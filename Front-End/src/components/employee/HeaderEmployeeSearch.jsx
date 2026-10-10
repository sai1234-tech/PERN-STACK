import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { normalizeRole } from "../../utils/auth";
import { getAllEmployees } from "../../services/employeeService";
import { getAllAttendance } from "../../services/hrService";
import { WORKFORCE_DIRECTORY } from "../../data/workforceDirectory";
import "./HeaderEmployeeSearch.css";

const QUICK_NAVIGATION_COMMANDS = [
  { id: "cmd-dashboard", itemType: "command", title: "Go to Dashboard", subtitle: "Main Overview & Live Analytics", icon: "📊", route: "/employee/dashboard", keywords: ["dashboard", "home", "main", "overview", "go to dashboard"] },
  { id: "cmd-attendance", itemType: "command", title: "View Attendance", subtitle: "Punch Logs, Shifts & Live Telemetry", icon: "⏱️", route: "/employee/attendance", keywords: ["attendance", "punch", "clock", "shift", "checkin", "view attendance"] },
  { id: "cmd-leaves", itemType: "command", title: "Apply for Leave", subtitle: "Time Off Requests & Leave Balance", icon: "🌴", route: "/employee/leaves", keywords: ["leave", "leaves", "apply for leave", "vacation", "pto", "holiday"] },
  { id: "cmd-wfh", itemType: "command", title: "Request WFH", subtitle: "Remote Work Applications & Logs", icon: "🏠", route: "/employee/leaves?tab=wfh", keywords: ["wfh", "remote", "work from home", "home office"] },
  { id: "cmd-timesheets", itemType: "command", title: "Manage Timesheets", subtitle: "Weekly Billable Hours & Projects", icon: "📋", route: "/employee/timesheets", keywords: ["timesheet", "timesheets", "hours", "manage timesheets", "billable", "project"] },
  { id: "cmd-payroll", itemType: "command", title: "Payroll & Salary", subtitle: "Salary Slips, Form 16 & Compensation", icon: "💰", route: "/employee/payroll", keywords: ["payroll", "salary", "pay", "payslip", "compensation", "tax"] },
  { id: "cmd-documents", itemType: "command", title: "My Documents", subtitle: "Company Policies, Offer Letters & Docs", icon: "📄", route: "/employee/documents", keywords: ["documents", "docs", "policy", "my documents", "files", "pdf"] },
  { id: "cmd-profile", itemType: "command", title: "My Profile", subtitle: "Personal Information, Skills & Job Details", icon: "👤", route: "/employee/profile", keywords: ["profile", "my profile", "account", "settings", "me"] },
  { id: "cmd-org", itemType: "command", title: "Org Hierarchy Chart", subtitle: "Interactive Quadratic Systems Org Tree", icon: "🌳", route: "/organization", keywords: ["org", "organization", "chart", "hierarchy", "tree", "team"] }
];

