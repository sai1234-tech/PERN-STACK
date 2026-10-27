import { useState, useEffect, useRef, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useSidebar } from "../../context/SidebarContext";
import { useTheme } from "../../context/ThemeContext";
import { getEmployee } from "../../services/employeeService";
import { getMyDocuments } from "../../services/documentService";
import { getLeaves } from "../../services/leaveService";
import { getTodayAttendance } from "../../services/attendanceService";
import { normalizeRole, getRoleDisplayTitle } from "../../utils/auth";
import { formatPhotoUrl } from "../../utils/photo";
import { formatTime } from "../../utils/date";
import HeaderEmployeeSearch from "./HeaderEmployeeSearch";
import "./EmployeeHeader.css";

// Route breadcrumb dictionary
const ROUTE_CONTEXT_MAP = {
  "/employee/dashboard": { section: "Workspace", title: "Overview" },
  "/employee/attendance": { section: "Time & Attendance", title: "Daily Attendance" },
  "/employee/leaves": { section: "Time Off", title: "Leaves & WFH Hub" },
  "/employee/timesheets": { section: "Timesheets", title: "Project Logs" },
  "/employee/payroll": { section: "Finance", title: "My Payroll" },
  "/employee/documents": { section: "Records", title: "Document Vault" },
  "/employee/profile": { section: "Personal", title: "My Profile" },
  "/employee/calendar": { section: "Organization", title: "Holiday Calendar" },
  "/organization": { section: "Enterprise", title: "Org Hierarchy & Tree" },
  "/employee/organization": { section: "Enterprise", title: "Org Hierarchy" },
  "/hr/dashboard": { section: "HR Command", title: "Dashboard" },
  "/hr/employees": { section: "Workforce", title: "Employees" },
  "/hr/departments": { section: "Structure", title: "Departments" },
  "/hr/organization": { section: "Enterprise", title: "Org Hierarchy" },
  "/hr/timesheets": { section: "Operations", title: "Timesheets" },
  "/hr/payroll": { section: "Operations", title: "Payroll Run" },
  "/hr/documents": { section: "Vault", title: "Company Documents" },
  "/manager/dashboard": { section: "Manager Workspace", title: "Team Approvals" },
  "/manager/projects": { section: "Manager Workspace", title: "Active Projects" },
  "/hr/recruitment": { section: "People & Structure", title: "Recruitment & Onboarding" },
  "/hr/lifecycle": { section: "People & Structure", title: "Employee Lifecycle Workflow" },
  "/hr/roster": { section: "Operations", title: "Shift Roster" },
  "/hr/helpdesk": { section: "Operations", title: "HR Helpdesk" },
  "/hr/leaves": { section: "Operations", title: "Leave Management" },
  "/hr/resignations": { section: "Operations", title: "Resignations" },
  "/hr/resources": { section: "Operations", title: "Resource Allocation" },
  "/hr/performance": { section: "Operations", title: "Appraisals & OKRs" },
  "/admin/dashboard": { section: "Admin", title: "Executive Command" },
  "/admin/accounts": { section: "Security", title: "User Accounts" },
};

