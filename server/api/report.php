<?php
// POST /api/report.php
// Body JSON: { installId, domain, score, detectors: [] }
// Registra un reporte (1 por instalación y dominio) y recalcula el estado.

require __DIR__ . '/../lib/helpers.php';
require __DIR__ . '/../lib/db.php';
cors();

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    jsonOut(['error' => 'method_not_allowed'], 405);
}

$in        = jsonBody();
$domain    = normDomain((string) ($in['domain'] ?? ''));
$install   = trim((string) ($in['installId'] ?? ''));
$score     = (int) ($in['score'] ?? 0);
$detectors = is_array($in['detectors'] ?? null) ? $in['detectors'] : [];

if (!validDomain($domain) || strlen($install) < 8) {
    jsonOut(['error' => 'invalid_input'], 400);
}
$score = max(0, min(1000, $score));

$c    = cfg();
$pdo  = db();
$ih   = installHash($install);
$net  = clientNetwork();
if ($net === '') {
    jsonOut(['error' => 'invalid_input'], 400);
}
$nh = networkHash($net);

// Rate-limiting por instalación y por red (24 h). El de red es el que de
// verdad frena: inventarse installIds es gratis.
$rl = $pdo->prepare(
    'SELECT
       SUM(install_hash = ?) AS by_install,
       SUM(net_hash = ?)     AS by_network
     FROM reports
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY) AND (install_hash = ? OR net_hash = ?)'
);
$rl->execute([$ih, $nh, $ih, $nh]);
$used = $rl->fetch();
if ((int) $used['by_install'] >= $c['rate_limit_per_day']
    || (int) $used['by_network'] >= ($c['rate_limit_per_network_day'] ?? 30)) {
    jsonOut(['error' => 'rate_limited'], 429);
}

$dh       = domainHash($domain);
$prefix   = substr($dh, 0, 4);
$detClean = array_slice(array_values(array_unique(array_map('strval', $detectors))), 0, 30);
$detJson  = json_encode($detClean);

$pdo->beginTransaction();
try {
    // Alta o toque del dominio.
    $pdo->prepare(
        'INSERT INTO domains (domain, domain_hash, hash_prefix, detectors_json, status, first_reported, last_reported)
         VALUES (?, ?, ?, ?, \'pending\', NOW(), NOW())
         ON DUPLICATE KEY UPDATE last_reported = NOW(), detectors_json = VALUES(detectors_json)'
    )->execute([$domain, $dh, $prefix, $detJson]);

    $did = (int) $pdo->query('SELECT id FROM domains WHERE domain = ' . $pdo->quote($domain))->fetchColumn();

    // Reporte único por (dominio, instalación).
    $ins = $pdo->prepare(
        'INSERT IGNORE INTO reports (domain_id, install_hash, net_hash, score, detectors_json, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())'
    );
    $ins->execute([$did, $ih, $nh, $score, $detJson]);
    $isNew = $ins->rowCount() > 0;

    if ($isNew) {
        $agg = $pdo->prepare(
            // Los reportes anteriores a la migración no tienen red: cada uno
            // cuenta como una red propia, igual que contaban antes.
            'SELECT COUNT(*) c, COUNT(DISTINCT COALESCE(net_hash, CONCAT(\'legacy:\', id))) n,
                    COALESCE(SUM(score), 0) s
             FROM reports WHERE domain_id = ?'
        );
        $agg->execute([$did]);
        $a        = $agg->fetch();
        $networks = (int) $a['n'];
        // Se valida por REDES distintas, no por instalaciones: cien UUIDs desde
        // la misma conexión cuentan como uno. Con auto_validate = false solo
        // valida un moderador.
        $promote = ($c['auto_validate'] ?? true) && $networks >= $c['validation_threshold'];
        // Solo se sube de 'pending' a 'validated': nunca se pisa lo que haya
        // decidido a mano un moderador (ni un 'rejected' ni un 'validated').
        $pdo->prepare(
            'UPDATE domains SET report_count = ?, network_count = ?, score_sum = ?,
               status = IF(status = \'pending\' AND ?, \'validated\', status)
             WHERE id = ?'
        )->execute([(int) $a['c'], $networks, (int) $a['s'], $promote ? 1 : 0, $did]);
    }

    $pdo->commit();
    jsonOut(['ok' => true, 'duplicate' => !$isNew]);
} catch (Throwable $e) {
    $pdo->rollBack();
    jsonOut(['error' => 'server_error'], 500);
}
