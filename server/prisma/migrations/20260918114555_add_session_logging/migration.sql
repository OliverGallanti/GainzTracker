-- AlterTable
ALTER TABLE "SplitLog" ADD COLUMN     "durationMinutes" INTEGER;

-- AlterTable
ALTER TABLE "WorkoutSet" ADD COLUMN     "splitLogId" TEXT;

-- CreateIndex
CREATE INDEX "WorkoutSet_splitLogId_idx" ON "WorkoutSet"("splitLogId");

-- AddForeignKey
ALTER TABLE "WorkoutSet" ADD CONSTRAINT "WorkoutSet_splitLogId_fkey" FOREIGN KEY ("splitLogId") REFERENCES "SplitLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
