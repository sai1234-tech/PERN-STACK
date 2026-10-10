import { useState, useEffect, useRef, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useSidebar } from "../../context/SidebarContext";
import { getEmployee } from "../../services/employeeService";
import { getMyDocuments } from "../../services/documentService";
import { normalizeRole } from "../../utils/auth";
import HeaderEmployeeSearch from "./HeaderEmployeeSearch";
import "./EmployeeHeader.css";

const formatPhotoUrl = (photo) => {
  if (!photo) return "";
  if (/^https?:\/\//i.test(photo) || photo.startsWith("blob:") || photo.startsWith("data:")) return photo;

  const apiUrl = (
    String(import.meta.env.VITE_API_URL || "").replace("localhost", "127.0.0.1") ||
    "/"
  ).replace(/\/$/, "");

  const cleanPhoto = String(photo).replace(/\\/g, "/").replace(/^\/?api(\/v1)?\/?/, "");
  return `${apiUrl.replace(/\/api(\/v1)?\/?$/, "")}${cleanPhoto.startsWith("/") ? cleanPhoto : `/${cleanPhoto}`}`;
};

// Route breadcrumb dictionary
const ROUTE_CONTEXT_MAP = {
  "/employee/dashboard": { section: "Workspace", title: "Overview" },
  "/employee/attendance": { section: "Time & Attendance", title: "Daily Attendance" },
  "/employee/leaves": { section: "Time Off", title: "Leaves & WFH Hub" },
  "/employee/timesheets": { section: "Timesheets", title: "Project Logs" },
  "/employee/payroll": { section: "Finance", title: "My Payroll" },
  "/employee/documents": { section: "Records", title: "Document Vault" },
  "/employee/profile": { section: "Personal", title: "My Profile" },
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
  "/admin/dashboard": { section: "Admin", title: "Executive Command" },
  "/admin/accounts": { section: "Security", title: "User Accounts" },
};

function EmployeeHeader() {
  const { user, employee, logout } = useAuth();
  const { isCollapsed, toggleSidebar } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();

  const [showNotifications, setShowNotifications] = useState(false);
  const [currentTime, setCurrentTime] = useState("");
  const [requestedDocs, setRequestedDocs] = useState([]);
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
    const l = localStorage.getItem("hrms_profile_photo");
    const s = sessionStorage.getItem("hrms_profile_photo");
    if (s && !s.startsWith("blob:")) return s;
    if (l && !l.startsWith("blob:")) return l;
    return "";
  });

  // Sync profile photo on change or fetch from server
  useEffect(() => {
    const directPhoto = employee?.profilePhoto || user?.profilePhoto;
    if (directPhoto) {
      setHeaderPhoto(directPhoto);
      if (!directPhoto.startsWith("blob:")) {
        localStorage.setItem("hrms_profile_photo", directPhoto);
        sessionStorage.setItem("hrms_profile_photo", directPhoto);
      }
    } else {
      const stored = localStorage.getItem("hrms_profile_photo") || sessionStorage.getItem("hrms_profile_photo");
      if (stored && !stored.startsWith("blob:")) {
        setHeaderPhoto(stored);
      } else {
        let isMounted = true;
        getEmployee()
          .then((res) => {
            if (!isMounted) return;
            const empData = res?.employee || res?.data?.employee || res?.user || res;
            const photo = empData?.profilePhoto;
            if (photo && !photo.startsWith("blob:")) {
              setHeaderPhoto(photo);
              localStorage.setItem("hrms_profile_photo", photo);
              sessionStorage.setItem("hrms_profile_photo", photo);
            }
          })
          .catch(() => {});
        return () => {
          isMounted = false;
        };
      }
    }
  }, [employee, user]);

  // Fetch real-time HR document requests for logged-in user
  useEffect(() => {
    let mounted = true;
    const fetchRequestedDocs = async () => {
      try {
        const res = await getMyDocuments();
        const docs = res?.data || res?.documents || res || [];
        if (mounted && Array.isArray(docs)) {
          const reqs = docs.filter(
            (d) => d.status === "requested" || d.status === "rejected"
          );
          setRequestedDocs(reqs);
        }
      } catch (e) {}
    };

    fetchRequestedDocs();
    const handleSync = () => fetchRequestedDocs();
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
      const newPhoto =
        e?.detail?.profilePhoto ||
        localStorage.getItem("hrms_profile_photo") ||
        sessionStorage.getItem("hrms_profile_photo");
      if (newPhoto) {
        setHeaderPhoto(newPhoto);
      }
    };

    window.addEventListener("hrms:profile_photo_updated", handlePhotoUpdated);
    window.addEventListener("storage", handlePhotoUpdated);

    return () => {
      window.removeEventListener("hrms:profile_photo_updated", handlePhotoUpdated);
      window.removeEventListener("storage", handlePhotoUpdated);
    };
  }, []);

  const role = normalizeRole(user);
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
  const displayName =
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

  const roleLabel = role === "manager"
    ? "Team Manager"
    : isHr
    ? "HR Lead"
    : isAdmin
    ? "Administrator"
    : "Employee";

  const currentRouteMeta = useMemo(() => {
    return ROUTE_CONTEXT_MAP[location.pathname] || { section: "Portal", title: "Quadratic HRMS" };
  }, [location.pathname]);

  const rawNotifications = useMemo(() => {
    const docNotifications = requestedDocs.map((doc) => ({
      id: `doc-req-${doc._id || doc.id}`,
      title: doc.status === "requested" ? "📨 HR Document Requested" : "✕ Document Rejected",
      desc: `${doc.documentType || doc.documentName || "Document"}: ${doc.requestNote || doc.verificationNotes || "Upload requested by HR."}`,
      time: "Action Needed",
      link: "/employee/documents",
    }));

    return [
      ...liveNotifications,
      ...docNotifications,
      {
        id: "sys-att-corr",
        title: "⏱️ HR Attendance Correction",
        desc: "HR resolved missing clock-out and updated check-out to 06:30 PM IST.",
        time: "Just now",
        link: "/employee/timesheets",
      },
      {
        id: "sys-res-update",
        title: "🚪 Resignation Status Update",
        desc: "Your resignation request has been reviewed by HR. Please check the portal.",
        time: "Recently",
        link: "/employee/resignation",
      },
      {
        id: "sys-1",
        title: "Payroll Statement Verified",
        desc: "September salary calculation finalized and available for download.",
        time: "10m ago",
        link: "/employee/payroll",
      },
      {
        id: "sys-2",
        title: "Leave Request Approved",
        desc: "Upcoming leave has been recorded in the attendance calendar.",
        time: "2h ago",
        link: "/employee/leaves",
      },
    ];
  }, [requestedDocs, liveNotifications]);

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
    try {
      localStorage.setItem("hrms_cleared_notifications", JSON.stringify(newCleared));
    } catch {}
  };

  const handleClearItem = (e, item) => {
    e.stopPropagation();
    const itemIdStr = String(item.id);
    const newCleared = Array.from(new Set([...clearedNotificationIds, itemIdStr]));
    setClearedNotificationIds(newCleared);
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
        {/* Live Clock Capsule */}
        {currentTime && (
          <div className="header-clock-capsule" title="Official Corporate Time (IST)">
            <span className="clock-icon">🕒</span>
            <span>{currentTime} IST</span>
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
                            onClick={(e) => handleClearItem(e, item)}
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
                  <div style={{ padding: "1.5rem 1rem", textAlign: "center", color: "#64748b", fontSize: "0.82rem" }}>
                    🔔 No new notifications
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
                  localStorage.removeItem("hrms_profile_photo");
                  sessionStorage.removeItem("hrms_profile_photo");
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
