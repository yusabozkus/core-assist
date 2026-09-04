DO $$
BEGIN
  CREATE TYPE "AiTone" AS ENUM ('PROFESSIONAL', 'FRIENDLY', 'WARM', 'MINIMAL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "AiResponseLength" AS ENUM ('SHORT', 'BALANCED', 'DETAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "AiEmojiPolicy" AS ENUM ('NEVER', 'WHEN_APPROPRIATE', 'ALWAYS');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "store_knowledge_profile" (
  "storeId" TEXT NOT NULL,
  "brandDescription" TEXT,
  "shippingPolicy" TEXT,
  "returnPolicy" TEXT,
  "exchangePolicy" TEXT,
  "warrantyPolicy" TEXT,
  "additionalInformation" TEXT,
  "tone" "AiTone" NOT NULL DEFAULT 'PROFESSIONAL',
  "responseLength" "AiResponseLength" NOT NULL DEFAULT 'BALANCED',
  "greetingEnabled" BOOLEAN NOT NULL DEFAULT true,
  "closingEnabled" BOOLEAN NOT NULL DEFAULT true,
  "emojiPolicy" "AiEmojiPolicy" NOT NULL DEFAULT 'NEVER',
  "preferredEmoji" TEXT,
  "emojiEnabled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "store_knowledge_profile_pkey" PRIMARY KEY ("storeId")
);

CREATE TABLE IF NOT EXISTS "store_knowledge_faq" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "answer" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "store_knowledge_faq_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "store_ai_instruction" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "store_ai_instruction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "channel_knowledge_override" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "providerKey" TEXT NOT NULL,
  "shippingPolicy" TEXT,
  "returnPolicy" TEXT,
  "exchangePolicy" TEXT,
  "warrantyPolicy" TEXT,
  "additionalInformation" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "channel_knowledge_override_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "store_knowledge_faq_storeId_active_position_idx"
ON "store_knowledge_faq"("storeId", "active", "position");

CREATE INDEX IF NOT EXISTS "store_ai_instruction_storeId_active_priority_idx"
ON "store_ai_instruction"("storeId", "active", "priority");

CREATE UNIQUE INDEX IF NOT EXISTS "channel_knowledge_override_storeId_providerKey_key"
ON "channel_knowledge_override"("storeId", "providerKey");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'store_knowledge_profile_storeId_fkey'
  ) THEN
    ALTER TABLE "store_knowledge_profile"
    ADD CONSTRAINT "store_knowledge_profile_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "store"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'store_knowledge_faq_storeId_fkey'
  ) THEN
    ALTER TABLE "store_knowledge_faq"
    ADD CONSTRAINT "store_knowledge_faq_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "store"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'store_ai_instruction_storeId_fkey'
  ) THEN
    ALTER TABLE "store_ai_instruction"
    ADD CONSTRAINT "store_ai_instruction_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "store"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'channel_knowledge_override_storeId_fkey'
  ) THEN
    ALTER TABLE "channel_knowledge_override"
    ADD CONSTRAINT "channel_knowledge_override_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "store"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

