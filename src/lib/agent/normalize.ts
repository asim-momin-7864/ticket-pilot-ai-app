import type { Route } from "./schemas";

const MAX_LEN = 4000;
const INJECTION =
  /(ignore (all |any )?(previous|prior|above) (instructions|prompts?)|disregard .{0,30}instructions|reveal .{0,20}system prompt|you are now)/i;
const SPAM =
  /(viagra|crypto giveaway|work from home \$|click here to claim|http\S+.*http\S+.*http\S+)/i;

export function stripQuotedAndSignature(raw: string): string {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    if (/^On .+ wrote:\s*$/.test(line)) break;
    if (/^-{2,}\s*Original Message/i.test(line)) break;
    if (/^--\s*$/.test(line)) break;
    if (line.startsWith(">")) continue;
    out.push(line);
  }
  return out.join("\n").trim();
}

export function redactPII(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    .replace(/\b(?:\d[ -]?){13,16}\b/g, "[card]");
}

export type Normalized = {
  text: string;
  logText: string;
  flags: { injection: boolean; spam: boolean };
  route: Route | null;
};

export function normalize(raw: string): Normalized {
  const text = stripQuotedAndSignature(raw).slice(0, MAX_LEN);
  const injection = INJECTION.test(text);
  const spam = SPAM.test(text);
  return {
    text,
    logText: redactPII(text),
    flags: { injection, spam },
    route: spam ? "SPAM" : null,
  };
}
