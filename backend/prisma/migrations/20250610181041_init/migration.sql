-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "verifySentAt" TIMESTAMP(3),
ADD COLUMN     "verifyToken" TEXT;
