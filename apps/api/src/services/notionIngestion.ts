import type { NotionDocument, NotionDocumentSection } from "@mindbloom/integrations";
import type { DocumentInput, IngestDocumentOptions, TextIngestionReceipt } from "memo-grafter";

export const NOTION_INGESTION_TIMEOUT_MS = 120_000;

export const notionIngestionOptions: IngestDocumentOptions = {
  replace: true,
  chunking: {
    strategy: "paragraph",
    targetCharacters: 1_800,
    maxCharacters: 3_000,
    maxChunks: 8,
    preserveHeadings: true,
  },
  segmentation: {
    strategy: "drift",
    minChunks: 2,
    maxTopics: 6,
  },
  memoryBudget: {
    maxPerSegment: 4,
    maxPerDocument: 12,
    deduplicate: true,
    preferredTypes: ["insight", "question", "task", "fact", "reference"],
  },
  qualityPolicy: {
    mode: "enforce",
    minExplicitness: 0.65,
  },
  sourceReliability: 0.85,
  concurrency: {
    extraction: 2,
    embedding: 4,
  },
};

export function notionIngestionOptionsFor(page: NotionDocument): IngestDocumentOptions {
  const meaningfulSections = page.sections.filter((section) => section.content.trim().length >= 80);
  if (meaningfulSections.length >= 2) {
    return {
      ...notionIngestionOptions,
      chunking: {
        strategy: "section",
        targetCharacters: 1_000,
        maxCharacters: 1_800,
        maxChunks: 6,
        preserveHeadings: true,
      },
      segmentation: { strategy: "per-chunk", maxTopics: 6 },
    };
  }
  return {
    ...notionIngestionOptions,
    chunking: {
      strategy: "paragraph",
      targetCharacters: 1_000,
      maxCharacters: 1_800,
      maxChunks: 6,
      preserveHeadings: true,
    },
    segmentation: { strategy: "drift", minChunks: 1, maxTopics: 6 },
  };
}

export function markdownToDocumentSections(markdown: string): NotionDocumentSection[] {
  const sections: NotionDocumentSection[] = [];
  let title: string | undefined;
  let lines: string[] = [];
  let inFence = false;
  const flush = () => {
    const content = lines.join("\n").trim();
    if (content) sections.push({ id: `local-section-${sections.length + 1}`, title, content, blockIds: [], order: sections.length });
    lines = [];
  };
  for (const line of markdown.split(/\r?\n/)) {
    if (/^\s*```/.test(line)) inFence = !inFence;
    const heading = !inFence ? line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/) : null;
    if (heading) {
      flush();
      title = heading[1]?.trim();
    }
    lines.push(line);
  }
  flush();
  return sections;
}

export function toMemoGrafterDocument(page: NotionDocument): DocumentInput {
  const source = {
    id: page.id,
    title: page.title,
    ...(page.url.startsWith("http://") || page.url.startsWith("https://") ? { url: page.url } : {}),
    metadata: { provider: "notion", createdAt: page.createdAt, updatedAt: page.updatedAt },
  };
  const sections = page.sections
    .filter((section) => section.content.trim())
    .map((section) => ({
      id: section.id,
      title: section.title,
      content: section.content,
      metadata: { blockIds: section.blockIds, order: section.order },
    }));
  if (sections.length) return { ...source, sections };
  return { ...source, content: page.content.trim() || page.title };
}

export function receiptCounts(receipt: TextIngestionReceipt): Record<string, unknown> {
  return {
    chunks: receipt.chunkCount,
    segments: receipt.segmentCount ?? 0,
    topics: receipt.topicCount ?? 0,
    ...(receipt.counts ?? {}),
  };
}

export function receiptWarnings(receipt: TextIngestionReceipt) {
  return receipt.warnings.map((warning) => ({
    code: warning.code,
    operation: warning.operation,
    ...(warning.stage ? { stage: warning.stage } : {}),
  }));
}

export function isSuccessfulIngestion(status: TextIngestionReceipt["status"]): boolean {
  return status === "completed" || status === "completed_with_warnings";
}
