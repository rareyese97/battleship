-- AlterTable
ALTER TABLE "User" ADD COLUMN     "resetSentAt" TIMESTAMP(3),
ADD COLUMN     "resetToken" TEXT;
