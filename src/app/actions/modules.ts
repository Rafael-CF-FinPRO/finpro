"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { setModuleStatusSchema, setConsultorModuleAccessSchema } from "@/lib/validation";

/** Only the ADMIN Master manages module gating — see src/lib/modules.ts
 * for how these are read. Both actions are plain (formData) => void,
 * same shape as setConsultorStatusAction (src/app/actions/admin.ts):
 * a one-field form that submits itself, no error UI needed since a
 * validation failure here is a tampered request, not a normal user
 * mistake. */

export async function setModuleStatusAction(formData: FormData) {
  const session = await requireRole("ADMIN");

  const parsed = setModuleStatusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    throw new Error("Módulo ou status inválido.");
  }
  const { id, status } = parsed.data;

  const module_ = await prisma.systemModule.findUnique({ where: { id } });
  if (!module_) {
    throw new Error("Módulo não encontrado.");
  }

  await prisma.$transaction([
    prisma.systemModule.update({ where: { id }, data: { status } }),
    prisma.moduleAuditLog.create({
      data: {
        adminId: session.realUserId,
        moduleId: id,
        action: "module.setStatus",
        previousValue: { status: module_.status },
        newValue: { status },
      },
    }),
  ]);

  revalidatePath("/admin/modulos");
  revalidatePath(`/admin/modulos/${module_.key}`);
}

export async function setConsultorModuleAccessAction(formData: FormData) {
  const session = await requireRole("ADMIN");

  const parsed = setConsultorModuleAccessSchema.safeParse({
    moduleId: formData.get("moduleId"),
    consultorId: formData.get("consultorId"),
    isEnabled: formData.get("isEnabled"),
  });
  if (!parsed.success) {
    throw new Error("Módulo, consultor ou valor inválido.");
  }
  const { moduleId, consultorId, isEnabled } = parsed.data;

  const [module_, consultor, existing] = await Promise.all([
    prisma.systemModule.findUnique({ where: { id: moduleId } }),
    prisma.user.findUnique({ where: { id: consultorId }, select: { role: true } }),
    prisma.consultantModuleAccess.findUnique({
      where: { consultorId_moduleId: { consultorId, moduleId } },
    }),
  ]);
  if (!module_) throw new Error("Módulo não encontrado.");
  if (!consultor || consultor.role !== "CONSULTOR") throw new Error("Consultor não encontrado.");

  await prisma.$transaction([
    prisma.consultantModuleAccess.upsert({
      where: { consultorId_moduleId: { consultorId, moduleId } },
      update: { isEnabled, updatedBy: session.realUserId },
      create: { consultorId, moduleId, isEnabled, updatedBy: session.realUserId },
    }),
    prisma.moduleAuditLog.create({
      data: {
        adminId: session.realUserId,
        moduleId,
        consultorId,
        action: "module.setConsultorAccess",
        previousValue: { isEnabled: existing?.isEnabled ?? false },
        newValue: { isEnabled },
      },
    }),
  ]);

  revalidatePath(`/admin/modulos/${module_.key}`);
  revalidatePath("/admin/modulos");
}
