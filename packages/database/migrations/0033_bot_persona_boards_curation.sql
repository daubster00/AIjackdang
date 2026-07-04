ALTER TABLE "bot_persona_boards" ADD COLUMN IF NOT EXISTS "curation_enabled" boolean NOT NULL DEFAULT false;
ALTER TABLE "bot_persona_boards" ADD COLUMN IF NOT EXISTS "curation_weights" jsonb;
