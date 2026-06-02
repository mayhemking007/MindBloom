import { useCallback, useEffect, useState } from "react";
import type { GraphSnapshotResponse } from "@mindbloom/shared";

import { getSnapshot, getTodaySession } from "../lib/api";

export function useSnapshot() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<GraphSnapshotResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (knownSessionId?: string) => {
      const targetSessionId = knownSessionId ?? sessionId;
      if (!targetSessionId) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data = await getSnapshot(targetSessionId);
        setSnapshot(data);
      } catch (snapshotError) {
        setError(
          snapshotError instanceof Error
            ? snapshotError.message
            : "MindBloom could not load your map.",
        );
      } finally {
        setLoading(false);
      }
    },
    [sessionId],
  );

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const today = await getTodaySession();
        if (!active) {
          return;
        }

        setSessionId(today.sessionId);
        const data = await getSnapshot(today.sessionId);
        if (!active) {
          return;
        }

        setSnapshot(data);
      } catch (snapshotError) {
        if (!active) {
          return;
        }

        setError(
          snapshotError instanceof Error
            ? snapshotError.message
            : "MindBloom could not load your map.",
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  return {
    error,
    loading,
    refresh,
    sessionId,
    snapshot,
  };
}
