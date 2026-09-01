import { formatCentsToBRL } from "@/lib/money";

export function TopIndicators({
  incomeCents,
  budgetedCents,
  realizedCents,
  availableCents,
  usedPct,
}: {
  incomeCents: number;
  budgetedCents: number;
  realizedCents: number;
  availableCents: number;
  usedPct: number | null;
}) {
  const isNegative = availableCents < 0;

  const items = [
    { label: "Renda mensal", value: formatCentsToBRL(incomeCents) },
    { label: "Orçado", value: formatCentsToBRL(budgetedCents) },
    { label: "Realizado", value: formatCentsToBRL(realizedCents) },
    {
      label: "Disponível",
      value: formatCentsToBRL(availableCents),
      danger: isNegative,
    },
    {
      label: "Utilizado",
      value: usedPct === null ? "—" : `${usedPct.toLocaleString("pt-BR")}%`,
      danger: usedPct !== null && usedPct > 100,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((item) => (
        <div key={item.label} className="card p-4">
          <p className="text-sm text-[var(--muted)]">{item.label}</p>
          <p
            className={`mt-1 text-lg font-semibold ${
              item.danger ? "text-[var(--danger)]" : "text-slate-900"
            }`}
          >
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}
