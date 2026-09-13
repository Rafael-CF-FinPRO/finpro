/**
 * The 17 elementos de proteção suggested by the reference spreadsheet
 * ("Gestão Patrimonial v2.xlsx", aba "Patrimônio") — seeded once per
 * user (createClientAction, plus a one-off backfill for accounts that
 * predate this feature), the same way DEFAULT_CATEGORY_TEMPLATE seeds
 * starter categories. `objective` mirrors the spreadsheet's own text
 * for each item; fully editable afterwards, and the user can add their
 * own beyond this list (PatrimonioProtection.element is free text, not
 * an enum).
 */
export const DEFAULT_PATRIMONIO_PROTECTIONS: { element: string; objective: string; order: number }[] = [
  {
    element: "Seguro de Vida",
    objective: "Proteção do padrão de vida do cônjuge, inventário e educação dos filhos.",
    order: 1,
  },
  {
    element: "Seguro de Invalidez",
    objective: "Proteção do patrimônio e provisionamento de longo prazo.",
    order: 2,
  },
  {
    element: "Seguro Doenças Graves",
    objective: "Proteção patrimonial.",
    order: 3,
  },
  {
    element: "Seguro Cirurgias",
    objective: "Proteção patrimonial.",
    order: 4,
  },
  {
    element: "Seguro de Internação Hospitalar",
    objective: "Proteção do fluxo de caixa e do patrimônio.",
    order: 5,
  },
  {
    element: "Seguro DIT",
    objective: "Proteção do fluxo de caixa e do patrimônio.",
    order: 6,
  },
  {
    element: "Seguro RCP",
    objective: "Proteção jurídica e patrimonial.",
    order: 7,
  },
  {
    element: "Plano de Saúde",
    objective: "Proteção do fluxo de caixa e do patrimônio.",
    order: 8,
  },
  {
    element: "Seguro Moradia",
    objective: "Proteção do patrimônio.",
    order: 9,
  },
  {
    element: "Seguro Auto",
    objective: "Proteção do patrimônio.",
    order: 10,
  },
  {
    element: "Previdência VGBL",
    objective: "Provisionamento para a sucessão.",
    order: 11,
  },
  {
    element: "Previdência PGBL",
    objective: "Diferimento fiscal e sucessão.",
    order: 12,
  },
  {
    element: "Holding",
    objective: "Estrutura para vantagens fiscais e sucessórias.",
    order: 13,
  },
  {
    element: "Offshore",
    objective: "Estrutura internacional de proteção patrimonial.",
    order: 14,
  },
  {
    element: "Proteção FGC",
    objective: "Proteção do patrimônio financeiro.",
    order: 15,
  },
  {
    element: "Asset Allocation",
    objective: "Proteção do patrimônio via diversificação.",
    order: 16,
  },
  {
    element: "Reserva de Emergência + Liquidez Adequada",
    objective: "Proteção do fluxo de caixa e do patrimônio.",
    order: 17,
  },
];
