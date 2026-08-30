import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/app/PlaceholderPage";

export const metadata: Metadata = {
  title: "Dashboard | FinPRO",
};

export default function DashboardPage() {
  return (
    <PlaceholderPage
      title="Dashboard"
      description="Visão geral das suas finanças."
    />
  );
}
