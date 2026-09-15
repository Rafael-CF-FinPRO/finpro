-- Consórcios: "Administradora/Instituição" and "Valor Já Pago no
-- Controle" — purely additive, no existing column altered or dropped.

ALTER TABLE "PatrimonioLiability" ADD COLUMN "institutionName" TEXT;
ALTER TABLE "PatrimonioLiability" ADD COLUMN "paidValueCents" INTEGER;
