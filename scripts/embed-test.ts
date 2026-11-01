import { google } from "@ai-sdk/google";
import { embed } from "ai";

async function main() {
  const { embedding } = await embed({
    model: google.textEmbeddingModel(process.env.EMBEDDING_MODEL!),
    value: "reset password",
    providerOptions: {
      google: { outputDimensionality: Number(process.env.EMBEDDING_DIM) },
    },
  });
  console.log("vector length:", embedding.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
