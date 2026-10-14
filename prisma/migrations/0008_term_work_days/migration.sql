-- AlterTable
ALTER TABLE "AcademicTerm" ADD COLUMN     "workDays" INTEGER[] DEFAULT ARRAY[0, 1, 2, 3, 4]::INTEGER[];

