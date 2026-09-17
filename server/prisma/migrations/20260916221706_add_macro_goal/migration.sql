-- CreateTable
CREATE TABLE "MacroGoal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "proteinG" DOUBLE PRECISION NOT NULL,
    "fatG" DOUBLE PRECISION NOT NULL,
    "carbsG" DOUBLE PRECISION NOT NULL,
    "calorieTarget" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MacroGoal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MacroGoal_userId_key" ON "MacroGoal"("userId");

-- AddForeignKey
ALTER TABLE "MacroGoal" ADD CONSTRAINT "MacroGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
