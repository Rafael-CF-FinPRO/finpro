import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getPaymentMethods, getTags } from "@/lib/transactions";
import { PaymentMethodsEditor } from "@/components/configuracoes/PaymentMethodsEditor";
import { TagsEditor } from "@/components/configuracoes/TagsEditor";

export const metadata: Metadata = {
  title: "Configurações | FinPRO",
};

export default async function ConfiguracoesPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const [paymentMethods, tags] = await Promise.all([
    getPaymentMethods(session.userId),
    getTags(session.userId),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-stone-900">Configurações</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Preferências da sua conta FinPRO.
      </p>

      <div className="card mt-6 p-4">
        <h2 className="font-semibold text-stone-900">Meios de pagamento</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Usados para identificar como cada lançamento foi pago ou recebido.
        </p>
        <div className="mt-4">
          <PaymentMethodsEditor
            items={paymentMethods.map((pm) => ({ id: pm.id, name: pm.name }))}
          />
        </div>
      </div>

      <div className="card mt-4 p-4">
        <h2 className="font-semibold text-stone-900">Tags</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Usadas para agrupar lançamentos de uma viagem, passeio ou evento esporádico.
        </p>
        <div className="mt-4">
          <TagsEditor items={tags.map((t) => ({ id: t.id, name: t.name }))} />
        </div>
      </div>
    </div>
  );
}
