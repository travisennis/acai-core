export function extractXml(text: string, tag: string): string {
  const match = text.match(new RegExp(`<${tag}>(.*?)</${tag}>`, "s"));
  return match ? match[1] : "";
}
