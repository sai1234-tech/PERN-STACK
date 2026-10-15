import { useTheme } from "../../context/ThemeContext";
import { useSidebar } from "../../context/SidebarContext";
import { useAuth } from "../../context/AuthContext";
import "./AppHeader.css";

function AppHeader() {
  const { toggleTheme, isDark } = useTheme();
  const { toggleSidebar } = useSidebar();
  const { user } = useAuth();

  return (
    <header className="app-top-header" role="banner">
      <div className="header-left-zone">
        {/* Mobile hamburger menu trigger */}
        <button
          type="button"
          className="header-hamburger-btn"
          onClick={toggleSidebar}
          title="Toggle Navigation Menu"
          aria-label="Toggle sidebar navigation"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <div className="header-breadcrumb">
          <span className="header-greeting">
            {getGreeting()}, <strong>{user?.name?.split(" ")[0] || "there"}</strong>
          </span>
        </div>
      </div>

      <div className="header-right-zone">
        {/* Theme Toggle Switch */}
        <button
          type="button"
          className={`theme-toggle-btn ${isDark ? "dark-active" : "light-active"}`}
          onClick={toggleTheme}
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          aria-pressed={isDark}
        >
          <div className="theme-toggle-track">
            <span className="theme-toggle-icons">
              {/* Sun Icon */}
              <span className="theme-icon sun-icon" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              </span>
              {/* Moon Icon */}
              <span className="theme-icon moon-icon" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              </span>
            </span>
            <span className="theme-toggle-thumb" />
          </div>
          <span className="theme-toggle-label">
            {isDark ? "Dark" : "Light"}
          </span>
        </button>
      </div>
    </header>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default AppHeader;