function EmployeeHeader() {
  const { user, employee, logout } = useAuth();
  const { isCollapsed, toggleSidebar } = useSidebar();
  const { isDark, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const [showNotifications, setShowNotifications] = useState(false);
  const [currentTime, setCurrentTime] = useState("");
  const [requestedDocs, setRequestedDocs] = useState([]);
  const [myLeaves, setMyLeaves] = useState([]);
  const [todayAtt, setTodayAtt] = useState(null);
  const [clearedNotificationIds, setClearedNotificationIds] = useState(() => {
    try {
      const stored = localStorage.getItem("hrms_cleared_notifications");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  
  // Real-time live notifications (e.g. from HR Helpdesk)
  const [liveNotifications, setLiveNotifications] = useState([]);
  const dropdownRef = useRef(null);

  const [headerPhoto, setHeaderPhoto] = useState(() => {
    const direct = employee?.profilePhoto || user?.profilePhoto;
    if (direct && !direct.startsWith("blob:")) return direct;
    return "";
  });

  // Sync profile photo on change
  useEffect(() => {
    const directPhoto = employee?.profilePhoto || user?.profilePhoto;
    if (directPhoto && !directPhoto.startsWith("blob:")) {
      setHeaderPhoto(directPhoto);
    } else {
      setHeaderPhoto("");
    }
  }, [employee, user]);

  // Fetch real-time context (documents, leaves, attendance) for logged-in user
  useEffect(() => {
    let mounted = true;
    const fetchUserContext = async () => {
      try {
        const [docsRes, leavesRes, attRes] = await Promise.allSettled([
          getMyDocuments(),
          getLeaves(),
          getTodayAttendance(),
        ]);

        if (mounted && docsRes.status === "fulfilled") {
          const docs = docsRes.value?.data || docsRes.value?.documents || docsRes.value || [];
          if (Array.isArray(docs)) {
            let dismissed = [];
            try {
              const s = JSON.parse(sessionStorage.getItem("hrms_dismissed_doc_requests") || "[]");
              dismissed = Array.isArray(s) ? s : [];
            } catch {}
            const reqs = docs.filter((d) => {
              const id = String(d._id || d.id);
              const status = String(d.status || "").toLowerCase();
              const isTarget = status === "requested" || status === "rejected";
              const isDismissed =
                dismissed.includes(id) ||
                dismissed.includes(`${id}:${d.status}`) ||
                dismissed.includes(`${id}:${status}`) ||
                dismissed.includes(`${id}:requested`) ||
                dismissed.includes(`${id}:rejected`);
              return isTarget && !isDismissed;
            });
            setRequestedDocs(reqs);
          }
        }

        if (mounted && leavesRes.status === "fulfilled") {
          const recs = leavesRes.value?.leaves || leavesRes.value?.records || leavesRes.value?.data || [];
          if (Array.isArray(recs)) {
            setMyLeaves(recs);
          }
        }

        if (mounted && attRes.status === "fulfilled") {
          const res = attRes.value;
          const todayData = res?.data || res;
          const record = res?.attendance || todayData?.attendance || (todayData?.checkIn ? todayData : null);
          const resolved = Array.isArray(record) ? record[0] : record;
          setTodayAtt(resolved && (resolved.checkIn || resolved.id) ? resolved : null);
        }
      } catch (e) {}
    };

    fetchUserContext();
    const handleSync = () => fetchUserContext();
    window.addEventListener("hrms:data_changed", handleSync);
    window.addEventListener("storage", handleSync);
    return () => {
      mounted = false;
      window.removeEventListener("hrms:data_changed", handleSync);
      window.removeEventListener("storage", handleSync);
    };
  }, []);

  // Listen for real-time photo updates dispatched from Profile page
  useEffect(() => {
    const handlePhotoUpdated = (e) => {
      const newPhoto = e?.detail?.profilePhoto;
      if (newPhoto && !newPhoto.startsWith("blob:")) {
        setHeaderPhoto(newPhoto);
      } else if (!newPhoto) {
        setHeaderPhoto("");
      }
    };

    window.addEventListener("hrms:profile_photo_updated", handlePhotoUpdated);

    return () => {
      window.removeEventListener("hrms:profile_photo_updated", handlePhotoUpdated);
    };
  }, []);

  const role = normalizeRole(user, employee);
  const isHr = role === "hr";
  const isAdmin = role === "admin";

  // Real-time clock update (IST / local)
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        new Intl.DateTimeFormat("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }).format(now)
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close notifications dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Name & Initials calculation
  const profile = employee || user || {};
  const isVikas =
    Boolean(
      profile?.name?.toLowerCase().includes("vikas") ||
      user?.name?.toLowerCase().includes("vikas") ||
      profile?.email?.toLowerCase().includes("vikas") ||
      user?.email?.toLowerCase().includes("vikas") ||
      employee?.email?.toLowerCase().includes("vikas")
    );

  const displayName =
    (isVikas ? "Vikas Guru" : "") ||
    profile.name ||
    `${profile.firstName || ""} ${profile.lastName || ""}`.trim() ||
    user?.name ||
    user?.email?.split("@")[0] ||
    "User";

  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || "QS";

  const isManager = role === "manager" || isVikas;
  const roleLabel = getRoleDisplayTitle(role);

  const currentRouteMeta = useMemo(() => {
    return ROUTE_CONTEXT_MAP[location.pathname] || { section: "Portal", title: "Quadratic HRMS" };
  }, [location.pathname]);

  const rawNotifications = useMemo(() => {
    const list = [...liveNotifications];

    // 1. Real HR document upload requests / rejections
    requestedDocs.forEach((doc) => {
      list.push({
        id: `doc-req-${doc._id || doc.id}`,
        title: doc.status === "requested" ? "📨 HR Document Requested" : "✕ Document Rejected",
        desc: `${doc.documentType || doc.documentName || "Document"}: ${doc.requestNote || doc.verificationNotes || "Upload requested by HR."}`,
        time: "Action Needed",
        link: "/employee/documents",
      });
    });

    // 2. Real employee leaves notifications (Pending review, Approved, Declined)
    myLeaves.forEach((l) => {
      const st = (l.status || "").toLowerCase();
      const typeName = l.leaveType?.name || l.type || "Leave";
      const startStr = l.startDate ? String(l.startDate).slice(0, 10) : "";
      if (st === "approved") {
        list.push({
          id: `leave-appr-${l.id || l._id}`,
          title: "🌴 Leave Request Approved",
          desc: `Your ${typeName} (${startStr}) has been approved by your manager.`,
          time: "Approved",
          link: "/employee/leaves",
        });
      } else if (st === "rejected") {
        list.push({
          id: `leave-rej-${l.id || l._id}`,
          title: "❌ Leave Request Declined",
          desc: `Your ${typeName} (${startStr}) was declined: ${l.rejection_reason || l.manager_remarks || "No remarks provided"}.`,
          time: "Declined",
          link: "/employee/leaves",
        });
      } else if (st.includes("pending")) {
        list.push({
          id: `leave-pend-${l.id || l._id}`,
          title: "⏳ Leave Application In Review",
          desc: `Your ${typeName} (${startStr}) is currently pending manager approval.`,
          time: "In Review",
          link: "/employee/leaves",
        });
      }
    });

    // 3. Real attendance notification (Late check-in today)
    if (todayAtt && (todayAtt.is_late || todayAtt.status === "late")) {
      const rawClockIn = todayAtt.checkIn || todayAtt.clockIn || todayAtt.checkInTime || todayAtt.clock_in;
      const clockInVal = rawClockIn ? formatTime(rawClockIn) : "past 10:00 AM";
      list.push({
        id: `att-late-${todayAtt.id || "today"}`,
        title: "⚠️ Shift Late Arrival Logged",
        desc: `Clocked in today at ${clockInVal}. Recorded as late arrival within permissible grace limit.`,
        time: "Today",
        link: "/employee/attendance",
      });
    }

    return list;
  }, [requestedDocs, liveNotifications, myLeaves, todayAtt]);

  // Listen for real-time ticket resolutions from HR Helpdesk
  useEffect(() => {
    const handleSync = (e) => {
      if (e.key === "hrms_tickets_sync" || e.type === "hrms_tickets_updated") {
        setLiveNotifications(prev => {
          const newNotif = {
            id: `hr-ticket-${Date.now()}`,
            title: "🎧 HR Helpdesk Update",
            desc: "HR has resolved your HR Connect request. Click to view the message.",
            time: "Just now",
            link: "/employee/resignation",
          };
          return [newNotif, ...prev];
        });
      }
    };
    window.addEventListener("storage", handleSync);
    window.addEventListener("hrms_tickets_updated", handleSync);
    return () => {
      window.removeEventListener("storage", handleSync);
      window.removeEventListener("hrms_tickets_updated", handleSync);
    };
  }, []);

  // Listen for notification dismissals fired across the app (e.g. from EmployeeDashboard)
  useEffect(() => {
    const handleDismissedSync = (e) => {
      const { id, docId } = e?.detail || {};
      if (id) {
        setClearedNotificationIds((prev) => Array.from(new Set([...prev, String(id)])));
        setLiveNotifications((prev) => prev.filter((n) => String(n.id) !== String(id)));
      }
      if (docId) {
        setRequestedDocs((prev) => prev.filter((d) => String(d._id || d.id) !== String(docId)));
      }
    };
    window.addEventListener("hrms_notification_dismissed", handleDismissedSync);
    return () => {
      window.removeEventListener("hrms_notification_dismissed", handleDismissedSync);
    };
  }, []);

  const notifications = useMemo(() => {
    return rawNotifications.filter(
      (item) => !clearedNotificationIds.includes(String(item.id))
    );
  }, [rawNotifications, clearedNotificationIds]);

  const handleClearAll = (e) => {
    e.stopPropagation();
    const allIds = rawNotifications.map((item) => String(item.id));
    const newCleared = Array.from(new Set([...clearedNotificationIds, ...allIds]));
    setClearedNotificationIds(newCleared);
    setLiveNotifications([]);

    try {
      localStorage.setItem("hrms_cleared_notifications", JSON.stringify(newCleared));
      const docIds = rawNotifications
        .filter((item) => String(item.id).startsWith("doc-"))
        .map((item) => String(item.id).replace(/^doc-(req-)?/, ""));
      if (docIds.length > 0) {
        const userOrEmpId = user?.id || employee?.id;
        const storedDismissed = JSON.parse(localStorage.getItem("hrms_dismissed_doc_requests") || "[]");
        const nextDismissed = Array.from(new Set([...storedDismissed, ...docIds]));
        localStorage.setItem("hrms_dismissed_doc_requests", JSON.stringify(nextDismissed));
        sessionStorage.setItem("hrms_dismissed_doc_requests", JSON.stringify(nextDismissed));
        if (userOrEmpId) {
          localStorage.setItem(`hrms_dismissed_doc_requests_${userOrEmpId}`, JSON.stringify(nextDismissed));
        }
        docIds.forEach((id) => {
          window.dispatchEvent(new CustomEvent("hrms_notification_dismissed", { detail: { id: `doc-req-${id}`, docId: id } }));
        });
      }
    } catch {}
  };

  const handleClearItem = (e, item) => {
    e.stopPropagation();
    const itemIdStr = String(item.id);
    const newCleared = Array.from(new Set([...clearedNotificationIds, itemIdStr]));
    setClearedNotificationIds(newCleared);

    // Immediately remove from liveNotifications if present
    setLiveNotifications((prev) => prev.filter((n) => String(n.id) !== itemIdStr));

    // If it's a doc request notification, dismiss from requestedDocs and sync across page
    if (itemIdStr.startsWith("doc-")) {
      const docId = itemIdStr.replace(/^doc-(req-)?/, "");
      try {
        const userOrEmpId = user?.id || employee?.id;
        const storedDismissed = JSON.parse(localStorage.getItem("hrms_dismissed_doc_requests") || "[]");
        const nextDismissed = Array.from(new Set([...storedDismissed, docId, `${docId}:requested`, `${docId}:rejected`]));
        localStorage.setItem("hrms_dismissed_doc_requests", JSON.stringify(nextDismissed));
        sessionStorage.setItem("hrms_dismissed_doc_requests", JSON.stringify(nextDismissed));
        if (userOrEmpId) {
          localStorage.setItem(`hrms_dismissed_doc_requests_${userOrEmpId}`, JSON.stringify(nextDismissed));
        }
        window.dispatchEvent(new CustomEvent("hrms_notification_dismissed", { detail: { id: itemIdStr, docId } }));
      } catch {}
      setRequestedDocs((prev) => prev.filter((d) => String(d._id || d.id) !== docId));
    } else if (itemIdStr.startsWith("leave-")) {
      const leaveId = itemIdStr.replace(/^leave-/, "");
      setMyLeaves((prev) => prev.filter((l) => String(l._id || l.id) !== leaveId));
    } else if (itemIdStr.startsWith("att-late-")) {
      setTodayAtt(null);
    }

    try {
      localStorage.setItem("hrms_cleared_notifications", JSON.stringify(newCleared));
    } catch {}
  };

  const handleNotificationClick = (item) => {
    setShowNotifications(false);
    if (item.link) {
      navigate(item.link);
    }
  };

  return (
    <header className="employee-header" aria-label="Top Application Header">
      {/* Left: Universal Sidebar Toggle & Breadcrumb / Section Context */}
      <div className="header-left-cluster">
        {/* Universal Sidebar Toggle Button (Click to Close / Click to Open) */}
        <button
          type="button"
          className={`header-sidebar-toggle-btn ${isCollapsed ? "is-collapsed" : "is-expanded"}`}
          onClick={toggleSidebar}
          title={
            isCollapsed
              ? "Open navigation sidebar (Ctrl+[)"
              : "Close navigation sidebar (Ctrl+[)"
          }
          aria-label={isCollapsed ? "Open sidebar" : "Close sidebar"}
        >
          <span className="sidebar-toggle-desktop-icon">
            {isCollapsed ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <line x1="9" y1="3" x2="9" y2="21"/>
                <polyline points="13 10 15 12 13 14"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <line x1="9" y1="3" x2="9" y2="21"/>
                <polyline points="16 14 14 12 16 10"/>
              </svg>
            )}
          </span>
          <span className="sidebar-toggle-mobile-icon">☰</span>
        </button>

        {/* Breadcrumb Context Title */}
        <div className="header-breadcrumb-box">
          <span className="breadcrumb-section">{currentRouteMeta.section}</span>
          <span className="breadcrumb-divider">/</span>
          <h2 className="breadcrumb-title">{currentRouteMeta.title}</h2>
        </div>
      </div>

      {/* Center: Global Real-Time Workforce Search Bar */}
      <div className="header-center-cluster">
        <HeaderEmployeeSearch />
      </div>

      {/* Right: Utilities (Clock, Notifications, User Profile, Sign out) */}
      <div className="employee-header-actions">
        <button
          type="button"
          className="header-theme-toggle"
          onClick={toggleTheme}
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          aria-pressed={isDark}
        >
          <span className="theme-toggle-icon" aria-hidden="true">{isDark ? "☀️" : "🌙"}</span>
          <span className="theme-toggle-text">{isDark ? "Light" : "Dark"}</span>
        </button>

        {/* Live Clock Capsule */}
        {currentTime && (
          <div
            className="header-clock-capsule"
            aria-label={`Official corporate time: ${currentTime} IST`}
            tabIndex={0}
          >
            <span className="clock-icon" aria-hidden="true">🕒</span>
            <span className="clock-time" aria-hidden="true">{currentTime} IST</span>
          </div>
        )}

        {/* Notifications Center */}
        <div className="header-notification-wrapper" ref={dropdownRef}>
          <button
            type="button"
            className="header-icon-btn"
            onClick={() => setShowNotifications(!showNotifications)}
            title="Notifications"
            aria-label="Toggle notifications"
          >
            🔔
            {notifications.length > 0 && (
              <span className="header-badge-count">{notifications.length}</span>
            )}
          </button>

          {showNotifications && (
            <>
              <div
                className="notification-backdrop"
                onClick={() => setShowNotifications(false)}
              />
              <div className="notification-dropdown">
                <div className="notification-header">
                  <span>System Notifications</span>
                  {notifications.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAll}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#0d9488",
                        cursor: "pointer",
                        fontSize: "0.72rem",
                        fontWeight: "600",
                        padding: "2px 6px",
                        borderRadius: "4px"
                      }}
                    >
                      Clear All
                    </button>
                  )}
                </div>
                {notifications.length > 0 ? (
                  <ul className="notification-list">
                    {notifications.map((item) => (
                      <li
                        key={item.id}
                        className="notification-item"
                        onClick={() => handleNotificationClick(item)}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", width: "100%", gap: "8px" }}>
                          <strong>{item.title}</strong>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleClearItem(e, item);
                            }}
                            title="Dismiss notification"
                            style={{
                              background: "none",
                              border: "none",
                              color: "#94a3b8",
                              cursor: "pointer",
                              fontSize: "1rem",
                              lineHeight: 1,
                              padding: "0 2px"
                            }}
                          >
                            ×
                          </button>
                        </div>
                        <span>{item.desc}</span>
                        <small style={{ color: "#94a3b8", fontSize: "0.68rem" }}>
                          {item.time}
                        </small>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div style={{ padding: "1.75rem 1rem", textAlign: "center", color: "#64748b", fontSize: "0.82rem" }}>
                    <div style={{ fontSize: "1.6rem", marginBottom: "0.35rem" }}>🔔</div>
                    <strong style={{ display: "block", color: "#334155", marginBottom: "0.2rem" }}>No New Notifications</strong>
                    <span>You're all caught up! No unread notifications at this time.</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* User Capsule */}
        <Link
          to="/employee/profile"
          className="header-user-capsule"
          title={`Signed in as ${displayName} (${roleLabel})`}
        >
          <div className="header-avatar" title={`Signed in as ${displayName}`}>
            {headerPhoto ? (
              <img
                src={formatPhotoUrl(headerPhoto)}
                alt={displayName}
                className="header-avatar-img"
                onError={(e) => {
                  setHeaderPhoto("");
                  e.currentTarget.style.display = "none";
                  const fallback = e.currentTarget.nextElementSibling;
                  if (fallback) fallback.style.display = "flex";
                }}
              />
            ) : null}
            <span
              className="header-avatar-initials"
              style={{ display: headerPhoto ? "none" : "flex" }}
            >
              {initials}
            </span>
          </div>
          <div className="header-user-details">
            <span className="header-user-name">{displayName}</span>
            <span className="header-user-role">{roleLabel}</span>
          </div>
        </Link>

        {/* Sign Out Action */}
        <button
          type="button"
          className="header-signout-btn"
          onClick={logout}
          title="Sign out of HRMS"
        >
          <span>Sign out</span>
          <span>↪</span>
        </button>
      </div>
    </header>
  );
}

export default EmployeeHeader;
