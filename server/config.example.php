<?php
// Copia este archivo a config.php y rellena tus valores. config.php NO se
// sube al repo (está en .gitignore) y el servidor web debe denegar su acceso
// público (ver .htaccess).

return [
    'db' => [
        'host'    => 'localhost',
        'name'    => 'guardian',
        'user'    => 'guardian',
        'pass'    => 'CAMBIA_ESTA_CONTRASENA',
        'charset' => 'utf8mb4',
    ],

    // Cadena larga y aleatoria. Se usa para hashear el UUID de instalación:
    // así, aunque se filtrara la base de datos, no se podría revertir a UUIDs.
    'pepper' => 'CAMBIA_ESTO_POR_UNA_CADENA_LARGA_Y_ALEATORIA',

    // Nº de REDES distintas (IPv4 /24, IPv6 /48) que deben reportar un dominio
    // para que pase de 'pending' a 'validated' (y la extensión lo marque como
    // conocido). Se cuentan redes y no instalaciones porque el installId lo
    // genera el cliente: cualquiera puede inventarse cien.
    'validation_threshold' => 5,

    // false = nada se valida solo; cada dominio lo valida un moderador en
    // /admin. Recomendable mientras la comunidad sea pequeña.
    'auto_validate' => true,

    // Máximo de reportes cada 24 h por instalación y por red (anti-abuso).
    'rate_limit_per_day' => 20,
    'rate_limit_per_network_day' => 30,

    // Token para el panel de moderación (/admin). Cadena larga y secreta.
    'admin_token' => 'CAMBIA_ESTE_TOKEN_DE_ADMIN',

    // Origen permitido por CORS. "*" para pruebas; en producción, mejor la
    // id de tu extensión: "chrome-extension://<tu-id>".
    'allow_origin' => '*',
];
