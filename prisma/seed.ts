import { randomUUID } from "node:crypto";
import pg from "pg";

const CATEGORIES: {
  name: string;
  type: "ENTRADA" | "SAIDA";
  classification: "RECEITA" | "CUSTO_FIXO" | "CUSTO_VARIAVEL";
  order: number;
}[] = [
  // Entradas
  { name: "Salário", type: "ENTRADA", classification: "RECEITA", order: 1 },
  { name: "Freelance", type: "ENTRADA", classification: "RECEITA", order: 2 },
  { name: "Investimentos", type: "ENTRADA", classification: "RECEITA", order: 3 },
  { name: "Outras Receitas", type: "ENTRADA", classification: "RECEITA", order: 4 },

  // Saídas — Custos Fixos
  { name: "Moradia", type: "SAIDA", classification: "CUSTO_FIXO", order: 1 },
  { name: "Contas e Utilidades", type: "SAIDA", classification: "CUSTO_FIXO", order: 2 },
  { name: "Assinaturas", type: "SAIDA", classification: "CUSTO_FIXO", order: 3 },
  { name: "Educação", type: "SAIDA", classification: "CUSTO_FIXO", order: 4 },

  // Saídas — Custos Variáveis
  { name: "Supermercado", type: "SAIDA", classification: "CUSTO_VARIAVEL", order: 5 },
  { name: "Transporte", type: "SAIDA", classification: "CUSTO_VARIAVEL", order: 6 },
  { name: "Saúde", type: "SAIDA", classification: "CUSTO_VARIAVEL", order: 7 },
  { name: "Lazer", type: "SAIDA", classification: "CUSTO_VARIAVEL", order: 8 },
  { name: "Vestuário", type: "SAIDA", classification: "CUSTO_VARIAVEL", order: 9 },
  { name: "Outras Despesas", type: "SAIDA", classification: "CUSTO_VARIAVEL", order: 10 },
];

async function main() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    for (const category of CATEGORIES) {
      await client.query(
        `INSERT INTO "Category" (id, name, type, classification, "order")
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (name, type)
         DO UPDATE SET classification = EXCLUDED.classification, "order" = EXCLUDED."order"`,
        [randomUUID(), category.name, category.type, category.classification, category.order]
      );
    }
    console.log(`Seeded ${CATEGORIES.length} categories.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
