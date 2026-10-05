import type { RelatedThought } from "@mindbloom/shared";
import type { RetrievalResult } from "memo-grafter";

export interface ThoughtSourceDocument {
  id: string;
  memoSessionId: string;
  title: string;
  sourceUrl: string;
}

export function selectTopRelatedThoughts(
  result: RetrievalResult,
  documents: ThoughtSourceDocument[],
  currentDocumentId: string,
  limit = 6,
): RelatedThought[] {
  const documentBySession = new Map(
    documents.filter((document) => document.id !== currentDocumentId).map((document) => [document.memoSessionId, document]),
  );
  const themeById = new Map(result.nodes.map((node) => [node.id, node.label]));
  const byMeaning = new Map<string, RelatedThought>();

  for (const fact of result.facts) {
    const document = documentBySession.get(fact.sessionId);
    if (!document) continue;
    const span = fact.sourceSpans?.[0];
    const thought: RelatedThought = {
      id: fact.id,
      memoryId: fact.id,
      documentId: document.id,
      documentTitle: document.title,
      sourceUrl: document.sourceUrl,
      text: fact.value,
      theme: themeById.get(fact.topicNodeId) ?? fact.subject,
      memoryType: fact.memoryType,
      sectionId: span?.section.id ?? null,
      sectionTitle: span?.section.title ?? null,
      relevance: fact.similarity,
    };
    const meaningKey = `${document.id}:${fact.value.trim().toLocaleLowerCase()}`;
    const previous = byMeaning.get(meaningKey);
    if (!previous || (thought.relevance ?? 0) > (previous.relevance ?? 0)) byMeaning.set(meaningKey, thought);
  }

  return [...byMeaning.values()]
    .sort((left, right) => (right.relevance ?? 0) - (left.relevance ?? 0))
    .slice(0, limit);
}
