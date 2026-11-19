-- A colour per routine day name, for the training calendar. Expand only.
-- Roll back: ALTER TABLE "WorkoutSplit" DROP COLUMN "dayColors";
ALTER TABLE "WorkoutSplit" ADD COLUMN "dayColors" JSONB;
