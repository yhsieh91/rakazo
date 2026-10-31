-- Additive: older releases never read or write it.
ALTER TABLE "threads" ADD COLUMN "jailbreakEnabled" BOOLEAN NOT NULL DEFAULT false;
