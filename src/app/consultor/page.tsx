import type { Metadata } from "next";
import { requireRole } from "@/lib/rbac";
import { getClientRows } from "@/lib/consultor";
import { StatCard } from "@/components/app/StatCard";

export const metadata: Metadata = {
  title: "Dashboard | Consultor | FinPRO",
};

export default async function ConsultorDashboardPage() {
  const session = await requireRole("CONSULTOR");
  const clientes = await getClientRows({ consultorId: session.realUserId });

  const ativos = clientes.filter((c) => c.activityStatus === "ATIVO").length;
  const bom = clientes.filter((c) => c.complianceTier === "BOM").length;
  const atencao = clientes.filter((c) => c.complianceTier === "ATENCAO").length;
  const critico = clientes.filter((c) => c.complianceTier === "CRITICO").length;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Dashboard</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Quais clientes estão usando o sistema e quais precisam da sua atenção.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Clientes" value={clientes.length} href="/consultor/clientes" />
        <StatCard
          label="Ativos"
          value={ativos}
          href="/consultor/clientes?filtro=ativos"
          tone="success"
        />
        <StatCard
          label="Orçamento Bom"
          value={bom}
          href="/consultor/clientes?filtro=orcamento_bom"
          tone="success"
        />
        <StatCard
          label="Atenção"
          value={atencao}
          href="/consultor/clientes?filtro=orcamento_atencao"
          tone="warning"
        />
        <StatCard
          label="Crítico"
          value={critico}
          href="/consultor/clientes?filtro=orcamento_critico"
          tone="danger"
        />
      </div>
    </div>
  );
}
