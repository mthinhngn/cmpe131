ALTER TABLE "User" ADD COLUMN "googleSubject" TEXT;
CREATE UNIQUE INDEX "User_googleSubject_key" ON "User"("googleSubject");

CREATE TABLE "GoogleLoginAttempt" (
    "stateHash" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "verifier" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GoogleLoginAttempt_pkey" PRIMARY KEY ("stateHash")
);
CREATE INDEX "GoogleLoginAttempt_expiresAt_idx" ON "GoogleLoginAttempt"("expiresAt");
