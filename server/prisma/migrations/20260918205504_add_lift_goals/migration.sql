-- CreateTable
CREATE TABLE "LiftGoal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "exerciseName" TEXT NOT NULL,
    "goalKg" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "LiftGoal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LiftGoal_userId_exerciseName_key" ON "LiftGoal"("userId", "exerciseName");

-- AddForeignKey
ALTER TABLE "LiftGoal" ADD CONSTRAINT "LiftGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: copy each existing per-lift goal column into a row. A NULL column
-- (goal never set) yields no row. ON CONFLICT DO NOTHING makes this safe to
-- re-run: the unique index turns a repeat into a no-op instead of a duplicate.
-- The old columns are deliberately left in place — see ROLLBACK below.
INSERT INTO "LiftGoal" ("id", "userId", "exerciseName", "goalKg")
SELECT gen_random_uuid()::text, "id", 'Deadlift', "deadliftGoalKg" FROM "User" WHERE "deadliftGoalKg" IS NOT NULL
ON CONFLICT ("userId", "exerciseName") DO NOTHING;

INSERT INTO "LiftGoal" ("id", "userId", "exerciseName", "goalKg")
SELECT gen_random_uuid()::text, "id", 'Squat', "squatGoalKg" FROM "User" WHERE "squatGoalKg" IS NOT NULL
ON CONFLICT ("userId", "exerciseName") DO NOTHING;

INSERT INTO "LiftGoal" ("id", "userId", "exerciseName", "goalKg")
SELECT gen_random_uuid()::text, "id", 'Bench Press', "benchPressGoalKg" FROM "User" WHERE "benchPressGoalKg" IS NOT NULL
ON CONFLICT ("userId", "exerciseName") DO NOTHING;

INSERT INTO "LiftGoal" ("id", "userId", "exerciseName", "goalKg")
SELECT gen_random_uuid()::text, "id", 'Overhead Press', "overheadPressGoalKg" FROM "User" WHERE "overheadPressGoalKg" IS NOT NULL
ON CONFLICT ("userId", "exerciseName") DO NOTHING;

-- ROLLBACK (Prisma has no down-migrations, so this is manual). Until the old
-- columns are dropped, rolling back is: revert the code, then optionally copy
-- any goals edited AFTER the switch back into the columns:
--
--   UPDATE "User" u SET "deadliftGoalKg" = g."goalKg" FROM "LiftGoal" g
--     WHERE g."userId" = u."id" AND g."exerciseName" = 'Deadlift';
--   (repeat for 'Squat' -> "squatGoalKg", 'Bench Press' -> "benchPressGoalKg",
--    'Overhead Press' -> "overheadPressGoalKg")
--   DROP TABLE "LiftGoal";
