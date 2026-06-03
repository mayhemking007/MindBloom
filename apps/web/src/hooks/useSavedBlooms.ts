import { useCallback, useEffect, useMemo, useState } from "react";

import { getSavedBlooms, type SavedBloom } from "../lib/bloomStore";
import { getDateFromSessionId } from "../lib/dateUtils";

export function useSavedBlooms() {
  const [blooms, setBlooms] = useState<SavedBloom[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );

  const refresh = useCallback(() => {
    const nextBlooms = getSavedBlooms();
    setBlooms(nextBlooms);
    setSelectedSessionId((current) => {
      if (current && nextBlooms.some((bloom) => bloom.sessionId === current)) {
        return current;
      }
      return nextBlooms[0]?.sessionId ?? null;
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const selectedBloom = useMemo(
    () =>
      blooms.find((bloom) => bloom.sessionId === selectedSessionId) ?? null,
    [blooms, selectedSessionId],
  );

  const selectedDate = selectedBloom
    ? getDateFromSessionId(selectedBloom.sessionId)
    : null;

  const selectBloom = useCallback((bloom: SavedBloom) => {
    setSelectedSessionId(bloom.sessionId);
  }, []);

  return {
    blooms,
    refresh,
    selectedBloom,
    selectedDate,
    selectBloom,
  };
}
