import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getBudgetOverview, getBudgetHistory } from "@/lib/budget";
import {
  currentMonthKey,
  isValidMonthKey,
  isValidDateInputValue,
  parseDateInputValue,
  addMonthsClamped,
} from "@/lib/dates";
import { MonthNavigator } from "@/components/orcamento/MonthNavigator";
import { DashboardViewTabs } from "@/components/dashboard/DashboardViewTabs";
import { HistoricalPeriodPicker } from "@/components/dashboard/HistoricalPeriodPicker";
import { HistoricalSummaryStrip } from "@/components/dashboard/HistoricalSummaryStrip";
import { HistoricalClassificationCards } from "@/components/dashboard/HistoricalClassificationCards";
import { BudgetEvolutionChart } from "@/components/dashboard/BudgetEvolutionChart";
import { SpendingDistributionChart } from "@/components/dashboard/SpendingDistributionChart";
import { ComplianceEvolutionChart } from "@/components/dashboard/ComplianceEvolutionChart";
import { HistoricalInvestmentsPanel } from "@/components/dashboard/HistoricalInvestmentsPanel";
import { HistoricalTopCategories } from "@/components/dashboard/HistoricalTopCategories";
import { MonthSummaryStrip } from "@/components/dashboard/MonthSummaryStrip";
import { IncomeFlowFunnel } from "@/components/dashboard/IncomeFlowFunnel";
import { ValueDistributionDonut } from "@/components/dashboard/ValueDistributionDonut";
import { BudgetVsRealizedPanel } from "@/components/dashboard/BudgetVsRealizedPanel";
import { TopCategoriesRanking } from "@/components/dashboard/TopCategoriesRanking";

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
      <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Dashboard</h1>
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
      <div className="mt-4 space-y-4">
        <MonthSummaryStrip
          realizedIncomeCents={overview.realizedIncomeCents}
          classifications={overview.classifications}
        />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <IncomeFlowFunnel
            receitaCents={overview.realizedIncomeCents}
            classifications={overview.classifications}
          />
          <ValueDistributionDonut
            realizedIncomeCents={overview.realizedIncomeCents}
            classifications={overview.classifications}
          />
        </div>
        <BudgetVsRealizedPanel classifications={overview.classifications} />
        <TopCategoriesRanking classifications={overview.classifications} />
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
  const toDate = isValidDateInputValue(requestedTo) ? parseDateInputValue(requestedTo)! : new Date();
  const fromDate = isValidDateInputValue(requestedFrom)
    ? parseDateInputValue(requestedFrom)!
    : addMonthsClamped(toDate, -DEFAULT_HISTORY_MONTHS);

  const history = await getBudgetHistory(userId, fromDate, toDate);

  if (!history.hasProfile) {
    return <NoProfileMessage />;
  }

  return (
    <>
      <div className="mt-4">
        <HistoricalPeriodPicker from={history.fromDate} to={history.toDate} />
      </div>
      <div className="mt-4 space-y-4">
        <HistoricalSummaryStrip history={history} />
        <HistoricalClassificationCards months={history.months} />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <BudgetEvolutionChart months={history.months} />
          <SpendingDistributionChart months={history.months} />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ComplianceEvolutionChart months={history.months} />
          <HistoricalInvestmentsPanel history={history} />
        </div>
        <HistoricalTopCategories history={history} />
      </div>
    </>
  );
}
