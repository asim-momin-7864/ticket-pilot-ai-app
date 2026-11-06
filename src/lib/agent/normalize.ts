const MAX_LEN = 4000;

function stripQuotedAndSignature(raw: string): string {
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

function redactPII(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    .replace(/\b(?:\d[ -]?){13,16}\b/g, "[card]");
}

export type Normalized = { text: string; logText: string };

export function normalize(raw: string): Normalized {
  const text = stripQuotedAndSignature(raw).slice(0, MAX_LEN);
  return { text, logText: redactPII(text) };
}
