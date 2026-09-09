import type { Metadata } from "next";
import { requireRole } from "@/lib/rbac";
import { getAdminDashboardCounts } from "@/lib/admin";
import { StatCard } from "@/components/app/StatCard";

export const metadata: Metadata = {
  title: "Dashboard | Admin | FinPRO",
};

export default async function AdminDashboardPage() {
  await requireRole("ADMIN");
  const counts = await getAdminDashboardCounts();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Dashboard</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">Visão geral da estrutura da plataforma.</p>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Consultores" value={counts.totalConsultores} href="/admin/consultores" />
        <StatCard
          label="Consultores Ativos"
          value={counts.consultoresAtivos}
          href="/admin/consultores"
          tone="success"
        />
        <StatCard label="Clientes" value={counts.totalClientes} href="/admin/clientes" />
        <StatCard
          label="Clientes Ativos"
          value={counts.clientesAtivos}
          href="/admin/clientes?filtro=ativos"
          tone="success"
        />
        <StatCard
          label="Clientes Inativos"
          value={counts.clientesInativos}
          href="/admin/clientes?filtro=inativos"
          tone="warning"
        />
      </div>
    </div>
  );
}
