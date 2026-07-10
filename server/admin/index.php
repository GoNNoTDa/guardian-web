<?php
// Panel de moderación mínimo. Protegido por token (?token=...).
// Permite validar/rechazar dominios manualmente y ver el estado.

require __DIR__ . '/../lib/helpers.php';
require __DIR__ . '/../lib/db.php';

$c     = cfg();
$token = (string) ($_REQUEST['token'] ?? '');
if (!hash_equals($c['admin_token'], $token)) {
    http_response_code(403);
    echo 'Acceso denegado.';
    exit;
}

$pdo = db();

// Acción de moderación.
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    $id     = (int) ($_POST['id'] ?? 0);
    $action = (string) ($_POST['action'] ?? '');
    if ($id && in_array($action, ['validated', 'rejected', 'pending'], true)) {
        $pdo->prepare('UPDATE domains SET status = ? WHERE id = ?')->execute([$action, $id]);
    }
    header('Location: index.php?token=' . urlencode($token));
    exit;
}

$rows = $pdo->query(
    'SELECT id, domain, report_count, status, last_reported FROM domains ORDER BY last_reported DESC LIMIT 300'
)->fetchAll();

function h($s) { return htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8'); }
$t = h($token);
?>
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Guardián Web — Moderación</title>
  <style>
    body { font: 14px/1.5 system-ui, sans-serif; max-width: 900px; margin: 30px auto; padding: 0 16px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 6px 10px; text-align: left; }
    th { background: #f5f5f5; }
    .validated { color: #1e7e45; font-weight: 600; }
    .pending { color: #a85a13; }
    .rejected { color: #b0281a; }
    button { font: inherit; padding: 3px 8px; cursor: pointer; }
  </style>
</head>
<body>
  <h1>🛡️ Moderación — Guardián Web</h1>
  <p>Umbral de validación automática: <b><?= (int) $c['validation_threshold'] ?></b> reportes.</p>
  <table>
    <tr><th>Dominio</th><th>Reportes</th><th>Estado</th><th>Último</th><th>Acciones</th></tr>
    <?php foreach ($rows as $r): ?>
      <tr>
        <td><?= h($r['domain']) ?></td>
        <td><?= (int) $r['report_count'] ?></td>
        <td class="<?= h($r['status']) ?>"><?= h($r['status']) ?></td>
        <td><?= h($r['last_reported']) ?></td>
        <td>
          <form method="post" style="display:inline">
            <input type="hidden" name="token" value="<?= $t ?>">
            <input type="hidden" name="id" value="<?= (int) $r['id'] ?>">
            <button name="action" value="validated">✔ Validar</button>
            <button name="action" value="rejected">✖ Rechazar</button>
            <button name="action" value="pending">↺ Pendiente</button>
          </form>
        </td>
      </tr>
    <?php endforeach; ?>
  </table>
</body>
</html>
