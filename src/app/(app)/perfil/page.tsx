import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ProfileScreen } from "@/components/profile/ProfileScreen";

export const metadata: Metadata = {
  title: "Meu Perfil | FinPRO",
};

export default async function PerfilPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  // realUserId, not userId — this is always the actually logged-in
  // person's own profile, even mid-impersonation (see src/app/actions/profile.ts).
  const user = await prisma.user.findUnique({
    where: { id: session.realUserId },
    select: { name: true, email: true, phone: true },
  });
  if (!user) redirect("/login");

  return <ProfileScreen user={user} />;
}
