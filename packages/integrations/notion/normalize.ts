import type { NotionBlockLike, NotionRichText } from "./types.js";

export function notionRichText(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value.map((item) => (item as NotionRichText).plain_text ?? "").join("");
}

export function notionRichTextToMarkdown(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value.map((raw) => {
    const item = raw as NotionRichText;
    let text = item.plain_text ?? "";
    if (item.annotations?.code) text = `\`${text}\``;
    if (item.annotations?.bold) text = `**${text}**`;
    if (item.annotations?.italic) text = `*${text}*`;
    if (item.annotations?.strikethrough) text = `~~${text}~~`;
    if (item.href) text = `[${text}](${item.href})`;
    return text;
  }).join("");
}

function blockPayload(block: NotionBlockLike): Record<string, unknown> {
  const value = block[block.type];
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

export function notionBlockToMarkdown(block: NotionBlockLike, children = ""): string {
  const payload = blockPayload(block);
  const text = notionRichTextToMarkdown(payload.rich_text);
  let line = "";
  switch (block.type) {
    case "paragraph": line = text; break;
    case "heading_1": line = `# ${text}`; break;
    case "heading_2": line = `## ${text}`; break;
    case "heading_3": line = `### ${text}`; break;
    case "bulleted_list_item": line = `- ${text}`; break;
    case "numbered_list_item": line = `1. ${text}`; break;
    case "to_do": line = `- [${payload.checked ? "x" : " "}] ${text}`; break;
    case "toggle": line = text; break;
    case "quote": line = `> ${text}`; break;
    case "callout": line = `> ${text}`; break;
    case "code": line = `\`\`\`${String(payload.language ?? "")}\n${text}\n\`\`\``; break;
    case "divider": line = "---"; break;
    case "bookmark":
    case "embed":
    case "link_preview": line = String(payload.url ?? ""); break;
    case "child_page": line = `## ${String(payload.title ?? "Untitled")}`; break;
    case "child_database": line = `## ${String(payload.title ?? "Untitled database")}`; break;
    default: line = text;
  }
  return [line, children].filter((part) => part.trim()).join("\n");
}

export function notionBlockText(block: NotionBlockLike): string {
  const payload = blockPayload(block);
  if (block.type === "child_page" || block.type === "child_database") {
    return String(payload.title ?? "").trim();
  }
  return notionRichText(payload.rich_text).trim();
}

export function isNotionHeading(block: NotionBlockLike): boolean {
  return block.type === "heading_1" || block.type === "heading_2" || block.type === "heading_3";
}

export function notionPageTitle(page: Record<string, unknown>): string {
  const properties = page.properties as Record<string, Record<string, unknown>> | undefined;
  for (const property of Object.values(properties ?? {})) {
    if (property.type === "title") {
      return notionRichText(property.title).trim() || "Untitled";
    }
  }
  return "Untitled";
}
