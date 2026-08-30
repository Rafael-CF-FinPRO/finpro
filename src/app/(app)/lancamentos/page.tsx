import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/app/PlaceholderPage";

export const metadata: Metadata = {
  title: "Lançamentos | FinPRO",
};

export default function LancamentosPage() {
  return (
    <PlaceholderPage
      title="Lançamentos"
      description="Suas entradas e saídas financeiras."
    />
  );
}
