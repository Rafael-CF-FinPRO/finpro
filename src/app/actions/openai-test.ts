"use server";

import { getOpenAIClient } from "@/lib/openai";

export type OpenAIConnectionTestResult =
  | { success: true; model: string; reply: string }
  | { success: false; error: string };

// Connectivity-only test — confirms the server can reach the OpenAI API
// with the configured key. Not wired into any page/route yet and not
// used by any real feature — intelligent categorization (the eventual
// real use of this connection) is separate, later work. Never returns
// the API key, only the model used and the model's reply.
export async function testOpenAIConnection(): Promise<OpenAIConnectionTestResult> {
  try {
    const client = getOpenAIClient();
    const model = "gpt-4o-mini";

    const response = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: "Responda apenas com a palavra: OK" }],
      max_tokens: 5,
    });

    const reply = response.choices[0]?.message?.content?.trim() ?? "";
    return { success: true, model, reply };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido ao conectar com a OpenAI.";
    return { success: false, error: message };
  }
}
