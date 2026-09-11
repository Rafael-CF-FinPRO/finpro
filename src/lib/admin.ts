import { prisma } from "@/lib/prisma";
import { getClientRows } from "@/lib/consultor";
import type { UserStatus } from "@/generated/prisma/enums";

export type AdminConsultorRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: UserStatus;
  clientCount: number;
};

export async function getConsultorRows(): Promise<AdminConsultorRow[]> {
  const consultores = await prisma.user.findMany({
    where: { role: "CONSULTOR" },
    orderBy: { name: "asc" },
    include: { _count: { select: { clientes: true } } },
  });

  return consultores.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    status: c.status,
    clientCount: c._count.clientes,
  }));
}

export type AdminDashboardCounts = {
  totalConsultores: number;
  totalClientes: number;
  clientesAtivos: number;
  clientesInativos: number;
  consultoresAtivos: number;
};

/** The Admin's own dashboard is deliberately even simpler than the
 * Consultor's (spec: max 5 indicators, no BI) — reuses getClientRows /
 * activityStatusFor exactly as the Consultor dashboard does. "Inativos"
 * here means the same thing as the Inativos filter on /admin/clientes
 * and /consultor/clientes (INATIVO or NUNCA_ACESSOU) — an ATENÇÃO
 * cliente counts toward neither tile, which is fine: this is a
 * headline number, not an exhaustive partition. */
export async function getAdminDashboardCounts(): Promise<AdminDashboardCounts> {
  const [clientes, consultores] = await Promise.all([
    getClientRows({}),
    prisma.user.findMany({ where: { role: "CONSULTOR" }, select: { status: true } }),
  ]);

  return {
    totalConsultores: consultores.length,
    totalClientes: clientes.length,
    clientesAtivos: clientes.filter((c) => c.activityStatus === "ATIVO").length,
    clientesInativos: clientes.filter(
      (c) => c.activityStatus === "INATIVO" || c.activityStatus === "NUNCA_ACESSOU"
    ).length,
    consultoresAtivos: consultores.filter((c) => c.status === "ATIVO").length,
  };
}
