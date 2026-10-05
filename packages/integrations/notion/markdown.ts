import type { Client } from "@notionhq/client";

type AppendChildren = Parameters<Client["blocks"]["children"]["append"]>[0]["children"];
type NotionBlockRequest = AppendChildren[number];
type RichText = Array<{
  type: "text";
  text: { content: string; link?: { url: string } | null };
  annotations?: { bold?: boolean; italic?: boolean; strikethrough?: boolean; code?: boolean };
}>;

const inlinePattern = /(\[([^\]]+)\]\((https?:\/\/[^ )]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|~~([^~]+)~~|`([^`]+)`|\*([^*\n]+)\*|_([^_\n]+)_)/g;

function pushText(output: RichText, content: string, annotations?: RichText[number]["annotations"], url?: string) {
  for (let index = 0; index < content.length; index += 1_900) {
    output.push({ type: "text", text: { content: content.slice(index, index + 1_900), ...(url ? { link: { url } } : {}) }, ...(annotations ? { annotations } : {}) });
  }
}

function plainTextToNotionRichText(value: string): RichText {
  const output: RichText = [];
  pushText(output, value);
  return output;
}

function notionCodeLanguage(value: string): string {
  const aliases: Record<string, string> = { js: "javascript", jsx: "javascript", ts: "typescript", tsx: "typescript", py: "python", sh: "shell", bash: "shell", md: "markdown", yml: "yaml" };
  return aliases[value.toLowerCase()] ?? "plain text";
}

export function markdownInlineToNotionRichText(markdown: string): RichText {
  const output: RichText = [];
  let cursor = 0;
  for (const match of markdown.matchAll(inlinePattern)) {
    const index = match.index ?? 0;
    if (index > cursor) pushText(output, markdown.slice(cursor, index));
    if (match[2] && match[3]) pushText(output, match[2], undefined, match[3]);
    else if (match[4] || match[5]) pushText(output, match[4] ?? match[5] ?? "", { bold: true });
    else if (match[6]) pushText(output, match[6], { strikethrough: true });
    else if (match[7]) pushText(output, match[7], { code: true });
    else pushText(output, match[8] ?? match[9] ?? "", { italic: true });
    cursor = index + match[0].length;
  }
  if (cursor < markdown.length) pushText(output, markdown.slice(cursor));
  return output.length ? output : [{ type: "text", text: { content: "" } }];
}

function richTextBlock(type: "paragraph" | "heading_1" | "heading_2" | "heading_3" | "bulleted_list_item" | "numbered_list_item" | "quote", text: string): NotionBlockRequest {
  return { object: "block", type, [type]: { rich_text: markdownInlineToNotionRichText(text) } } as NotionBlockRequest;
}

export function markdownToNotionBlocks(markdown: string): AppendChildren {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: NotionBlockRequest[] = [];
  let paragraph: string[] = [];
  const flushParagraph = () => {
    const content = paragraph.join("\n").trim();
    if (content) blocks.push(richTextBlock("paragraph", content));
    paragraph = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const fence = line.match(/^```\s*([^\s`]*)\s*$/);
    if (fence) {
      flushParagraph();
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !/^```\s*$/.test(lines[index] ?? "")) {
        code.push(lines[index] ?? "");
        index += 1;
      }
      blocks.push({ object: "block", type: "code", code: { rich_text: plainTextToNotionRichText(code.join("\n")), language: notionCodeLanguage(fence[1] ?? "") } } as NotionBlockRequest);
      continue;
    }
    if (!line.trim()) { flushParagraph(); continue; }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    const task = line.match(/^[-*+]\s+\[([ xX])\]\s+(.+)$/);
    const bullet = line.match(/^[-*+]\s+(.+)$/);
    const numbered = line.match(/^\d+[.)]\s+(.+)$/);
    const quote = line.match(/^>\s?(.*)$/);
    if (heading) { flushParagraph(); blocks.push(richTextBlock(`heading_${heading[1].length}` as "heading_1" | "heading_2" | "heading_3", heading[2] ?? "")); }
    else if (task) { flushParagraph(); blocks.push({ object: "block", type: "to_do", to_do: { rich_text: markdownInlineToNotionRichText(task[2] ?? ""), checked: task[1]?.toLowerCase() === "x" } } as NotionBlockRequest); }
    else if (bullet) { flushParagraph(); blocks.push(richTextBlock("bulleted_list_item", bullet[1] ?? "")); }
    else if (numbered) { flushParagraph(); blocks.push(richTextBlock("numbered_list_item", numbered[1] ?? "")); }
    else if (quote) { flushParagraph(); blocks.push(richTextBlock("quote", quote[1] ?? "")); }
    else if (/^(---|\*\*\*|___)$/.test(line.trim())) { flushParagraph(); blocks.push({ object: "block", type: "divider", divider: {} } as NotionBlockRequest); }
    else paragraph.push(line);
  }
  flushParagraph();
  return blocks;
}
