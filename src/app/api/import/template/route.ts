import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getCategories } from "@/lib/transactions";
import { buildTemplateWorkbook } from "@/lib/import/spreadsheet-template";

// The template lists each user's own active categories (src/lib/import/
// spreadsheet-template.ts), so it can't be a static file — a GET Route
// Handler is what returns a binary download with the right
// Content-Disposition behind a plain <a href>, unlike a Server Action.
export async function GET() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const categories = await getCategories(session.userId);
  const buffer = buildTemplateWorkbook(categories);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="modelo-importacao-finpro.xlsx"',
    },
  });
}
