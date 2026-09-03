-- Every Classification and Category now shows a short, plain-language
-- description directly in Orçamento (never in a tooltip), meant to help
-- the user decide where a given expense belongs. Classification
-- descriptions are a fixed set of 5, kept in code
-- (src/lib/transaction-labels.ts). Category descriptions live on the
-- row itself since categories are per-user and user-editable.

ALTER TABLE "Category" ADD COLUMN "description" TEXT;

-- Backfill every existing category that still matches one of the
-- official default names (name + type + classification) with its
-- canonical description — see src/lib/default-categories.ts, which is
-- the single source of truth these strings are copied from. A category
-- a user has renamed, or created themselves, has no match here and
-- stays NULL; the create/edit category form now requires a description
-- going forward.
UPDATE "Category" c SET "description" = v.description
FROM (VALUES
  ('Salário', 'ENTRADA', 'RECEITA', 'Valor fixo que você recebe todo mês do seu emprego ou contrato de trabalho.'),
  ('Freelance', 'ENTRADA', 'RECEITA', 'Dinheiro recebido por trabalhos avulsos ou prestação de serviços fora do emprego fixo.'),
  ('Outras Receitas', 'ENTRADA', 'RECEITA', 'Qualquer outro dinheiro que entra e não se encaixa em salário ou freelance, como reembolsos ou vendas.'),

  ('Saúde', 'SAIDA', 'ESSENCIAIS', 'Consultas, exames, remédios e plano de saúde — cuidados necessários com o seu bem-estar físico.'),
  ('Alimentação', 'SAIDA', 'ESSENCIAIS', 'Refeições do dia a dia fora de casa, como almoço no trabalho ou lanches rápidos.'),
  ('Educação', 'SAIDA', 'ESSENCIAIS', 'Mensalidades, cursos e materiais necessários para estudar ou se qualificar.'),
  ('Essenciais Geral', 'SAIDA', 'ESSENCIAIS', 'Gastos indispensáveis do dia a dia que não se encaixam em nenhuma outra categoria essencial.'),
  ('Mercado', 'SAIDA', 'ESSENCIAIS', 'Compras de supermercado para alimentação e itens básicos de casa.'),
  ('Moradia', 'SAIDA', 'ESSENCIAIS', 'Aluguel, condomínio, luz, água, internet e outras contas fixas da sua casa.'),
  ('Pets - Essencial', 'SAIDA', 'ESSENCIAIS', 'Gastos necessários com alimentação, saúde e cuidados básicos do seu animal.'),
  ('Prestadores de Serviço - Essencial', 'SAIDA', 'ESSENCIAIS', 'Serviços indispensáveis para a casa funcionar, como encanador, eletricista ou diarista.'),
  ('Seguros', 'SAIDA', 'ESSENCIAIS', 'Seguro de vida, residencial, saúde ou outros que protegem você de imprevistos.'),
  ('Serviços Financeiros', 'SAIDA', 'ESSENCIAIS', 'Tarifas bancárias, anuidades e outras taxas cobradas por bancos ou instituições financeiras.'),
  ('Transporte - Essencial', 'SAIDA', 'ESSENCIAIS', 'Deslocamentos do dia a dia para trabalhar ou estudar, como ônibus, metrô, combustível ou aplicativo.'),
  ('Imposto', 'SAIDA', 'ESSENCIAIS', 'Impostos e taxas obrigatórias, como IPVA, IPTU ou Imposto de Renda.'),
  ('Cuidados Pessoais - Essencial', 'SAIDA', 'ESSENCIAIS', 'Itens básicos de higiene e saúde pessoal que você não pode deixar de ter.'),
  ('Filhos e Família', 'SAIDA', 'ESSENCIAIS', 'Gastos necessários com filhos ou dependentes, como escola, saúde e itens básicos.'),

  ('Viagens e Passeios', 'SAIDA', 'NAO_ESSENCIAIS', 'Viagens e passeios de lazer que não são necessários para o seu dia a dia.'),
  ('Assinaturas', 'SAIDA', 'NAO_ESSENCIAIS', 'Streaming, aplicativos e outras assinaturas recorrentes de entretenimento.'),
  ('Compras', 'SAIDA', 'NAO_ESSENCIAIS', 'Compras gerais que não são necessidade imediata, como eletrônicos ou itens diversos que você quis.'),
  ('Lanches, Restaurante e Confraternizações', 'SAIDA', 'NAO_ESSENCIAIS', 'Idas a restaurantes, bares, lanches e encontros sociais por lazer.'),
  ('Lazer e Diversão', 'SAIDA', 'NAO_ESSENCIAIS', 'Cinema, shows, jogos e outras formas de entretenimento e diversão.'),
  ('Pets - Não Essencial', 'SAIDA', 'NAO_ESSENCIAIS', 'Gastos opcionais com seu animal, como acessórios, serviços e outros cuidados que não são indispensáveis.'),
  ('Presentes e Doações', 'SAIDA', 'NAO_ESSENCIAIS', 'Presentes para outras pessoas e doações que você faz por escolha própria.'),
  ('Cuidados Pessoais - Não Essencial', 'SAIDA', 'NAO_ESSENCIAIS', 'Cuidados extras com beleza e bem-estar, como salão, spa ou produtos além do básico.'),
  ('Prestadores de Serviço - Não Essencial', 'SAIDA', 'NAO_ESSENCIAIS', 'Serviços contratados por conveniência ou conforto, não por necessidade imediata.'),
  ('Roupas e Vestuário', 'SAIDA', 'NAO_ESSENCIAIS', 'Roupas, calçados e acessórios além do necessário, como trocas de guarda-roupa por estilo.'),
  ('Transporte - Não Essencial', 'SAIDA', 'NAO_ESSENCIAIS', 'Deslocamentos por lazer ou conveniência, como aplicativo para sair à noite ou passeios de carro.'),
  ('Outros Não Essenciais', 'SAIDA', 'NAO_ESSENCIAIS', 'Qualquer outro gasto por escolha que não se encaixa nas demais categorias não essenciais.'),

  ('Consórcio', 'SAIDA', 'DIVIDAS', 'Parcelas de consórcio que você paga para receber um bem no futuro.'),
  ('Empréstimo', 'SAIDA', 'DIVIDAS', 'Parcelas de empréstimos pessoais ou bancários que você contraiu.'),
  ('Financiamento', 'SAIDA', 'DIVIDAS', 'Parcelas de financiamentos, como carro, imóvel ou outros bens comprados a prazo.'),
  ('Financiamentos e Dívidas Geral', 'SAIDA', 'DIVIDAS', 'Outras dívidas e financiamentos que não se encaixam nas categorias específicas acima.'),
  ('Parcelamento Cartão', 'SAIDA', 'DIVIDAS', 'Compras parceladas no cartão de crédito que ainda estão sendo pagas.'),

  ('Carteira de Investimentos', 'SAIDA', 'INVESTIMENTOS', 'Dinheiro aplicado em ações, fundos, renda fixa ou outros investimentos financeiros.'),
  ('Outros Investimentos', 'SAIDA', 'INVESTIMENTOS', 'Qualquer outro valor guardado ou investido para o futuro fora da carteira principal.')
) AS v(name, type, classification, description)
WHERE c.name = v.name
  AND c.type = v.type::"TransactionType"
  AND c.classification = v.classification::"Classification"
  AND c.description IS NULL;
