import type { ProtectionDetailRow } from "@/lib/patrimonio";

const GROUPS: { status: ProtectionDetailRow["status"]; label: string; color: string; emptyMessage: string }[] = [
  {
    status: "PENDENTE",
    label: "Necessárias e pendentes",
    color: "var(--danger)",
    emptyMessage: "Nenhuma pendência — tudo que é necessário já está coberto.",
  },
  {
    status: "POSSUIDA",
    label: "Necessárias e possuídas",
    color: "var(--success)",
    emptyMessage: "Nenhum elemento marcado como necessário e coberto ainda.",
  },
  {
    status: "NAO_NECESSARIA",
    label: "Não necessárias",
    color: "var(--text-faint)",
    emptyMessage: "Nenhum elemento marcado como não necessário.",
  },
];

/** Complementa o velocímetro (spec section 10) — em vez de mais um
 * gráfico, uma lista agrupada simples: rápida de ler, sem repetir o que
 * o velocímetro já mostra em percentual. Pendentes aparece primeiro —
 * é a informação mais acionável. */
export function ProtectionDetailBreakdown({ rows }: { rows: ProtectionDetailRow[] }) {
  return (
    <div className="card p-4 sm:p-5">
      <p className="text-sm font-medium text-[var(--text-secondary)]">Detalhamento das Proteções</p>
      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {GROUPS.map((group) => {
          const items = rows.filter((r) => r.status === group.status);
          return (
            <div key={group.status}>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: group.color }} />
                <p className="text-xs font-medium text-[var(--text-tertiary)]">
                  {group.label} ({items.length})
                </p>
              </div>
              {items.length === 0 ? (
                <p className="mt-2 text-xs text-[var(--text-faint)]">{group.emptyMessage}</p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {items.map((row) => (
                    <li
                      key={row.id}
                      className="rounded-md border-l-2 px-2 py-1 text-xs text-[var(--text-secondary)]"
                      style={{ borderLeftColor: group.color }}
                    >
                      {row.element}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