function HeaderEmployeeSearch() {
  const { user, employee: currentEmployee } = useAuth();
  const navigate = useNavigate();
  const currentRole = normalizeRole(user);
  const isHrOrAdmin = currentRole === "hr" || currentRole === "admin";

  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [copiedContact, setCopiedContact] = useState(false);

  // Real-time backend data
  const [realtimeEmployees, setRealtimeEmployees] = useState([]);
  const [attendanceMap, setAttendanceMap] = useState({});

  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // 1. Fetch real-time employees from API
  useEffect(() => {
    let isMounted = true;
    async function fetchRealtimeData() {
      try {
        const empRes = await getAllEmployees().catch(() => ({ data: [] }));
        const empList = empRes.data || empRes.employees || [];
        if (isMounted && Array.isArray(empList) && empList.length > 0) {
          setRealtimeEmployees(empList);
        }

        // If HR/Admin, fetch live attendance statuses
        if (isHrOrAdmin) {
          const attRes = await getAllAttendance().catch(() => ({ data: [] }));
          const attList = attRes.data || attRes.attendance || [];
          if (isMounted && Array.isArray(attList)) {
            const map = {};
            attList.forEach((record) => {
              const empId = record.employee?._id || record.employeeId || record.employee;
              if (empId) {
                map[empId] = record;
              }
            });
            setAttendanceMap(map);
          }
        }
      } catch (err) {
        console.error("Real-time workforce search fetch error:", err);
      }
    }

    fetchRealtimeData();
    return () => {
      isMounted = false;
    };
  }, [isHrOrAdmin]);

  // 2. Merge backend real-time employees with rich workforce seed directory
  const allEmployees = useMemo(() => {
    const list = [...WORKFORCE_DIRECTORY];

    if (realtimeEmployees.length > 0) {
      realtimeEmployees.forEach((apiEmp) => {
        const code = apiEmp.employeeCode || `QSI-${apiEmp._id?.slice(-4)}`;
        const existingIdx = list.findIndex(
          (m) =>
            m.employeeCode === code ||
            (apiEmp.email && m.email?.toLowerCase() === apiEmp.email?.toLowerCase())
        );

        const deptName =
          apiEmp.employment?.department || apiEmp.department || "Engineering";
        const designation =
          apiEmp.employment?.designation || apiEmp.designation || "Staff Specialist";
        const employmentType =
          apiEmp.employment?.employmentType || apiEmp.employmentType || "Full Time";
        const rawStatus = apiEmp.employment?.status || apiEmp.status || "Active";

        // Determine live check-in from attendance map
        const todayAttendance = attendanceMap[apiEmp._id];
        const isCheckedIn = !!todayAttendance?.checkIn;

        const dynamicEmp = {
          id: apiEmp._id || `emp-${code}`,
          employeeCode: code,
          name:
            apiEmp.name ||
            `${apiEmp.firstName || ""} ${apiEmp.lastName || ""}`.trim() ||
            "Team Member",
          firstName: apiEmp.firstName || "Team",
          lastName: apiEmp.lastName || "Member",
          designation,
          department: deptName,
          band: apiEmp.employment?.band || apiEmp.band || "Not specified",
          reportsTo: apiEmp.reportsTo?._id || apiEmp.reportsTo || null,
          reportsToName: typeof apiEmp.reportsTo === "object" && apiEmp.reportsTo !== null
            ? (apiEmp.reportsTo.name || `${apiEmp.reportsTo.firstName || ""} ${apiEmp.reportsTo.lastName || ""}`.trim())
            : (apiEmp.reportsTo || "Not assigned"),
          email: apiEmp.email || "Not provided",
          phone: apiEmp.phone || "Not provided",
          status: rawStatus,
          loginStatus: isCheckedIn ? "Online" : "Active",
          lastActive: isCheckedIn ? "Checked in today" : "Active Session",
          location: apiEmp.workLocation || "Not provided",
          branch: "Hyderabad HQ",
          workstationPod: "Engineering Pod",
          shift: "09:30 AM – 06:30 PM (IST)",
          employmentType,
          dateOfJoining:
            apiEmp.employment?.joiningDate || apiEmp.joiningDate || apiEmp.createdAt?.slice(0, 10) || "",
          experience: "Not recorded",
          avatarBg: "linear-gradient(135deg, #2563eb, #3b82f6)",
          summary: `${designation} in ${deptName}`,
          skills: [
            "Problem Solving",
            "Agile Development",
            "Cross-team Collaboration",
            deptName,
            "REST Integration",
          ],
        };

        if (existingIdx >= 0) {
          list[existingIdx] = {
            ...list[existingIdx],
            ...dynamicEmp,
            skills: list[existingIdx].skills || dynamicEmp.skills,
            summary: list[existingIdx].summary || dynamicEmp.summary,
            workstationPod: list[existingIdx].workstationPod || dynamicEmp.workstationPod,
          };
        } else {
          list.push(dynamicEmp);
        }
      });
    }

    // Build direct reports map
    const reportsMap = {};
    list.forEach((e) => {
      if (e.reportsTo) {
        if (!reportsMap[e.reportsTo]) reportsMap[e.reportsTo] = [];
        reportsMap[e.reportsTo].push(e);
      }
    });

    return list.map((e) => {
      const isCurrentUser =
        (user?.email && e.email?.toLowerCase() === user.email.toLowerCase()) ||
        (currentEmployee?.employeeCode &&
          e.employeeCode?.toUpperCase() === currentEmployee.employeeCode.toUpperCase());

      return {
        ...e,
        isCurrentUser,
        directReports: reportsMap[e.id] || [],
        loginStatus: isCurrentUser ? "Online" : e.loginStatus || "Active",
        lastActive: isCurrentUser ? "Active Now (Current Session)" : e.lastActive,
      };
    });
  }, [realtimeEmployees, attendanceMap, user, currentEmployee]);

  // 3. Search filter for commands & employees
  const filteredCommands = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return QUICK_NAVIGATION_COMMANDS.slice(0, 5);
    }
    return QUICK_NAVIGATION_COMMANDS.filter((cmd) => {
      const titleMatch = cmd.title.toLowerCase().includes(q);
      const subMatch = cmd.subtitle.toLowerCase().includes(q);
      const keyMatch = cmd.keywords.some((k) => k.toLowerCase().includes(q));
      return titleMatch || subMatch || keyMatch;
    });
  }, [query]);

  const filteredEmployees = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return allEmployees.slice(0, 5);
    }
    return allEmployees.filter((emp) => {
      const nameMatch = emp.name.toLowerCase().includes(q);
      const codeMatch = emp.employeeCode.toLowerCase().includes(q);
      const desigMatch = emp.designation.toLowerCase().includes(q);
      const deptMatch = emp.department.toLowerCase().includes(q);
      const locMatch =
        (emp.location || "").toLowerCase().includes(q) ||
        (emp.branch || "").toLowerCase().includes(q);
      const skillsMatch = (emp.skills || []).some((s) => s.toLowerCase().includes(q));

      return (
        nameMatch || codeMatch || desigMatch || deptMatch || locMatch || skillsMatch
      );
    });
  }, [query, allEmployees]);

  const allFilteredItems = useMemo(() => {
    return [
      ...filteredCommands.map((c) => ({ ...c, itemType: "command" })),
      ...filteredEmployees.map((e) => ({ ...e, itemType: "employee" })),
    ];
  }, [filteredCommands, filteredEmployees]);

  // 4. Global keyboard shortcut (Ctrl+K or Cmd+K or '/')
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      } else if (e.key === "/" && document.activeElement !== inputRef.current) {
        const isInputField =
          ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName) ||
          document.activeElement?.isContentEditable;
        if (!isInputField) {
          e.preventDefault();
          inputRef.current?.focus();
          setIsOpen(true);
        }
      } else if (e.key === "Escape") {
        setIsOpen(false);
        setSelectedEmp(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // 5. Handle Click outside dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectItem = (item) => {
    if (item.itemType === "command") {
      setIsOpen(false);
      navigate(item.route);
    } else {
      openDossier(item);
    }
  };

  // Keyboard navigation within results
  const handleInputKeyDown = (e) => {
    if (!isOpen) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < allFilteredItems.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev > 0 ? prev - 1 : allFilteredItems.length - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const targetItem = allFilteredItems[selectedIndex];
      if (targetItem) {
        handleSelectItem(targetItem);
      }
    }
  };

  const openDossier = (emp) => {
    setSelectedEmp(emp);
    setIsOpen(false);
  };

  const closeDossier = () => {
    setSelectedEmp(null);
  };

  const handleCopyContact = (emp) => {
    const contactText = `${emp.name} | ${emp.designation}\nEmail: ${emp.email}\nPhone: ${emp.phone}\nWorkstation: ${emp.location}\nDepartment: ${emp.department} (Quadratic Systems Inc)`;
    navigator.clipboard?.writeText(contactText).then(() => {
      setCopiedContact(true);
      setTimeout(() => setCopiedContact(false), 2200);
    });
  };

  const handleViewInOrgChart = (emp) => {
    closeDossier();
    navigate("/organization", {
      state: { highlightId: emp.id, searchName: emp.name },
    });
  };

  const getStatusDotClass = (status) => {
    if (status === "Online") return "status-online";
    if (status === "Away") return "status-away";
    return "status-active";
  };

  return (
    <div className="hdr-search-root" ref={containerRef}>
      {/* Search Input Bar */}
      <div
        className={`hdr-search-box ${isOpen ? "is-active" : ""}`}
        onClick={() => {
          inputRef.current?.focus();
          setIsOpen(true);
        }}
      >
        <span className="hdr-search-icon">🔍</span>
        <input
          ref={inputRef}
          type="text"
          className="hdr-search-input"
          placeholder="Search employees by name, skills, designation, location..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setSelectedIndex(0);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleInputKeyDown}
          aria-label="Search employees"
        />

        {query ? (
          <button
            type="button"
            className="hdr-search-clear"
            onClick={(e) => {
              e.stopPropagation();
              setQuery("");
              inputRef.current?.focus();
            }}
            title="Clear search"
          >
            ✕
          </button>
        ) : (
          <kbd
            className="hdr-search-shortcut"
            title="Press Ctrl + K to search"
            onClick={(e) => {
              e.stopPropagation();
              inputRef.current?.focus();
              setIsOpen(true);
            }}
          >
            <span>Ctrl</span> K
          </kbd>
        )}
      </div>

      {/* Spotlight Dropdown Results */}
      {isOpen && (
        <div className="hdr-search-dropdown">
          <div className="dropdown-header-bar">
            <div
              className="dropdown-header-left"
              onClick={() => {
                setIsOpen(false);
                navigate(isHrOrAdmin ? "/hr/employees" : "/organization");
              }}
              title="Click to view full Workforce Directory"
            >
              <span className="dropdown-header-icon">🔍</span>
              <span className="dropdown-header-title">
                {query.trim()
                  ? `Search Results (${allFilteredItems.length} Found)`
                  : "Quick Actions & Workforce Directory"}
              </span>
            </div>

            <div className="dropdown-header-right">
              <button
                type="button"
                className="dropdown-directory-btn"
                onClick={() => {
                  setIsOpen(false);
                  navigate(isHrOrAdmin ? "/hr/employees" : "/organization");
                }}
                title="Open full Workforce Directory page"
              >
                Full Directory →
              </button>
              <span className="dropdown-esc-hint">Press Esc</span>
            </div>
          </div>

          <div className="dropdown-results-list">
            {allFilteredItems.length > 0 ? (
              <>
                {/* 1. Quick Navigation Actions Section */}
                {filteredCommands.length > 0 && (
                  <div className="dropdown-section">
                    <div className="dropdown-section-title">
                      <span>⚡ Quick Actions & Pages</span>
                    </div>
                    {filteredCommands.map((cmd) => {
                      const itemIndex = allFilteredItems.findIndex((x) => x.id === cmd.id);
                      const isSelected = itemIndex === selectedIndex;
                      return (
                        <div
                          key={cmd.id}
                          className={`dropdown-result-card command-card ${isSelected ? "selected" : ""}`}
                          onClick={() => handleSelectItem({ ...cmd, itemType: "command" })}
                          onMouseEnter={() => setSelectedIndex(itemIndex)}
                        >
                          <div className="cmd-card-icon">{cmd.icon}</div>
                          <div className="result-info">
                            <div className="result-name-row">
                              <strong className="result-name">{cmd.title}</strong>
                              <span className="result-dept-tag">Page</span>
                            </div>
                            <div className="result-desig-row">
                              <span className="result-desig">{cmd.subtitle}</span>
                            </div>
                          </div>
                          <div className="result-action-slot">
                            <button
                              type="button"
                              className="result-view-btn cmd-go-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectItem({ ...cmd, itemType: "command" });
                              }}
                            >
                              Open →
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 2. Workforce Directory & Colleagues Section */}
                {filteredEmployees.length > 0 && (
                  <div className="dropdown-section">
                    <div className="dropdown-section-title">
                      <span>👥 Workforce Directory & Colleagues</span>
                    </div>
                    {filteredEmployees.map((emp) => {
                      const itemIndex = allFilteredItems.findIndex(
                        (x) => x.id === emp.id || x.employeeCode === emp.employeeCode
                      );
                      const isSelected = itemIndex === selectedIndex;
                      const initials = emp.name
                        .split(" ")
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((w) => w[0].toUpperCase())
                        .join("");

                      return (
                        <div
                          key={emp.id || emp.employeeCode}
                          className={`dropdown-result-card ${isSelected ? "selected" : ""}`}
                          onClick={() => handleSelectItem({ ...emp, itemType: "employee" })}
                          onMouseEnter={() => setSelectedIndex(itemIndex)}
                        >
                          <div
                            className="result-avatar"
                            style={{ background: emp.avatarBg || "linear-gradient(135deg, #1e3a8a, #2563eb)" }}
                          >
                            <span>{initials}</span>
                            <span
                              className={`result-status-dot ${getStatusDotClass(emp.loginStatus)}`}
                              title={`Status: ${emp.loginStatus}`}
                            />
                          </div>

                          <div className="result-info">
                            <div className="result-name-row">
                              <strong className="result-name">{emp.name}</strong>
                              {emp.isCurrentUser && (
                                <span className="result-you-tag">⭐ YOU</span>
                              )}
                              <span className="result-code-tag">{emp.employeeCode}</span>
                              <span className="result-dept-tag">{emp.department}</span>
                            </div>

                            <div className="result-desig-row">
                              <span className="result-desig">{emp.designation}</span>
                              <span className="result-sep">•</span>
                              <span className="result-location">📍 {emp.location}</span>
                            </div>

                            {emp.skills && emp.skills.length > 0 && (
                              <div className="result-skills-row">
                                {emp.skills.slice(0, 4).map((skill, sIdx) => (
                                  <span key={sIdx} className="result-skill-chip">
                                    {skill}
                                  </span>
                                ))}
                                {emp.skills.length > 4 && (
                                  <span className="result-skill-more">
                                    +{emp.skills.length - 4} more
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="result-action-slot">
                            <button
                              type="button"
                              className="result-view-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectItem({ ...emp, itemType: "employee" });
                              }}
                            >
                              Profile →
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <div className="dropdown-empty-state">
                <span className="empty-icon">🔍</span>
                <h4>No matching results found</h4>
                <p>
                  No quick actions or colleagues match &ldquo;{query}&rdquo;. Try searching by page name (e.g., Dashboard, Attendance, Payroll, Leave) or employee details.
                </p>
              </div>
            )}
          </div>

          <div className="dropdown-footer-bar">
            <span>
              💡 Use <kbd>↑</kbd> <kbd>↓</kbd> to navigate, <kbd>Enter</kbd> to open
              profile dossier
            </span>
            <span className="realtime-status-pill">
              🟢 Real-Time Workforce Telemetry Active
            </span>
          </div>
        </div>
      )}

      {/* ==========================================================================
          FULL EMPLOYEE DOSSIER MODAL (NEXT LEVEL - PORTAL TO BODY)
          ========================================================================== */}
      {selectedEmp &&
        createPortal(
          <div className="dossier-modal-overlay" onClick={closeDossier}>
            <div
              className="dossier-modal-card"
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header Banner */}
              <div
                className="dossier-modal-hero"
                style={{
                  background: selectedEmp.avatarBg || "linear-gradient(135deg, #1e3a8a, #2563eb)",
                }}
              >
                <button
                  type="button"
                  className="dossier-modal-close"
                  onClick={closeDossier}
                  aria-label="Close dossier"
                >
                  ✕
                </button>

                <div className="modal-hero-content">
                  <div className="modal-avatar-frame">
                    <div className="modal-avatar-circle">
                      {selectedEmp.name
                        .split(" ")
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((w) => w[0].toUpperCase())
                        .join("")}
                    </div>
                    <span
                      className={`modal-live-status-dot ${getStatusDotClass(
                        selectedEmp.loginStatus
                      )}`}
                      title={`Real-time Status: ${selectedEmp.loginStatus}`}
                    />
                  </div>

                  <div className="modal-title-cluster">
                    <div className="modal-top-tags">
                      <span className="modal-code-pill">{selectedEmp.employeeCode}</span>
                      <span className="modal-dept-pill">{selectedEmp.department}</span>
                      <span className="modal-band-pill">
                        {selectedEmp.band || "Corporate Staff"}
                      </span>
                      {selectedEmp.isCurrentUser && (
                        <span className="modal-you-pill">⭐ YOUR ACTIVE PROFILE</span>
                      )}
                    </div>

                    <h2 className="modal-employee-name">{selectedEmp.name}</h2>
                    <p className="modal-employee-desig">{selectedEmp.designation}</p>
                  </div>
                </div>
              </div>

              {/* Modal Body & Dossier Grid */}
              <div className="dossier-modal-body">
                {/* Real-time Status & Availability Bar */}
                <div className="dossier-telemetry-strip">
                  <div className="telemetry-item">
                    <span className="telemetry-label">Login & Session Status:</span>
                    <div className="telemetry-value-tag live">
                      <span className="pulse-dot" />
                      <strong>
                        {selectedEmp.loginStatus === "Online"
                          ? "Active Now (Logged in to HRMS)"
                          : selectedEmp.loginStatus === "Away"
                          ? "Away / In Strategic Review"
                          : "Active Workforce Member"}
                      </strong>
                    </div>
                  </div>

                  <div className="telemetry-item">
                    <span className="telemetry-label">Official Work Shift:</span>
                    <strong className="telemetry-text">
                      {selectedEmp.shift || "09:30 AM – 06:30 PM (IST)"}
                    </strong>
                  </div>

                  <div className="telemetry-item">
                    <span className="telemetry-label">Employment Status:</span>
                    <strong className="telemetry-text confirmed">
                      ✓ {selectedEmp.employmentType || "Full Time Permanent"}
                    </strong>
                  </div>
                </div>

                {/* Action Toolbar */}
                <div className="dossier-actions-bar">
                  <a
                    href={`mailto:${selectedEmp.email}`}
                    className="dossier-action-btn primary"
                    title={`Send email to ${selectedEmp.name}`}
                  >
                    <span>✉️ Email Direct</span>
                  </a>

                  <a
                    href={`tel:${selectedEmp.phone}`}
                    className="dossier-action-btn secondary"
                    title={`Call ${selectedEmp.phone}`}
                  >
                    <span>📞 Call Extension</span>
                  </a>

                  <button
                    type="button"
                    className="dossier-action-btn tertiary"
                    onClick={() => handleCopyContact(selectedEmp)}
                    title="Copy contact card to clipboard"
                  >
                    <span>{copiedContact ? "✓ Copied Card!" : "📋 Copy Contact"}</span>
                  </button>

                  <button
                    type="button"
                    className="dossier-action-btn org-chart-btn"
                    onClick={() => handleViewInOrgChart(selectedEmp)}
                    title="View this employee's node in Organization Hierarchy Flow Chart"
                  >
                    <span>🌳 View in Org Chart</span>
                  </button>
                </div>

                {/* 4 Structured Information Quadrants */}
                <div className="dossier-quadrants-grid">
                  {/* Quadrant 1: About & Professional Summary */}
                  <div className="dossier-quadrant-card">
                    <div className="quadrant-head">
                      <span className="quadrant-icon">📝</span>
                      <h3>About & Professional Summary</h3>
                    </div>
                    <p className="quadrant-summary-text">
                      {selectedEmp.summary ||
                        `${selectedEmp.name} serves as ${selectedEmp.designation} in ${selectedEmp.department} at Quadratic Systems Inc, driving organizational goals and enterprise delivery.`}
                    </p>
                  </div>

                  {/* Quadrant 2: Skills & Core Competencies */}
                  <div className="dossier-quadrant-card">
                    <div className="quadrant-head">
                      <span className="quadrant-icon">⚡</span>
                      <h3>Skills & Core Competencies</h3>
                    </div>
                    <div className="dossier-skills-cluster">
                      {selectedEmp.skills && selectedEmp.skills.length > 0 ? (
                        selectedEmp.skills.map((skill, sIdx) => (
                          <span key={sIdx} className="dossier-skill-pill">
                            {skill}
                          </span>
                        ))
                      ) : (
                        <span className="no-skills-text">General Enterprise Competencies</span>
                      )}
                    </div>
                  </div>

                  {/* Quadrant 3: Reporting & Team Architecture */}
                  <div className="dossier-quadrant-card">
                    <div className="quadrant-head">
                      <span className="quadrant-icon">👥</span>
                      <h3>Reporting & Team Architecture</h3>
                    </div>

                    <div className="reporting-pair">
                      {/* Manager info */}
                      <div className="reporting-manager-box">
                        <span className="rep-label">Directly Reports To:</span>
                        {selectedEmp.reportsToName ? (
                          <div className="manager-mini-pill">
                            <span className="mgr-icon">👔</span>
                            <div>
                              <strong>{selectedEmp.reportsToName}</strong>
                              <small>
                                {selectedEmp.reportsTo === "emp-ceo"
                                  ? "CEO & Managing Director"
                                  : "Department Leadership"}
                              </small>
                            </div>
                          </div>
                        ) : (
                          <div className="manager-mini-pill board">
                            <span className="mgr-icon">🌟</span>
                            <div>
                              <strong>Corporate Board of Directors</strong>
                              <small>Highest Corporate Governance Tier</small>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Direct subordinates */}
                      <div className="direct-reports-box">
                        <span className="rep-label">
                          Direct Subordinates ({selectedEmp.directReports?.length || 0}):
                        </span>
                        {selectedEmp.directReports && selectedEmp.directReports.length > 0 ? (
                          <div className="subordinates-chips-cluster">
                            {selectedEmp.directReports.map((sub) => (
                              <button
                                type="button"
                                key={sub.id}
                                className="subordinate-chip-btn"
                                onClick={() => setSelectedEmp(sub)}
                                title={`Switch dossier to ${sub.name}`}
                              >
                                <span>{sub.name}</span>
                                <small>({sub.designation})</small>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span className="no-reports-text">
                            Individual Contributor • No direct subordinate reports
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Quadrant 4: Workstation, Location & Contact Details */}
                  <div className="dossier-quadrant-card">
                    <div className="quadrant-head">
                      <span className="quadrant-icon">📍</span>
                      <h3>Workstation & Office Location</h3>
                    </div>

                    <div className="location-details-list">
                      <div className="loc-item">
                        <span>Office Branch:</span>
                        <strong>{selectedEmp.branch || "Hyderabad HQ (Melange Towers)"}</strong>
                      </div>

                      <div className="loc-item">
                        <span>Desk & Pod Location:</span>
                        <strong>{selectedEmp.location || "Floor 5, Systems Pod 14"}</strong>
                      </div>

                      <div className="loc-item">
                        <span>Corporate Email:</span>
                        <strong className="code-text">{selectedEmp.email}</strong>
                      </div>

                      <div className="loc-item">
                        <span>Direct Phone / Extension:</span>
                        <strong>{selectedEmp.phone}</strong>
                      </div>

                      <div className="loc-item">
                        <span>Date of Joining:</span>
                        <strong>{selectedEmp.dateOfJoining} ({selectedEmp.experience || "2+ yrs"})</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="dossier-modal-footer">
                <span className="footer-copyright">
                  Quadratic Systems Inc (QSI) • Enterprise Human Resource Directory
                </span>
                <button
                  type="button"
                  className="dossier-close-footer-btn"
                  onClick={closeDossier}
                >
                  Close Dossier
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

export default HeaderEmployeeSearch;
