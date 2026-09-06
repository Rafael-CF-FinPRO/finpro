export function parseMoneyToCents(
  raw: string,
  options?: { allowZero?: boolean }
): number | null {
  let s = raw.trim().replace(/[^\d.,]/g, "");
  if (!s) return null;

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");
    s =
      lastComma > lastDot
        ? s.replace(/\./g, "").replace(",", ".")
        : s.replace(/,/g, "");
  } else if (hasComma) {
    s = s.replace(",", ".");
  }

  const value = Number(s);
  const minValue = options?.allowZero ? 0 : Number.EPSILON;
  if (!Number.isFinite(value) || value < minValue) return null;

  return Math.round(value * 100);
}

export function formatCentsToBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/** Short form for chart axis ticks, where the full currency format
 * (formatCentsToBRL) would crowd the labels — "R$20 mil" instead of
 * "R$ 20.000,00". Never used for a value the user needs to act on
 * (transactions, totals, form fields), only for scale reference. */
export function formatCentsCompactBRL(cents: number): string {
  const reais = cents / 100;
  const sign = reais < 0 ? "-" : "";
  const abs = Math.abs(reais);
  if (abs >= 1_000_000) {
    return `${sign}R$${(abs / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}mi`;
  }
  if (abs >= 1_000) {
    return `${sign}R$${(abs / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}mil`;
  }
  return `${sign}R$${abs.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}
