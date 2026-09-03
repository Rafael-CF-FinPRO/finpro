import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getBudgetOverview, getBudgetHistory } from "@/lib/budget";
import { currentMonthKey, isValidMonthKey, shiftMonthKey } from "@/lib/dates";
import { MonthNavigator } from "@/components/orcamento/MonthNavigator";
import { BudgetSummaryDashboard } from "@/components/orcamento/BudgetSummaryDashboard";
import { DashboardViewTabs } from "@/components/dashboard/DashboardViewTabs";
import { HistoricalPeriodPicker } from "@/components/dashboard/HistoricalPeriodPicker";
import { BudgetHistorySummary } from "@/components/dashboard/BudgetHistorySummary";
import { BudgetEvolutionChart } from "@/components/dashboard/BudgetEvolutionChart";

export const metadata: Metadata = {
  title: "Dashboard | FinPRO",
};

const DEFAULT_HISTORY_MONTHS = 6;

function NoProfileMessage() {
  return (
    <div className="card mt-6 p-8 text-center text-sm text-[var(--muted)]">
      Defina sua renda mensal de referência em Orçamento para ver o resumo aqui.
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const params = await searchParams;
  const view = params.view === "historico" ? "historico" : "mensal";

  return (
    <div>
      <h1 className="text-2xl font-semibold text-stone-900">Dashboard</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">Visão geral das suas finanças.</p>

      <div className="mt-6">
        <DashboardViewTabs view={view} />
      </div>

      {view === "mensal" ? (
        <DashboardMonthlyView requestedMonth={typeof params.month === "string" ? params.month : ""} userId={session.userId} />
      ) : (
        <DashboardHistoricalView
          requestedFrom={typeof params.from === "string" ? params.from : ""}
          requestedTo={typeof params.to === "string" ? params.to : ""}
          userId={session.userId}
        />
      )}
    </div>
  );
}

async function DashboardMonthlyView({
  requestedMonth,
  userId,
}: {
  requestedMonth: string;
  userId: string;
}) {
  const monthKey = isValidMonthKey(requestedMonth) ? requestedMonth : currentMonthKey();
  const overview = await getBudgetOverview(userId, monthKey);

  if (!overview.hasProfile) {
    return <NoProfileMessage />;
  }

  return (
    <>
      <div className="mt-4">
        <MonthNavigator monthKey={monthKey} />
      </div>
      <div className="mt-4">
        <BudgetSummaryDashboard
          monthlyIncomeCents={overview.monthlyIncomeCents}
          classifications={overview.classifications}
        />
      </div>
    </>
  );
}

async function DashboardHistoricalView({
  requestedFrom,
  requestedTo,
  userId,
}: {
  requestedFrom: string;
  requestedTo: string;
  userId: string;
}) {
  const to = isValidMonthKey(requestedTo) ? requestedTo : currentMonthKey();
  const from = isValidMonthKey(requestedFrom)
    ? requestedFrom
    : shiftMonthKey(to, -(DEFAULT_HISTORY_MONTHS - 1));

  const history = await getBudgetHistory(userId, from, to);

  if (!history.hasProfile) {
    return <NoProfileMessage />;
  }

  return (
    <>
      <div className="mt-4">
        <HistoricalPeriodPicker from={from} to={to} />
      </div>
      <div className="mt-4">
        <BudgetHistorySummary history={history} />
      </div>
      <div className="mt-4">
        <BudgetEvolutionChart months={history.months} />
      </div>
    </>
  );
}
