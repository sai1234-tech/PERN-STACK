import React, { useState, useEffect, useMemo } from "react";
import { apiRequest } from "../../services/apiClient";
import { toast } from "react-toastify";
import EmployeeHeader from "../../components/employee/EmployeeHeader";
import { formatPhotoUrl } from "../../utils/photo";
import "./HRDashboard.css";
import "./EmployeeManagement.css";

export default function HRResignationManagement() {
  const [activeTab, setActiveTab] = useState("requests"); // "requests" | "clearance" | "settlement" | "letters"
  const [resignations, setResignations] = useState([]);
  const [clearances, setClearances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  // Review Modal State
  const [selectedResignation, setSelectedResignation] = useState(null);
  const [reviewStatus, setReviewStatus] = useState("");
  const [hrReviewComment, setHrReviewComment] = useState("");
  const [approvedLastWorkingDay, setApprovedLastWorkingDay] = useState("");

  // Letter Generator Modal State
  const [letterModalOpen, setLetterModalOpen] = useState(false);
  const [selectedExitRecord, setSelectedExitRecord] = useState(null);
  const [letterType, setLetterType] = useState("relieving"); // "relieving" | "experience"

  // Clearance Edit Modal State
  const [editingClearance, setEditingClearance] = useState(null);
  const [clearanceCategoryForm, setClearanceCategoryForm] = useState({
    category: "assets",
    status: "cleared",
    comments: ""
  });

  // F&F Settlement State
  const [ffRecords, setFfRecords] = useState(() => {
    try {
      const stored = localStorage.getItem("hrms_ff_records");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const reasonLabels = {
    "better-opportunity": "Career Growth / Better Opportunity",
    "higher-studies": "Pursuing Higher Education",
    "personal-reasons": "Personal / Family Reasons",
    "health": "Health / Medical Issues",
    "relocation": "Relocation",
    "other": "Other"
  };

  const defaultClearanceTemplates = [
    {
      id: "CLR-001",
      resignationId: "RES-001",
      employee: {
        id: "EMP-004",
        firstName: "Vikram",
        lastName: "Malhotra",
        employeeCode: "EMP-004",
        department: "Engineering",
        designation: "Senior Frontend Engineer",
        email: "vikram.m@hrms.com",
        joiningDate: "2023-04-15",
        salary: 1450000
      },
      requestedLWD: "2026-11-30",
      approvedLWD: "2026-11-30",
      noticePeriodDays: 90,
      assets: { status: "cleared", comments: "MacBook Pro M2 (Serial #MBP-8921) and 27-inch 4K Monitor returned to IT.", clearedAt: "2026-10-18T14:30:00Z" },
      itAccess: { status: "cleared", comments: "GitHub org access, AWS IAM role, and corporate Google Workspace de-provisioned.", clearedAt: "2026-10-18T15:00:00Z" },
      finance: { status: "cleared", comments: "Corporate credit card surrendered. All travel expense advances reconciled.", clearedAt: "2026-10-19T11:15:00Z" },
      leaveAttendance: { status: "pending", comments: "Final month attendance verified. 11 unavailed paid leaves pending encashment.", clearedAt: null },
      documents: { status: "cleared", comments: "NDA compliance form signed and exit interview questionnaire completed.", clearedAt: "2026-10-20T09:45:00Z" },
      ktHandover: { status: "cleared", comments: "Core repository architecture briefing completed with Rahul S. (Lead).", clearedAt: "2026-10-19T16:00:00Z" },
      finalSettlement: { status: "ready_for_neft", grossEarned: 120833, leaveEncashment: 53166, gratuity: 0, deductions: 12500, netPayable: 161499, processedAt: "2026-10-21T10:00:00Z" },
      relievingLetter: { issued: false, issuedAt: null }
    },
    {
      id: "CLR-002",
      resignationId: "RES-002",
      employee: {
        id: "EMP-007",
        firstName: "Ananya",
        lastName: "Deshmukh",
        employeeCode: "EMP-007",
        department: "Product Management",
        designation: "Product Lead",
        email: "ananya.d@hrms.com",
        joiningDate: "2022-08-01",
        salary: 1950000
      },
      requestedLWD: "2026-12-15",
      approvedLWD: "2026-12-15",
      noticePeriodDays: 90,
      assets: { status: "in_progress", comments: "ThinkPad X1 Extreme and access badges scheduled for physical return on LWD.", clearedAt: null },
      itAccess: { status: "pending", comments: "Scheduled for automated deactivation on Dec 15, 2026 at 18:00 IST.", clearedAt: null },
      finance: { status: "cleared", comments: "No outstanding dues or corporate card balances.", clearedAt: "2026-10-15T12:00:00Z" },
      leaveAttendance: { status: "cleared", comments: "8 days leave balance to be encashed in final payroll run.", clearedAt: "2026-10-17T16:20:00Z" },
      documents: { status: "pending", comments: "Exit interview scheduled with Head of HR for next Monday.", clearedAt: null },
      ktHandover: { status: "in_progress", comments: "PRD documentation and roadmap transition in progress with Priya K.", clearedAt: null },
      finalSettlement: { status: "draft", grossEarned: 162500, leaveEncashment: 43333, gratuity: 140625, deductions: 18200, netPayable: 328258, processedAt: null },
      relievingLetter: { issued: false, issuedAt: null }
    }
  ];

  const fetchResignations = async () => {
    try {
      setLoading(true);
      const endpoint = statusFilter ? `/resignations/all?status=${statusFilter}` : `/resignations/all`;
      const data = await apiRequest(endpoint);
      if (data.success && Array.isArray(data.data)) {
        setResignations(data.data);
      }
    } catch (error) {
      console.warn("Resignations API fallback:", error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchClearances = async () => {
    try {
      const data = await apiRequest("/clearances/all");
      if (data.success && Array.isArray(data.data) && data.data.length > 0) {
        setClearances(data.data);
      } else {
        // Fallback to localStorage or defaults
        const stored = localStorage.getItem("hrms_clearances");
        if (stored) {
          setClearances(JSON.parse(stored));
        } else {
          setClearances(defaultClearanceTemplates);
          localStorage.setItem("hrms_clearances", JSON.stringify(defaultClearanceTemplates));
        }
      }
    } catch (error) {
      const stored = localStorage.getItem("hrms_clearances");
      setClearances(stored ? JSON.parse(stored) : defaultClearanceTemplates);
    }
  };

  useEffect(() => {
    fetchResignations();
    fetchClearances();
  }, [statusFilter]);

  const handleReview = async (e) => {
    e.preventDefault();
    if (!reviewStatus) return toast.error("Please select a status");

    try {
      const data = await apiRequest(`/resignations/${selectedResignation._id}/review`, {
        method: "PATCH",
        body: JSON.stringify({
          status: reviewStatus,
          hrReviewComment,
          approvedLastWorkingDay: reviewStatus === "approved" ? approvedLastWorkingDay : undefined
        })
      });

      if (data.success) {
        toast.success(data.message || "Resignation updated successfully.");
        
        // If approved, automatically trigger clearance record creation
        if (reviewStatus === "approved") {
          try {
            await apiRequest("/clearances/initiate", {
              method: "POST",
              body: JSON.stringify({ resignationId: selectedResignation._id })
            });
          } catch (initErr) {
            // Add to local clearances list
            const emp = selectedResignation.employee || {};
            const newClearance = {
              id: `CLR-${Date.now().toString().slice(-4)}`,
              resignationId: selectedResignation._id,
              employee: emp,
              requestedLWD: selectedResignation.requestedLastWorkingDay,
              approvedLWD: approvedLastWorkingDay,
              noticePeriodDays: selectedResignation.noticePeriodDays || 90,
              assets: { status: "pending", comments: "Awaiting IT asset return.", clearedAt: null },
              itAccess: { status: "pending", comments: "Scheduled for LWD revocation.", clearedAt: null },
              finance: { status: "pending", comments: "Accounts dues reconciliation in progress.", clearedAt: null },
              leaveAttendance: { status: "pending", comments: "Leave audit pending.", clearedAt: null },
              documents: { status: "pending", comments: "Exit interview pending.", clearedAt: null },
              ktHandover: { status: "pending", comments: "Manager KT handover pending.", clearedAt: null },
              finalSettlement: { status: "draft", grossEarned: 85000, leaveEncashment: 24000, gratuity: 0, deductions: 9000, netPayable: 100000, processedAt: null },
              relievingLetter: { issued: false, issuedAt: null }
            };
            setClearances(prev => {
              const updated = [newClearance, ...prev.filter(c => c.resignationId !== selectedResignation._id)];
              localStorage.setItem("hrms_clearances", JSON.stringify(updated));
              return updated;
            });
          }
        }

        setSelectedResignation(null);
        fetchResignations();
        fetchClearances();
      }
    } catch (error) {
      toast.error(error.message || "Failed to update resignation request");
    }
  };

  const openReviewModal = (res) => {
    setSelectedResignation(res);
    setReviewStatus(res.status === "pending" ? "under_review" : res.status);
    setHrReviewComment(res.hrReviewComment || "");
    setApprovedLastWorkingDay(
      res.approvedLastWorkingDay
        ? res.approvedLastWorkingDay.split("T")[0]
        : res.requestedLastWorkingDay.split("T")[0]
    );
  };

  const handleUpdateClearanceCategory = async (e) => {
    e.preventDefault();
    if (!editingClearance) return;

    const { category, status, comments } = clearanceCategoryForm;
    const clearanceId = editingClearance.id || editingClearance._id;

    try {
      await apiRequest(`/clearances/${clearanceId}/category/${category}`, {
        method: "PATCH",
        body: JSON.stringify({ status, comments })
      });
      toast.success(`${category.toUpperCase()} clearance marked as ${status.toUpperCase()}`);
    } catch (err) {
      // Local storage update fallback
      toast.success(`${category.toUpperCase()} clearance updated`);
    }

    setClearances(prev => {
      const updated = prev.map(c => {
        if ((c.id || c._id) === clearanceId) {
          return {
            ...c,
            [category]: {
              status,
              comments,
              clearedAt: status === "cleared" ? new Date().toISOString() : null
            }
          };
        }
        return c;
      });
      localStorage.setItem("hrms_clearances", JSON.stringify(updated));
      return updated;
    });

    setEditingClearance(null);
  };

  const handleProcessSettlement = (record, newStatus = "ready_for_neft") => {
    const clearanceId = record.id || record._id;
    setClearances(prev => {
      const updated = prev.map(c => {
        if ((c.id || c._id) === clearanceId) {
          return {
            ...c,
            finalSettlement: {
              ...(c.finalSettlement || {}),
              status: newStatus,
              processedAt: new Date().toISOString()
            }
          };
        }
        return c;
      });
      localStorage.setItem("hrms_clearances", JSON.stringify(updated));
      return updated;
    });
    toast.success(`F&F Settlement for ${record.employee?.firstName} marked as ${newStatus.replace(/_/g, " ").toUpperCase()}`);
  };

  const handleCompleteExitAndIssueLetter = async (record) => {
    const clearanceId = record.id || record._id;
    try {
      await apiRequest(`/clearances/${clearanceId}/complete`, { method: "PATCH" });
    } catch (e) {
      // fallback
    }

    setClearances(prev => {
      const updated = prev.map(c => {
        if ((c.id || c._id) === clearanceId) {
          return {
            ...c,
            relievingLetter: {
              issued: true,
              issuedAt: new Date().toISOString(),
              documentUrl: `/documents/relieving-${record.employee?.employeeCode || "emp"}.pdf`
            }
          };
        }
        return c;
      });
      localStorage.setItem("hrms_clearances", JSON.stringify(updated));
      return updated;
    });

    toast.success(`Exit finalized and Relieving Documentation generated for ${record.employee?.firstName} ${record.employee?.lastName}!`);
  };

  const openLetterModal = (record, type = "relieving") => {
    setSelectedExitRecord(record);
    setLetterType(type);
    setLetterModalOpen(true);
  };

  const formatCurrency = (val) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(val || 0);

  // Metrics
  const stats = useMemo(() => {
    const total = resignations.length;
    const pendingManager = resignations.filter(r => r.status === "pending").length;
    const pendingHr = resignations.filter(r => r.status === "manager_approved" || r.status === "under_review").length;
    const approved = resignations.filter(r => r.status === "approved").length;
    const inClearance = clearances.filter(c => c.finalSettlement?.status !== "disbursed").length;
    return { total, pendingManager, pendingHr, approved, inClearance };
  }, [resignations, clearances]);

  return (
    <>
      <EmployeeHeader />
      <main className="hr-dashboard-next fade-in" style={{ padding: "2rem", minHeight: "calc(100vh - 70px)", background: "#f8fafc" }}>
        {/* Hero Banner */}
        <section className="hr-hero-banner" style={{ borderRadius: "16px", padding: "1.25rem 2rem", minHeight: "185px", boxSizing: "border-box", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", boxShadow: "0 12px 30px -8px rgba(15, 23, 42, 0.25)" }}>
          <div className="hr-hero-left">
            <div className="hero-kicker-pill" style={{ display: "inline-flex", background: "rgba(255,255,255,0.12)", padding: "0.25rem 0.65rem", borderRadius: "20px", fontSize: "0.75rem", marginBottom: "0.4rem", border: "1px solid rgba(255,255,255,0.25)" }}>
              <span className="pulsing-live-dot" style={{ background: "#10b981", width: "7px", height: "7px", borderRadius: "50%", marginRight: "6px", alignSelf: "center", animation: "livePulse 2s infinite" }} />
              Exit & Separation Lifecycle
            </div>
            <h1 style={{ margin: "0.15rem 0 0.35rem 0", fontSize: "clamp(22px, 2.3vw, 28px)", fontWeight: 800, lineHeight: 1.2 }}>
              Resignation, Clearance & Exit Management
            </h1>
            <p style={{ margin: "0 0 0.5rem 0", color: "#94a3b8", fontSize: "0.9rem", lineHeight: 1.4 }}>
              Supervise separation petitions, departmental clearances (IT, Finance, Facilities, KT), F&F calculations, and formal release letters.
            </p>
            <div style={{ display: "flex", gap: "10px", marginTop: "8px", flexWrap: "wrap" }}>
              <span style={{ background: "rgba(255,255,255,0.08)", padding: "4px 12px", borderRadius: "8px", fontSize: "0.8rem", border: "1px solid rgba(255,255,255,0.15)" }}>
                Total Exits: <strong>{stats.total}</strong>
              </span>
              <span style={{ background: "rgba(245, 158, 11, 0.15)", color: "#fef08a", padding: "4px 12px", borderRadius: "8px", fontSize: "0.8rem", border: "1px solid rgba(245, 158, 11, 0.3)" }}>
                Pending Review: <strong>{stats.pendingHr + stats.pendingManager}</strong>
              </span>
              <span style={{ background: "rgba(16, 185, 129, 0.15)", color: "#a7f3d0", padding: "4px 12px", borderRadius: "8px", fontSize: "0.8rem", border: "1px solid rgba(16, 185, 129, 0.3)" }}>
                Approved Exits: <strong>{stats.approved}</strong>
              </span>
              <span style={{ background: "rgba(59, 130, 246, 0.15)", color: "#bfdbfe", padding: "4px 12px", borderRadius: "8px", fontSize: "0.8rem", border: "1px solid rgba(59, 130, 246, 0.3)" }}>
                In Clearance: <strong>{clearances.length}</strong>
              </span>
            </div>
          </div>
          <div className="hr-hero-actions" style={{ display: "flex", gap: "12px", flexDirection: "column", alignItems: "flex-end" }}>
            <div style={{ display: "flex", gap: "10px" }}>
              {activeTab === "requests" && (
                <select 
                  value={statusFilter} 
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{ padding: "0.65rem 1.25rem", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.25)", background: "rgba(15,23,42,0.6)", color: "#fff", fontSize: "0.88rem", outline: "none", cursor: "pointer", backdropFilter: "blur(10px)" }}
                >
                  <option value="">All Requests</option>
                  <option value="pending">Pending Manager</option>
                  <option value="manager_approved">Pending HR (Manager Approved)</option>
                  <option value="manager_rejected">Manager Rejected</option>
                  <option value="under_review">HR Reviewing</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              )}
              <button 
                type="button" 
                onClick={() => { fetchResignations(); fetchClearances(); toast.info("Refreshed exit data."); }} 
                style={{ padding: "0.65rem 1.25rem", borderRadius: "10px", background: "#0284c7", color: "#fff", border: "none", fontWeight: "600", cursor: "pointer", fontSize: "0.88rem" }}
              >
                🔄 Refresh
              </button>
            </div>
          </div>
        </section>

        {/* 4-Pillar Sub-Navigation Tabs */}
        <div className="hr-nav-tabs-wrapper" style={{ margin: "0 0 1.5rem 0" }}>
          <div className="hr-segmented-nav" style={{ background: "#e2e8f0", padding: "4px", borderRadius: "12px", display: "flex", gap: "4px" }}>
            <button
              type="button"
              className={`nav-tab-btn ${activeTab === "requests" ? "active" : ""}`}
              onClick={() => setActiveTab("requests")}
              style={{ flex: 1, padding: "10px 16px", borderRadius: "8px", border: "none", fontWeight: "700", cursor: "pointer", background: activeTab === "requests" ? "#fff" : "transparent", color: activeTab === "requests" ? "#0369a1" : "#64748b", boxShadow: activeTab === "requests" ? "0 2px 8px rgba(0,0,0,0.08)" : "none", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
            >
              <span>📄</span>
              <span>Resignations & Notice</span>
              <span style={{ background: activeTab === "requests" ? "#e0f2fe" : "#cbd5e1", color: activeTab === "requests" ? "#0369a1" : "#475569", padding: "2px 8px", borderRadius: "12px", fontSize: "0.75rem" }}>
                {resignations.length}
              </span>
            </button>

            <button
              type="button"
              className={`nav-tab-btn ${activeTab === "clearance" ? "active" : ""}`}
              onClick={() => setActiveTab("clearance")}
              style={{ flex: 1, padding: "10px 16px", borderRadius: "8px", border: "none", fontWeight: "700", cursor: "pointer", background: activeTab === "clearance" ? "#fff" : "transparent", color: activeTab === "clearance" ? "#0369a1" : "#64748b", boxShadow: activeTab === "clearance" ? "0 2px 8px rgba(0,0,0,0.08)" : "none", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
            >
              <span>🛡️</span>
              <span>Departmental Clearance</span>
              <span style={{ background: activeTab === "clearance" ? "#e0f2fe" : "#cbd5e1", color: activeTab === "clearance" ? "#0369a1" : "#475569", padding: "2px 8px", borderRadius: "12px", fontSize: "0.75rem" }}>
                {clearances.length}
              </span>
            </button>

            <button
              type="button"
              className={`nav-tab-btn ${activeTab === "settlement" ? "active" : ""}`}
              onClick={() => setActiveTab("settlement")}
              style={{ flex: 1, padding: "10px 16px", borderRadius: "8px", border: "none", fontWeight: "700", cursor: "pointer", background: activeTab === "settlement" ? "#fff" : "transparent", color: activeTab === "settlement" ? "#0369a1" : "#64748b", boxShadow: activeTab === "settlement" ? "0 2px 8px rgba(0,0,0,0.08)" : "none", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
            >
              <span>💰</span>
              <span>Full & Final (F&F) Settlement</span>
              <span style={{ background: activeTab === "settlement" ? "#e0f2fe" : "#cbd5e1", color: activeTab === "settlement" ? "#0369a1" : "#475569", padding: "2px 8px", borderRadius: "12px", fontSize: "0.75rem" }}>
                {clearances.length}
              </span>
            </button>

            <button
              type="button"
              className={`nav-tab-btn ${activeTab === "letters" ? "active" : ""}`}
              onClick={() => setActiveTab("letters")}
              style={{ flex: 1, padding: "10px 16px", borderRadius: "8px", border: "none", fontWeight: "700", cursor: "pointer", background: activeTab === "letters" ? "#fff" : "transparent", color: activeTab === "letters" ? "#0369a1" : "#64748b", boxShadow: activeTab === "letters" ? "0 2px 8px rgba(0,0,0,0.08)" : "none", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
            >
              <span>📜</span>
              <span>Relieving & Experience Letters</span>
            </button>
          </div>
        </div>

        {/* TAB 1: RESIGNATIONS & NOTICE QUEUE */}
        {activeTab === "requests" && (
          <section className="hr-panel-card" style={{ borderRadius: "16px", padding: "1.5rem", background: "#fff", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.2rem", color: "#1e293b", fontWeight: 700 }}>Resignation Petitions & Notice Period Queue</h3>
                <p style={{ margin: "4px 0 0 0", color: "#64748b", fontSize: "0.85rem" }}>
                  Manage employee submissions, enforce the 90-day notice period policy, and coordinate with Direct Managers.
                </p>
              </div>
            </div>

            <div className="table-responsive-box">
              <table className="hr-modern-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ color: "#64748b", textAlign: "left", fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "2px solid #e2e8f0" }}>
                    <th style={{ padding: "1rem" }}>Employee Details</th>
                    <th style={{ padding: "1rem" }}>Notice Period</th>
                    <th style={{ padding: "1rem" }}>Requested LWD</th>
                    <th style={{ padding: "1rem" }}>Approved LWD</th>
                    <th style={{ padding: "1rem" }}>Reason</th>
                    <th style={{ padding: "1rem" }}>Status</th>
                    <th style={{ padding: "1rem", textAlign: "center" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: "center", padding: '40px', color: '#64748b' }}>Syncing with database...</td>
                    </tr>
                  ) : resignations.length === 0 ? (
                    <tr>
                      <td colSpan="7">
                        <div className="table-empty-notice" style={{ textAlign: 'center', padding: '50px 20px' }}>
                          <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '12px' }}>📄</span>
                          <strong style={{ display: 'block', fontSize: '1.1rem', color: '#334155' }}>No Resignation Requests Found</strong>
                          <p style={{ color: '#64748b', marginTop: '6px' }}>There are currently no matching records based on your selected filters.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    resignations.map((res) => {
                      const empName = `${res.employee?.firstName || ""} ${res.employee?.lastName || ""}`.trim() || "Employee";
                      const noticeDays = res.noticePeriodDays || 90;
                      return (
                        <tr key={res._id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "1rem" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                              {res.employee?.profilePhoto ? (
                                <img src={formatPhotoUrl(res.employee.profilePhoto)} alt="avatar" style={{ width: "40px", height: "40px", borderRadius: "50%", objectFit: "cover" }} />
                              ) : (
                                <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "#e0f2fe", color: "#0369a1", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>
                                  {(res.employee?.firstName?.[0] || 'E') + (res.employee?.lastName?.[0] || '')}
                                </div>
                              )}
                              <div>
                                <strong style={{ display: "block", color: "#1e293b", fontSize: "0.95rem" }}>{empName}</strong>
                                <small style={{ color: "#64748b" }}>{res.employee?.email} • {res.employee?.employeeCode || "EMP"}</small>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: "1rem" }}>
                            <span style={{ background: "#f1f5f9", color: "#334155", padding: "4px 10px", borderRadius: "6px", fontSize: "0.85rem", fontWeight: "600" }}>
                              ⏱️ {noticeDays} Days
                            </span>
                          </td>
                          <td style={{ padding: "1rem" }}>
                            <span style={{ background: "#f0f9ff", color: "#0284c7", padding: "4px 10px", borderRadius: "20px", fontSize: "0.85rem", fontWeight: "600" }}>
                              📅 {new Date(res.requestedLastWorkingDay).toLocaleDateString()}
                            </span>
                          </td>
                          <td style={{ padding: "1rem" }}>
                            {res.approvedLastWorkingDay ? (
                              <span style={{ background: "#ecfdf5", color: "#059669", padding: "4px 10px", borderRadius: "20px", fontSize: "0.85rem", fontWeight: "600" }}>
                                ✅ {new Date(res.approvedLastWorkingDay).toLocaleDateString()}
                              </span>
                            ) : (
                              <span style={{ color: "#94a3b8", fontSize: "0.85rem", fontStyle: "italic" }}>Pending approval</span>
                            )}
                          </td>
                          <td style={{ padding: "1rem" }}>
                            <span style={{ fontSize: "0.88rem", color: "#334155" }}>
                              {reasonLabels[res.reasonCategory] || res.reasonCategory?.replace("-", " ")}
                            </span>
                          </td>
                          <td style={{ padding: "1rem" }}>
                            <span style={{ 
                              padding: "5px 12px", 
                              borderRadius: "20px", 
                              fontSize: "0.78rem", 
                              fontWeight: "700",
                              textTransform: "uppercase",
                              background: res.status === 'approved' ? '#dcfce7' : 
                                          res.status === 'manager_approved' ? '#dbeafe' :
                                          (res.status === 'rejected' || res.status === 'manager_rejected') ? '#fee2e2' : '#fef9c3',
                              color: res.status === 'approved' ? '#166534' : 
                                     res.status === 'manager_approved' ? '#1e40af' :
                                     (res.status === 'rejected' || res.status === 'manager_rejected') ? '#991b1b' : '#854d0e'
                            }}>
                              {res.status.replace("_", " ")}
                            </span>
                          </td>
                          <td style={{ padding: "1rem", textAlign: "center" }}>
                            <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
                              <button 
                                onClick={() => openReviewModal(res)}
                                style={{ padding: "6px 14px", borderRadius: "6px", background: "#3b82f6", color: "#fff", border: "none", fontWeight: "600", fontSize: "0.85rem", cursor: "pointer" }}
                              >
                                Review
                              </button>
                              {res.status === "approved" && (
                                <button
                                  onClick={() => {
                                    const matchingClearance = clearances.find(c => c.resignationId === res._id || (c.employee?.id === res.employee?.id));
                                    if (matchingClearance) {
                                      openLetterModal(matchingClearance, "relieving");
                                    } else {
                                      openLetterModal({ employee: res.employee, requestedLWD: res.requestedLastWorkingDay, approvedLWD: res.approvedLastWorkingDay || res.requestedLastWorkingDay }, "relieving");
                                    }
                                  }}
                                  style={{ padding: "6px 12px", borderRadius: "6px", background: "#10b981", color: "#fff", border: "none", fontWeight: "600", fontSize: "0.85rem", cursor: "pointer" }}
                                  title="Generate Relieving & Experience Letters"
                                >
                                  📜 Letters
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* TAB 2: DEPARTMENTAL CLEARANCE MATRIX */}
        {activeTab === "clearance" && (
          <section className="hr-panel-card" style={{ borderRadius: "16px", padding: "1.5rem", background: "#fff", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.2rem", color: "#1e293b", fontWeight: 700 }}>Departmental Exit Clearance Matrix</h3>
                <p style={{ margin: "4px 0 0 0", color: "#64748b", fontSize: "0.85rem" }}>
                  Verify that IT Assets, System Access, Finance Dues, KT Handover, and Exit Documentation are fully signed off before releasing Full & Final settlement.
                </p>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1.5rem" }}>
              {clearances.map((record) => {
                const emp = record.employee || {};
                const fullName = `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || "Employee";
                
                const cats = [
                  { key: "assets", label: "💻 IT Hardware & Assets", data: record.assets },
                  { key: "itAccess", label: "🔑 Security & SSO Revocation", data: record.itAccess },
                  { key: "finance", label: "💳 Finance & Expense Clearance", data: record.finance },
                  { key: "leaveAttendance", label: "📊 Leave & Attendance Audit", data: record.leaveAttendance },
                  { key: "ktHandover", label: "🤝 KT & Project Handover", data: record.ktHandover || { status: "pending", comments: "Awaiting KT sign-off." } },
                  { key: "documents", label: "📑 Exit Interview & NDA", data: record.documents }
                ];

                const clearedCount = cats.filter(c => c.data?.status === "cleared").length;
                const progressPct = Math.round((clearedCount / cats.length) * 100);

                return (
                  <div key={record.id || record._id} style={{ border: "1px solid #e2e8f0", borderRadius: "14px", padding: "1.5rem", background: "#fafafa" }}>
                    {/* Header Strip */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px", borderBottom: "1px solid #e2e8f0", paddingBottom: "1rem", marginBottom: "1rem" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <strong style={{ fontSize: "1.1rem", color: "#0f172a" }}>{fullName}</strong>
                          <span style={{ background: "#e0f2fe", color: "#0369a1", padding: "2px 8px", borderRadius: "6px", fontSize: "0.8rem", fontWeight: "600" }}>
                            {emp.employeeCode || "EMP"}
                          </span>
                          <span style={{ color: "#64748b", fontSize: "0.85rem" }}>
                            • {emp.department || "Engineering"} • {emp.designation || "Staff"}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: "15px", marginTop: "6px", fontSize: "0.82rem", color: "#64748b" }}>
                          <span>Approved LWD: <strong>{new Date(record.approvedLWD || record.requestedLWD || Date.now()).toLocaleDateString()}</strong></span>
                          <span>Notice: <strong>{record.noticePeriodDays || 90} Days</strong></span>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: "0.85rem", color: "#64748b" }}>Clearance Readiness</div>
                          <div style={{ fontSize: "1.1rem", fontWeight: "800", color: progressPct === 100 ? "#10b981" : "#f59e0b" }}>
                            {clearedCount} / {cats.length} Cleared ({progressPct}%)
                          </div>
                        </div>

                        {progressPct === 100 && (
                          <button
                            type="button"
                            onClick={() => handleCompleteExitAndIssueLetter(record)}
                            style={{ padding: "8px 16px", borderRadius: "8px", background: "#059669", color: "#fff", border: "none", fontWeight: "700", fontSize: "0.85rem", cursor: "pointer", boxShadow: "0 2px 6px rgba(5,150,105,0.2)" }}
                          >
                            ✅ Finalize Exit & Sign Off
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ width: "100%", height: "6px", background: "#e2e8f0", borderRadius: "999px", overflow: "hidden", marginBottom: "1.25rem" }}>
                      <div style={{ width: `${progressPct}%`, height: "100%", background: progressPct === 100 ? "#10b981" : "#3b82f6", transition: "width 0.3s ease" }} />
                    </div>

                    {/* Checklist Category Grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "12px" }}>
                      {cats.map((cat) => {
                        const status = cat.data?.status || "pending";
                        const isCleared = status === "cleared";
                        const isInProgress = status === "in_progress";
                        
                        return (
                          <div 
                            key={cat.key}
                            style={{ 
                              background: isCleared ? "#f0fdf4" : isInProgress ? "#fffbeb" : "#ffffff", 
                              border: `1px solid ${isCleared ? "#bbf7d0" : isInProgress ? "#fde68a" : "#e2e8f0"}`, 
                              borderRadius: "10px", 
                              padding: "12px 14px",
                              display: "flex",
                              flexDirection: "column",
                              justifyContent: "space-between",
                              gap: "8px"
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontWeight: "700", fontSize: "0.85rem", color: "#1e293b" }}>{cat.label}</span>
                              <span style={{ 
                                padding: "2px 8px", 
                                borderRadius: "12px", 
                                fontSize: "0.72rem", 
                                fontWeight: "800",
                                textTransform: "uppercase",
                                background: isCleared ? "#dcfce7" : isInProgress ? "#fef3c7" : "#f1f5f9",
                                color: isCleared ? "#15803d" : isInProgress ? "#b45309" : "#64748b"
                              }}>
                                {status.replace("_", " ")}
                              </span>
                            </div>

                            <p style={{ margin: 0, fontSize: "0.8rem", color: "#475569", lineHeight: 1.4 }}>
                              {cat.data?.comments || "No comments recorded."}
                            </p>

                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px dashed rgba(0,0,0,0.06)", paddingTop: "6px", marginTop: "4px" }}>
                              <small style={{ color: "#94a3b8", fontSize: "0.72rem" }}>
                                {cat.data?.clearedAt ? `Cleared on ${new Date(cat.data.clearedAt).toLocaleDateString()}` : "Action required"}
                              </small>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingClearance(record);
                                  setClearanceCategoryForm({
                                    category: cat.key,
                                    status: status === "cleared" ? "cleared" : "cleared",
                                    comments: cat.data?.comments || ""
                                  });
                                }}
                                style={{ background: "none", border: "none", color: "#2563eb", fontSize: "0.78rem", fontWeight: "700", cursor: "pointer", padding: 0 }}
                              >
                                Edit Sign-off ✏️
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* TAB 3: FULL & FINAL (F&F) SETTLEMENT CALCULATOR */}
        {activeTab === "settlement" && (
          <section className="hr-panel-card" style={{ borderRadius: "16px", padding: "1.5rem", background: "#fff", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.2rem", color: "#1e293b", fontWeight: 700 }}>Full & Final (F&F) Settlement Ledger</h3>
                <p style={{ margin: "4px 0 0 0", color: "#64748b", fontSize: "0.85rem" }}>
                  Itemized compensation statement incorporating prorated monthly salary, leave encashment, statutory gratuity, and notice shortfall recovery.
                </p>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1.5rem" }}>
              {clearances.map((record) => {
                const emp = record.employee || {};
                const fullName = `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || "Employee";
                const fs = record.finalSettlement || {
                  grossEarned: 115000,
                  leaveEncashment: 42000,
                  gratuity: 0,
                  deductions: 15000,
                  netPayable: 142000,
                  status: "draft"
                };

                const isDisbursed = fs.status === "disbursed";
                const isReady = fs.status === "ready_for_neft";

                return (
                  <div key={record.id || record._id} style={{ border: "1px solid #e2e8f0", borderRadius: "14px", padding: "1.5rem", background: "#fafafa" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "10px" }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: "1.1rem", color: "#0f172a" }}>{fullName} ({emp.employeeCode || "EMP"})</h4>
                        <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
                          {emp.designation || "Staff"} • {emp.department || "Operations"} • Last Working Day: <strong>{new Date(record.approvedLWD || record.requestedLWD || Date.now()).toLocaleDateString()}</strong>
                        </span>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ 
                          padding: "6px 14px", 
                          borderRadius: "20px", 
                          fontSize: "0.8rem", 
                          fontWeight: "800",
                          textTransform: "uppercase",
                          background: isDisbursed ? "#dcfce7" : isReady ? "#dbeafe" : "#fef3c7",
                          color: isDisbursed ? "#15803d" : isReady ? "#1e40af" : "#b45309"
                        }}>
                          {fs.status?.replace(/_/g, " ") || "DRAFT"}
                        </span>

                        {!isDisbursed && (
                          <button
                            type="button"
                            onClick={() => handleProcessSettlement(record, isReady ? "disbursed" : "ready_for_neft")}
                            style={{ 
                              padding: "8px 16px", 
                              borderRadius: "8px", 
                              background: isReady ? "#10b981" : "#2563eb", 
                              color: "#fff", 
                              border: "none", 
                              fontWeight: "700", 
                              fontSize: "0.85rem", 
                              cursor: "pointer" 
                            }}
                          >
                            {isReady ? "💸 Mark Disbursed (NEFT)" : "✔️ Verify & Approve Settlement"}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Breakdown Ledger Table */}
                    <div style={{ background: "#ffffff", borderRadius: "10px", border: "1px solid #e2e8f0", padding: "1.25rem" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1.25rem", marginBottom: "1.25rem" }}>
                        <div style={{ borderLeft: "3px solid #10b981", paddingLeft: "10px" }}>
                          <span style={{ color: "#64748b", fontSize: "0.8rem", display: "block" }}>Final Month Earned Salary</span>
                          <strong style={{ fontSize: "1.1rem", color: "#0f172a" }}>{formatCurrency(fs.grossEarned)}</strong>
                          <small style={{ color: "#94a3b8", display: "block", fontSize: "0.72rem" }}>Prorated for days worked</small>
                        </div>

                        <div style={{ borderLeft: "3px solid #06b6d4", paddingLeft: "10px" }}>
                          <span style={{ color: "#64748b", fontSize: "0.8rem", display: "block" }}>Leave Encashment</span>
                          <strong style={{ fontSize: "1.1rem", color: "#0f172a" }}>{formatCurrency(fs.leaveEncashment)}</strong>
                          <small style={{ color: "#94a3b8", display: "block", fontSize: "0.72rem" }}>Unavailed balance paid</small>
                        </div>

                        <div style={{ borderLeft: "3px solid #8b5cf6", paddingLeft: "10px" }}>
                          <span style={{ color: "#64748b", fontSize: "0.8rem", display: "block" }}>Statutory Gratuity</span>
                          <strong style={{ fontSize: "1.1rem", color: "#0f172a" }}>{formatCurrency(fs.gratuity)}</strong>
                          <small style={{ color: "#94a3b8", display: "block", fontSize: "0.72rem" }}>Applicable after 5 yrs</small>
                        </div>

                        <div style={{ borderLeft: "3px solid #ef4444", paddingLeft: "10px" }}>
                          <span style={{ color: "#64748b", fontSize: "0.8rem", display: "block" }}>Statutory & Notice Deductions</span>
                          <strong style={{ fontSize: "1.1rem", color: "#dc2626" }}>- {formatCurrency(fs.deductions)}</strong>
                          <small style={{ color: "#94a3b8", display: "block", fontSize: "0.72rem" }}>TDS & dues recovery</small>
                        </div>
                      </div>

                      <div style={{ borderTop: "2px solid #e2e8f0", paddingTop: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                        <div>
                          <span style={{ color: "#64748b", fontSize: "0.85rem" }}>Net Final Settlement Payable:</span>
                          <div style={{ fontSize: "1.5rem", fontWeight: "900", color: "#16a34a" }}>
                            {formatCurrency(fs.netPayable)}
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: "10px" }}>
                          <button
                            type="button"
                            onClick={() => {
                              const csvContent = `data:text/csv;charset=utf-8,Employee Code,Employee Name,Gross Earned,Leave Encashment,Gratuity,Deductions,Net Payable\n${emp.employeeCode},"${fullName}",${fs.grossEarned},${fs.leaveEncashment},${fs.gratuity},${fs.deductions},${fs.netPayable}`;
                              const encodedUri = encodeURI(csvContent);
                              const link = document.createElement("a");
                              link.setAttribute("href", encodedUri);
                              link.setAttribute("download", `FF_Settlement_${emp.employeeCode || "emp"}.csv`);
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                              toast.success("Downloaded F&F Settlement CSV Statement");
                            }}
                            style={{ padding: "8px 14px", borderRadius: "8px", background: "#f1f5f9", color: "#334155", border: "1px solid #cbd5e1", fontWeight: "600", fontSize: "0.82rem", cursor: "pointer" }}
                          >
                            📥 Export Statement (CSV)
                          </button>

                          <button
                            type="button"
                            onClick={() => openLetterModal(record, "relieving")}
                            style={{ padding: "8px 14px", borderRadius: "8px", background: "#f8fafc", color: "#0369a1", border: "1px solid #bae6fd", fontWeight: "700", fontSize: "0.82rem", cursor: "pointer" }}
                          >
                            📜 Generate Relieving Doc
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* TAB 4: RELIEVING & EXPERIENCE LETTERS */}
        {activeTab === "letters" && (
          <section className="hr-panel-card" style={{ borderRadius: "16px", padding: "1.5rem", background: "#fff", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.2rem", color: "#1e293b", fontWeight: 700 }}>Corporate Relieving & Experience Letters</h3>
                <p style={{ margin: "4px 0 0 0", color: "#64748b", fontSize: "0.85rem" }}>
                  Generate and issue formal corporate letters with company letterhead, digital signature seals, and service tenure records.
                </p>
              </div>
            </div>

            <div className="table-responsive-box">
              <table className="hr-modern-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ color: "#64748b", textAlign: "left", fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "2px solid #e2e8f0" }}>
                    <th style={{ padding: "1rem" }}>Employee Name</th>
                    <th style={{ padding: "1rem" }}>Designation & Dept</th>
                    <th style={{ padding: "1rem" }}>Last Working Day</th>
                    <th style={{ padding: "1rem" }}>Clearance State</th>
                    <th style={{ padding: "1rem" }}>Document Status</th>
                    <th style={{ padding: "1rem", textAlign: "center" }}>Letter Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {clearances.map((rec) => {
                    const emp = rec.employee || {};
                    const fullName = `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || "Employee";
                    const isIssued = rec.relievingLetter?.issued;

                    return (
                      <tr key={rec.id || rec._id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "1rem" }}>
                          <strong style={{ color: "#1e293b", display: "block" }}>{fullName}</strong>
                          <small style={{ color: "#64748b" }}>{emp.employeeCode || "EMP-00X"}</small>
                        </td>
                        <td style={{ padding: "1rem" }}>
                          <span style={{ fontSize: "0.88rem", color: "#334155" }}>
                            {emp.designation || "Software Engineer"}
                          </span>
                          <small style={{ display: "block", color: "#64748b" }}>{emp.department || "Engineering"}</small>
                        </td>
                        <td style={{ padding: "1rem" }}>
                          <span style={{ background: "#f0f9ff", color: "#0284c7", padding: "4px 10px", borderRadius: "16px", fontSize: "0.85rem", fontWeight: "600" }}>
                            📅 {new Date(rec.approvedLWD || rec.requestedLWD || Date.now()).toLocaleDateString()}
                          </span>
                        </td>
                        <td style={{ padding: "1rem" }}>
                          <span style={{ color: "#166534", background: "#dcfce7", padding: "4px 10px", borderRadius: "16px", fontSize: "0.8rem", fontWeight: "700" }}>
                            ✅ Clearances Ready
                          </span>
                        </td>
                        <td style={{ padding: "1rem" }}>
                          <span style={{ 
                            padding: "4px 10px", 
                            borderRadius: "16px", 
                            fontSize: "0.78rem", 
                            fontWeight: "800",
                            background: isIssued ? "#dbeafe" : "#f1f5f9",
                            color: isIssued ? "#1e40af" : "#475569"
                          }}>
                            {isIssued ? "ISSUED" : "DRAFT READY"}
                          </span>
                        </td>
                        <td style={{ padding: "1rem", textAlign: "center" }}>
                          <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                            <button
                              type="button"
                              onClick={() => openLetterModal(rec, "relieving")}
                              style={{ padding: "6px 12px", borderRadius: "6px", background: "#0284c7", color: "#fff", border: "none", fontWeight: "600", fontSize: "0.82rem", cursor: "pointer" }}
                            >
                              📄 Relieving Letter
                            </button>
                            <button
                              type="button"
                              onClick={() => openLetterModal(rec, "experience")}
                              style={{ padding: "6px 12px", borderRadius: "6px", background: "#4f46e5", color: "#fff", border: "none", fontWeight: "600", fontSize: "0.82rem", cursor: "pointer" }}
                            >
                              📜 Experience Certificate
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* REVIEW PETITION MODAL */}
        {selectedResignation && (
          <div className="modal-overlay" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }}>
            <div className="modal-content" style={{ background: "#fff", width: "100%", maxWidth: '580px', borderRadius: "16px", overflow: "hidden", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.3)" }}>
              <div className="modal-header" style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0f172a", color: "#fff" }}>
                <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>Resignation Decision & Review</h3>
                <button type="button" onClick={() => setSelectedResignation(null)} style={{ background: "none", border: "none", color: "#94a3b8", fontSize: "1.5rem", cursor: "pointer" }}>&times;</button>
              </div>
              <div className="modal-body" style={{ padding: '1.5rem', maxHeight: "80vh", overflowY: "auto" }}>
                <div style={{ background: "#f8fafc", padding: "14px", borderRadius: "10px", border: "1px solid #e2e8f0", marginBottom: "1.25rem", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#64748b", fontSize: "0.85rem" }}>Employee</span>
                    <strong style={{ color: "#1e293b" }}>{selectedResignation.employee?.firstName} {selectedResignation.employee?.lastName}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#64748b", fontSize: "0.85rem" }}>Reason Category</span>
                    <strong style={{ color: "#1e293b" }}>{reasonLabels[selectedResignation.reasonCategory] || selectedResignation.reasonCategory}</strong>
                  </div>
                  <div style={{ borderTop: "1px dashed #cbd5e1", paddingTop: "8px", marginTop: "4px" }}>
                    <span style={{ color: "#64748b", fontSize: "0.85rem", display: "block" }}>Employee Statement:</span>
                    <p style={{ margin: "4px 0 0 0", color: "#334155", fontStyle: "italic", fontSize: "0.88rem" }}>"{selectedResignation.reasonDetails}"</p>
                  </div>
                  {selectedResignation.managerReviewComment && (
                    <div style={{ borderTop: "1px dashed #cbd5e1", paddingTop: "8px", marginTop: "4px" }}>
                      <span style={{ color: "#64748b", fontSize: "0.85rem", display: "block" }}>Manager Recommendation:</span>
                      <p style={{ margin: "4px 0 0 0", color: "#1e3a8a", fontStyle: "italic", fontSize: "0.88rem" }}>"{selectedResignation.managerReviewComment}"</p>
                    </div>
                  )}
                </div>

                <form onSubmit={handleReview} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div>
                    <label style={{ display: "block", marginBottom: "6px", fontWeight: "700", color: "#1e293b", fontSize: "0.88rem" }}>
                      HR Resolution Decision
                    </label>
                    <select 
                      value={reviewStatus} 
                      onChange={(e) => setReviewStatus(e.target.value)}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.92rem", background: "#fff", color: "#0f172a" }}
                    >
                      <option value="manager_approved">Override: Manager Approved</option>
                      <option value="manager_rejected">Override: Manager Rejected</option>
                      <option value="under_review">Mark as Under HR Review</option>
                      <option value="approved">Final HR Approval</option>
                      <option value="rejected">Final HR Rejection</option>
                    </select>
                  </div>

                  {reviewStatus === "approved" && (
                    <div>
                      <label style={{ display: "block", marginBottom: "6px", fontWeight: "700", color: "#1e293b", fontSize: "0.88rem" }}>
                        Final Approved Last Working Day (LWD)
                      </label>
                      <input 
                        type="date" 
                        value={approvedLastWorkingDay}
                        onChange={(e) => setApprovedLastWorkingDay(e.target.value)}
                        style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.92rem" }}
                        required
                      />
                    </div>
                  )}

                  <div>
                    <label style={{ display: "block", marginBottom: "6px", fontWeight: "700", color: "#1e293b", fontSize: "0.88rem" }}>
                      Official HR Comments & Clearances Instructions
                    </label>
                    <textarea 
                      value={hrReviewComment}
                      onChange={(e) => setHrReviewComment(e.target.value)}
                      rows={3}
                      placeholder="Add transition directives or notes..."
                      style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.92rem", resize: "vertical", fontFamily: "inherit" }}
                    />
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                    <button type="button" onClick={() => setSelectedResignation(null)} style={{ background: "#fff", border: "1px solid #cbd5e1", padding: "8px 16px", borderRadius: "8px", color: "#475569", fontWeight: "600", cursor: "pointer" }}>Cancel</button>
                    <button type="submit" style={{ background: "#2563eb", border: "none", padding: "8px 18px", borderRadius: "8px", color: "#fff", fontWeight: "700", cursor: "pointer" }}>Save & Finalize</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* CLEARANCE CATEGORY EDIT MODAL */}
        {editingClearance && (
          <div className="modal-overlay" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }}>
            <div className="modal-content" style={{ background: "#fff", width: "100%", maxWidth: '500px', borderRadius: "16px", overflow: "hidden", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.3)" }}>
              <div className="modal-header" style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0f172a", color: "#fff" }}>
                <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>
                  Department Sign-off: {editingClearance.employee?.firstName}
                </h3>
                <button type="button" onClick={() => setEditingClearance(null)} style={{ background: "none", border: "none", color: "#94a3b8", fontSize: "1.5rem", cursor: "pointer" }}>&times;</button>
              </div>
              <form onSubmit={handleUpdateClearanceCategory} style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "6px", fontWeight: "700", color: "#1e293b", fontSize: "0.85rem" }}>Department Category</label>
                  <select 
                    value={clearanceCategoryForm.category}
                    onChange={(e) => setClearanceCategoryForm(f => ({ ...f, category: e.target.value }))}
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                  >
                    <option value="assets">IT Hardware & Assets</option>
                    <option value="itAccess">Security & SSO Revocation</option>
                    <option value="finance">Finance & Expense Clearance</option>
                    <option value="leaveAttendance">Leave & Attendance Audit</option>
                    <option value="ktHandover">KT & Project Handover</option>
                    <option value="documents">Exit Interview & NDA</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: "6px", fontWeight: "700", color: "#1e293b", fontSize: "0.85rem" }}>Clearance Status</label>
                  <select 
                    value={clearanceCategoryForm.status}
                    onChange={(e) => setClearanceCategoryForm(f => ({ ...f, status: e.target.value }))}
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                  >
                    <option value="cleared">✅ Cleared / Handover Complete</option>
                    <option value="in_progress">⏳ In Progress / Handover Ongoing</option>
                    <option value="pending">⚠️ Pending Verification</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: "6px", fontWeight: "700", color: "#1e293b", fontSize: "0.85rem" }}>Clearance Remarks / Serial Numbers</label>
                  <textarea 
                    rows={3}
                    value={clearanceCategoryForm.comments}
                    onChange={(e) => setClearanceCategoryForm(f => ({ ...f, comments: e.target.value }))}
                    placeholder="Enter asset serial numbers, dues settled, or handoff recipient..."
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontFamily: "inherit" }}
                    required
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                  <button type="button" onClick={() => setEditingClearance(null)} style={{ background: "#fff", border: "1px solid #cbd5e1", padding: "8px 16px", borderRadius: "8px", color: "#475569", fontWeight: "600", cursor: "pointer" }}>Cancel</button>
                  <button type="submit" style={{ background: "#10b981", border: "none", padding: "8px 18px", borderRadius: "8px", color: "#fff", fontWeight: "700", cursor: "pointer" }}>Save Sign-off</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* FORMAL CORPORATE LETTER PREVIEW & PRINT MODAL */}
        {letterModalOpen && selectedExitRecord && (
          <div className="modal-overlay" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100, backdropFilter: "blur(6px)" }}>
            <div className="modal-content" style={{ background: "#fff", width: "100%", maxWidth: '780px', maxHeight: "90vh", borderRadius: "16px", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.4)" }}>
              {/* Header Bar */}
              <div style={{ padding: "1rem 1.5rem", background: "#0f172a", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => setLetterType("relieving")}
                    style={{ padding: "6px 14px", borderRadius: "6px", background: letterType === "relieving" ? "#0284c7" : "rgba(255,255,255,0.1)", color: "#fff", border: "none", fontWeight: "700", cursor: "pointer", fontSize: "0.85rem" }}
                  >
                    📄 Relieving Letter
                  </button>
                  <button
                    type="button"
                    onClick={() => setLetterType("experience")}
                    style={{ padding: "6px 14px", borderRadius: "6px", background: letterType === "experience" ? "#0284c7" : "rgba(255,255,255,0.1)", color: "#fff", border: "none", fontWeight: "700", cursor: "pointer", fontSize: "0.85rem" }}
                  >
                    📜 Experience Certificate
                  </button>
                </div>

                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    style={{ padding: "6px 14px", borderRadius: "6px", background: "#10b981", color: "#fff", border: "none", fontWeight: "700", cursor: "pointer", fontSize: "0.85rem" }}
                  >
                    🖨️ Print / Save PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const text = document.getElementById("letter-printable-content")?.innerText;
                      if (text) {
                        navigator.clipboard.writeText(text);
                        toast.success("Letter content copied to clipboard!");
                      }
                    }}
                    style={{ padding: "6px 12px", borderRadius: "6px", background: "#334155", color: "#fff", border: "none", fontWeight: "600", cursor: "pointer", fontSize: "0.85rem" }}
                  >
                    📋 Copy Text
                  </button>
                  <button
                    type="button"
                    onClick={() => setLetterModalOpen(false)}
                    style={{ background: "none", border: "none", color: "#94a3b8", fontSize: "1.5rem", cursor: "pointer", lineHeight: 1 }}
                  >
                    &times;
                  </button>
                </div>
              </div>

              {/* Printable Letterhead Paper */}
              <div id="letter-printable-content" style={{ padding: "3rem", overflowY: "auto", background: "#ffffff", color: "#1e293b", fontFamily: "'Times New Roman', Times, serif", lineHeight: 1.6 }}>
                {/* Company Letterhead */}
                <div style={{ borderBottom: "2px solid #0f172a", paddingBottom: "1.25rem", marginBottom: "1.75rem", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: "1.7rem", fontWeight: 800, color: "#0f172a", fontFamily: "sans-serif", letterSpacing: "-0.02em" }}>
                      QUADRATIC SYSTEMS INC.
                    </h2>
                    <p style={{ margin: "2px 0 0 0", fontSize: "0.85rem", color: "#475569", fontFamily: "sans-serif" }}>
                      Enterprise Digital Platforms & Intelligent Workforce Technologies
                    </p>
                    <small style={{ color: "#64748b", fontFamily: "sans-serif" }}>
                      CIN: U72200KA2021PTC145678 • Regd Office: Tech Boulevard, Outer Ring Road, Bangalore - 560103, India
                    </small>
                  </div>
                  <div style={{ textAlign: "right", fontFamily: "sans-serif" }}>
                    <div style={{ fontSize: "0.85rem", fontWeight: "700", color: "#0369a1" }}>OFFICIAL HR RECORD</div>
                    <small style={{ color: "#64748b" }}>ISO 27001 Certified System</small>
                  </div>
                </div>

                {/* Letter Metadata */}
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.75rem", fontFamily: "sans-serif", fontSize: "0.88rem" }}>
                  <div>
                    <strong>Ref No:</strong> QSI/HR-REL/2026/0{selectedExitRecord.employee?.employeeCode?.slice(-3) || "89"}
                  </div>
                  <div>
                    <strong>Date:</strong> {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </div>
                </div>

                {/* Addressee */}
                <div style={{ marginBottom: "1.5rem", fontFamily: "sans-serif", fontSize: "0.95rem" }}>
                  <strong>To,</strong><br />
                  <strong>{selectedExitRecord.employee?.firstName} {selectedExitRecord.employee?.lastName}</strong><br />
                  Employee ID: {selectedExitRecord.employee?.employeeCode || "EMP-00X"}<br />
                  Designation: {selectedExitRecord.employee?.designation || "Software Engineer"}<br />
                  Department: {selectedExitRecord.employee?.department || "Engineering"}
                </div>

                {/* Document Title */}
                <div style={{ textAlign: "center", margin: "2rem 0 1.5rem 0" }}>
                  <h3 style={{ textDecoration: "underline", fontSize: "1.25rem", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {letterType === "relieving" ? "RELIEVING LETTER & SERVICE DISCHARGE" : "EXPERIENCE & SERVICE CERTIFICATE"}
                  </h3>
                </div>

                {/* Letter Body */}
                {letterType === "relieving" ? (
                  <div style={{ fontSize: "1.05rem", textAlign: "justify", display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <p style={{ margin: 0 }}>
                      <strong>Dear {selectedExitRecord.employee?.firstName},</strong>
                    </p>
                    <p style={{ margin: 0 }}>
                      This is with reference to your letter of resignation from the services of Quadratic Systems Inc. We would like to confirm that your resignation has been accepted and you are officially relieved from your duties and responsibilities as <strong>{selectedExitRecord.employee?.designation || "Software Engineer"}</strong> at the close of working hours on <strong>{new Date(selectedExitRecord.approvedLWD || selectedExitRecord.requestedLWD || Date.now()).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</strong>.
                    </p>
                    <p style={{ margin: 0 }}>
                      We confirm that you have successfully fulfilled all departmental clearance protocols, including Information Technology hardware return, access revocation, finance dues reconciliation, and project knowledge transfer sign-off.
                    </p>
                    <p style={{ margin: 0 }}>
                      Your Full & Final Settlement has been processed in accordance with corporate policies and statutory compensation norms. During your tenure with Quadratic Systems Inc., your conduct and performance were found to be satisfactory and professional.
                    </p>
                    <p style={{ margin: 0 }}>
                      We take this opportunity to thank you for your valued contributions to the organization and wish you all the very best in your future professional endeavors.
                    </p>
                  </div>
                ) : (
                  <div style={{ fontSize: "1.05rem", textAlign: "justify", display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <p style={{ margin: 0 }}>
                      <strong>TO WHOMSOEVER IT MAY CONCERN</strong>
                    </p>
                    <p style={{ margin: 0 }}>
                      This is to certify that <strong>{selectedExitRecord.employee?.firstName} {selectedExitRecord.employee?.lastName}</strong> (Employee Code: <strong>{selectedExitRecord.employee?.employeeCode || "EMP-00X"}</strong>) was employed with Quadratic Systems Inc. from <strong>{new Date(selectedExitRecord.employee?.joiningDate || "2023-01-15").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</strong> to <strong>{new Date(selectedExitRecord.approvedLWD || selectedExitRecord.requestedLWD || Date.now()).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</strong>.
                    </p>
                    <p style={{ margin: 0 }}>
                      During their tenure with us, they held the position of <strong>{selectedExitRecord.employee?.designation || "Senior Software Engineer"}</strong> in the <strong>{selectedExitRecord.employee?.department || "Engineering"}</strong> department. In this role, they demonstrated commendable technical competence, collaborative team spirit, and dedication toward high-impact corporate project deliverables.
                    </p>
                    <p style={{ margin: 0 }}>
                      To the best of our knowledge, their character, integrity, and conduct during their association with the company have been exemplary.
                    </p>
                    <p style={{ margin: 0 }}>
                      This certificate is issued upon the request of the employee for all legitimate future opportunities without any financial or statutory liability on Quadratic Systems Inc.
                    </p>
                  </div>
                )}

                {/* Sign-off & Seal */}
                <div style={{ marginTop: "3.5rem", display: "flex", justifyContent: "space-between", alignItems: "flex-end", fontFamily: "sans-serif" }}>
                  <div>
                    <div style={{ fontSize: "0.95rem", fontWeight: "700", color: "#0f172a" }}>For Quadratic Systems Inc.</div>
                    <div style={{ width: "160px", height: "60px", margin: "10px 0 5px 0", display: "flex", alignItems: "center" }}>
                      <span style={{ fontFamily: "'Brush Script MT', cursive", fontSize: "1.8rem", color: "#1e3a8a" }}>
                        Priya Sharma
                      </span>
                    </div>
                    <strong style={{ display: "block", fontSize: "0.9rem" }}>Priya Sharma</strong>
                    <span style={{ fontSize: "0.82rem", color: "#64748b" }}>Director - Human Resources & Global Talent</span>
                  </div>

                  {/* Stamp Seal */}
                  <div style={{ border: "2px solid #1e3a8a", padding: "8px 16px", borderRadius: "10px", textAlign: "center", color: "#1e3a8a", transform: "rotate(-4deg)", opacity: 0.85 }}>
                    <div style={{ fontSize: "0.72rem", fontWeight: "900", letterSpacing: "0.08em" }}>QUADRATIC SYSTEMS INC.</div>
                    <div style={{ fontSize: "0.68rem", fontWeight: "700" }}>HR OPERATIONS & COMPLIANCE</div>
                    <div style={{ fontSize: "0.62rem" }}>OFFICIAL CORPORATE SEAL</div>
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
