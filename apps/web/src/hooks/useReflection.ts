import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReflectResponse } from "@mindbloom/shared";

import { generateReflection as requestReflection } from "../lib/api";
import { getSavedBlooms, type SavedBloom } from "../lib/bloomStore";

export function useReflection() {
  const [availableBlooms, setAvailableBlooms] = useState<SavedBloom[]>([]);
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [reflectionData, setReflectionData] = useState<ReflectResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const blooms = getSavedBlooms();
    setAvailableBlooms(blooms);
    setSelectedSessionIds(blooms.slice(0, 7).map((bloom) => bloom.sessionId));
  }, []);

  const selectedBlooms = useMemo(
    () =>
      availableBlooms.filter((bloom) =>
        selectedSessionIds.includes(bloom.sessionId),
      ),
    [availableBlooms, selectedSessionIds],
  );

  const toggleSession = useCallback((sessionId: string) => {
    setSelectedSessionIds((current) =>
      current.includes(sessionId)
        ? current.filter((id) => id !== sessionId)
        : [...current, sessionId],
    );
  }, []);

  const generateReflection = useCallback(async () => {
    if (selectedSessionIds.length === 0 || loading) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await requestReflection({
        sourceSessionIds: selectedSessionIds,
      });
      setReflectionData(data);
    } catch (reflectionError) {
      setError(
        reflectionError instanceof Error
          ? reflectionError.message
          : "MindBloom could not create your weekly reflection.",
      );
    } finally {
      setLoading(false);
    }
  }, [loading, selectedSessionIds]);

  return {
    availableBlooms,
    error,
    generateReflection,
    loading,
    reflectionData,
    selectedBlooms,
    selectedSessionIds,
    toggleSession,
  };
}
