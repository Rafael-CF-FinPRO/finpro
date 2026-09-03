import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getBudgetOverview } from "@/lib/budget";
import { currentMonthKey, isValidMonthKey } from "@/lib/dates";
import { IncomeCard } from "@/components/orcamento/IncomeCard";
import { MonthNavigator } from "@/components/orcamento/MonthNavigator";
import { BudgetBoard } from "@/components/orcamento/BudgetBoard";
import type { BudgetOverview } from "@/lib/budget";

function budgetBoardKey(monthKey: string, overview: BudgetOverview): string {
  const fingerprint = overview.classifications
    .map(
      (c) =>
        `${c.classification}=${c.percentage}:${c.categories
          .map((cat) => `${cat.categoryId}=${cat.percentage}:${cat.name}:${cat.isActive}`)
          .join(",")}`
    )
    .join(";");
  return `${monthKey}|${overview.isCustomMonth}|${fingerprint}`;
}

export const metadata: Metadata = {
  title: "Orçamento | FinPRO",
};

export default async function OrcamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const params = await searchParams;
  const requestedMonth = typeof params.month === "string" ? params.month : "";
  const monthKey = isValidMonthKey(requestedMonth) ? requestedMonth : currentMonthKey();

  const overview = await getBudgetOverview(session.userId, monthKey);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-stone-900">Orçamento</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Distribua sua renda mensal entre classificações e categorias.
      </p>

      {overview.hasProfile ? (
        <>
          <div className="mt-6">
            <MonthNavigator monthKey={monthKey} />
          </div>

          <div className="mt-4">
            <BudgetBoard
              // The board holds local edit state (sliders, which scope is
              // being edited). It must remount — not just re-render — any
              // time the persisted data actually changes underneath it
              // (e.g. after "restaurar orçamento padrão"), otherwise stale
              // local state lingers on screen after a server mutation.
              key={budgetBoardKey(monthKey, overview)}
              monthKey={monthKey}
              monthlyIncomeCents={overview.monthlyIncomeCents}
              isCustomMonth={overview.isCustomMonth}
              classifications={overview.classifications}
            />
          </div>
        </>
      ) : (
        <div className="mt-6 space-y-4">
          <IncomeCard
            monthlyIncomeCents={overview.monthlyIncomeCents}
            hasProfile={overview.hasProfile}
          />
          <div className="card p-8 text-center text-sm text-[var(--muted)]">
            Defina sua renda mensal de referência para começar a configurar o orçamento.
          </div>
        </div>
      )}
    </div>
  );
}
