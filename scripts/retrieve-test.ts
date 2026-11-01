import { google } from "@ai-sdk/google";
import { embed } from "ai";
import { createClient } from "@supabase/supabase-js";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

async function ask(q: string) {
  const { embedding } = await embed({
    model: google.textEmbeddingModel(process.env.EMBEDDING_MODEL!),
    value: q,
    providerOptions: {
      google: { outputDimensionality: Number(process.env.EMBEDDING_DIM) },
    },
  });
  const { data, error } = await db.rpc("match_kb_chunks", {
    query_embedding: embedding,
    match_threshold: 0.5,
    match_count: 4,
  });
  if (error) throw error;
  console.log("\nQ:", q);
  for (const r of data ?? []) {
    console.log(r.similarity.toFixed(3), "|", r.article_title, "|", r.heading);
  }
  if (!data?.length) console.log("(nothing above threshold)");
}

async function main() {
  for (const q of [
    "I forgot my password",
    "I get a 429 error from the API",
    "How do I set up SSO on the Pro plan?",
    "Can I get my money back?",
    "How do I install the Orbitly mobile app?",
  ])
    await ask(q);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
