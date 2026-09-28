import { createContext, useContext, type ReactNode } from "react";

import type { UserProfile } from "../types/api";

type ViewerUserContextValue = {
  user: UserProfile | null;
  setUser: (user: UserProfile | null) => void;
};

const ViewerUserContext = createContext<ViewerUserContextValue | null>(null);

export function ViewerUserProvider({ value, children }: { value: ViewerUserContextValue; children: ReactNode }) {
  return <ViewerUserContext.Provider value={value}>{children}</ViewerUserContext.Provider>;
}

export function useViewerUser(): ViewerUserContextValue {
  const value = useContext(ViewerUserContext);
  if (!value) {
    throw new Error("useViewerUser must be used inside ViewerUserProvider");
  }
  return value;
}
