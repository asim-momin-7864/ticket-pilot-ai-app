import { google } from "@ai-sdk/google";
import { embed } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";

export type Doc = {
  id: string;
  article_title: string;
  heading: string;
  content: string;
  similarity: number;
};

export const MATCH_THRESHOLD = 0.6;
export const MAX_DOCS = 4;

export async function retrieve(
  db: SupabaseClient,
  query: string,
): Promise<Doc[]> {
  try {
    const { embedding } = await embed({
      model: google.textEmbeddingModel(process.env.EMBEDDING_MODEL!),
      value: query,
      providerOptions: {
        google: { outputDimensionality: Number(process.env.EMBEDDING_DIM) },
      },
    });
    const { data, error } = await db.rpc("match_kb_chunks", {
      query_embedding: embedding,
      match_threshold: MATCH_THRESHOLD,
      match_count: 6,
    });
    if (error) throw error;
    return ((data ?? []) as Doc[]).slice(0, MAX_DOCS);
  } catch (e) {
    console.error("retrieve failed:", e instanceof Error ? e.message : e);
    return [];
  }
}
