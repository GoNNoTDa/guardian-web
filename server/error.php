<?php
// Página unificada de errores HTTP para sec.fourmartech.es.
// Se activa desde .htaccess con ErrorDocument. Muestra un mensaje amable con
// la estética de Guardián Web y devuelve el código HTTP correcto.

$code = (int) ($_SERVER['REDIRECT_STATUS'] ?? ($_GET['code'] ?? 500));

$messages = [
    400 => ['Petición incorrecta', 'La solicitud no se entendió. Revisa los parámetros e inténtalo de nuevo.'],
    403 => ['Acceso denegado', 'No tienes permiso para ver este recurso.'],
    404 => ['Página no encontrada', 'La dirección que buscas no existe o se ha movido.'],
    405 => ['Método no permitido', 'Esa operación no está disponible en esta dirección.'],
    429 => ['Demasiadas peticiones', 'Has hecho muchas solicitudes en poco tiempo. Espera un momento.'],
    500 => ['Error del servidor', 'Algo ha fallado por nuestra parte. Inténtalo más tarde.'],
    503 => ['Servicio no disponible', 'Estamos en mantenimiento. Vuelve en unos minutos.'],
];

if (!isset($messages[$code])) {
    $code = 500;
}
[$title, $detail] = $messages[$code];

if (function_exists('http_response_code')) {
    http_response_code($code);
}
header('Content-Type: text/html; charset=utf-8');

$emoji = $code === 404 ? '🧭' : ($code === 403 ? '⛔' : ($code === 429 ? '⏳' : '🛠️'));
?>
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?= $code ?> · Guardián Web</title>
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E🛡️%3C/text%3E%3C/svg%3E">
  <style>
    :root { --green:#1e7e45; --ink:#17201b; --muted:#5b6b60; --bg:#f6f8f6; }
    @media (prefers-color-scheme: dark){ :root{ --ink:#e8efe9; --muted:#9fb0a4; --bg:#0f1512; } }
    * { box-sizing: border-box; }
    body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
      font: 17px/1.6 system-ui,-apple-system,sans-serif; color:var(--ink); background:var(--bg); text-align:center; padding:24px; }
    .box { max-width: 480px; }
    .emoji { font-size: 60px; }
    .code { font-size: 72px; font-weight: 800; color: var(--green); letter-spacing:-.03em; margin:4px 0; }
    h1 { font-size: 24px; margin: 0 0 8px; }
    p { color: var(--muted); margin: 0 0 28px; }
    a { display:inline-block; padding:12px 22px; border-radius:10px; background:var(--green); color:#fff; text-decoration:none; font-weight:600; }
    a:hover { opacity:.9; }
    .brand { margin-top: 32px; color: var(--muted); font-size: 14px; }
  </style>
</head>
<body>
  <div class="box">
    <div class="emoji"><?= $emoji ?></div>
    <div class="code"><?= $code ?></div>
    <h1><?= htmlspecialchars($title) ?></h1>
    <p><?= htmlspecialchars($detail) ?></p>
    <a href="/">Volver al inicio</a>
    <div class="brand">🛡️ Guardián Web</div>
  </div>
</body>
</html>
