import { useCallback, useState } from "react";
import type { BloomResponse } from "@mindbloom/shared";

import { generateBloom as requestBloom } from "../lib/api";
import { saveBloom } from "../lib/bloomStore";

export function useBloom(sessionId: string | null) {
  const [bloomData, setBloomData] = useState<BloomResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateBloom = useCallback(async () => {
    if (!sessionId || loading) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await requestBloom(sessionId);
      setBloomData(data);
      saveBloom(data);
    } catch (bloomError) {
      setError(
        bloomError instanceof Error
          ? bloomError.message
          : "MindBloom could not generate your Bloom.",
      );
    } finally {
      setLoading(false);
    }
  }, [loading, sessionId]);

  return {
    bloomData,
    error,
    generateBloom,
    loading,
  };
}
