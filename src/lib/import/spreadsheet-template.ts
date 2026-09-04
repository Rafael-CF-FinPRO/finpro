import * as XLSX from "@e965/xlsx";
import JSZip from "jszip";
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
export type TemplateSimpleOption = { id: string; name: string };

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

// How many data rows the dropdowns (below) cover — generous enough for a
// year of daily transactions without validating the whole column, which
// some Excel versions handle poorly for performance.
const VALIDATION_LAST_ROW = 1000;

// SheetJS's community build never writes <dataValidations> (confirmed in
// its own source: the spot for it is a hardcoded no-op comment) — full
// dropdown/list validation is a Pro-only feature there. This patches the
// dropdowns straight into the generated .xlsx's XML after the fact,
// since an .xlsx file is just a zip of XML parts.
function xmlEscape(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// A row range with zero items has nothing to validate against — fall
// back to a single cell far outside any real data so the dropdown is
// simply empty instead of pointing at garbage.
function rangeOrEmpty(sheetRef: string, column: string, count: number, startRow: number): string {
  if (count <= 0) return `${sheetRef}!$Z$1:$Z$1`;
  return `${sheetRef}!$${column}$${startRow}:$${column}$${startRow + count - 1}`;
}

/**
 * Builds the downloadable spreadsheet template, personalized with the
 * user's own active categories, payment methods and tags:
 * - Sheet 1 "Lançamentos": the columns to fill in, with dropdown data
 *   validation on Tipo, Categoria (cascading off Tipo), Meio de
 *   Pagamento and Tag — the same data the spreadsheet parser
 *   (spreadsheet-parser.ts) resolves back to real ids.
 * - Sheet 2 "Categorias": every active category's disambiguated display
 *   name (see category-display.ts), grouped by Tipo — also what the
 *   Categoria dropdown's list points at.
 * - Sheet 3 "Meios de Pagamento" / Sheet 4 "Tags": what the Meio de
 *   Pagamento / Tag dropdowns point at. Typing something not on either
 *   list is still allowed (only a warning) since import can create a
 *   new payment method/tag on the fly, same as the manual entry form.
 */
export async function buildTemplateWorkbook(
  categories: TemplateCategory[],
  paymentMethods: TemplateSimpleOption[],
  tags: TemplateSimpleOption[]
): Promise<Buffer> {
  const displayCategories = withCategoryDisplayName(categories.filter((c) => c.isActive)).sort(
    (a, b) => a.type.localeCompare(b.type) || a.displayName.localeCompare(b.displayName, "pt-BR")
  );
  const entradaCategories = displayCategories.filter((c) => c.type === "ENTRADA");
  const neutroCategories = displayCategories.filter((c) => c.type === "NEUTRO");
  const saidaCategories = displayCategories.filter((c) => c.type === "SAIDA");

  const paymentMethodNames = paymentMethods.map((p) => p.name).sort((a, b) => a.localeCompare(b, "pt-BR"));
  const tagNames = tags.map((t) => t.name).sort((a, b) => a.localeCompare(b, "pt-BR"));

  const exampleCategory = saidaCategories[0] ?? displayCategories[0];

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

  const paymentMethodsSheet = XLSX.utils.aoa_to_sheet([
    ["Meio de Pagamento"],
    ...paymentMethodNames.map((name) => [name]),
  ]);

  const tagsSheet = XLSX.utils.aoa_to_sheet([["Tag"], ...tagNames.map((name) => [name])]);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, transactionsSheet, "Lançamentos");
  XLSX.utils.book_append_sheet(workbook, categoriesSheet, "Categorias");
  XLSX.utils.book_append_sheet(workbook, paymentMethodsSheet, "Meios de Pagamento");
  XLSX.utils.book_append_sheet(workbook, tagsSheet, "Tags");

  const baseBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

  // Categorias sheet: header on row 1, ENTRADA rows first, then NEUTRO,
  // then SAIDA — matches the sort above ("ENTRADA" < "NEUTRO" < "SAIDA"),
  // so each type's block is contiguous.
  const entradaRow = 2;
  const neutroRow = entradaRow + entradaCategories.length;
  const saidaRow = neutroRow + neutroCategories.length;
  const entradaRange = rangeOrEmpty("Categorias", "B", entradaCategories.length, entradaRow);
  const neutroRange = rangeOrEmpty("Categorias", "B", neutroCategories.length, neutroRow);
  const saidaRange = rangeOrEmpty("Categorias", "B", saidaCategories.length, saidaRow);

  const paymentMethodRange = rangeOrEmpty("'Meios de Pagamento'", "A", paymentMethodNames.length, 2);
  const tagRange = rangeOrEmpty("Tags", "A", tagNames.length, 2);

  const definedNamesXml = [
    `<definedNames>`,
    `<definedName name="Entrada">${xmlEscape(entradaRange)}</definedName>`,
    `<definedName name="Neutro">${xmlEscape(neutroRange)}</definedName>`,
    `<definedName name="Saída">${xmlEscape(saidaRange)}</definedName>`,
    `</definedNames>`,
  ].join("");

  const dataValidationsXml = [
    `<dataValidations count="4">`,
    `<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" errorStyle="stop" sqref="B2:B${VALIDATION_LAST_ROW}">`,
    `<formula1>"Entrada,Saída,Neutro"</formula1>`,
    `<error>Selecione Entrada, Saída ou Neutro.</error>`,
    `</dataValidation>`,
    `<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" errorStyle="stop" sqref="D2:D${VALIDATION_LAST_ROW}">`,
    `<formula1>INDIRECT($B2)</formula1>`,
    `<error>Selecione uma categoria da lista — as opções dependem do Tipo escolhido nesta linha.</error>`,
    `</dataValidation>`,
    `<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" errorStyle="warning" sqref="F2:F${VALIDATION_LAST_ROW}">`,
    `<formula1>${xmlEscape(paymentMethodRange)}</formula1>`,
    `<error>Este meio de pagamento ainda não existe — será possível criá-lo durante a importação.</error>`,
    `</dataValidation>`,
    `<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" errorStyle="warning" sqref="G2:G${VALIDATION_LAST_ROW}">`,
    `<formula1>${xmlEscape(tagRange)}</formula1>`,
    `<error>Esta tag ainda não existe — será possível criá-la durante a importação.</error>`,
    `</dataValidation>`,
    `</dataValidations>`,
  ].join("");

  const zip = await JSZip.loadAsync(baseBuffer);

  const sheet1File = zip.file("xl/worksheets/sheet1.xml");
  const workbookFile = zip.file("xl/workbook.xml");
  if (!sheet1File || !workbookFile) return baseBuffer;

  const sheet1Xml = await sheet1File.async("string");
  zip.file("xl/worksheets/sheet1.xml", sheet1Xml.replace("</sheetData>", `</sheetData>${dataValidationsXml}`));

  const workbookXml = await workbookFile.async("string");
  zip.file("xl/workbook.xml", workbookXml.replace("</sheets>", `</sheets>${definedNamesXml}`));

  return zip.generateAsync({ type: "nodebuffer" });
}
