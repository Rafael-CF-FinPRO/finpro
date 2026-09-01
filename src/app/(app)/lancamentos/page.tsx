import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { formatDateBR, toDateInputValue } from "@/lib/dates";
import {
  getCategories,
  getTransactions,
  parseFilters,
  summarize,
} from "@/lib/transactions";
import { SummaryCards } from "@/components/lancamentos/SummaryCards";
import { FiltersBar } from "@/components/lancamentos/FiltersBar";
import { TransactionsBoard } from "@/components/lancamentos/TransactionsBoard";

export const metadata: Metadata = {
  title: "Lançamentos | FinPRO",
};

export default async function LancamentosPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const params = await searchParams;
  const filters = parseFilters(params);

  const [categories, transactions] = await Promise.all([
    getCategories(session.userId),
    getTransactions(session.userId, filters),
  ]);

  const summary = summarize(transactions);

  const transactionRows = transactions.map((t) => ({
    id: t.id,
    type: t.type,
    amountCents: t.amountCents,
    description: t.description,
    categoryId: t.categoryId,
    categoryName: t.category.name,
    classification: t.classification,
    dateValue: toDateInputValue(t.date),
    dateLabel: formatDateBR(t.date),
    note: t.note ?? "",
  }));

  const categoryOptions = categories.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    classification: c.classification,
    isActive: c.isActive,
  }));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Lançamentos</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Suas entradas e saídas financeiras.
      </p>

      <div className="mt-6">
        <SummaryCards summary={summary} />
      </div>

      <div className="mt-4">
        <FiltersBar filters={filters} categories={categoryOptions} />
      </div>

      <div className="mt-4">
        <TransactionsBoard categories={categoryOptions} transactions={transactionRows} />
      </div>
    </div>
  );
}
