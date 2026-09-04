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
