import { DependencyList, useEffect } from "react";

type PollingLoader = (opts: { silent: boolean }) => Promise<void>;

export function usePolling(loader: PollingLoader, deps: DependencyList, intervalMs = 5000) {
  useEffect(() => {
    let active = true;

    const run = async (silent: boolean) => {
      if (!active) return;
      await loader({ silent });
    };

    void run(false);
    const interval = setInterval(() => {
      void run(true);
    }, intervalMs);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, deps);
}
