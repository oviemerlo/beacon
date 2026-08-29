import { DependencyList, useEffect, useRef } from "react";

type PollingLoader = (opts: { silent: boolean }) => Promise<void>;

export function usePolling(loader: PollingLoader, deps: DependencyList, intervalMs = 5000) {
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    let active = true;
    void loaderRef.current({ silent: false });
    const interval = setInterval(() => {
      if (!active) return;
      void loaderRef.current({ silent: true });
    }, intervalMs);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [intervalMs]);

  useEffect(() => {
    void loader({ silent: true });
  }, deps);
}
