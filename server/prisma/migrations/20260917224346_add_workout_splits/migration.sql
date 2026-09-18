-- CreateTable
CREATE TABLE "WorkoutSplit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "days" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkoutSplit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SplitLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "splitId" TEXT NOT NULL,
    "dayIndex" INTEGER NOT NULL,
    "completed" BOOLEAN NOT NULL,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SplitLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkoutSplit_userId_idx" ON "WorkoutSplit"("userId");

-- CreateIndex
CREATE INDEX "SplitLog_userId_loggedAt_idx" ON "SplitLog"("userId", "loggedAt");

-- CreateIndex
CREATE INDEX "SplitLog_splitId_loggedAt_idx" ON "SplitLog"("splitId", "loggedAt");

-- AddForeignKey
ALTER TABLE "WorkoutSplit" ADD CONSTRAINT "WorkoutSplit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SplitLog" ADD CONSTRAINT "SplitLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SplitLog" ADD CONSTRAINT "SplitLog_splitId_fkey" FOREIGN KEY ("splitId") REFERENCES "WorkoutSplit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
