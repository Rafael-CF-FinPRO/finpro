import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/app/PlaceholderPage";

export const metadata: Metadata = {
  title: "Orçamento | FinPRO",
};

export default function OrcamentoPage() {
  return (
    <PlaceholderPage
      title="Orçamento"
      description="Planeje e acompanhe o orçamento das suas finanças."
    />
  );
}
