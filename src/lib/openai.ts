import OpenAI from "openai";

// Server-only — never import this from a Client Component. The key is
// read straight from process.env (never a NEXT_PUBLIC_ var) and never
// leaves the server; nothing in this file returns it.
let client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY não está configurada no ambiente do servidor.");
  }
  if (!client) {
    client = new OpenAI({ apiKey });
  }
  return client;
}
