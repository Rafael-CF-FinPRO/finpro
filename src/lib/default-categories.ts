import type { Classification, TransactionType } from "@/generated/prisma/enums";

/**
 * Starter categories given to every newly-registered user, organized
 * under the 3 budget classifications (Custos Obrigatórios / Prazeres e
 * Confortos / Investimentos) plus Receita for income. Categories are
 * fully editable per-user after registration (rename, reclassify,
 * deactivate) — Classification is the only fixed part.
 *
 * Some category concepts exist once under Custos Obrigatórios and once
 * under Prazeres e Confortos (Pets, Transporte, Cuidados Pessoais,
 * Prestadores de Serviço e Serviços) — unlike the previous structure,
 * the name itself is NOT decorated to disambiguate them (no more
 * " - Essencial" / " - Não Essencial" suffix baked in). Classification
 * alone tells them apart; src/lib/category-display.ts appends a
 * "— Custo Obrigatório" / "— Prazer e Conforto" tag only where a flat
 * list would otherwise show the same name twice.
 *
 * `description` is shown directly under the category name in Orçamento
 * (never hidden behind a tooltip) — plain-language, jargon-free, and
 * written to work as a classification parameter: it should help the
 * user decide whether a given expense belongs here.
 */
export const DEFAULT_CATEGORY_TEMPLATE: {
  name: string;
  description: string;
  type: TransactionType;
  classification: Classification;
  order: number;
}[] = [
  {
    name: "Salário",
    description: "Valor fixo que você recebe todo mês do seu emprego ou contrato de trabalho.",
    type: "ENTRADA",
    classification: "RECEITA",
    order: 1,
  },
  {
    name: "Freelance",
    description: "Dinheiro recebido por trabalhos avulsos ou prestação de serviços fora do emprego fixo.",
    type: "ENTRADA",
    classification: "RECEITA",
    order: 2,
  },
  {
    name: "Outras Receitas",
    description: "Qualquer outro dinheiro que entra e não se encaixa em salário ou freelance, como reembolsos ou vendas.",
    type: "ENTRADA",
    classification: "RECEITA",
    order: 3,
  },

  // Custos Obrigatórios — "Gastos necessários para manter sua vida
  // funcionando e cumprir seus compromissos."
  {
    name: "Moradia",
    description: "Aluguel, condomínio, luz, água, internet e outras contas fixas da sua casa.",
    type: "SAIDA",
    classification: "CUSTOS_OBRIGATORIOS",
    order: 1,
  },
  {
    name: "Alimentação",
    description: "Gastos com comida no dia a dia — supermercado, restaurantes, lanches e refeições fora de casa.",
    type: "SAIDA",
    classification: "CUSTOS_OBRIGATORIOS",
    order: 2,
  },
  {
    name: "Saúde",
    description: "Consultas, exames, remédios e plano de saúde — cuidados necessários com o seu bem-estar físico.",
    type: "SAIDA",
    classification: "CUSTOS_OBRIGATORIOS",
    order: 3,
  },
  {
    name: "Educação",
    description: "Mensalidades, cursos e materiais necessários para estudar ou se qualificar.",
    type: "SAIDA",
    classification: "CUSTOS_OBRIGATORIOS",
    order: 4,
  },
  {
    name: "Transporte",
    description: "Deslocamentos do dia a dia para trabalhar ou estudar, como ônibus, metrô, combustível ou aplicativo.",
    type: "SAIDA",
    classification: "CUSTOS_OBRIGATORIOS",
    order: 5,
  },
  {
    name: "Seguros",
    description: "Seguro de vida, residencial, saúde ou outros que protegem você de imprevistos.",
    type: "SAIDA",
    classification: "CUSTOS_OBRIGATORIOS",
    order: 6,
  },
  {
    name: "Impostos",
    description: "Impostos e taxas obrigatórias, como IPVA, IPTU ou Imposto de Renda.",
    type: "SAIDA",
    classification: "CUSTOS_OBRIGATORIOS",
    order: 7,
  },
  {
    name: "Filhos e Família",
    description: "Gastos necessários com filhos ou dependentes, como escola, saúde e itens básicos.",
    type: "SAIDA",
    classification: "CUSTOS_OBRIGATORIOS",
    order: 8,
  },
  {
    name: "Pets",
    description: "Gastos necessários com alimentação, saúde e cuidados básicos do seu animal.",
    type: "SAIDA",
    classification: "CUSTOS_OBRIGATORIOS",
    order: 9,
  },
  {
    name: "Prestadores de Serviço e Serviços",
    description: "Serviços indispensáveis para a casa funcionar, como encanador, eletricista ou diarista.",
    type: "SAIDA",
    classification: "CUSTOS_OBRIGATORIOS",
    order: 10,
  },
  {
    name: "Serviços Financeiros",
    description: "Tarifas bancárias, anuidades e outras taxas cobradas por bancos ou instituições financeiras.",
    type: "SAIDA",
    classification: "CUSTOS_OBRIGATORIOS",
    order: 11,
  },
  {
    name: "Financiamentos e Compromissos Financeiros",
    description: "Gastos com financiamentos, empréstimos, consórcios, parcelamentos e outros compromissos financeiros que precisam ser pagos.",
    type: "SAIDA",
    classification: "CUSTOS_OBRIGATORIOS",
    order: 12,
  },
  {
    name: "Outros Custos Obrigatórios",
    description: "Gastos indispensáveis do dia a dia que não se encaixam em nenhuma outra categoria de custo obrigatório.",
    type: "SAIDA",
    classification: "CUSTOS_OBRIGATORIOS",
    order: 13,
  },

  // Prazeres e Confortos — "Gastos que tornam sua vida mais confortável
  // ou prazerosa, mas que podem ser reduzidos, adiados ou ajustados
  // quando necessário."
  {
    name: "Viagens e Passeios",
    description: "Viagens e passeios de lazer que não são necessários para o seu dia a dia.",
    type: "SAIDA",
    classification: "PRAZERES_E_CONFORTOS",
    order: 1,
  },
  {
    name: "Lanches, Restaurantes e Confraternizações",
    description: "Idas a restaurantes, bares, lanches e encontros sociais por lazer.",
    type: "SAIDA",
    classification: "PRAZERES_E_CONFORTOS",
    order: 2,
  },
  {
    name: "Lazer e Diversão",
    description: "Cinema, shows, jogos e outras formas de entretenimento e diversão.",
    type: "SAIDA",
    classification: "PRAZERES_E_CONFORTOS",
    order: 3,
  },
  {
    name: "Assinaturas",
    description: "Streaming, aplicativos e outras assinaturas recorrentes de entretenimento.",
    type: "SAIDA",
    classification: "PRAZERES_E_CONFORTOS",
    order: 4,
  },
  {
    name: "Compras",
    description: "Compras gerais que não são necessidade imediata, como eletrônicos ou itens diversos que você quis.",
    type: "SAIDA",
    classification: "PRAZERES_E_CONFORTOS",
    order: 5,
  },
  {
    name: "Roupas e Vestuário",
    description: "Roupas, calçados e acessórios além do necessário, como trocas de guarda-roupa por estilo.",
    type: "SAIDA",
    classification: "PRAZERES_E_CONFORTOS",
    order: 6,
  },
  {
    name: "Presentes e Doações",
    description: "Presentes para outras pessoas e doações que você faz por escolha própria.",
    type: "SAIDA",
    classification: "PRAZERES_E_CONFORTOS",
    order: 7,
  },
  {
    name: "Pets",
    description: "Gastos opcionais com seu animal, como acessórios, serviços e outros cuidados que não são indispensáveis.",
    type: "SAIDA",
    classification: "PRAZERES_E_CONFORTOS",
    order: 8,
  },
  {
    name: "Cuidados Pessoais",
    description: "Cuidados extras com beleza e bem-estar, como salão, spa ou produtos além do básico.",
    type: "SAIDA",
    classification: "PRAZERES_E_CONFORTOS",
    order: 9,
  },
  {
    name: "Prestadores de Serviço e Serviços",
    description: "Serviços contratados por conveniência ou conforto, não por necessidade imediata.",
    type: "SAIDA",
    classification: "PRAZERES_E_CONFORTOS",
    order: 10,
  },
  {
    name: "Transporte",
    description: "Deslocamentos por lazer ou conveniência, como aplicativo para sair à noite ou passeios de carro.",
    type: "SAIDA",
    classification: "PRAZERES_E_CONFORTOS",
    order: 11,
  },
  {
    name: "Outros Prazeres e Confortos",
    description: "Qualquer outro gasto por escolha que não se encaixa nas demais categorias de prazer e conforto.",
    type: "SAIDA",
    classification: "PRAZERES_E_CONFORTOS",
    order: 12,
  },

  // Investimentos — "Dinheiro destinado à construção de patrimônio,
  // investimentos e realização de objetivos futuros."
  {
    name: "Carteira de Investimentos",
    description: "Dinheiro aplicado em ações, fundos, renda fixa ou outros investimentos financeiros.",
    type: "SAIDA",
    classification: "INVESTIMENTOS",
    order: 1,
  },
  {
    name: "Metas e Projetos",
    description: "Dinheiro separado para objetivos específicos no futuro, como trocar de carro, fazer uma reforma, comprar um imóvel ou realizar outro projeto.",
    type: "SAIDA",
    classification: "INVESTIMENTOS",
    order: 2,
  },
  {
    name: "Outros Investimentos",
    description: "Qualquer outro valor guardado ou investido para o futuro fora da carteira principal.",
    type: "SAIDA",
    classification: "INVESTIMENTOS",
    order: 3,
  },
];
