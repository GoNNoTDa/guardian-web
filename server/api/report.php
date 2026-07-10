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

// Rate-limiting por instalación (24 h).
$rl = $pdo->prepare(
    'SELECT COUNT(*) FROM reports WHERE install_hash = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)'
);
$rl->execute([$ih]);
if ((int) $rl->fetchColumn() >= $c['rate_limit_per_day']) {
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
        'INSERT IGNORE INTO reports (domain_id, install_hash, score, detectors_json, created_at)
         VALUES (?, ?, ?, ?, NOW())'
    );
    $ins->execute([$did, $ih, $score, $detJson]);
    $isNew = $ins->rowCount() > 0;

    if ($isNew) {
        $agg = $pdo->prepare('SELECT COUNT(*) c, COALESCE(SUM(score), 0) s FROM reports WHERE domain_id = ?');
        $agg->execute([$did]);
        $a      = $agg->fetch();
        $count  = (int) $a['c'];
        $status = $count >= $c['validation_threshold'] ? 'validated' : 'pending';
        // No pisar un 'rejected' puesto a mano por un moderador.
        $pdo->prepare(
            'UPDATE domains SET report_count = ?, score_sum = ?, status = IF(status = \'rejected\', \'rejected\', ?) WHERE id = ?'
        )->execute([$count, (int) $a['s'], $status, $did]);
    }

    $pdo->commit();
    jsonOut(['ok' => true, 'duplicate' => !$isNew]);
} catch (Throwable $e) {
    $pdo->rollBack();
    jsonOut(['error' => 'server_error'], 500);
}
