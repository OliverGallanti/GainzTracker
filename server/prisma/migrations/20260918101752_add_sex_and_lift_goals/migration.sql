-- AlterTable
ALTER TABLE "User" ADD COLUMN     "benchPressGoalKg" DOUBLE PRECISION,
ADD COLUMN     "deadliftGoalKg" DOUBLE PRECISION,
ADD COLUMN     "overheadPressGoalKg" DOUBLE PRECISION,
ADD COLUMN     "sex" TEXT,
ADD COLUMN     "squatGoalKg" DOUBLE PRECISION;
