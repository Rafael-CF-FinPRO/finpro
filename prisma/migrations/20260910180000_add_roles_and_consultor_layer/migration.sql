-- Adds the multiuser layer on top of the existing single-tenant model:
-- three roles (ADMIN/CONSULTOR/CLIENTE), a self-relation modeling each
-- CONSULTOR's own portfolio of CLIENTE accounts, and an AuditLog table
-- for actions a CONSULTOR/ADMIN takes while impersonating a CLIENTE.
--
-- Every new User column is either NOT NULL with a default (role
-- defaults to CLIENTE — every existing account becomes a CLIENTE with
-- zero behavior change, isActive defaults to true) or nullable
-- (lastLoginAt, consultorId) — a pure additive change, no existing row
-- loses data and no existing query is affected.
CREATE TYPE "Role" AS ENUM ('ADMIN', 'CONSULTOR', 'CLIENTE');

ALTER TABLE "User" ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'CLIENTE',
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "consultorId" TEXT;

CREATE INDEX "User_consultorId_idx" ON "User"("consultorId");

ALTER TABLE "User" ADD CONSTRAINT "User_consultorId_fkey" FOREIGN KEY ("consultorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "consultorId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "previousValue" JSONB,
    "newValue" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_consultorId_idx" ON "AuditLog"("consultorId");

CREATE INDEX "AuditLog_clienteId_idx" ON "AuditLog"("clienteId");

ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_consultorId_fkey" FOREIGN KEY ("consultorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
