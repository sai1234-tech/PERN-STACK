import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./CommandPalette.css";

const COMMANDS = [
  { id: "dashboard", title: "Go to Dashboard", subtitle: "Main Overview", icon: "📊", route: "/employee/dashboard", group: "Pages" },
  { id: "leaves", title: "Apply for Leave", subtitle: "Time off requests", icon: "🌴", route: "/employee/leaves", group: "Actions" },
  { id: "wfh", title: "Request WFH", subtitle: "Remote work days", icon: "🏠", route: "/employee/leaves?tab=wfh", group: "Actions" },
  { id: "attendance", title: "View Attendance", subtitle: "Punch logs & shifts", icon: "⏱️", route: "/employee/attendance", group: "Pages" },
  { id: "timesheets", title: "Manage Timesheets", subtitle: "Weekly billable hours", icon: "📋", route: "/employee/timesheets", group: "Pages" },
  { id: "documents", title: "My Documents", subtitle: "Payslips & policies", icon: "📄", route: "/employee/documents", group: "Pages" },
  { id: "payroll", title: "Payroll & Salary", subtitle: "Compensation details", icon: "💰", route: "/employee/payroll", group: "Pages" },
  { id: "profile", title: "My Profile", subtitle: "Personal & Job details", icon: "👤", route: "/employee/profile", group: "Pages" }
];

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  // Handle Ctrl+K shortcut globally
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  // Filter commands
  const filteredCommands = query
    ? COMMANDS.filter((c) => 
        c.title.toLowerCase().includes(query.toLowerCase()) || 
        c.subtitle.toLowerCase().includes(query.toLowerCase())
      )
    : COMMANDS;

  // Group commands
  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    if (!acc[cmd.group]) acc[cmd.group] = [];
    acc[cmd.group].push(cmd);
    return acc;
  }, {});

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery("");
    }
  }, [isOpen]);

  // Handle modal keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      setIsOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
    } else if (e.key === "Enter" && filteredCommands[selectedIndex]) {
      e.preventDefault();
      executeCommand(filteredCommands[selectedIndex]);
    }
  };

  const executeCommand = (cmd) => {
    navigate(cmd.route);
    setIsOpen(false);
  };

  if (!isOpen) return null;

  let globalIndex = 0;

  return (
    <div className="command-palette-overlay" onClick={() => setIsOpen(false)}>
      <div className="command-palette-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cmd-search-header">
          <svg className="cmd-search-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            ref={inputRef}
            className="cmd-search-input"
            placeholder="Search commands, pages, or actions..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <span className="cmd-search-esc">ESC</span>
        </div>

        <div className="cmd-results-container">
          {filteredCommands.length === 0 ? (
            <div className="cmd-no-results">No results found for "{query}"</div>
          ) : (
            Object.entries(groupedCommands).map(([group, cmds]) => (
              <div key={group} className="cmd-results-group">
                <div className="cmd-group-label">{group}</div>
                {cmds.map((cmd) => {
                  const currentIndex = globalIndex++;
                  const isSelected = currentIndex === selectedIndex;
                  return (
                    <button
                      key={cmd.id}
                      className={`cmd-result-item ${isSelected ? "selected" : ""}`}
                      onClick={() => executeCommand(cmd)}
                      onMouseEnter={() => setSelectedIndex(currentIndex)}
                    >
                      <span className="cmd-item-icon">{cmd.icon}</span>
                      <div className="cmd-item-content">
                        <span className="cmd-item-title">{cmd.title}</span>
                        <span className="cmd-item-subtitle">{cmd.subtitle}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="cmd-footer">
          <div className="cmd-footer-shortcut">
            <kbd className="cmd-footer-kbd">↑</kbd>
            <kbd className="cmd-footer-kbd">↓</kbd>
            <span>to navigate</span>
          </div>
          <div className="cmd-footer-shortcut">
            <kbd className="cmd-footer-kbd">↵</kbd>
            <span>to select</span>
          </div>
        </div>
      </div>
    </div>
  );
}
