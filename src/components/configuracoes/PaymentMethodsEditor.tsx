"use client";

import {
  createPaymentMethodAction,
  deletePaymentMethodAction,
  updatePaymentMethodAction,
} from "@/app/actions/payment-methods";
import { ReferenceListEditor, type ReferenceItem } from "./ReferenceListEditor";

export function PaymentMethodsEditor({ items }: { items: ReferenceItem[] }) {
  return (
    <ReferenceListEditor
      items={items}
      emptyMessage="Nenhum meio de pagamento cadastrado ainda."
      addPlaceholder="Nome do meio de pagamento"
      deleteConfirmLabel={(name) =>
        `Excluir o meio de pagamento "${name}"? Lançamentos que o utilizam ficarão sem meio de pagamento.`
      }
      onCreate={createPaymentMethodAction}
      onUpdate={updatePaymentMethodAction}
      onDelete={deletePaymentMethodAction}
    />
  );
}
