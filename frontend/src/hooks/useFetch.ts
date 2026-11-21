import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api";

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  setData: (value: T | null) => void;
}

/**
 * Small data-fetching hook: handles loading, error and stale-response races
 * without pulling in a query library.
 */
export function useFetch<T>(fetcher: () => Promise<T>, deps: unknown[] = []): FetchState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const requestId = useRef(0);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    const id = ++requestId.current;
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetcherRef
      .current()
      .then((result) => {
        if (cancelled || id !== requestId.current) return;
        setData(result);
      })
      .catch((err: unknown) => {
        if (cancelled || id !== requestId.current) return;
        const message =
          err instanceof ApiError ? err.message : "Something went wrong while loading this page.";
        setError(message);
      })
      .finally(() => {
        if (cancelled || id !== requestId.current) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, loading, error, reload, setData };
}
