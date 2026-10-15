import { createContext, useContext, useState, useEffect, useCallback } from "react";

const ThemeContext = createContext({
  theme: "light",
  toggleTheme: () => {},
  isDark: false,
});

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem("hrms_theme");
      if (saved === "dark" || saved === "light") return saved;
      // Default to system preference
      if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) return "dark";
    } catch {
      // ignore
    }
    return "light";
  });

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("hrms_theme", theme);
    } catch {
      // ignore
    }
  }, [theme]);

  // Listen for system preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mediaQuery) return;
    const handler = (e) => {
      const saved = localStorage.getItem("hrms_theme");
      // Only follow system if user hasn't explicitly chosen
      if (!saved) {
        setTheme(e.matches ? "dark" : "light");
      }
    };
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDark: theme === "dark" }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    return { theme: "light", toggleTheme: () => {}, isDark: false };
  }
  return context;
}
