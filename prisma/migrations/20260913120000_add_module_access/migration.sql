-- Whole-tab/module access control for the Admin Master
-- (src/lib/modules.ts) — three new tables, no existing table touched.
CREATE TYPE "ModuleStatus" AS ENUM ('ATIVA', 'EM_DESENVOLVIMENTO', 'BLOQUEADA');

CREATE TABLE "SystemModule" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ModuleStatus" NOT NULL DEFAULT 'ATIVA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemModule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SystemModule_key_key" ON "SystemModule"("key");

CREATE TABLE "ConsultantModuleAccess" (
    "id" TEXT NOT NULL,
    "consultorId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsultantModuleAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConsultantModuleAccess_consultorId_moduleId_key" ON "ConsultantModuleAccess"("consultorId", "moduleId");

CREATE INDEX "ConsultantModuleAccess_moduleId_idx" ON "ConsultantModuleAccess"("moduleId");

ALTER TABLE "ConsultantModuleAccess" ADD CONSTRAINT "ConsultantModuleAccess_consultorId_fkey" FOREIGN KEY ("consultorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConsultantModuleAccess" ADD CONSTRAINT "ConsultantModuleAccess_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "SystemModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ModuleAuditLog" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "consultorId" TEXT,
    "action" TEXT NOT NULL,
    "previousValue" JSONB,
    "newValue" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModuleAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ModuleAuditLog_moduleId_idx" ON "ModuleAuditLog"("moduleId");

CREATE INDEX "ModuleAuditLog_consultorId_idx" ON "ModuleAuditLog"("consultorId");

ALTER TABLE "ModuleAuditLog" ADD CONSTRAINT "ModuleAuditLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ModuleAuditLog" ADD CONSTRAINT "ModuleAuditLog_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "SystemModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ModuleAuditLog" ADD CONSTRAINT "ModuleAuditLog_consultorId_fkey" FOREIGN KEY ("consultorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
