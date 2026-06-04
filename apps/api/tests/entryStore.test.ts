import { describe, expect, it } from "vitest";

import {
  getMemoSessionIdForEntry,
  InMemoryEntryStore,
} from "../src/lib/entryStore.js";

const demoOwner = {
  ownerId: "demo-user",
  ownerKind: "demo" as const,
};

describe("InMemoryEntryStore", () => {
  it("creates multiple entries for the same owner and groups them by day", () => {
    const store = new InMemoryEntryStore();

    const first = store.createEntry({
      ...demoOwner,
      title: "Morning thoughts",
      purpose: "journal",
      mode: "classic",
    });
    const second = store.createEntry({
      ...demoOwner,
      title: "Product idea",
      purpose: "idea",
      mode: "mixed",
    });

    expect(first.memoSessionId).toBe(getMemoSessionIdForEntry(first.id));
    expect(second.memoSessionId).toBe(getMemoSessionIdForEntry(second.id));
    expect(first.memoSessionId).not.toBe(second.memoSessionId);

    const groups = store.listEntriesGroupedByDay(demoOwner);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.entries.map((entry) => entry.id).sort()).toEqual(
      [first.id, second.id].sort(),
    );
  });

  it("tracks document versions and ingestion boundaries", () => {
    const store = new InMemoryEntryStore();
    const entry = store.createEntry({
      ...demoOwner,
      purpose: "brainstorm",
      mode: "classic",
    });

    const firstDraft = store.upsertDocument({
      entryId: entry.id,
      content: "First pass",
    });
    const secondDraft = store.upsertDocument({
      entryId: entry.id,
      content: "Second pass",
    });
    const ingested = store.markDocumentIngested(entry.id, secondDraft.version);

    expect(firstDraft.version).toBe(1);
    expect(secondDraft.version).toBe(2);
    expect(ingested?.lastIngestedVersion).toBe(2);
  });

  it("stores notes, messages, graft records, and reflections by source entry", () => {
    const store = new InMemoryEntryStore();
    const entry = store.createEntry({
      ...demoOwner,
      title: "A note-worthy entry",
      purpose: "journal",
      mode: "mixed",
    });

    const message = store.addMessage({
      entryId: entry.id,
      role: "user",
      content: "I keep returning to this thought.",
    });
    const note = store.createNote({
      ...demoOwner,
      entryId: entry.id,
      body: "Remember this thought.",
      sourceType: "entry-selection",
      sourceMessageId: message.id,
    });
    const graft = store.createGraft({
      entryId: entry.id,
      query: "boundaries",
      themeLabel: "Setting better boundaries",
      similarity: 0.82,
    });
    const reflection = store.createReflection({
      entryId: entry.id,
      graphSnapshot: null,
      cards: [
        {
          id: "card-1",
          type: "word",
          title: "A word to carry forward",
          body: "Space",
        },
      ],
    });

    expect(store.listMessages(entry.id)).toEqual([message]);
    expect(store.listNotes(demoOwner)).toEqual([note]);
    expect(store.listGrafts(entry.id)).toEqual([graft]);
    expect(store.listReflections(entry.id)).toEqual([reflection]);
  });
});
