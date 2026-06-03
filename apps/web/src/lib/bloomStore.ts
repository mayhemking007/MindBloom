import type { BloomResponse } from "@mindbloom/shared";

export interface SavedBloom extends BloomResponse {
  savedAt: string;
}

function getBloomStorageKey(sessionId: string): string {
  return `mindbloom:blooms:${sessionId}`;
}

function isSavedBloom(value: unknown): value is SavedBloom {
  if (!value || typeof value !== "object") {
    return false;
  }

  const bloom = value as Partial<SavedBloom>;
  const insights = bloom.insights;
  const snapshot = bloom.snapshot;

  return (
    typeof bloom.sessionId === "string" &&
    bloom.sessionId.startsWith("mindbloom-session-") &&
    typeof bloom.savedAt === "string" &&
    typeof bloom.capturedAt === "string" &&
    typeof bloom.topWord === "string" &&
    Boolean(insights) &&
    typeof insights?.mood === "string" &&
    typeof insights?.archetype === "string" &&
    typeof insights?.wordOfDay === "string" &&
    Boolean(snapshot) &&
    Array.isArray(snapshot?.nodes) &&
    Array.isArray(snapshot?.edges)
  );
}

function parseSavedBloom(raw: string | null): SavedBloom | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return isSavedBloom(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveBloom(bloom: BloomResponse): SavedBloom {
  const savedBloom: SavedBloom = {
    ...bloom,
    savedAt: new Date().toISOString(),
  };

  localStorage.setItem(
    getBloomStorageKey(bloom.sessionId),
    JSON.stringify(savedBloom),
  );

  return savedBloom;
}

export function getSavedBlooms(): SavedBloom[] {
  return Object.keys(localStorage)
    .filter((key) => key.startsWith("mindbloom:blooms:"))
    .map((key) => parseSavedBloom(localStorage.getItem(key)))
    .filter((bloom): bloom is SavedBloom => Boolean(bloom))
    .sort((left, right) => right.savedAt.localeCompare(left.savedAt));
}

export function getBloomForDate(date: string): SavedBloom | null {
  const sessionId = `mindbloom-session-${date}`;
  return parseSavedBloom(localStorage.getItem(getBloomStorageKey(sessionId)));
}
