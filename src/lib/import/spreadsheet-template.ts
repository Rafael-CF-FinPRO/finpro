import * as XLSX from "@e965/xlsx";
import { withCategoryDisplayName } from "@/lib/category-display";
import { TYPE_LABELS } from "@/lib/transaction-labels";
import type { Classification, TransactionType } from "@/generated/prisma/enums";

export type TemplateCategory = {
  id: string;
  name: string;
  type: TransactionType;
  classification: Classification;
  isActive: boolean;
};

const TRANSACTIONS_HEADERS = [
  "Data",
  "Tipo",
  "Valor",
  "Categoria",
  "Descrição",
  "Meio de Pagamento",
  "Tag",
  "Observação",
];

// Sheet 2 lists every active category using the same disambiguated name
// (see src/lib/category-display.ts) that the spreadsheet parser resolves
// back to a category id — copy-pasting a name from here always round-trips
// to exactly one category, even for names that repeat across
// classifications (e.g. "Pets").
export function buildTemplateWorkbook(categories: TemplateCategory[]): Buffer {
  const displayCategories = withCategoryDisplayName(categories.filter((c) => c.isActive)).sort(
    (a, b) => a.type.localeCompare(b.type) || a.displayName.localeCompare(b.displayName, "pt-BR")
  );

  const exampleCategory = displayCategories.find((c) => c.type === "SAIDA") ?? displayCategories[0];

  const transactionsSheet = XLSX.utils.aoa_to_sheet([
    TRANSACTIONS_HEADERS,
    [
      "01/09/2026",
      "Saída",
      "150,00",
      exampleCategory?.displayName ?? "",
      "Exemplo de descrição",
      "Cartão de Débito",
      "",
      "",
    ],
  ]);

  const categoriesSheet = XLSX.utils.aoa_to_sheet([
    ["Tipo", "Categoria"],
    ...displayCategories.map((c) => [TYPE_LABELS[c.type], c.displayName]),
  ]);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, transactionsSheet, "Lançamentos");
  XLSX.utils.book_append_sheet(workbook, categoriesSheet, "Categorias");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
