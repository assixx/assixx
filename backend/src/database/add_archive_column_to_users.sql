-- Füge is_archived Spalte zur Tabelle users hinzu
ALTER TABLE users ADD COLUMN is_archived BOOLEAN DEFAULT false AFTER status;

-- Kommentar für die neue Spalte hinzufügen
ALTER TABLE users MODIFY COLUMN is_archived BOOLEAN DEFAULT false COMMENT 'Gibt an, ob der Benutzer archiviert wurde';

-- Indexe für performantere Suche hinzufügen
CREATE INDEX idx_users_is_archived ON users(is_archived);
CREATE INDEX idx_users_status_archived ON users(status, is_archived);