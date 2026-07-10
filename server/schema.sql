-- Guardián Web — esquema de la base de datos de reputación colaborativa.
-- MySQL 5.7+ / MariaDB 10.2+. Cotejo utf8mb4 para dominios internacionalizados.

CREATE TABLE IF NOT EXISTS domains (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  domain         VARCHAR(255) NOT NULL,
  domain_hash    CHAR(64)     NOT NULL,               -- SHA-256 hex del dominio normalizado
  hash_prefix    CHAR(4)      NOT NULL,               -- primeros 4 hex (bucket de k-anonimato)
  report_count   INT UNSIGNED NOT NULL DEFAULT 0,     -- nº de instalaciones distintas que lo reportan
  score_sum      INT UNSIGNED NOT NULL DEFAULT 0,     -- suma de puntuaciones (para la media)
  detectors_json TEXT         NULL,                   -- detectores agregados más frecuentes
  status         ENUM('pending','validated','rejected') NOT NULL DEFAULT 'pending',
  first_reported DATETIME     NOT NULL,
  last_reported  DATETIME     NOT NULL,
  UNIQUE KEY uq_domain (domain),
  KEY idx_prefix_status (hash_prefix, status),
  KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS reports (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  domain_id      INT UNSIGNED    NOT NULL,
  install_hash   CHAR(64)        NOT NULL,            -- SHA-256(uuid + pepper): nunca se guarda el UUID en claro
  score          SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  detectors_json TEXT            NULL,
  created_at     DATETIME        NOT NULL,
  UNIQUE KEY uq_install_domain (domain_id, install_hash),  -- 1 reporte por instalación y dominio
  KEY idx_install_time (install_hash, created_at),         -- para el rate-limiting
  CONSTRAINT fk_reports_domain FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
