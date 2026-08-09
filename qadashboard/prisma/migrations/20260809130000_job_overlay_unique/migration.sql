-- AlterTable
CREATE UNIQUE INDEX IF NOT EXISTS "Job_userId_originalId_key" ON "Job"("userId", "originalId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Job_userId_score_idx" ON "Job"("userId", "score");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Job_userId_status_idx" ON "Job"("userId", "status");
