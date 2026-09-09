import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { BackofficeShell } from "@/components/app/BackofficeShell";

const ADMIN_NAV_ITEMS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/consultores", label: "Consultores" },
  { href: "/admin/clientes", label: "Clientes" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole("ADMIN");
  // realUserId, not userId — see src/app/consultor/layout.tsx for why.
  const user = await prisma.user.findUnique({
    where: { id: session.realUserId },
    select: { name: true },
  });

  return (
    <BackofficeShell
      roleLabel="Administrador"
      navItems={ADMIN_NAV_ITEMS}
      userName={user?.name ?? ""}
      profileHref="/admin/perfil"
    >
      {children}
    </BackofficeShell>
  );
}
