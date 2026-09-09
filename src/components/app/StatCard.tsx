import Link from "next/link";

const TONE_CLASS: Record<"default" | "success" | "warning" | "danger", string> = {
  default: "text-[var(--text-primary)]",
  success: "text-[var(--success)]",
  warning: "text-[var(--warning)]",
  danger: "text-[var(--danger)]",
};

/** One indicator on the Consultor/Admin dashboards — both are
 * deliberately capped at ~5 of these (spec: no BI, no dense graphs), so
 * a single reusable card is enough; optionally links into the filtered
 * Clientes list ("4 Críticos" → Clientes filtered by Crítico). */
export function StatCard({
  label,
  value,
  href,
  tone = "default",
}: {
  label: string;
  value: string | number;
  href?: string;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const content = (
    <div className="card p-5">
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <p className={`mt-1 text-3xl font-semibold ${TONE_CLASS[tone]}`}>{value}</p>
    </div>
  );

  if (!href) return content;
  return (
    <Link href={href} className="block transition-transform hover:-translate-y-0.5">
      {content}
    </Link>
  );
}
