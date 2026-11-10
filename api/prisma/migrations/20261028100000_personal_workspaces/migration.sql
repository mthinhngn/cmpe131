CREATE TABLE "PersonalWorkspace" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "version" INTEGER NOT NULL DEFAULT 0,
  "state" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "PersonalOperation" (
  "workspaceId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "before" JSONB NOT NULL,
  "result" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("workspaceId", "requestId"),
  CONSTRAINT "PersonalOperation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "PersonalWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "PersonalOperation_workspaceId_createdAt_idx" ON "PersonalOperation"("workspaceId", "createdAt");
