import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";
const storageKey = "reflow-theme";
const ThemeContext = createContext<{ theme: Theme; toggle: () => void } | null>(
  null,
);

function storedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(storageKey);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<Theme | null>(storedTheme);
  const [system, setSystem] = useState<Theme>(() =>
    matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
  );
  const theme = preference ?? system;

  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const updateSystem = () => setSystem(media.matches ? "dark" : "light");
    const syncPreference = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null)
        setPreference(storedTheme());
    };
    media.addEventListener("change", updateSystem);
    window.addEventListener("storage", syncPreference);
    return () => {
      media.removeEventListener("change", updateSystem);
      window.removeEventListener("storage", syncPreference);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "light" ? "#f5f2ec" : "#0a0a0a");
  }, [theme]);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setPreference(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      // The control still works for this visit when browser storage is blocked.
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("Theme controls require ThemeProvider.");
  return value;
}

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
    >
      {theme === "dark" ? (
        <Sun size={17} aria-hidden="true" />
      ) : (
        <Moon size={17} aria-hidden="true" />
      )}
      <span>{next === "light" ? "Light mode" : "Dark mode"}</span>
    </button>
  );
}
