-- Adds an optional phone contact field, shown/edited only on the new
-- "Meu Perfil" screen — nullable, so every existing row is unaffected.
ALTER TABLE "User" ADD COLUMN "phone" TEXT;
