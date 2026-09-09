import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/rbac";
import { getClientRows, formatDaysSinceLastAccess, type ConsultorClientRow } from "@/lib/consultor";
import { startImpersonationAction } from "@/app/actions/consultor";
import { ActivityStatusBadge, ComplianceTierBadge } from "@/components/app/ClienteStatusBadges";
import { EditClienteButton } from "@/components/app/EditClienteButton";
import { NewClienteButton } from "@/components/consultor/NewClienteButton";

export const metadata: Metadata = {
  title: "Clientes | Consultor | FinPRO",
};

type FiltroKey =
  | "todos"
  | "ativos"
  | "atencao"
  | "inativos"
  | "orcamento_bom"
  | "orcamento_atencao"
  | "orcamento_critico";

const FILTERS: { key: FiltroKey; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "ativos", label: "Ativos" },
  { key: "atencao", label: "Atenção" },
  { key: "inativos", label: "Inativos" },
  { key: "orcamento_bom", label: "Orçamento Bom" },
  { key: "orcamento_atencao", label: "Orçamento Atenção" },
  { key: "orcamento_critico", label: "Orçamento Crítico" },
];

function matchesFilter(cliente: ConsultorClientRow, filtro: FiltroKey): boolean {
  switch (filtro) {
    case "ativos":
      return cliente.activityStatus === "ATIVO";
    case "atencao":
      return cliente.activityStatus === "ATENCAO";
    case "inativos":
      return cliente.activityStatus === "INATIVO" || cliente.activityStatus === "NUNCA_ACESSOU";
    case "orcamento_bom":
      return cliente.complianceTier === "BOM";
    case "orcamento_atencao":
      return cliente.complianceTier === "ATENCAO";
    case "orcamento_critico":
      return cliente.complianceTier === "CRITICO";
    default:
      return true;
  }
}

export default async function ConsultorClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await requireRole("CONSULTOR");
  const params = await searchParams;
  const requestedFiltro = typeof params.filtro === "string" ? params.filtro : "todos";
  const activeFiltro = (FILTERS.some((f) => f.key === requestedFiltro) ? requestedFiltro : "todos") as FiltroKey;
  const q = typeof params.q === "string" ? params.q.trim().toLowerCase() : "";

  const allClientes = await getClientRows({ consultorId: session.realUserId });
  const clientes = allClientes
    .filter((c) => matchesFilter(c, activeFiltro))
    .filter((c) => !q || c.name.toLowerCase().includes(q));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Clientes</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {allClientes.length === 0
              ? "Nenhum cliente cadastrado ainda."
              : `${allClientes.length} cliente(s) na sua carteira.`}
          </p>
        </div>
        <NewClienteButton />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={f.key === "todos" ? "/consultor/clientes" : `/consultor/clientes?filtro=${f.key}`}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                activeFiltro === f.key
                  ? "bg-[var(--primary)] text-[var(--on-primary)]"
                  : "border border-[var(--surface-border)] text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)]"
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>
        <form method="get" className="flex items-center gap-2">
          {activeFiltro !== "todos" && <input type="hidden" name="filtro" value={activeFiltro} />}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Buscar por nome..."
            className="field-input w-56"
          />
        </form>
      </div>

      <div className="card mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--surface-border)] text-xs tracking-wide text-[var(--muted)] uppercase">
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Dias desde o último acesso</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Cumprimento do orçamento</th>
              <th className="px-4 py-3 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {clientes.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--muted)]">
                  Nenhum cliente encontrado.
                </td>
              </tr>
            ) : (
              clientes.map((cliente) => (
                <tr key={cliente.id} className="border-b border-[var(--surface-border)] last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium text-[var(--text-primary)]">{cliente.name}</p>
                    <p className="text-xs text-[var(--muted)]">{cliente.email}</p>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">
                    {formatDaysSinceLastAccess(cliente.daysSinceLastAccess)}
                  </td>
                  <td className="px-4 py-3">
                    <ActivityStatusBadge status={cliente.activityStatus} />
                  </td>
                  <td className="px-4 py-3">
                    <ComplianceTierBadge tier={cliente.complianceTier} pct={cliente.compliancePct} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <form action={startImpersonationAction}>
                        <input type="hidden" name="clienteId" value={cliente.id} />
                        <button
                          type="submit"
                          className="text-sm font-medium text-[var(--primary)] hover:text-[var(--primary-hover)]"
                        >
                          Entrar
                        </button>
                      </form>
                      <EditClienteButton
                        clienteId={cliente.id}
                        initialName={cliente.name}
                        initialEmail={cliente.email}
                      />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
