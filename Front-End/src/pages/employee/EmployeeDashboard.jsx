import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import EmployeeHeader from "../../components/employee/EmployeeHeader";
import DailyPulseWidget from "../../components/employee/DailyPulseWidget";
import Loader from "../../components/common/Loader";
import ErrorMessage from "../../components/common/ErrorMessage";
import { useAuth } from "../../context/AuthContext";
import { useEmployee } from "../../hooks/useEmployee";
import { useAttendance } from "../../hooks/useAttendance";
import { useLeaves } from "../../hooks/useLeaves";
import { useTimesheets } from "../../hooks/useTimesheets";
import { useEnterpriseOps } from "../../hooks/useEnterpriseOps";
import { getMyDocuments, uploadDocument, getDocumentTypes, normalizeDocumentTypes } from "../../services/documentService";
import { apiRequest } from "../../services/apiClient";
import { formatTime, formatDate, parseLocalDate, formatDuration } from "../../utils/date";
import { normalizeRole } from "../../utils/auth";
import "./EmployeeDashboard.css";

function EmployeeDashboard() {
  const { user, employee: sessionEmployee } = useAuth();
  const employeeState = useEmployee();
  const attendanceState = useAttendance();
  const leavesState = useLeaves();
  const timesheetState = useTimesheets();
  const { pulseAnswered, submitPulse } = useEnterpriseOps();

  const [requestedDocs, setRequestedDocs] = useState([]);
  const [uploadNotice, setUploadNotice] = useState("");
  const [uploadBusy, setUploadBusy] = useState(false);

  // Field 1: General Document Upload states
  const [docTypeList, setDocTypeList] = useState([
    { id: "Aadhaar / ID Proof", label: "Aadhaar / ID Proof" },
    { id: "PAN", label: "PAN" },
    { id: "Passport & Visa", label: "Passport & Visa" },
    { id: "Educational Degree Certificate", label: "Educational Degree Certificate" },
    { id: "Signed Employment Contract", label: "Signed Employment Contract" },
    { id: "Tax Declaration (W-4 / Form 16)", label: "Tax Declaration (W-4 / Form 16)" },
    { id: "Direct Deposit Voided Check", label: "Direct Deposit Voided Check" },
    { id: "Non-Disclosure Agreement (NDA)", label: "Non-Disclosure Agreement (NDA)" },
    { id: "Health Insurance Beneficiary", label: "Health Insurance Beneficiary" },
    { id: "General Document", label: "General Document" },
  ]);
  const [generalDocType, setGeneralDocType] = useState("Aadhaar / ID Proof");
  const [generalDocTitle, setGeneralDocTitle] = useState("");
  const [generalDocFile, setGeneralDocFile] = useState(null);
  const [generalDocBusy, setGeneralDocBusy] = useState(false);

  // Field 2: HR Document Request Upload states
  const [hrSelectedFiles, setHrSelectedFiles] = useState({});
  const [hrUploadingIds, setHrUploadingIds] = useState([]);
  const getStoredDismissedRequests = () => {
    try {
      const session = JSON.parse(sessionStorage.getItem("hrms_dismissed_doc_requests") || "[]");
      return Array.isArray(session) ? session : [];
    } catch {
      return [];
    }
  };

  const [dismissedDocRequests, setDismissedDocRequests] = useState(() => getStoredDismissedRequests());

  // Fetch HR document requests for logged in employee
  useEffect(() => {
    let mounted = true;
    const fetchRequested = async () => {
      try {
        const res = await getMyDocuments();
        const docs = res?.data || res?.documents || res || [];
        if (mounted && Array.isArray(docs)) {
          const dismissed = getStoredDismissedRequests();
          const reqs = docs.filter((d) => {
            const id = String(d._id || d.id);
            const status = String(d.status || "").toLowerCase();
            const rawStatus = String(d.status || "");
            const isTarget = status === "requested" || status === "rejected";
            const isDismissed =
              dismissed.includes(id) ||
              dismissed.includes(`${id}:${rawStatus}`) ||
              dismissed.includes(`${id}:${status}`) ||
              dismissed.includes(`${id}:requested`) ||
              dismissed.includes(`${id}:rejected`);
            return isTarget && !isDismissed;
          });
          setRequestedDocs(reqs);
        }
      } catch (e) {}
    };

    fetchRequested();

    // Fetch official document types for general upload field
    getDocumentTypes()
      .then((res) => {
        const types = normalizeDocumentTypes(res);
        if (Array.isArray(types) && types.length > 0) {
          setDocTypeList(types);
          setGeneralDocType(types[0].label || types[0].id || "General Document");
        }
      })
      .catch(() => {});

    const handleSync = () => fetchRequested();
    const handleDismissSync = (e) => {
      const docId = e?.detail?.docId;
      if (docId) {
        setRequestedDocs((prev) => prev.filter((d) => String(d._id || d.id) !== String(docId)));
        setDismissedDocRequests((prev) => Array.from(new Set([...prev, String(docId), `${docId}:requested`, `${docId}:rejected`])));
      }
    };
    window.addEventListener("hrms:data_changed", handleSync);
    window.addEventListener("storage", handleSync);
    window.addEventListener("hrms_notification_dismissed", handleDismissSync);
    return () => {
      mounted = false;
      window.removeEventListener("hrms:data_changed", handleSync);
      window.removeEventListener("storage", handleSync);
      window.removeEventListener("hrms_notification_dismissed", handleDismissSync);
    };
  }, [user, sessionEmployee]);

  const handleDashboardUpload = async (e, reqDoc) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadBusy(true);
      setUploadNotice("");

      await uploadDocument(file, {
        documentType: reqDoc.documentType || "General Document",
        documentId: reqDoc._id || reqDoc.id,
        requestId: reqDoc._id || reqDoc.id,
        documentName: reqDoc.documentName || reqDoc.documentType || file.name,
      });

      setUploadNotice(`✓ Successfully uploaded "${file.name}"! Document submitted to HR for review.`);
      window.dispatchEvent(new CustomEvent("hrms:data_changed"));

      const res = await getMyDocuments();
      const docs = res?.data || res?.documents || res || [];
      if (Array.isArray(docs)) {
        const dismissed = getStoredDismissedRequests();
        setRequestedDocs(
          docs.filter((d) => {
            const id = String(d._id || d.id);
            const status = String(d.status || "").toLowerCase();
            const rawStatus = String(d.status || "");
            const isTarget = status === "requested" || status === "rejected";
            const isDismissed =
              dismissed.includes(id) ||
              dismissed.includes(`${id}:${rawStatus}`) ||
              dismissed.includes(`${id}:${status}`) ||
              dismissed.includes(`${id}:requested`) ||
              dismissed.includes(`${id}:rejected`);
            return isTarget && !isDismissed;
          })
        );
      }
    } catch (err) {
      alert(err.message || "Failed to upload document.");
    } finally {
      setUploadBusy(false);
      e.target.value = "";
    }
  };

  // Field 1: Handler for General Document Upload
  const handleGeneralUploadSubmit = async (e) => {
    e.preventDefault();
    if (!generalDocFile) {
      alert("Please select a document file to upload.");
      return;
    }

    try {
      setGeneralDocBusy(true);
      setUploadNotice("");

      await uploadDocument(generalDocFile, {
        documentType: generalDocType || "General Document",
        documentName: generalDocTitle.trim() || generalDocFile.name,
        description: `Uploaded from Employee Dashboard on ${new Date().toLocaleDateString()}`,
      });

      setUploadNotice(`✓ Successfully uploaded "${generalDocFile.name}" as ${generalDocType || "General Document"}! Routed to HR for verification.`);
      setGeneralDocFile(null);
      setGeneralDocTitle("");

      window.dispatchEvent(new CustomEvent("hrms:data_changed"));
    } catch (err) {
      alert(err.message || "Failed to upload document.");
    } finally {
      setGeneralDocBusy(false);
    }
  };

  // Field 2: Handler for Uploading Document Requested from HR
  const handleHrRequestUpload = async (reqDoc) => {
    const docId = String(reqDoc._id || reqDoc.id);
    const file = hrSelectedFiles[docId];
    if (!file) {
      alert(`Please select a file to upload for "${reqDoc.documentType || reqDoc.documentName}".`);
      return;
    }

    try {
      setHrUploadingIds((prev) => [...prev, docId]);
      setUploadNotice("");

      await uploadDocument(file, {
        documentType: reqDoc.documentType || "General Document",
        documentId: docId,
        requestId: docId,
        documentName: reqDoc.documentName || reqDoc.documentType || file.name,
      });

      setUploadNotice(`✓ Successfully uploaded "${file.name}" in response to HR's request! Submitted for verification.`);
      
      // Clear this file selection
      setHrSelectedFiles((prev) => {
        const copy = { ...prev };
        delete copy[docId];
        return copy;
      });

      window.dispatchEvent(new CustomEvent("hrms:data_changed"));

      // Refresh list
      const res = await getMyDocuments();
      const docs = res?.data || res?.documents || res || [];
      if (Array.isArray(docs)) {
        const dismissed = getStoredDismissedRequests();
        setRequestedDocs(
          docs.filter((d) => {
            const id = String(d._id || d.id);
            const status = String(d.status || "").toLowerCase();
            const rawStatus = String(d.status || "");
            const isTarget = status === "requested" || status === "rejected";
            const isDismissed =
              dismissed.includes(id) ||
              dismissed.includes(`${id}:${rawStatus}`) ||
              dismissed.includes(`${id}:${status}`) ||
              dismissed.includes(`${id}:requested`) ||
              dismissed.includes(`${id}:rejected`);
            return isTarget && !isDismissed;
          })
        );
      }
    } catch (err) {
      alert(err.message || "Failed to upload requested document.");
    } finally {
      setHrUploadingIds((prev) => prev.filter((id) => id !== docId));
    }
  };

  const dismissAllDocRequests = (docsToDismiss = requestedDocs) => {
    const list = Array.isArray(docsToDismiss) ? docsToDismiss : [docsToDismiss];
    const docIds = list.map((d) => String(d._id || d.id || "")).filter(Boolean);
    const keysToAdd = [];
    docIds.forEach((id) => {
      keysToAdd.push(id, `${id}:requested`, `${id}:rejected`);
    });

    // 1. Immediately hide from page state
    setRequestedDocs((prev) => prev.filter((d) => !docIds.includes(String(d._id || d.id))));

    // 2. Persist to dismissedDocRequests state and both sessionStorage & localStorage
    setDismissedDocRequests((current) => {
      const next = Array.from(new Set([...current, ...keysToAdd]));
      try {
        sessionStorage.setItem("hrms_dismissed_doc_requests", JSON.stringify(next));
        localStorage.setItem("hrms_dismissed_doc_requests", JSON.stringify(next));
        const userOrEmpId = user?.id || sessionEmployee?.id;
        if (userOrEmpId) {
          localStorage.setItem(`hrms_dismissed_doc_requests_${userOrEmpId}`, JSON.stringify(next));
        }
      } catch {}
      return next;
    });

    // 3. Inform header notifications to also clear doc notifications
    try {
      const clearedStored = JSON.parse(localStorage.getItem("hrms_cleared_notifications") || "[]");
      const notifKeys = docIds.flatMap((id) => [`doc-${id}`, `doc-req-${id}`, id]);
      const updatedCleared = Array.from(new Set([...clearedStored, ...notifKeys]));
      localStorage.setItem("hrms_cleared_notifications", JSON.stringify(updatedCleared));
      docIds.forEach((docId) => {
        window.dispatchEvent(new CustomEvent("hrms_notification_dismissed", { detail: { id: `doc-req-${docId}`, docId } }));
        window.dispatchEvent(new CustomEvent("hrms_notification_dismissed", { detail: { id: `doc-${docId}`, docId } }));
      });
    } catch {}
  };

  const dismissDocRequest = (reqDoc) => {
    dismissAllDocRequests(reqDoc ? [reqDoc] : requestedDocs);
  };

  // Greeting based on current time
  const currentHour = new Date().getHours();
  const [tickets, setTickets] = useState([]);
  const [activeTab, setActiveTab] = useState("workspace");
  
  useEffect(() => {
    // Fetch tickets for dashboard display
    const fetchMyTickets = async () => {
      try {
        const { apiRequest } = await import('../../services/apiClient');
        const res = await apiRequest('/tickets/my');
        if (res.success) {
          setTickets(res.tickets || []);
        }
      } catch (err) {
        console.error("Failed to fetch tickets for dashboard", err);
      }
    };
    fetchMyTickets();
    
    // Auto-update if HR resolves a ticket
    const handleTicketSync = (e) => {
      if (e.key === "hrms_tickets_sync" || e.type === "hrms_tickets_updated") {
        fetchMyTickets();
        
        // Show a popup notification to alert the user
        import('react-toastify').then(({ toast }) => {
          toast.success("🎧 HR Helpdesk Update: A ticket has been resolved!");
        }).catch(err => console.error("Toast failed to load", err));
      }
    };
    window.addEventListener("storage", handleTicketSync);
    window.addEventListener("hrms_tickets_updated", handleTicketSync);
    return () => {
      window.removeEventListener("storage", handleTicketSync);
      window.removeEventListener("hrms_tickets_updated", handleTicketSync);
    };
  }, []);

  const greeting =
    currentHour < 12
      ? "Good morning"
      : currentHour < 18
        ? "Good afternoon"
        : "Good evening";

  // Profile data resolution: merge loaded employee profile with auth session user
  const employeeData = sessionEmployee || employeeState.employee || {};
  const profile = {
    ...user,
    ...employeeData,
    employment: {
      ...(user?.employment || {}),
      ...(employeeData.employment || {}),
    },
  };
  const fullName =
    profile.name ||
    `${profile.firstName || ""} ${profile.lastName || ""}`.trim() ||
    sessionEmployee?.name ||
    user?.name ||
    (user?.email ? user.email.split("@")[0] : "") ||
    "Employee";

  const rawFirstName =
    profile.firstName ||
    sessionEmployee?.firstName ||
    fullName.split(" ")[0] ||
    "Employee";

  const firstName =
    rawFirstName.toLowerCase().startsWith("sandhya")
      ? "Sandhya"
      : rawFirstName;

  const employeeCode =
    profile.employeeCode ||
    profile.employeeId ||
    user?.employeeId ||
    "EMP-2024-001";

  const department =
    profile.employment?.department ||
    profile.department ||
    user?.department ||
    "Department not assigned";

  const designation =
    profile.employment?.designation ||
    profile.designation ||
    profile.jobTitle ||
    "Job title not assigned";

  const managerName =
    profile.reportsTo?.name ||
    employeeData.reportsTo?.name ||
    profile.reportsToName ||
    (typeof profile.reportsTo === "string" ? profile.reportsTo : "") ||
    "Vikas Guru";

  // Attendance states
  const today = attendanceState.todayAttendance;
  const checkedIn = Boolean(today?.checkIn) && !today?.checkOut;
  const shiftCompleted = Boolean(today?.checkIn && today?.checkOut);

  // Deactivated check: only block if explicitly inactive
  const empStatus = (profile.employment?.status || profile.status || "Active").toLowerCase();
  const isDeactivated = empStatus === "inactive" || empStatus === "terminated" || user?.isActive === false;

  const isShiftDurationExhausted = Number(today?.workingHours || 0) >= 8.0;
  const isClockInDisabled = checkedIn || isDeactivated || (shiftCompleted && isShiftDurationExhausted);
  const isClockOutDisabled = !checkedIn || isDeactivated;

  const [clockBusy, setClockBusy] = useState(false);

  const handleClockInAction = async () => {
    try {
      setClockBusy(true);
      await attendanceState.clockIn();
    } catch (err) {
      console.error("Clock In error:", err);
    } finally {
      setClockBusy(false);
    }
  };

  const handleClockOutAction = async () => {
    try {
      setClockBusy(true);
      await attendanceState.clockOut();
    } catch (err) {
      console.error("Clock Out error:", err);
    } finally {
      setClockBusy(false);
    }
  };

  // Live stopwatch timer
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Live employee availability status: 'in' | 'out' | 'wfh' | 'leave'
  const [availability, setAvailability] = useState("in");

  useEffect(() => {
    if (!today?.checkIn) {
      setElapsedSeconds(Math.min(28800, Math.max(0, Math.round(Number(today?.workingHours || 0) * 3600))));
      return;
    }

    const checkInTime = new Date(today.checkIn).getTime();
    const checkOutTime = today.checkOut ? new Date(today.checkOut).getTime() : Date.now();

    if (Number.isNaN(checkInTime)) {
      setElapsedSeconds(Math.min(28800, Math.max(0, Math.round(Number(today?.workingHours || 0) * 3600))));
      return;
    }

    const updateElapsed = () => {
      const currentTime = today.checkOut ? checkOutTime : Date.now();
      const rawSeconds = Math.max(0, Math.floor((currentTime - checkInTime) / 1000));
      const storedSeconds = Math.max(0, Math.round(Number(today?.workingHours || 0) * 3600));
      const totalSeconds = Math.max(rawSeconds, storedSeconds);

      // Capped at 8 hours (28800 seconds)
      setElapsedSeconds(Math.min(28800, totalSeconds));

      // Strict 8-hour cap: If clocked in for >= 8 hours, automatically clock out
      if (!today.checkOut && rawSeconds >= 28800 && !clockBusy) {
        handleClockOutAction();
      }
    };

    updateElapsed();
    if (today.checkOut) return;

    const timer = setInterval(updateElapsed, 1000);
    return () => clearInterval(timer);
  }, [today?.checkIn, today?.checkOut, today?.workingHours, clockBusy]);

  // Target shift: 8 hours (28800 seconds)
  const shiftProgressPercent = Math.min(
    100,
    Math.round((elapsedSeconds / 28800) * 100)
  );

  // Attendance metrics calculation
  const attendanceList = attendanceState.attendance || [];
  const presentCount = attendanceList.filter(
    (record) =>
      ["present", "late", "completed", "half-day", "halfday"].includes(
        String(record.status || "").toLowerCase()
      ) || Boolean(record.checkIn)
  ).length;

  const lateCount = attendanceList.filter(
    (record) => String(record.status || "").toLowerCase() === "late"
  ).length;

  const attendanceRate = attendanceList.length
    ? Math.min(100, Math.round((presentCount / attendanceList.length) * 100))
    : 0;

  // Standard enterprise leave types (Earned Leave, Casual Leave, Sick Leave, Optional Holiday)
  // Excludes special statutory leaves like Maternity (180 days) and remote allowance WFH (48 days)
  const ptoBalances = useMemo(() => {
    if (!leavesState.balance?.length) return [];
    return leavesState.balance.filter((b) => {
      const code = (b.leaveType?.code || "").toUpperCase();
      const name = (b.leaveType?.name || "").toLowerCase();
      const isSpecial = b.isSpecial || b.leaveType?.isSpecial;
      return (
        !isSpecial &&
        code !== "ML" &&
        code !== "MAT" &&
        code !== "WFH" &&
        !name.includes("maternity") &&
        !name.includes("paternity") &&
        !name.includes("work from home")
      );
    });
  }, [leavesState.balance]);

  const leaveBalanceDays = ptoBalances.length
    ? ptoBalances.reduce((total, b) => total + Number(b.available || 0), 0)
    : 39;

  // Strict user attendance activity for current week
  const displayPunches = attendanceList.slice(0, 7);

  // User's own leave applications
  const displayLeaves = leavesState.leaves?.slice(0, 4) || [];

  // Upcoming company holidays
  const currentYear = new Date().getFullYear();
  const [apiHolidays, setApiHolidays] = useState([]);

  useEffect(() => {
    apiRequest("/holidays")
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.data || res?.holidays || []);
        if (list.length > 0) setApiHolidays(list);
      })
      .catch((err) => console.error("Failed to fetch holidays in dashboard", err));
  }, []);

  const getHolidayEmoji = (title = "") => {
    const t = String(title).toLowerCase();
    if (t.includes("diwali") || t.includes("deepavali")) return "🪔";
    if (t.includes("holi")) return "🎨";
    if (t.includes("christmas") || t.includes("xmas")) return "🎄";
    if (t.includes("new year")) return "✨";
    if (t.includes("republic") || t.includes("independence") || t.includes("national")) return "🇮🇳";
    if (t.includes("gandhi")) return "🕊️";
    if (t.includes("eid") || t.includes("ramadan") || t.includes("bakrid")) return "🌙";
    if (t.includes("pongal") || t.includes("sankranti") || t.includes("onam")) return "🌾";
    if (t.includes("dussehra") || t.includes("durga") || t.includes("navratri") || t.includes("puja") || t.includes("vijayadashami")) return "🌺";
    if (t.includes("ganesh") || t.includes("vinayaka")) return "🐘";
    if (t.includes("raksha") || t.includes("rakhi")) return "🧵";
    if (t.includes("good friday") || t.includes("easter")) return "✝️";
    if (t.includes("buddha") || t.includes("purnima")) return "🪷";
    if (t.includes("labor") || t.includes("may day")) return "⚒️";
    return "🏖️";
  };

  const upcomingHolidays = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const source = apiHolidays.length > 0 ? apiHolidays : [
      { date: `${currentYear}-10-02`, title: "Gandhi Jayanti", type: "National Holiday" },
      { date: `${currentYear}-10-20`, title: "Dussehra / Vijayadashami", type: "Public Holiday" },
      { date: `${currentYear}-11-01`, title: "Diwali / Deepavali", type: "Public Holiday" },
      { date: `${currentYear}-12-25`, title: "Christmas Day", type: "Public Holiday" },
      { date: `${currentYear + 1}-01-01`, title: "New Year's Day", type: "Public Holiday" },
      { date: `${currentYear + 1}-01-26`, title: "Republic Day", type: "National Holiday" },
    ];

    return source
      .map((h) => {
        const d = parseLocalDate(h.date);
        const diffDays = Math.ceil((d - today) / (1000 * 60 * 60 * 24));
        const countdownStr =
          diffDays === 0
            ? "Today 🎉"
            : diffDays === 1
            ? "Tomorrow ⚡"
            : diffDays > 1
            ? `In ${diffDays} days`
            : "Passed";
        return {
          id: h._id || h.id || h.title,
          date: String(d.getDate()).padStart(2, "0"),
          month: d.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
          weekday: d.toLocaleDateString("en-US", { weekday: "short" }),
          year: d.getFullYear(),
          name: h.title || h.name,
          type: h.type || "Public Holiday",
          diffDays,
          countdownStr,
          emoji: getHolidayEmoji(h.title || h.name),
          fullDateStr: d.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          }),
        };
      })
      .filter((h) => h.diffDays >= 0)
      .sort((a, b) => a.diffDays - b.diffDays)
      .slice(0, 6);
  }, [apiHolidays, currentYear]);


  if (employeeState.loading) {
    return <Loader label="Loading your workspace..." />;
  }

  if (employeeState.error && !profile?.email && !sessionEmployee?.email && !user?.email) {
    return (
      <ErrorMessage
        message={employeeState.error}
        onRetry={employeeState.reload}
      />
    );
  }

  return (
    <>
      <EmployeeHeader />

      <main className="employee-dashboard-hub">
        {/* =====================================================
            URGENT REMINDERS BANNER
        ===================================================== */}
        {timesheetState.needsEODReminder && (
          <div style={{
            background: "#fff1f2",
            border: "1px solid #fecdd3",
            padding: "1rem",
            borderRadius: "8px",
            marginBottom: "1.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: "0 4px 6px -1px rgba(225, 29, 72, 0.1)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span style={{ fontSize: "1.5rem" }}>⚠️</span>
              <div>
                <strong style={{ display: "block", color: "#be123c", fontSize: "0.95rem" }}>
                  Timesheet Overdue: End of Day Cutoff Reached
                </strong>
                <span style={{ color: "#e11d48", fontSize: "0.85rem" }}>
                  Your timesheet for today has not been submitted. Please complete and submit your timesheet by EOD. ({timesheetState.pendingCount} Pending)
                </span>
              </div>
            </div>
            <Link to="/employee/timesheets" className="att-btn primary" style={{ backgroundColor: "#e11d48", border: "none" }}>
              Submit Now
            </Link>
          </div>
        )}

        {/* =====================================================
            HR DOCUMENT REQUEST ALERT BANNERS
        ===================================================== */}
        {uploadNotice && (
          <div
            className="doc-request-alert"
            style={{
              backgroundColor: "#f0fdf4",
              borderColor: "#bbf7d0",
              color: "#166534",
            }}
            role="status"
          >
            <div className="doc-request-alert-message">
              <div className="doc-request-alert-icon" style={{ backgroundColor: "#dcfce7", color: "#16a34a" }}>
                ✓
              </div>
              <div className="doc-request-alert-copy">
                <strong style={{ color: "#15803d" }}>Upload Submitted</strong>
                <span style={{ color: "#166534" }}>{uploadNotice}</span>
              </div>
            </div>
            <div className="doc-request-alert-actions">
              <button
                type="button"
                onClick={() => setUploadNotice("")}
                aria-label="Dismiss upload notification"
                title="Dismiss alert"
                className="doc-request-dismiss"
                style={{ color: "#166534" }}
              >
                ×
              </button>
            </div>
          </div>
        )}

        {(() => {
          const activeDocs = requestedDocs.filter((reqDoc) => {
            const id = String(reqDoc._id || reqDoc.id);
            const status = String(reqDoc.status || "").toLowerCase();
            const rawStatus = String(reqDoc.status || "");
            return (
              !dismissedDocRequests.includes(id) &&
              !dismissedDocRequests.includes(`${id}:${rawStatus}`) &&
              !dismissedDocRequests.includes(`${id}:${status}`) &&
              !dismissedDocRequests.includes(`${id}:requested`) &&
              !dismissedDocRequests.includes(`${id}:rejected`)
            );
          });

          if (activeDocs.length === 0) return null;

          // SHOW ONLY ONCE: Single consolidated alert banner in Overview
          const primaryDoc = activeDocs[0];
          const hasMultiple = activeDocs.length > 1;

          return (
            <div
              key={`doc-request-consolidated-${primaryDoc._id || primaryDoc.id}`}
              className="doc-request-alert doc-dual-alert"
              role="alert"
            >
              {/* Field 1: Details of Document Requested from HR */}
              <div className="doc-request-alert-message doc-request-field-view">
                <div className="doc-request-alert-icon" aria-hidden="true">
                  📨
                </div>
                <div className="doc-request-alert-copy">
                  <div className="doc-alert-tag-row">
                    <span className="doc-urgent-pill">⚡ Requested from HR</span>
                    {hasMultiple && <span className="doc-count-pill">{activeDocs.length} Pending Requests</span>}
                  </div>
                  <strong className="doc-request-alert-title">
                    {primaryDoc.documentType || primaryDoc.documentName || "Document"}
                  </strong>
                  <span className="doc-request-alert-note">
                    {hasMultiple
                      ? `Required: ${activeDocs.map((d) => d.documentType || d.documentName).filter(Boolean).join(", ")}`
                      : `HR Note: "${primaryDoc.requestNote || primaryDoc.verificationNotes || "Please submit requested compliance file."}"`}
                  </span>
                </div>
              </div>

              {/* Field 2: Uploading Field to Fulfill HR Request */}
              <div className="doc-request-alert-actions doc-uploading-field-view">
                <label className="att-btn primary doc-request-upload">
                  {uploadBusy ? (
                    <>⏳ Uploading to HR...</>
                  ) : (
                    <>📤 Select & Upload File</>
                  )}
                  <input
                    type="file"
                    onChange={(e) => handleDashboardUpload(e, primaryDoc)}
                    disabled={uploadBusy}
                    hidden
                  />
                </label>
                <Link
                  to="/employee/documents"
                  className="att-btn secondary doc-request-vault"
                >
                  📁 View Vault
                </Link>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dismissAllDocRequests(activeDocs);
                  }}
                  aria-label="Dismiss HR document request alert"
                  title="Dismiss alert"
                  className="doc-request-dismiss"
                >
                  ×
                </button>
              </div>
            </div>
          );
        })()}

        {/* =====================================================
            DAILY PULSE WELLBEING CHECKLIST & POPUP MODAL
        ===================================================== */}
        <DailyPulseWidget />

        {/* =====================================================
            HERO COMMAND BANNER
        ===================================================== */}
        <section className="emp-hero-banner" aria-label="Employee welcome banner">
          <div className="emp-hero-left">
            <div className="hero-kicker-pill">
              <span className="pulsing-live-dot" />
              <span>Quadratic Employee Workspace</span>
            </div>
            <h1>
              {greeting}, {firstName}!
            </h1>
            <p>
              {designation} • {department} • {profile.employment?.workLocation || profile.workLocation || profile.branch || "Hyderabad HQ"}
            </p>

            <div className="emp-meta-pills">
              <span className="meta-pill-tag">🆔 {employeeCode}</span>
              <span className="meta-pill-tag">💼 Full-Time Regular</span>
              <span className="meta-pill-tag">🕒 Shift: 09:30 AM – 06:30 PM IST</span>
              <span className="meta-pill-tag">📍 Hyderabad Location</span>
              <span className="meta-pill-tag">👤 Manager: {managerName}</span>

              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
                {/* Live Employee Availability Status Pill */}
                <div
                  className="availability-hero-pill"
                  title="Click to update your live availability status"
                >
                  <span className="avail-dot-icon">
                    {availability === "in"
                      ? "🟢"
                      : availability === "wfh"
                        ? "🏠"
                        : availability === "leave"
                          ? "🌴"
                          : "🔴"}
                  </span>
                  <span className="avail-text">
                    Status:{" "}
                    <strong>
                      {availability === "in"
                        ? "In Office"
                        : availability === "wfh"
                          ? "WFH (Remote)"
                          : availability === "leave"
                            ? "On Leave"
                            : "Out of Office"}
                    </strong>
                  </span>
                  <select
                    value={availability}
                    onChange={(e) => setAvailability(e.target.value)}
                    className="avail-select-dropdown"
                    aria-label="Change Work Availability"
                  >
                    <option value="in">🟢 In (In Office)</option>
                    <option value="out">🔴 Out (Out of Office)</option>
                    <option value="wfh">🏠 WFH (Remote Work)</option>
                    <option value="leave">🌴 On Leave (Time Off)</option>
                  </select>
                </div>

                {/* Today's Date Badge */}
                <div className="date-capsule-badge">
                  <span>📅</span>
                  <span>
                    {new Intl.DateTimeFormat("en-IN", {
                      weekday: "long",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    }).format(new Date())}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="emp-hero-actions">
            {["manager", "admin"].includes(normalizeRole(user, profile)) && (
              <Link to="/manager/dashboard" className="emp-action-btn primary" style={{ background: "#0f172a", color: "#ffffff", borderColor: "#1e293b" }}>
                <span>👥</span> Manager Workspace
              </Link>
            )}
            <Link to="/employee/profile" className="emp-action-btn secondary" title="View & Edit My Profile Dossier">
              <span>👤</span> My Profile
            </Link>
            <Link to="/employee/payroll" className="emp-action-btn secondary" title="View Payslips & Salary">
              <span>💰</span> My Payroll
            </Link>
            <Link to="/employee/leaves" className="emp-action-btn secondary">
              <span>🌴</span> Apply Leave
            </Link>
            <Link to="/employee/leaves?tab=wfh" className="emp-action-btn primary">
              <span>🏠</span> Request WFH
            </Link>
          </div>
        </section>

        {/* =====================================================
            KPI METRIC CARDS
        ===================================================== */}
        <section className="emp-kpi-grid" aria-label="Employee Overview KPIs">
          {/* Card 1: Shift Status (Simplified In / Out with icons) */}
          <div className="kpi-card-box emerald">
            <div className="kpi-card-head">
              <span className="kpi-title-text">Today's Shift Status</span>
              <div className="kpi-icon-pod emerald">⏱️</div>
            </div>
            <div className="kpi-stat-row">
              <span className="kpi-big-num">
                {checkedIn ? "In" : shiftCompleted ? "Out" : "Ready"}
              </span>
              <span
                className={`kpi-badge-chip ${checkedIn ? "positive" : "neutral"
                  }`}
              >
                {checkedIn ? "🟢 ↗️ In" : "🔴 ↘️ Out"}
              </span>
            </div>
            <div className="kpi-progress-rail">
              <div
                className="kpi-progress-bar emerald"
                style={{ width: `${checkedIn ? shiftProgressPercent : shiftCompleted ? 100 : 0}%` }}
              />
            </div>
            <span className="kpi-subtext">
              {today?.checkIn
                ? `Clocked in at ${formatTime(today.checkIn)} • Target 8.0 hrs`
                : "Shift starts at 09:30 AM"}
            </span>
          </div>

          {/* Card 2: Monthly Attendance Rate */}
          <div className="kpi-card-box teal">
            <div className="kpi-card-head">
              <span className="kpi-title-text">Monthly Attendance Rate</span>
              <div className="kpi-icon-pod teal">📈</div>
            </div>
            <div className="kpi-stat-row">
              <span className="kpi-big-num">{attendanceRate}%</span>
              <span className="kpi-badge-chip positive">High Presence</span>
            </div>
            <div className="kpi-progress-rail">
              <div
                className="kpi-progress-bar teal"
                style={{ width: `${attendanceRate}%` }}
              />
            </div>
            <span className="kpi-subtext">
              {presentCount} Days Present • {lateCount} Late • 0 Absences
            </span>
          </div>

          {/* Card 3: Available Leave Balance */}
          <div className="kpi-card-box indigo">
            <div className="kpi-card-head">
              <span className="kpi-title-text">Available Leave Balance</span>
              <div className="kpi-icon-pod indigo">🌴</div>
            </div>
            <div className="kpi-stat-row">
              <div className="kpi-num-unit-group">
                <span className="kpi-big-num">{leaveBalanceDays}</span>
                <span className="kpi-unit-label">Days</span>
              </div>
              <span className="kpi-badge-chip indigo">Carry Forward</span>
            </div>
            <div className="kpi-progress-rail">
              <div className="kpi-progress-bar indigo" style={{ width: "75%" }} />
            </div>
            <span className="kpi-subtext">
              {ptoBalances?.length
                ? ptoBalances
                    .map((b) => `${b.available} ${b.leaveType?.code || b.leaveType?.name}`)
                    .join(" • ") + " Remaining"
                : "15 EL • 12 CL • 12 SL • 3 OH Remaining"}
            </span>
          </div>

          {/* Card 4: Timesheet Status */}
          <div className="kpi-card-box rose">
            <div className="kpi-card-head">
              <span className="kpi-title-text">Timesheet Status</span>
              <div className="kpi-icon-pod rose">📋</div>
            </div>
            <div className="kpi-stat-row">
              <span className="kpi-big-num">
                {timesheetState.hasUnsubmittedToday ? "Pending" : "Submitted"}
              </span>
              <span className={`kpi-badge-chip ${timesheetState.hasUnsubmittedToday ? "neutral" : "positive"}`}>
                {timesheetState.submittedCount} / 5 This Week
              </span>
            </div>
            <div className="kpi-progress-rail">
              <div className={`kpi-progress-bar ${timesheetState.hasUnsubmittedToday ? "rose" : "emerald"}`} style={{ width: `${(timesheetState.submittedCount / 5) * 100}%` }} />
            </div>
            <span className="kpi-subtext">
              {timesheetState.hasUnsubmittedToday ? "Today: 1 Pending" : "Today: Submitted"} • {timesheetState.pendingCount} Total Pending
            </span>
          </div>
        </section>

        {/* =====================================================
            SMART WORKDAY PUNCH CONSOLE
        ===================================================== */}
        <section className="workday-punch-station" aria-label="Workday Punch Station">
          <div className="punch-console-left">
            <div className="punch-status-line">
              <span
                className={`punch-state-badge ${
                  checkedIn
                    ? "active"
                    : shiftCompleted
                    ? "completed"
                    : today?.liveStatus === "Absent" ||
                      today?.status === "absent" ||
                      (new Date().getHours() >= 17 && !checkedIn && !shiftCompleted)
                    ? "absent"
                    : "idle"
                }`}
              >
                <span className="punch-pulse-dot" />
                {checkedIn
                  ? "Workday Active"
                  : shiftCompleted
                  ? "Workday Completed"
                  : today?.liveStatus === "Absent" ||
                    today?.status === "absent" ||
                    (new Date().getHours() >= 17 && !checkedIn && !shiftCompleted)
                  ? "Absent"
                  : "Not Checked In"}
              </span>
              <span className="location-marker-text" title="5A1 Melange Towers, Madhapur, Hyderabad">
                <span className="location-pin-icon">📍</span>
                <span className="location-address-text">5A1 Melange Towers, Madhapur, Hyderabad</span>
              </span>
            </div>

            <div className="digital-stopwatch-box">
              <div className="stopwatch-glow-orb" />
              <div className="stopwatch-content">
                <span className="stopwatch-label">
                  <span className="stopwatch-dot-accent" />
                  Hours Logged Today
                </span>
                <div className="stopwatch-counter">
                  {formatDuration(elapsedSeconds)}
                </div>
              </div>
              <div className="stopwatch-status-chip">
                {checkedIn ? "● Shift in Progress" : shiftCompleted ? "✓ Shift Concluded" : "○ Standing By"}
              </div>
            </div>

            <div className="shift-progress-wrapper">
              <div className="shift-rail">
                <div
                  className="shift-fill"
                  style={{ width: `${shiftProgressPercent}%` }}
                />
              </div>
              <div className="shift-labels-row">
                <span className="shift-min-val">0.0 hrs</span>
                <span className="shift-target-badge">{shiftProgressPercent}% of 8.0 hr Target</span>
                <span className="shift-max-val">8.0 hrs</span>
              </div>
            </div>

            <div className="punch-actions-row">
              <button
                type="button"
                className="punch-btn in"
                onClick={handleClockInAction}
                disabled={isClockInDisabled || clockBusy}
              >
                <span className="punch-btn-icon" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                </span>
                <span className="punch-btn-text">
                  {clockBusy && !checkedIn ? "Clocking In..." : shiftCompleted ? "Resume Shift" : "Clock In"}
                </span>
              </button>

              <button
                type="button"
                className="punch-btn out"
                onClick={handleClockOutAction}
                disabled={isClockOutDisabled || clockBusy}
              >
                <span className="punch-btn-icon" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="6" y="6" width="12" height="12" rx="2.5"></rect>
                  </svg>
                </span>
                <span className="punch-btn-text">
                  {clockBusy && checkedIn ? "Clocking Out..." : "Clock Out"}
                </span>
              </button>
            </div>
          </div>

          <div className="punch-console-right">
            <div className="punch-telemetry-header">
              <span className="punch-telemetry-title">Shift Telemetry & Specs</span>
              <span className="punch-telemetry-badge">Corporate Policy</span>
            </div>
            <div className="shift-detail-item">
              <span className="shift-detail-label">
                <span className="shift-detail-icon">🕒</span> Shift Window
              </span>
              <strong className="shift-detail-value">09:30 AM – 06:30 PM (IST)</strong>
            </div>
            <div className="shift-detail-item">
              <span className="shift-detail-label">
                <span className="shift-detail-icon">🟢</span> Clock In Timestamp
              </span>
              <strong className="shift-detail-value">
                {today?.checkIn ? (
                  <span className="timestamp-with-status">
                    <span>{formatTime(today.checkIn)}</span>
                    <span className={`status-pill ${today?.isLate || today?.status === "late" ? "status-pill-late" : "status-pill-ontime"}`}>
                      {today?.isLate || today?.status === "late" ? "Late Arrival" : "On Time"}
                    </span>
                  </span>
                ) : (
                  <span className="status-pill status-pill-empty">Not recorded</span>
                )}
              </strong>
            </div>
            <div className="shift-detail-item">
              <span className="shift-detail-label">
                <span className="shift-detail-icon">🔴</span> Clock Out Timestamp
              </span>
              <strong className="shift-detail-value">
                {today?.checkOut ? (
                  <span className="timestamp-with-status">
                    <span>{formatTime(today.checkOut)}</span>
                    <span className="status-pill status-pill-complete">Completed</span>
                  </span>
                ) : checkedIn ? (
                  <span className="status-pill status-pill-progress">Active in progress</span>
                ) : (
                  <span className="status-pill status-pill-empty">Not recorded</span>
                )}
              </strong>
            </div>
            <div className="shift-detail-item">
              <span className="shift-detail-label">
                <span className="shift-detail-icon">☕</span> Break Duration
              </span>
              <strong className="shift-detail-value">
                {today?.checkOut
                  ? `${today?.breakDuration || 45} mins (Lunch deducted)`
                  : checkedIn || today?.checkIn
                  ? "0 mins (Calculated at Out)"
                  : "0 mins / N/A"}
              </strong>
            </div>
            <div className="shift-detail-item">
              <span className="shift-detail-label">
                <span className="shift-detail-icon">🛡️</span> IP Verification
              </span>
              <strong className="shift-detail-value">
                <span className="status-pill status-pill-verified">✓ Verified Corp Network</span>
              </strong>
            </div>
          </div>
        </section>

        {/* =====================================================
            QUICK ACTION LAUNCHPAD
        ===================================================== */}
        <section className="quick-launchpad-grid" aria-label="Quick Launchpad">
          <Link to="/employee/leaves" className="launchpad-card">
            <div className="launchpad-icon">🌴</div>
            <div className="launchpad-info">
              <h3>Request Time Off</h3>
              <p>Apply for casual, sick, or earned leave</p>
            </div>
          </Link>

          <Link to="/employee/leaves?tab=wfh" className="launchpad-card">
            <div className="launchpad-icon">🏠</div>
            <div className="launchpad-info">
              <h3>Apply for WFH</h3>
              <p>Request remote work days & log schedule</p>
            </div>
          </Link>

          <Link to="/employee/attendance" className="launchpad-card">
            <div className="launchpad-icon">⏱️</div>
            <div className="launchpad-info">
              <h3>Attendance</h3>
              <p>View punch logs, shift hours & attendance</p>
            </div>
          </Link>

          <Link to="/employee/timesheets" className="launchpad-card">
            <div className="launchpad-icon">📋</div>
            <div className="launchpad-info">
              <h3>Timesheet</h3>
              <p>Submit weekly billable hours & project tasks</p>
            </div>
          </Link>

          <Link to="/employee/documents" className="launchpad-card launchpad-card-doc" title="Open Verified Documents Vault">
            <div className="launchpad-icon">📂</div>
            <div className="launchpad-info">
              <h3>Document Vault</h3>
              <p>View verified credentials & compliance files</p>
            </div>
          </Link>

          <Link to="/ai-assistant" className="launchpad-card launchpad-card-ai" title="Ask AI HR & Policy Assistant">
            <div className="launchpad-icon ai-avatar-glow">🤖</div>
            <div className="launchpad-info">
              <h3>AI HR Assistant</h3>
              <p>Ask policy queries, leave balance & HR self-service</p>
            </div>
          </Link>
        </section>

        {/* =====================================================
            DOCUMENT COMPLIANCE & UPLOAD HUB (DUAL FIELDS)
            Field 1: Upload Document (General / Self-service)
            Field 2: Uploading Document Requested from HR
        ===================================================== */}
        {(() => {
          const activeRequested = requestedDocs.filter((reqDoc) => {
            const id = String(reqDoc._id || reqDoc.id);
            const status = String(reqDoc.status || "").toLowerCase();
            const rawStatus = String(reqDoc.status || "");
            return (
              !dismissedDocRequests.includes(id) &&
              !dismissedDocRequests.includes(`${id}:${rawStatus}`) &&
              !dismissedDocRequests.includes(`${id}:${status}`) &&
              !dismissedDocRequests.includes(`${id}:requested`) &&
              !dismissedDocRequests.includes(`${id}:rejected`)
            );
          });

          return (
            <section className="doc-compliance-hub-section" aria-label="Document Upload and HR Compliance">
              <div className="section-title-wrap">
                <div className="title-left">
                  <div className="hub-badge-pill">
                    <span className="live-hub-dot" />
                    <span>Compliance Central</span>
                  </div>
                  <h2>📁 Document Upload & HR Request Hub</h2>
                  <p>Self-service filing in one field, and uploading documents requested by HR in another field</p>
                </div>
                <Link to="/employee/documents" className="view-vault-link">
                  <span>🔐</span> Verified Documents Vault →
                </Link>
              </div>

              <div className="doc-dual-grid">
                {/* FIELD 1: GENERAL UPLOAD DOCUMENT */}
                <div className="doc-field-card general-upload-card">
                  <div className="doc-field-head">
                    <div className="doc-field-title-group">
                      <span className="doc-field-icon">📄</span>
                      <div>
                        <h3>Upload Document</h3>
                        <span className="doc-field-subtitle">Self-file certificates, tax proofs, or identity records</span>
                      </div>
                    </div>
                    <span className="doc-field-badge badge-self">Self-Service</span>
                  </div>

                  <form onSubmit={handleGeneralUploadSubmit} className="doc-field-body">
                    <div className="doc-input-group">
                      <label htmlFor="general-doc-type">Document Category</label>
                      <select
                        id="general-doc-type"
                        value={generalDocType}
                        onChange={(e) => setGeneralDocType(e.target.value)}
                        className="doc-field-select"
                      >
                        {docTypeList.map((type) => (
                          <option key={type.id || type.label || type} value={type.label || type}>
                            {type.label || type}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="doc-input-group">
                      <label htmlFor="general-doc-title">Document Name / Label (Optional)</label>
                      <input
                        id="general-doc-title"
                        type="text"
                        placeholder="e.g. Degree Certificate 2024, Aadhaar Front & Back"
                        value={generalDocTitle}
                        onChange={(e) => setGeneralDocTitle(e.target.value)}
                        className="doc-field-input"
                      />
                    </div>

                    <div className="doc-input-group">
                      <label>Select Document File</label>
                      <div className="doc-file-dropzone">
                        <input
                          type="file"
                          id="general-file-input"
                          onChange={(e) => setGeneralDocFile(e.target.files?.[0] || null)}
                          className="doc-hidden-file-input"
                        />
                        <label htmlFor="general-file-input" className="doc-dropzone-label">
                          <span className="drop-icon">📎</span>
                          <span className="drop-text">
                            {generalDocFile ? (
                              <strong>{generalDocFile.name} ({(generalDocFile.size / 1024).toFixed(1)} KB)</strong>
                            ) : (
                              "Click to choose file (PDF, PNG, JPG, DOCX up to 10MB)"
                            )}
                          </span>
                          <span className="drop-browse-btn">{generalDocFile ? "Change File" : "Browse"}</span>
                        </label>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={generalDocBusy || !generalDocFile}
                      className="doc-submit-btn primary"
                    >
                      {generalDocBusy ? (
                        <>
                          <span className="doc-btn-spinner" /> Uploading Document...
                        </>
                      ) : (
                        <>📤 Upload Document</>
                      )}
                    </button>
                  </form>
                </div>

                {/* FIELD 2: UPLOADING DOCUMENT REQUESTED FROM HR */}
                <div className={`doc-field-card hr-upload-card ${activeRequested.length > 0 ? "has-requests" : "clean-status"}`}>
                  <div className="doc-field-head">
                    <div className="doc-field-title-group">
                      <span className="doc-field-icon">📨</span>
                      <div>
                        <h3>Uploading Request from HR</h3>
                        <span className="doc-field-subtitle">Compliance submissions specifically requested by People Ops</span>
                      </div>
                    </div>
                    {activeRequested.length > 0 ? (
                      <span className="doc-field-badge badge-urgent">
                        ⚡ {activeRequested.length} Action Required
                      </span>
                    ) : (
                      <span className="doc-field-badge badge-compliant">✓ All Compliant</span>
                    )}
                  </div>

                  <div className="doc-field-body">
                    {activeRequested.length > 0 ? (
                      <div className="hr-requests-list">
                        {activeRequested.map((reqDoc) => {
                          const docId = String(reqDoc._id || reqDoc.id);
                          const isUploading = hrUploadingIds.includes(docId);
                          const selectedFile = hrSelectedFiles[docId];

                          return (
                            <div key={docId} className="hr-request-item-card">
                              <div className="request-card-header">
                                <div className="request-title-area">
                                  <span className="request-doc-title">
                                    {reqDoc.documentType || reqDoc.documentName || "Compliance Document"}
                                  </span>
                                  <span className="request-status-chip">
                                    {reqDoc.status === "rejected" ? "⚠️ Resubmission Requested" : "📌 Requested by HR"}
                                  </span>
                                </div>
                                <span className="request-date-tag">
                                  {reqDoc.createdAt ? formatDate(reqDoc.createdAt) : "Pending"}
                                </span>
                              </div>

                              {(reqDoc.requestNote || reqDoc.verificationNotes) && (
                                <div className="request-hr-note">
                                  <strong>HR Instructions:</strong> {reqDoc.requestNote || reqDoc.verificationNotes}
                                </div>
                              )}

                              <div className="request-upload-controls">
                                <input
                                  type="file"
                                  id={`hr-file-${docId}`}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0] || null;
                                    setHrSelectedFiles((prev) => ({ ...prev, [docId]: file }));
                                  }}
                                  className="doc-hidden-file-input"
                                  disabled={isUploading}
                                />
                                <label htmlFor={`hr-file-${docId}`} className="doc-browse-pill">
                                  <span>📎</span>
                                  <span className="pill-text">
                                    {selectedFile ? selectedFile.name : "Select File to Upload"}
                                  </span>
                                </label>

                                <button
                                  type="button"
                                  onClick={() => handleHrRequestUpload(reqDoc)}
                                  disabled={isUploading || !selectedFile}
                                  className="doc-submit-btn urgent"
                                >
                                  {isUploading ? (
                                    <>
                                      <span className="doc-btn-spinner" /> Uploading to HR...
                                    </>
                                  ) : (
                                    <>📤 Submit to HR</>
                                  )}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="no-hr-requests-state">
                        <span className="clean-check-icon">🛡️</span>
                        <h4>No Documents Requested from HR</h4>
                        <p>
                          All requested employee filings are in good standing. When HR requests an updated passport, tax form, or credential, it will appear here for one-click uploading.
                        </p>
                        <Link to="/employee/documents" className="doc-view-vault-btn">
                          📁 Open Document Vault
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          );
        })()}

        {/* =====================================================
            DASHBOARD TABS (Added for better organization)
        ===================================================== */}
        <nav className="emp-tabs-nav" aria-label="Dashboard views">
          <button
            className={activeTab === "workspace" ? "active" : ""}
            onClick={() => setActiveTab("workspace")}
          >
            My Workspace
          </button>
          <button
            className={activeTab === "company" ? "active" : ""}
            onClick={() => setActiveTab("company")}
          >
            Company & Updates
          </button>
        </nav>

        {/* =====================================================
            TAB PANES
        ===================================================== */}
        {activeTab === "workspace" && (
          <div className="dashboard-dual-layout">
            <div className="dash-layout-col main">
              {/* Recent Punch Activity */}
              <div className="dash-panel-card">
                <div className="dash-panel-head">
                  <h2>Recent Attendance Activity (Weekly View)</h2>
                  <Link to="/employee/attendance" className="panel-action-link">
                    View All Records →
                  </Link>
                </div>
                <div className="table-responsive-wrapper recent-attendance-scroll">
                  <table className="recent-punch-table">
                    <thead>
                      <tr>
                        <th>Day & Date</th>
                        <th>Clock In</th>
                        <th>Clock Out</th>
                        <th>Hours</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayPunches.length > 0 ? (
                        displayPunches.map((item) => {
                          const isWeekend =
                            String(item.status).toLowerCase().includes("off") ||
                            String(item.status).toLowerCase().includes("weekend");
                          return (
                            <tr
                              key={item.id || item.date}
                              style={
                                isWeekend
                                  ? { opacity: 0.78, background: "rgba(241, 245, 249, 0.45)" }
                                  : {}
                              }
                            >
                              <td>
                                <strong style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                  {item.dayName && (
                                    <span style={{ color: isWeekend ? "#94a3b8" : "#64748b", fontWeight: 600 }}>
                                      {item.dayName},
                                    </span>
                                  )}
                                  <span>{formatDate(item.date)}</span>
                                </strong>
                              </td>
                              <td>{item.checkIn ? formatTime(item.checkIn) : "-"}</td>
                              <td>
                                {item.checkOut
                                  ? formatTime(item.checkOut)
                                  : item.workingHours === "In Progress"
                                    ? "Active"
                                    : "-"}
                              </td>
                              <td>{item.workingHours || "-"}</td>
                              <td>
                                <span
                                  className={`status-chip-badge ${isWeekend
                                      ? "off"
                                      : String(item.status).toLowerCase() === "late"
                                        ? "late"
                                        : "present"
                                    }`}
                                >
                                  {item.status || "Present"}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan="5" style={{ textAlign: "center", padding: "1.5rem", color: "#64748b" }}>
                            No recent attendance records found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="dash-layout-col">
              {/* Leave Balances Breakdown */}
              <div className="dash-panel-card">
                <div className="dash-panel-head">
                  <h2>Leave Balances</h2>
                  <Link to="/employee/leaves" className="panel-action-link">
                    Apply Leave →
                  </Link>
                </div>
                <div className="leave-balances-scroll">
                  {(() => {
                    const defaultLeaveBalances = [
                      { leaveType: { name: "Casual Leave", code: "CL" }, annualAllocation: 12, available: 12, total: 12, used: 0 },
                      { leaveType: { name: "Sick Leave", code: "SL" }, annualAllocation: 12, available: 12, total: 12, used: 0 },
                      { leaveType: { name: "Paid Privilege Leave", code: "PL" }, annualAllocation: 18, available: 18, total: 18, used: 0 },
                      { leaveType: { name: "Work From Home", code: "WFH" }, annualAllocation: 24, available: 24, total: 24, used: 0 }
                    ];

                    const rawList = leavesState.balance && leavesState.balance.length > 0
                      ? leavesState.balance
                      : (leavesState.leaveTypes && leavesState.leaveTypes.length > 0
                          ? leavesState.leaveTypes.map(t => ({
                              leaveType: t,
                              annualAllocation: Number(t.annualAllocation ?? t.annual_allocation ?? t.daysAllowed ?? 12),
                              available: Number(t.available ?? t.annualAllocation ?? t.annual_allocation ?? t.daysAllowed ?? 12),
                              total: Number(t.annualAllocation ?? t.annual_allocation ?? t.daysAllowed ?? 12),
                              used: 0
                            }))
                          : defaultLeaveBalances);

                    const listToDisplay = rawList.filter(b => {
                      const name = String(b.leaveType?.name || "").toLowerCase();
                      const code = String(b.leaveType?.code || "").toUpperCase();
                      return !name.includes("maternity") && !name.includes("paternity") && code !== "ML" && code !== "MAT" && code !== "OH";
                    });

                    return listToDisplay.map((b) => {
                      const typeName = String(b.leaveType?.name || "Leave");
                      const typeLower = typeName.toLowerCase();

                      const defaultAlloc = typeLower.includes("work from home") || typeLower.includes("wfh")
                        ? 24
                        : (typeLower.includes("privilege") || typeLower.includes("earned") ? 18 : 12);

                      const total = Number(
                        b.annualAllocation ??
                        b.annual_allocation ??
                        b.total ??
                        b.leaveType?.annualAllocation ??
                        b.leaveType?.annual_allocation ??
                        b.leaveType?.daysAllowed ??
                        defaultAlloc
                      ) || defaultAlloc;

                      const used = Number(b.used ?? 0);
                      const pending = Number(b.pending ?? 0);

                      const available = Number(
                        b.available !== undefined && b.available !== null
                          ? b.available
                          : (b.remaining !== undefined && b.remaining !== null
                              ? b.remaining
                              : Math.max(0, total - used - pending))
                      );

                      const pct = total > 0 ? Math.min(100, Math.round((available / total) * 100)) : 0;
                      const fillClass = typeLower.includes("sick")
                        ? "sick"
                        : typeLower.includes("casual")
                          ? "casual"
                          : typeLower.includes("comp")
                            ? "comp"
                            : "earned";

                      return (
                        <div key={b.leaveType?._id || b.leaveType?.id || typeName} className="leave-type-row">
                          <div className="leave-type-head">
                            <span title={typeName}>{typeName}</span>
                            <strong>{available} / {total} Days</strong>
                          </div>
                          <div className="leave-mini-rail">
                            <div
                              className={`leave-mini-fill ${fillClass}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Recent Leave Requests */}
              <div className="dash-panel-card">
                <div className="dash-panel-head">
                  <h2>Recent Leave Requests</h2>
                  <Link to="/employee/leaves" className="panel-action-link">
                    History →
                  </Link>
                </div>
                <div className="recent-leaves-scroll">
                  {displayLeaves.length > 0 ? (
                    displayLeaves.map((leave, idx) => {
                      const statusStr = String(leave.status || "Pending").toLowerCase();
                      const statusClass = statusStr.includes("approv")
                        ? "approved"
                        : statusStr.includes("reject")
                          ? "rejected"
                          : statusStr.includes("cancel")
                            ? "cancelled"
                            : "pending";

                      return (
                        <div
                          key={leave.id || leave._id || idx}
                          className="recent-leave-item"
                        >
                          <div className="leave-item-info">
                            <strong className="leave-item-type">
                              {leave.leaveType?.name || leave.type || "Leave Request"}
                            </strong>
                            <span className="leave-item-date">
                              {formatDate(leave.startDate)}
                              {leave.endDate && leave.endDate !== leave.startDate
                                ? ` - ${formatDate(leave.endDate)}`
                                : ""}
                            </span>
                          </div>
                          <span className={`status-chip-badge ${statusClass}`}>
                            {leave.status || "Pending"}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <p style={{ fontSize: "0.84rem", color: "#64748b", margin: "0.5rem 0" }}>
                      No recent leave requests found.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "company" && (
          <div className="dashboard-dual-layout">
            <div className="dash-layout-col main">
              {/* Upcoming Company Holidays */}
              <div className="dash-panel-card emp-holiday-panel-card">
                <div className="dash-panel-head">
                  <div>
                    <h2>Corporate Holidays ({currentYear})</h2>
                    <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
                      Annual gazetted observances and paid company leaves
                    </span>
                  </div>
                  <Link to="/employee/calendar" className="panel-action-link holiday-calendar-cta">
                    🗓️ Open Full Calendar →
                  </Link>
                </div>
                <div className="holidays-scroll-container">
                  {(() => {
                    const imminent = upcomingHolidays.find((h) => h.diffDays === 0 || h.diffDays === 1);
                    if (!imminent) return null;
                    const isToday = imminent.diffDays === 0;

                    return (
                      <div className={`emp-imminent-holiday-notice ${isToday ? "today" : "tomorrow"}`}>
                        <span className="notice-emoji">{isToday ? "🎉" : "⚡"}</span>
                        <div className="notice-details">
                          <strong>
                            {isToday
                              ? `Today is ${imminent.name}! (${imminent.type})`
                              : `Tomorrow is ${imminent.name}! (${imminent.type})`}
                          </strong>
                          <p>
                            {isToday
                              ? "Company office is closed today. Shift hours and desk punches are paused for the gazetted holiday."
                              : `Scheduled for tomorrow, ${imminent.fullDateStr}. Corporate office will be closed. Enjoy the holiday!`}
                          </p>
                        </div>
                        <span className="notice-badge">
                          {isToday ? "🎉 TODAY'S HOLIDAY" : "⚡ TOMORROW'S HOLIDAY"}
                        </span>
                      </div>
                    );
                  })()}

                  {upcomingHolidays.length === 0 ? (
                    <p style={{ fontSize: "0.86rem", color: "#64748b", margin: "1rem 0", textAlign: "center" }}>
                      🏖️ No upcoming holidays scheduled for the rest of the year.
                    </p>
                  ) : (
                    upcomingHolidays.map((holiday) => {
                      const isToday = holiday.diffDays === 0;
                      const isTomorrow = holiday.diffDays === 1;

                      return (
                        <div
                          key={holiday.id || holiday.name}
                          className={`holiday-item-row ${isToday ? "today-row imminent-row" : ""} ${isTomorrow ? "tomorrow-row imminent-row" : ""}`}
                        >
                          <div className="holiday-meta">
                            <div className="holiday-date-pod">
                              <span className="h-pod-month">{holiday.month}</span>
                              <strong className="h-pod-day">{holiday.date}</strong>
                              <span className="h-pod-weekday">{holiday.weekday}</span>
                            </div>
                            <div className="holiday-info">
                              <div className="holiday-title-line">
                                <span className="holiday-festive-emoji">{holiday.emoji}</span>
                                <h4>{holiday.name}</h4>
                                {isToday && <span className="mini-celebration-pill">🎉 Today</span>}
                                {isTomorrow && <span className="mini-celebration-pill tomorrow">⚡ Tomorrow</span>}
                              </div>
                              <span className="holiday-date-detail">{holiday.fullDateStr}</span>
                            </div>
                          </div>
                          <div className="holiday-tags-group">
                            <span className={`holiday-type-pill ${(holiday.type || "public").toLowerCase().replace(/\s+/g, "-")}`}>
                              {holiday.type}
                            </span>
                            <span className={`holiday-countdown-pill ${isToday ? "today-glow" : isTomorrow ? "tomorrow-glow" : ""}`}>
                              {isToday ? "🎉 Today" : isTomorrow ? "⚡ Tomorrow" : holiday.countdownStr}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>

            <div className="dash-layout-col">
              {/* Support Tickets / HR Connect */}
              <div className="dash-panel-card">
                <div className="dash-panel-head">
                  <h2>HR Helpdesk Updates</h2>
                  <Link to="/employee/resignation" className="panel-action-link">
                    Open Helpdesk →
                  </Link>
                </div>
                <div className="bulletin-scroll-container">
                  {tickets.length > 0 ? (
                    tickets.slice(0, 3).map((ticket) => {
                      const isResolved = ticket.status === "Resolved";
                      return (
                        <div key={ticket.id} className="bulletin-box" style={{ borderLeft: isResolved ? "4px solid #16a34a" : "4px solid #f59e0b" }}>
                          <strong>
                            {isResolved ? "✅ Resolved" : "⚡ Open"}: {ticket.query.substring(0, 40)}{ticket.query.length > 40 ? '...' : ''}
                          </strong>
                          <p style={{ marginTop: '5px', fontSize: '0.85rem' }}>
                            {isResolved ? (
                              <span style={{ color: '#166534', fontWeight: 600 }}>Message from HR: {ticket.resolution}</span>
                            ) : (
                              <span style={{ color: '#92400e' }}>Waiting for HR response...</span>
                            )}
                          </p>
                        </div>
                      );
                    })
                  ) : (
                    <p style={{ fontSize: "0.84rem", color: "#64748b", margin: "0.5rem 0", padding: "0 10px" }}>
                      No recent HR Helpdesk requests.
                    </p>
                  )}
                </div>
              </div>

              {/* Corporate Bulletin & Notices */}
              <div className="dash-panel-card">
                <div className="dash-panel-head">
                  <h2>Corporate Bulletin</h2>
                  <span style={{ fontSize: "0.72rem", color: "#0d9488", fontWeight: 700 }}>
                    HR Updates
                  </span>
                </div>
                <div className="bulletin-scroll-container">
                  <div className="bulletin-box">
                    <strong>📢 All-Hands Townhall</strong>
                    Join leadership for the Q3 Enterprise Roadmap discussion this Friday at 4:00 PM IST via Teams.
                  </div>
                  <div className="bulletin-box">
                    <strong>🛡️ Health Insurance Cards</strong>
                    Updated digital health cards for FY 2026 are now available under the Documents tab.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

export default EmployeeDashboard;
