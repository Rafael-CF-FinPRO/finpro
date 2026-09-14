import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

/** Streams back the single document attached to one Passivo/Proteção
 * item (src/app/actions/patrimonio.ts's saveLiabilityAction/
 * saveProtectionAction) — a plain GET Route Handler rather than a
 * Server Action since this needs to return a binary body with its own
 * Content-Type behind a plain `<a href>`, same reason
 * /api/import/template exists. Ownership is re-checked against the
 * live session on every request, exactly like every other read in this
 * module. */
export async function GET(_request: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const session = await getSession();
  if (!session) {
    return new NextResponse("Não autorizado.", { status: 401 });
  }

  const { kind, id } = await params;

  const record =
    kind === "liability"
      ? await prisma.patrimonioLiability.findUnique({
          where: { id },
          select: { userId: true, documentData: true, documentMimeType: true, documentFileName: true },
        })
      : kind === "protection"
        ? await prisma.patrimonioProtection.findUnique({
            where: { id },
            select: { userId: true, documentData: true, documentMimeType: true, documentFileName: true },
          })
        : null;

  if (!record || record.userId !== session.userId || !record.documentData) {
    return new NextResponse("Documento não encontrado.", { status: 404 });
  }

  return new NextResponse(new Uint8Array(record.documentData), {
    headers: {
      "Content-Type": record.documentMimeType ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${encodeURIComponent(record.documentFileName ?? "documento")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
