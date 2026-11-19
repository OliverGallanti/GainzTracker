-- An icon per routine day name, next to dayColors. Expand only.
-- Roll back: ALTER TABLE "WorkoutSplit" DROP COLUMN "dayIcons";
ALTER TABLE "WorkoutSplit" ADD COLUMN "dayIcons" JSONB;
