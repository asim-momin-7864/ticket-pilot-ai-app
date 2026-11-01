import { readdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import matter from "gray-matter";
import { google } from "@ai-sdk/google";
import { embedMany } from "ai";
import { createClient } from "@supabase/supabase-js";

const MODEL = process.env.EMBEDDING_MODEL!;
const DIM = Number(process.env.EMBEDDING_DIM);
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

type Piece = { heading: string; text: string };

function chunk(body: string, max = 800, overlap = 80): Piece[] {
  const out: Piece[] = [];
  for (const s of body.split(/\n(?=#{1,3} )/)) {
    const text = s.trim();
    if (!text) continue;
    const m = text.match(/^#{1,3}\s+(.+)/);
    const heading = m ? m[1].trim() : "Overview";
    if (text.length <= max) {
      out.push({ heading, text });
      continue;
    }
    for (let i = 0; i < text.length; i += max - overlap) {
      out.push({ heading, text: text.slice(i, i + max) });
    }
  }
  return out;
}

async function main() {
  const files = readdirSync("kb").filter((f) => f.endsWith(".md"));
  for (const file of files) {
    const raw = readFileSync(`kb/${file}`, "utf8");
    const hash = createHash("sha256").update(raw).digest("hex");

    const { data: fm, content } = matter(raw);
    if (!fm.title) {
      console.warn("skip (no title):", file);
      continue;
    }

    const { data: existing } = await db
      .from("kb_chunks")
      .select("content_hash")
      .eq("source_file", file)
      .limit(1);
    if (existing?.[0]?.content_hash === hash) {
      console.log("skip", file);
      continue;
    }
    await db.from("kb_chunks").delete().eq("source_file", file);

    const pieces = chunk(content);
    const { embeddings } = await embedMany({
      model: google.textEmbeddingModel(MODEL),
      values: pieces.map((p) => `${fm.title}\n${p.heading}\n${p.text}`),
      providerOptions: { google: { outputDimensionality: DIM } },
    });

    const rows = pieces.map((p, i) => ({
      source_file: file,
      article_title: fm.title,
      heading: p.heading,
      content: p.text,
      collection: fm.collection ?? null,
      visibility: fm.visibility ?? "public",
      status: fm.status ?? "current",
      plan: fm.plan ?? null,
      content_hash: hash,
      embedding: embeddings[i],
      model: MODEL,
      embedding_model: MODEL,
    }));
    const { error } = await db.from("kb_chunks").insert(rows);
    if (error) throw error;
    console.log("ingested", file, rows.length, "chunks");
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
