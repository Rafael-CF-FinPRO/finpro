import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/app/PlaceholderPage";

export const metadata: Metadata = {
  title: "Configurações | FinPRO",
};

export default function ConfiguracoesPage() {
  return (
    <PlaceholderPage
      title="Configurações"
      description="Preferências da sua conta FinPRO."
    />
  );
}
