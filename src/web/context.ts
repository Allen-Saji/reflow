import { createContext } from "react";
import type { AppState } from "./api";
export const Context = createContext<{
  state: AppState | null;
  reload: () => Promise<void>;
  inspect: (ids: string[]) => void;
  error: string;
  setError: (s: string) => void;
}>({
  state: null,
  reload: async () => {},
  inspect: () => {},
  error: "",
  setError: () => {},
});
