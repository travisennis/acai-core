export function extractXml(text: string, tag: string): string {
  const match = text.match(new RegExp(`<${tag}>(.*?)</${tag}>`, "s"));
  return match ? (match[1] ?? "") : "";
}

export function removeAllLineBreaks(text: string) {
  return text.replace(/(\r\n|\n|\r)/gm, " ");
}

export function removeHtmLtags(text: string) {
  return text.replace(/<[^>]*>?/gm, "");
}
