-- Replaces the boolean "isActive" with a 3-state "status"
-- (ATIVO/INATIVO/BLOQUEADO) available to every role. Preserves the
-- current state of every existing row: isActive=true -> ATIVO (the
-- column default, so every unaffected row gets it automatically),
-- isActive=false -> INATIVO — nobody who could log in before loses
-- access, and nobody already deactivated becomes reachable again.
CREATE TYPE "UserStatus" AS ENUM ('ATIVO', 'INATIVO', 'BLOQUEADO');

ALTER TABLE "User" ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'ATIVO';

UPDATE "User" SET "status" = 'INATIVO' WHERE "isActive" = false;

ALTER TABLE "User" DROP COLUMN "isActive";
