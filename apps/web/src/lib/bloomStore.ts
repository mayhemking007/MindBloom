import type { BloomResponse } from "@mindbloom/shared";

export interface SavedBloom extends BloomResponse {
  savedAt: string;
}

function getBloomStorageKey(sessionId: string): string {
  return `mindbloom:blooms:${sessionId}`;
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
    .map((key) => {
      try {
        return JSON.parse(localStorage.getItem(key) ?? "") as SavedBloom;
      } catch {
        return null;
      }
    })
    .filter((bloom): bloom is SavedBloom => Boolean(bloom?.sessionId))
    .sort((left, right) => right.savedAt.localeCompare(left.savedAt));
}

export function getBloomForDate(date: string): SavedBloom | null {
  try {
    const sessionId = `mindbloom-session-${date}`;
    return JSON.parse(
      localStorage.getItem(getBloomStorageKey(sessionId)) ?? "null",
    ) as SavedBloom | null;
  } catch {
    return null;
  }
}
