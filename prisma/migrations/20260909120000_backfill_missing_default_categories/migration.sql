-- Some existing users registered before the full official category list
-- (src/lib/default-categories.ts) reached its current shape, so they
-- only ever got a smaller/older starter set — e.g. a user might have
-- "Alimentação" but never got "Seguros", "Pets" under Prazeres e
-- Confortos, "Carteira de Investimentos", etc. This isn't a
-- classification mix-up (nothing to "correct"), the rows simply never
-- existed — so for every user, backfill any official category they're
-- still missing, matched by (name, type, classification) so a category
-- they already have (wherever it lives) is never duplicated.
--
-- Custom/legacy categories outside this list (e.g. "Contas e
-- Utilidades", a standalone "Investimentos") are untouched — inventing
-- a mapping for those is still out of scope, same as previous passes.
-- No Transaction or existing Category row is touched.
--
-- `order` for backfilled rows starts at 101 (well above any realistic
-- existing value) plus a per-user, per-classification sequence, so the
-- newly-added categories sort after whatever the user already had
-- without needing to know their exact current max order.

INSERT INTO "Category" (id, "userId", name, description, type, classification, "order", "isActive", "createdAt")
SELECT
  gen_random_uuid()::text,
  ranked."userId",
  ranked.name,
  ranked.description,
  ranked.type::"TransactionType",
  ranked.classification::"Classification",
  100 + ranked.rn,
  true,
  now()
FROM (
  SELECT
    u.id AS "userId",
    v.name,
    v.description,
    v.type,
    v.classification,
    ROW_NUMBER() OVER (PARTITION BY u.id, v.classification ORDER BY v."order") AS rn
  FROM "User" u
  CROSS JOIN (VALUES
    ('Salário', 'Valor fixo que você recebe todo mês do seu emprego ou contrato de trabalho.', 'ENTRADA', 'RECEITA', 1),
    ('Freelance', 'Dinheiro recebido por trabalhos avulsos ou prestação de serviços fora do emprego fixo.', 'ENTRADA', 'RECEITA', 2),
    ('Outras Receitas', 'Qualquer outro dinheiro que entra e não se encaixa em salário ou freelance, como reembolsos ou vendas.', 'ENTRADA', 'RECEITA', 3),
    ('Moradia', 'Aluguel, condomínio, luz, água, internet e outras contas fixas da sua casa.', 'SAIDA', 'CUSTOS_OBRIGATORIOS', 1),
    ('Alimentação', 'Gastos com comida no dia a dia — supermercado, restaurantes, lanches e refeições fora de casa.', 'SAIDA', 'CUSTOS_OBRIGATORIOS', 2),
    ('Saúde', 'Consultas, exames, remédios e plano de saúde — cuidados necessários com o seu bem-estar físico.', 'SAIDA', 'CUSTOS_OBRIGATORIOS', 3),
    ('Educação', 'Mensalidades, cursos e materiais necessários para estudar ou se qualificar.', 'SAIDA', 'CUSTOS_OBRIGATORIOS', 4),
    ('Transporte', 'Deslocamentos do dia a dia para trabalhar ou estudar, como ônibus, metrô, combustível ou aplicativo.', 'SAIDA', 'CUSTOS_OBRIGATORIOS', 5),
    ('Seguros', 'Seguro de vida, residencial, saúde ou outros que protegem você de imprevistos.', 'SAIDA', 'CUSTOS_OBRIGATORIOS', 6),
    ('Impostos', 'Impostos e taxas obrigatórias, como IPVA, IPTU ou Imposto de Renda.', 'SAIDA', 'CUSTOS_OBRIGATORIOS', 7),
    ('Filhos e Família', 'Gastos necessários com filhos ou dependentes, como escola, saúde e itens básicos.', 'SAIDA', 'CUSTOS_OBRIGATORIOS', 8),
    ('Pets', 'Gastos necessários com alimentação, saúde e cuidados básicos do seu animal.', 'SAIDA', 'CUSTOS_OBRIGATORIOS', 9),
    ('Prestadores de Serviço e Serviços', 'Serviços indispensáveis para a casa funcionar, como encanador, eletricista ou diarista.', 'SAIDA', 'CUSTOS_OBRIGATORIOS', 10),
    ('Serviços Financeiros', 'Tarifas bancárias, anuidades e outras taxas cobradas por bancos ou instituições financeiras.', 'SAIDA', 'CUSTOS_OBRIGATORIOS', 11),
    ('Financiamentos e Compromissos Financeiros', 'Gastos com financiamentos, empréstimos, consórcios, parcelamentos e outros compromissos financeiros que precisam ser pagos.', 'SAIDA', 'CUSTOS_OBRIGATORIOS', 12),
    ('Outros Custos Obrigatórios', 'Gastos indispensáveis do dia a dia que não se encaixam em nenhuma outra categoria de custo obrigatório.', 'SAIDA', 'CUSTOS_OBRIGATORIOS', 13),
    ('Viagens e Passeios', 'Viagens e passeios de lazer que não são necessários para o seu dia a dia.', 'SAIDA', 'PRAZERES_E_CONFORTOS', 1),
    ('Lanches, Restaurantes e Confraternizações', 'Idas a restaurantes, bares, lanches e encontros sociais por lazer.', 'SAIDA', 'PRAZERES_E_CONFORTOS', 2),
    ('Lazer e Diversão', 'Cinema, shows, jogos e outras formas de entretenimento e diversão.', 'SAIDA', 'PRAZERES_E_CONFORTOS', 3),
    ('Assinaturas', 'Streaming, aplicativos e outras assinaturas recorrentes de entretenimento.', 'SAIDA', 'PRAZERES_E_CONFORTOS', 4),
    ('Compras', 'Compras gerais que não são necessidade imediata, como eletrônicos ou itens diversos que você quis.', 'SAIDA', 'PRAZERES_E_CONFORTOS', 5),
    ('Roupas e Vestuário', 'Roupas, calçados e acessórios além do necessário, como trocas de guarda-roupa por estilo.', 'SAIDA', 'PRAZERES_E_CONFORTOS', 6),
    ('Presentes e Doações', 'Presentes para outras pessoas e doações que você faz por escolha própria.', 'SAIDA', 'PRAZERES_E_CONFORTOS', 7),
    ('Pets', 'Gastos opcionais com seu animal, como acessórios, serviços e outros cuidados que não são indispensáveis.', 'SAIDA', 'PRAZERES_E_CONFORTOS', 8),
    ('Cuidados Pessoais', 'Cuidados extras com beleza e bem-estar, como salão, spa ou produtos além do básico.', 'SAIDA', 'PRAZERES_E_CONFORTOS', 9),
    ('Prestadores de Serviço e Serviços', 'Serviços contratados por conveniência ou conforto, não por necessidade imediata.', 'SAIDA', 'PRAZERES_E_CONFORTOS', 10),
    ('Transporte', 'Deslocamentos por lazer ou conveniência, como aplicativo para sair à noite ou passeios de carro.', 'SAIDA', 'PRAZERES_E_CONFORTOS', 11),
    ('Outros Prazeres e Confortos', 'Qualquer outro gasto por escolha que não se encaixa nas demais categorias de prazer e conforto.', 'SAIDA', 'PRAZERES_E_CONFORTOS', 12),
    ('Carteira de Investimentos', 'Dinheiro aplicado em ações, fundos, renda fixa ou outros investimentos financeiros.', 'SAIDA', 'INVESTIMENTOS', 1),
    ('Metas e Projetos', 'Dinheiro separado para objetivos específicos no futuro, como trocar de carro, fazer uma reforma, comprar um imóvel ou realizar outro projeto.', 'SAIDA', 'INVESTIMENTOS', 2),
    ('Outros Investimentos', 'Qualquer outro valor guardado ou investido para o futuro fora da carteira principal.', 'SAIDA', 'INVESTIMENTOS', 3)
  ) AS v(name, description, type, classification, "order")
  WHERE NOT EXISTS (
    SELECT 1 FROM "Category" c
    WHERE c."userId" = u.id
      AND c.name = v.name
      AND c.type = v.type::"TransactionType"
      AND c.classification = v.classification::"Classification"
  )
) AS ranked;
