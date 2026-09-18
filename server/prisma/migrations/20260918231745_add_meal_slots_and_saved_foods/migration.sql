-- AlterTable
ALTER TABLE "MacroEntry" ADD COLUMN     "mealName" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mealNames" TEXT[] DEFAULT ARRAY['Breakfast', 'Lunch', 'Dinner']::TEXT[];

-- CreateTable
CREATE TABLE "SavedFood" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "calories" INTEGER NOT NULL,
    "proteinG" DOUBLE PRECISION,
    "carbsG" DOUBLE PRECISION,
    "fatG" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedFood_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SavedFood_userId_name_key" ON "SavedFood"("userId", "name");

-- AddForeignKey
ALTER TABLE "SavedFood" ADD CONSTRAINT "SavedFood_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ROLLBACK (manual — Prisma has no down-migrations). Purely additive, so this
-- only discards meal slots / saved foods created since; existing data is untouched:
--   DROP TABLE "SavedFood";
--   ALTER TABLE "MacroEntry" DROP COLUMN "mealName";
--   ALTER TABLE "User" DROP COLUMN "mealNames";
