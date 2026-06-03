import type { BloomResponse } from "@mindbloom/shared";

export function bloomFixture(
  sessionId = "mindbloom-session-2026-06-01",
  savedMood = "A quiet mind making room",
): BloomResponse {
  return {
    sessionId,
    capturedAt: "2026-06-01T10:00:00.000Z",
    topWord: "room",
    insights: {
      mood: savedMood,
      moodArc: "The session moved from noise toward clarity.",
      archetype: "The Patient Noticer",
      archetypeCaption: "You stayed with the thought long enough to hear it.",
      sessionSong: "A soft acoustic track with a steady ending.",
      wordOfDay: "room",
      wordOfDayCopy: "It was what the day kept asking for.",
      recurringThread: "You wanted a little more space around your thoughts.",
      shareableTagline: "I made a little room for myself today.",
    },
    snapshot: {
      sessionId,
      nodes: [],
      edges: [],
      memories: [],
      memoryEdges: [],
      capturedAt: "2026-06-01T10:00:00.000Z",
    },
  };
}
