-- Migración para bases creadas con el schema.sql anterior a octubre de 2026.
-- Añade el hash de red a los reportes y el recuento de redes a los dominios,
-- que es lo que ahora decide la validación automática.
--
--   mysql -u USUARIO -p BASE < migrations/2026-10-network-hash.sql
--
-- Los reportes ya existentes se quedan sin red (NULL): no hay forma de saberla
-- a posteriori. report.php cuenta cada uno de ellos como una red propia, igual
-- que contaban antes, así que ningún dominio cambia de estado por migrar.

ALTER TABLE reports
  ADD COLUMN net_hash CHAR(64) NULL AFTER install_hash,
  ADD KEY idx_net_time (net_hash, created_at);

ALTER TABLE domains
  ADD COLUMN network_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER report_count;

UPDATE domains SET network_count = report_count;
