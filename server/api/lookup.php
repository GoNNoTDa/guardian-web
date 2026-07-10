<?php
// GET /api/lookup.php?prefix=abcd
// Devuelve TODOS los dominios validados cuyo hash empieza por ese prefijo de
// 4 hex. La extensión envía solo el prefijo (k-anonimato): el servidor nunca
// sabe qué dominio exacto está mirando el usuario. La extensión compara en
// local el hash completo de su dominio contra los devueltos.

require __DIR__ . '/../lib/helpers.php';
require __DIR__ . '/../lib/db.php';
cors();

$prefix = strtolower(preg_replace('/[^0-9a-f]/', '', (string) ($_GET['prefix'] ?? '')));
if (strlen($prefix) < 4) {
    jsonOut(['error' => 'invalid_prefix'], 400);
}
$prefix = substr($prefix, 0, 4);

$pdo  = db();
$stmt = $pdo->prepare(
    "SELECT domain_hash, report_count, score_sum, detectors_json
     FROM domains
     WHERE hash_prefix = ? AND status = 'validated'
     LIMIT 500"
);
$stmt->execute([$prefix]);

$matches = [];
foreach ($stmt as $r) {
    $count = (int) $r['report_count'];
    $matches[] = [
        'h'     => $r['domain_hash'],                                   // hash completo (no el dominio en claro)
        'n'     => $count,                                              // nº de reportes
        'score' => $count > 0 ? intdiv((int) $r['score_sum'], $count) : 0,
        'd'     => json_decode($r['detectors_json'] ?: '[]'),           // detectores agregados
    ];
}

jsonOut(['prefix' => $prefix, 'matches' => $matches]);
