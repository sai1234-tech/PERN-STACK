import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";

export function isAuthPath(pathname) {
  if (!pathname) return false;
  const path = pathname.toLowerCase();
  return (
    path === "/login" ||
    path.startsWith("/login/") ||
    path === "/signup" ||
    path.startsWith("/signup/") ||
    path === "/admin/setup" ||
    path.startsWith("/admin/setup/")
  );
}

/**
 * Instantly and simultaneously applies the theme to the entire DOM tree.
 * Freezes transition lag for one frame so all components, sidebars, headers,
 * cards, texts, and borders snap together simultaneously without stutter.
 */
export function applyThemeSynchronously(targetTheme, isAuth = false) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const body = document.body;
  const activeTheme = isAuth ? "light" : targetTheme;

  // 1. Temporarily freeze transitions so all DOM nodes swap simultaneously
  root.classList.add("theme-transitioning");

  // 2. Immediately apply data-theme and utility classes to html, body, and root
  root.setAttribute("data-theme", activeTheme);
  root.classList.remove("light", "dark");
  root.classList.add(activeTheme);
  root.style.colorScheme = activeTheme;

  if (body) {
    body.setAttribute("data-theme", activeTheme);
    body.classList.remove("light", "dark");
    body.classList.add(activeTheme);
    body.style.backgroundColor = activeTheme === "dark" ? "#0b1120" : "#f1f4f6";
    body.style.color = activeTheme === "dark" ? "#e2e8f0" : "#0f172a";
  }

  const rootDiv = document.getElementById("root");
  if (rootDiv) {
    rootDiv.setAttribute("data-theme", activeTheme);
  }

  // 3. Update browser chrome theme color
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute("content", activeTheme === "dark" ? "#0f172a" : "#176b70");
  }

  // 4. Force immediate layout/style recalculation across the entire document
  void root.offsetHeight;

  // 5. Restore transitions on the subsequent animation frame
  requestAnimationFrame(() => {
    root.classList.remove("theme-transitioning");
  });
}

// Synchronously apply saved theme on initial script load to prevent any flash of unstyled content
try {
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    const saved = localStorage.getItem("hrms_theme");
    const initial =
      saved === "dark" || saved === "light"
        ? saved
        : window.matchMedia?.("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    const isAuth = isAuthPath(window.location?.pathname);
    applyThemeSynchronously(initial, isAuth);
  }
} catch {
  // ignore
}

const ThemeContext = createContext({
  theme: "light",
  toggleTheme: () => {},
  isDark: false,
});

export function ThemeProvider({ children }) {
  const location = useLocation();
  const isAuth = isAuthPath(location?.pathname);

  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem("hrms_theme");
      if (saved === "dark" || saved === "light") return saved;
      if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) return "dark";
    } catch {
      // ignore
    }
    return "light";
  });

  // Apply synchronously whenever theme or route changes
  useEffect(() => {
    applyThemeSynchronously(theme, isAuth);
    try {
      localStorage.setItem("hrms_theme", theme);
    } catch {
      // ignore
    }
  }, [theme, isAuth]);

  // Listen for system preference changes (only if user hasn't explicitly set preference)
  useEffect(() => {
    const mediaQuery = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mediaQuery) return;
    const handler = (e) => {
      const saved = localStorage.getItem("hrms_theme");
      if (!saved) {
        const next = e.matches ? "dark" : "light";
        applyThemeSynchronously(next, isAuth);
        setTheme(next);
      }
    };
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [isAuth]);

  // Synchronous, instantaneous theme toggle
  const toggleTheme = useCallback(() => {
    setTheme((prevTheme) => {
      const nextTheme = prevTheme === "dark" ? "light" : "dark";

      // 1. Immediately apply to the entire DOM tree synchronously
      applyThemeSynchronously(nextTheme, isAuth);

      // 2. Persist to storage
      try {
        localStorage.setItem("hrms_theme", nextTheme);
      } catch {
        // ignore
      }

      // 3. Dispatch high-priority custom event for all synchronized components
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("hrms_theme_changed", { detail: { theme: nextTheme } })
        );
      }

      return nextTheme;
    });
  }, [isAuth]);

  const isDark = !isAuth && theme === "dark";

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDark }}>
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
