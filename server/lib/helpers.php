<?php
// Utilidades compartidas por los endpoints.

function cfg(): array
{
    static $c = null;
    if ($c === null) {
        $path = __DIR__ . '/../config.php';
        if (!is_file($path)) {
            http_response_code(500);
            echo json_encode(['error' => 'config_missing']);
            exit;
        }
        $c = require $path;
    }
    return $c;
}

function cors(): void
{
    $c = cfg();
    header('Access-Control-Allow-Origin: ' . $c['allow_origin']);
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Vary: Origin');
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

function jsonOut($data, int $code = 200): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data);
    exit;
}

function jsonBody(): array
{
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

// Normaliza a un dominio comparable: minúsculas, sin esquema, sin ruta, sin www.
function normDomain(string $d): string
{
    $d = strtolower(trim($d));
    $d = preg_replace('#^[a-z]+://#', '', $d);
    $d = explode('/', $d)[0];
    $d = explode(':', $d)[0]; // fuera el puerto
    $d = preg_replace('/^www\./', '', $d);
    return $d;
}

function validDomain(string $d): bool
{
    return $d !== '' && strlen($d) <= 255 && (bool) preg_match('/^[a-z0-9.-]+\.[a-z]{2,}$/', $d);
}

function domainHash(string $d): string
{
    return hash('sha256', $d);
}

// El UUID de instalación se hashea con pepper: la BD nunca ve el UUID real.
function installHash(string $id): string
{
    return hash('sha256', $id . '|' . cfg()['pepper']);
}
