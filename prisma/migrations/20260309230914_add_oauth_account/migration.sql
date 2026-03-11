-- CreateTable
CREATE TABLE "oauth_account" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_account_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "oauth_account_userId_idx" ON "oauth_account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_account_provider_providerAccountId_key" ON "oauth_account"("provider", "providerAccountId");

-- AddForeignKey
ALTER TABLE "oauth_account" ADD CONSTRAINT "oauth_account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
