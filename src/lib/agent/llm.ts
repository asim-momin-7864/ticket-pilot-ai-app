import { google } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import type { z } from "zod";

export async function generateStructured<T extends z.ZodType>(opts: {
  system: string;
  prompt: string;
  schema: T;
  timeoutMs?: number;
}): Promise<z.infer<T> | null> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const { output } = await generateText({
        model: google(process.env.LLM_MODEL!),
        system: opts.system,
        prompt: opts.prompt,
        output: Output.object({ schema: opts.schema }),
        abortSignal: AbortSignal.timeout(opts.timeoutMs ?? 45_000),
        temperature: 0,
      });
      return output as z.infer<T>;
    } catch (e) {
      console.error(
        `LLM call failed (attempt ${attempt}):`,
        e instanceof Error ? e.message : e,
      );
    }
  }
  return null;
}
