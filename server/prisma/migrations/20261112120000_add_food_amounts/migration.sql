-- Additive only: existing saved foods become basis "serving", which is what they were.
-- Rollback: ALTER TABLE "MacroEntry" DROP COLUMN "amount", DROP COLUMN "unit";
--           ALTER TABLE "SavedFood" DROP COLUMN "basis", DROP COLUMN "servingG";

-- AlterTable
ALTER TABLE "MacroEntry" ADD COLUMN     "amount" DOUBLE PRECISION,
ADD COLUMN     "unit" TEXT;

-- AlterTable
ALTER TABLE "SavedFood" ADD COLUMN     "basis" TEXT NOT NULL DEFAULT 'serving',
ADD COLUMN     "servingG" DOUBLE PRECISION;

