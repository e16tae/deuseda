-- Remove TOTP secret column and add password hash
ALTER TABLE users DROP COLUMN IF EXISTS totp_secret;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) NOT NULL DEFAULT '';
