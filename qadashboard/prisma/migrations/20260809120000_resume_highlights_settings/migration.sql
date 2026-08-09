-- AlterTable
ALTER TABLE "Resume" ADD COLUMN "highlights" TEXT;

-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN "emailTemplate" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Resume_userId_key" ON "Resume"("userId");
