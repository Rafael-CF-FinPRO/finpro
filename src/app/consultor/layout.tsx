import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { BackofficeShell } from "@/components/app/BackofficeShell";

const CONSULTOR_NAV_ITEMS = [
  { href: "/consultor", label: "Dashboard" },
  { href: "/consultor/clientes", label: "Clientes" },
];

export default async function ConsultorLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole("CONSULTOR");
  // realUserId, not userId — this chrome is the Consultor's own
  // environment, so it must show the Consultor's own name even if
  // they're mid-impersonation of a cliente elsewhere in the app (see
  // src/lib/session.ts's EffectiveSession.userId doc comment).
  const user = await prisma.user.findUnique({
    where: { id: session.realUserId },
    select: { name: true },
  });

  return (
    <BackofficeShell roleLabel="Consultor" navItems={CONSULTOR_NAV_ITEMS} userName={user?.name ?? ""}>
      {children}
    </BackofficeShell>
  );
}
