import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { homeForRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Sidebar, MobileNav } from "@/components/app/Sidebar";
import { Topbar } from "@/components/app/Topbar";
import { ImpersonationBanner } from "@/components/app/ImpersonationBanner";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  // A CONSULTOR/ADMIN only ever lands here while actively impersonating
  // a cliente (see the "Entrar" flow, src/app/actions/consultor.ts) —
  // hitting one of these URLs directly, without impersonating anyone,
  // sends them to their own home instead of a CLIENTE's dashboard. A
  // CLIENTE's own request is completely unaffected by this check.
  if (session.role !== "CLIENTE" && !session.isImpersonating) {
    redirect(homeForRole(session.role));
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { name: true, email: true },
  });

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)]">
      {session.isImpersonating && session.impersonatedClientName && (
        <ImpersonationBanner clientName={session.impersonatedClientName} />
      )}
      <div className="flex min-h-0 flex-1">
        <Sidebar userName={user.name} userEmail={user.email} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar userName={user.name} userEmail={user.email} />
          <MobileNav />
          <main className="flex-1 p-4 md:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
