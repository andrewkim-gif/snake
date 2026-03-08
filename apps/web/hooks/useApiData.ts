'use client';

import { useState, useEffect, useCallback } from 'react';

interface UseApiDataOptions {
  /** Refresh interval in ms (0 = no polling) */
  refreshInterval?: number;
}

interface UseApiDataResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Generic data-fetching hook with polling support.
 * @param fetcher — async function that returns data (from api-client.ts)
 * @param options — optional polling interval
 */
export function useApiData<T>(
  fetcher: () => Promise<T | null>,
  options: UseApiDataOptions = {},
): UseApiDataResult<T> {
  const { refreshInterval = 0 } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const doFetch = useCallback(async () => {
    try {
      const result = await fetcher();
      if (result !== null) {
        setData(result);
        setError(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'fetch failed');
    } finally {
      setLoading(false);
    }
  }, [fetcher]);

  useEffect(() => {
    doFetch();
    if (refreshInterval > 0) {
      const id = setInterval(doFetch, refreshInterval);
      return () => clearInterval(id);
    }
  }, [doFetch, refreshInterval]);

  return { data, loading, error, refetch: doFetch };
}
