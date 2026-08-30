import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/app/PlaceholderPage";

export const metadata: Metadata = {
  title: "Metas | FinPRO",
};

export default function MetasPage() {
  return (
    <PlaceholderPage
      title="Metas"
      description="Defina e acompanhe seus objetivos financeiros."
    />
  );
}
