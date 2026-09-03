/**
 * Starter payment methods given to every newly-registered user, so the
 * dropdown isn't empty on day one. Fully editable afterwards (rename,
 * delete) from Configurações — this is just a helpful starting point,
 * not a fixed list.
 */
export const DEFAULT_PAYMENT_METHODS: { name: string; order: number }[] = [
  { name: "Pix", order: 1 },
  { name: "Dinheiro", order: 2 },
  { name: "Cartão de Débito", order: 3 },
  { name: "Cartão de Crédito", order: 4 },
  { name: "Transferência Bancária", order: 5 },
];
