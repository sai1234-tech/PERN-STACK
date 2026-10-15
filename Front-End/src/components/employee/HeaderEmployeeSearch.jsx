import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { normalizeRole } from "../../utils/auth";
import {
  getAllEmployees,
  uploadEmployeeProfilePicture,
  uploadProfilePicture,
} from "../../services/employeeService";
import { getAllAttendance } from "../../services/hrService";
import { formatDate } from "../../utils/date";
import { calculateTenure, formatTenure } from "../../utils/tenureUtils";
import { formatPhotoUrl } from "../../utils/photo";
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
  const { user, employee: currentEmployee, updateProfilePhoto } = useAuth();
  const navigate = useNavigate();
  const currentRole = normalizeRole(user, currentEmployee);
  const isHrOrAdmin = currentRole === "hr" || currentRole === "admin";

  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [copiedContact, setCopiedContact] = useState(false);
  const [photoUploadError, setPhotoUploadError] = useState("");
  const [photoUploading, setPhotoUploading] = useState(false);

  // Real-time backend data
  const [realtimeEmployees, setRealtimeEmployees] = useState([]);
  const [attendanceMap, setAttendanceMap] = useState({});
  const [workforceError, setWorkforceError] = useState("");
  const [workforceLoading, setWorkforceLoading] = useState(true);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const photoInputRef = useRef(null);

  // 1. Fetch real-time employees from API
  useEffect(() => {
    let isMounted = true;
    async function fetchRealtimeData() {
      try {
        const empRes = await getAllEmployees();
        if (empRes?.success === false) {
          throw new Error(empRes.message || "Unable to load the live workforce directory.");
        }
        const empList = empRes.data || empRes.employees || [];
        if (!Array.isArray(empList)) {
          throw new Error("The workforce directory returned an invalid employee list.");
        }
        if (isMounted) {
          setRealtimeEmployees(empList);
          setWorkforceError("");
          setWorkforceLoading(false);
        }

        // If HR/Admin, fetch live attendance statuses
        if (isHrOrAdmin) {
          const attRes = await getAllAttendance();
          const attList = attRes.data || attRes.attendance || [];
          if (isMounted && Array.isArray(attList)) {
            const map = {};
            attList.forEach((record) => {
              const empId =
                record.employee?.id ||
                record.employee?._id ||
                record.employeeId ||
                record.employee;
              if (empId) {
                map[String(empId)] = record;
              }
            });
            setAttendanceMap(map);
          }
        }
      } catch (err) {
        console.error("Real-time workforce search fetch error:", err);
        if (isMounted) {
          setWorkforceError(err.message || "Unable to load live workforce data.");
          setWorkforceLoading(false);
        }
      }
    }

    fetchRealtimeData();
    const refreshTimer = window.setInterval(fetchRealtimeData, 30000);
    window.addEventListener("hrms:data_changed", fetchRealtimeData);
    return () => {
      isMounted = false;
      window.clearInterval(refreshTimer);
      window.removeEventListener("hrms:data_changed", fetchRealtimeData);
    };
  }, [isHrOrAdmin]);

  // Use the backend employee list as the single source of truth.
  const allEmployees = useMemo(() => {
    const uniqueEmployees = new Map();
    realtimeEmployees.forEach((apiEmp) => {
      const id = apiEmp.id ?? apiEmp._id;
      const code = apiEmp.employeeCode || apiEmp.employeeId || "";
      const email = (apiEmp.email || "").toLowerCase();
      const key = email
        ? `email:${email}`
        : code
          ? `code:${code.toUpperCase()}`
          : id !== undefined
            ? `id:${id}`
            : "";
      if (!key) return;

      const reportsToRef = apiEmp.reportsTo;
      const reportsTo =
        reportsToRef && typeof reportsToRef === "object"
          ? reportsToRef.id ?? reportsToRef._id ?? reportsToRef.employeeCode ?? reportsToRef.email ?? null
          : reportsToRef || null;
      const department = apiEmp.employment?.department || apiEmp.department || "";
      const designation = apiEmp.employment?.designation || apiEmp.designation || "";
      const attendance = attendanceMap[String(id)];
      const isCheckedIn = Boolean(attendance?.checkIn && !attendance?.checkOut);

      uniqueEmployees.set(key, {
        id: id ?? key,
        employeeCode: code,
        name: apiEmp.name || `${apiEmp.firstName || ""} ${apiEmp.lastName || ""}`.trim() || "Employee",
        firstName: apiEmp.firstName || "",
        lastName: apiEmp.lastName || "",
        designation,
        department,
        band: apiEmp.employment?.band || apiEmp.band || "",
        reportsTo,
        reportsToName:
          typeof reportsToRef === "object" && reportsToRef !== null
            ? reportsToRef.name || `${reportsToRef.firstName || ""} ${reportsToRef.lastName || ""}`.trim()
            : reportsToRef || "Not assigned",
        email,
        phone: apiEmp.phone || apiEmp.personal?.phone || "",
        status: apiEmp.employment?.status || apiEmp.status || "",
        loginStatus: isCheckedIn ? "Online" : attendance?.checkIn ? "Present" : "Not checked in",
        lastActive: isCheckedIn ? "Checked in and on duty" : attendance?.checkIn ? "Checked in today" : "",
        location:
          apiEmp.workstationPod ||
          apiEmp.deskLocation ||
          apiEmp.employment?.workstationPod ||
          apiEmp.employment?.deskLocation ||
          "",
        branch:
          apiEmp.branch ||
          apiEmp.officeBranch ||
          apiEmp.employment?.officeBranch ||
          apiEmp.employment?.branch ||
          apiEmp.workLocation ||
          apiEmp.work_location ||
          apiEmp.employment?.workLocation ||
          apiEmp.address?.city ||
          "",
        workstationPod:
          apiEmp.workstationPod ||
          apiEmp.deskLocation ||
          apiEmp.employment?.workstationPod ||
          apiEmp.employment?.deskLocation ||
          "",
        shift: apiEmp.shift || "",
        employmentType: apiEmp.employment?.employmentType || apiEmp.employmentType || "",
        dateOfJoining: apiEmp.employment?.joiningDate || apiEmp.joiningDate || "",
        experience: apiEmp.experience || apiEmp.employment?.experience || "",
        profilePhoto: apiEmp.profilePhoto || apiEmp.profile_photo || "",
        avatarBg: "linear-gradient(135deg, #2563eb, #3b82f6)",
        summary: apiEmp.summary || [designation, department].filter(Boolean).join(" in "),
        skills: Array.isArray(apiEmp.skills) ? apiEmp.skills : [],
      });
    });
    const list = [...uniqueEmployees.values()];

    const employeeLookup = {};
    list.forEach((employee) => {
      employeeLookup[String(employee.id)] = employee;
      if (employee.employeeCode) employeeLookup[employee.employeeCode.toUpperCase()] = employee;
      if (employee.email) employeeLookup[employee.email.toLowerCase()] = employee;
    });

    // Build direct reports map from live manager references.
    const reportsMap = {};
    list.forEach((e) => {
      if (e.reportsTo) {
        const managerKey = String(e.reportsTo);
        const manager =
          employeeLookup[managerKey] ||
          employeeLookup[managerKey.toUpperCase()] ||
          employeeLookup[managerKey.toLowerCase()];
        if (manager) {
          if (!reportsMap[String(manager.id)]) reportsMap[String(manager.id)] = [];
          reportsMap[String(manager.id)].push(e);
        }
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
        directReports: reportsMap[String(e.id)] || [],
        loginStatus: isCurrentUser ? "Online" : e.loginStatus,
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
    setPhotoUploadError("");
  };

  const handleProfilePhotoUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !selectedEmp) return;

    setPhotoUploadError("");
    setPhotoUploading(true);
    try {
      const result = selectedEmp.isCurrentUser
        ? await uploadProfilePicture(file)
        : await uploadEmployeeProfilePicture(selectedEmp.id, file);
      if (!result?.success || !result.profilePhoto) {
        throw new Error(result?.message || "The profile photo could not be uploaded.");
      }
      setSelectedEmp((current) =>
        current ? { ...current, profilePhoto: result.profilePhoto } : current
      );
      if (selectedEmp.isCurrentUser) updateProfilePhoto(result.profilePhoto);
      window.dispatchEvent(new CustomEvent("hrms:data_changed"));
    } catch (error) {
      console.error("Profile photo upload failed:", error);
      setPhotoUploadError(error.message || "The profile photo could not be uploaded.");
    } finally {
      setPhotoUploading(false);
    }
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
                            {emp.profilePhoto && (
                              <img
                                className="workforce-result-photo"
                                src={formatPhotoUrl(emp.profilePhoto)}
                                alt={`${emp.name} profile`}
                                onError={(event) => {
                                  event.currentTarget.style.display = "none";
                                  const fallback = event.currentTarget.nextElementSibling;
                                  if (fallback) fallback.style.display = "flex";
                                }}
                              />
                            )}
                            <span style={{ display: emp.profilePhoto ? "none" : "flex" }}>
                              {initials}
                            </span>
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
                            {!workforceLoading && filteredEmployees.length === 0 && workforceError && (
                              <div className="dropdown-section" role="status">
                                <div className="dropdown-section-title">
                                  <span>👥 Workforce Directory & Colleagues</span>
                                </div>
                                <div className="dropdown-empty-state">
                                  <h4>Live workforce data unavailable</h4>
                                  <p>{workforceError}</p>
                                </div>
                              </div>
                            )}
                            {workforceLoading && filteredEmployees.length === 0 && (
                              <div className="dropdown-section" role="status">
                                <div className="dropdown-section-title">
                                  <span>👥 Workforce Directory & Colleagues</span>
                                </div>
                                <div className="dropdown-empty-state">
                                  <h4>Loading live workforce data…</h4>
                                </div>
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
                        {selectedEmp.profilePhoto ? (
                          <img
                            src={formatPhotoUrl(selectedEmp.profilePhoto)}
                            alt={`${selectedEmp.name} profile`}
                            onError={(event) => {
                              event.currentTarget.style.display = "none";
                            }}
                          />
                        ) : (
                          selectedEmp.name
                            .split(" ")
                            .filter(Boolean)
                            .slice(0, 2)
                            .map((w) => w[0].toUpperCase())
                            .join("")
                        )}
                      </div>
                      {(selectedEmp.isCurrentUser || isHrOrAdmin) && (
                        <>
                          <input
                            ref={photoInputRef}
                            className="profile-photo-input"
                            type="file"
                            accept="image/*"
                            onChange={handleProfilePhotoUpload}
                            aria-label="Upload profile photo"
                          />
                          <button
                            type="button"
                            className="profile-photo-upload-button"
                            onClick={() => photoInputRef.current?.click()}
                            disabled={photoUploading}
                            aria-label={photoUploading ? "Uploading profile photo" : "Upload profile photo"}
                            title={photoUploading ? "Uploading…" : "Upload profile photo"}
                          >
                            {photoUploading ? "…" : "↑"}
                          </button>
                        </>
                      )}
                      <span
                        className={`modal-live-status-dot ${getStatusDotClass(
                          selectedEmp.loginStatus
                      )}`}
                      title={`Real-time Status: ${selectedEmp.loginStatus}`}
                    />
                    {photoUploadError && (
                      <span className="profile-photo-upload-error" role="alert">
                        {photoUploadError}
                      </span>
                    )}
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
                          : selectedEmp.loginStatus || "Not available"}
                      </strong>
                    </div>
                  </div>

                  <div className="telemetry-item">
                    <span className="telemetry-label">Official Work Shift:</span>
                    <strong className="telemetry-text">
                      {selectedEmp.shift || "Not recorded"}
                    </strong>
                  </div>

                  <div className="telemetry-item">
                    <span className="telemetry-label">Employment Status:</span>
                    <strong className="telemetry-text confirmed">
                      {selectedEmp.employmentType || "Not provided"}
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
                        <strong>{selectedEmp.branch || "Not recorded"}</strong>
                      </div>

                      <div className="loc-item">
                        <span>Desk & Pod Location:</span>
                        <strong>{selectedEmp.workstationPod || "Not recorded"}</strong>
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
                        <strong>
                          {formatDate(selectedEmp.dateOfJoining)}
                          {selectedEmp.dateOfJoining &&
                            ` (${selectedEmp.experience || formatTenure(calculateTenure(selectedEmp.dateOfJoining))})`}
                        </strong>
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
