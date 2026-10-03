-- Keep account records compatible with providers that omit a display name.
ALTER TABLE "User" ALTER COLUMN "username" DROP NOT NULL;

-- Conversations need timestamps for stable history ordering and updates.
ALTER TABLE "Conversation"
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Enforce the same cascades declared by the Prisma relations.
ALTER TABLE "Conversation" DROP CONSTRAINT "Conversation_userId_fkey";
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Message" DROP CONSTRAINT "Message_conversationId_fkey";
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

