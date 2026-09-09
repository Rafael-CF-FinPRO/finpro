"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { hashPassword, verifyPassword } from "@/lib/password";
import { updateProfileSchema, changePasswordSchema } from "@/lib/validation";

export type ProfileActionState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
};

/** "Meu Perfil" — self-service only. Always reads/writes
 * `session.realUserId`, never `session.userId`: while a CONSULTOR/ADMIN
 * is impersonating a CLIENTE, `userId` resolves to the cliente being
 * impersonated (see src/lib/session.ts), but this screen is about the
 * actually logged-in person's own account, exactly like BackofficeShell
 * already treats "my own identity". */
export async function updateProfileAction(
  _prevState: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const parsed = updateProfileSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
  });
  if (!parsed.success) {
    return {
      error: "Verifique os campos informados.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  await prisma.user.update({
    where: { id: session.realUserId },
    data: { name: parsed.data.name, phone: parsed.data.phone || null },
  });

  revalidatePath("/perfil");
  revalidatePath("/consultor/perfil");
  revalidatePath("/admin/perfil");
  return { success: true };
}

export async function changePasswordAction(
  _prevState: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmNewPassword: formData.get("confirmNewPassword"),
  });
  if (!parsed.success) {
    return {
      error: "Verifique os campos informados.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const user = await prisma.user.findUnique({ where: { id: session.realUserId } });
  if (!user) redirect("/login");

  const isValid = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
  if (!isValid) {
    return {
      error: "Senha atual incorreta.",
      fieldErrors: { currentPassword: ["Senha atual incorreta."] },
    };
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await prisma.user.update({ where: { id: session.realUserId }, data: { passwordHash } });

  return { success: true };
}
