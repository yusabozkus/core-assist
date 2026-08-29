-- Preserve existing channel values while replacing the closed provider enum
-- with an extensible provider key column.
ALTER TABLE "channel_connection"
ALTER COLUMN "provider" TYPE TEXT
USING "provider"::TEXT;
