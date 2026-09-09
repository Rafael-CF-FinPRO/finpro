import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { ProfileScreen } from "@/components/profile/ProfileScreen";

export const metadata: Metadata = {
  title: "Meu Perfil | Consultor | FinPRO",
};

export default async function ConsultorPerfilPage() {
  const session = await requireRole("CONSULTOR");

  const user = await prisma.user.findUnique({
    where: { id: session.realUserId },
    select: { name: true, email: true, phone: true },
  });
  if (!user) return null;

  return <ProfileScreen user={user} />;
}
