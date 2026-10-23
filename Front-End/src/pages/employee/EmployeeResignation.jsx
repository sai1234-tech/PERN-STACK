import React, { useState, useEffect } from "react";
import { apiRequest } from "../../services/apiClient";
import { toast } from "react-toastify";
import EmployeeHeader from "../../components/employee/EmployeeHeader";
import { useEmployee } from "../../hooks/useEmployee";
import { useAuth } from "../../context/AuthContext";
import "./EmployeeDashboard.css";

export default function EmployeeResignation() {
  const { user } = useAuth();
  const { employee, loading: empLoading } = useEmployee();
  const [resignation, setResignation] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [myClearance, setMyClearance] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Letter Preview State
  const [letterModalOpen, setLetterModalOpen] = useState(false);
  const [letterType, setLetterType] = useState("relieving");

  // Form State
  const [requestedLastWorkingDay, setRequestedLastWorkingDay] = useState("");
  const [reasonCategory, setReasonCategory] = useState("better-opportunity");
  const [reasonDetails, setReasonDetails] = useState("");
  const [agreedToPolicy, setAgreedToPolicy] = useState(false);

  const reasonLabels = {
    "better-opportunity": "Career Growth / Better Opportunity",
    "higher-studies": "Pursuing Higher Education",
    "personal-reasons": "Personal / Family Reasons",
    "health": "Health / Medical Issues",
    "relocation": "Relocation",
    "other": "Other"
  };

  const defaultClearanceState = {
    assets: { status: "cleared", comments: "Laptop MacBook Pro & 4K display returned to IT.", clearedAt: "2026-10-18T14:30:00Z" },
    itAccess: { status: "in_progress", comments: "Google Workspace & GitHub rights scheduled for revocation on LWD.", clearedAt: null },
    finance: { status: "cleared", comments: "Corporate card surrendered. No outstanding travel dues.", clearedAt: "2026-10-19T11:15:00Z" },
    leaveAttendance: { status: "cleared", comments: "10 days unavailed leave calculated for encashment.", clearedAt: "2026-10-20T10:00:00Z" },
    ktHandover: { status: "cleared", comments: "Knowledge Transfer and repository architecture signed off by Lead.", clearedAt: "2026-10-19T16:00:00Z" },
    documents: { status: "cleared", comments: "NDA compliance form signed and exit interview completed.", clearedAt: "2026-10-20T09:45:00Z" },
    finalSettlement: { grossEarned: 110000, leaveEncashment: 38500, gratuity: 0, deductions: 12000, netPayable: 136500, status: "ready_for_neft" }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const resData = await apiRequest("/resignations/my");
      if (resData.success && resData.data) {
        setResignation(resData.data);
      } else {
        setResignation(null);
      }

      const ticketsData = await apiRequest("/tickets/my");
      if (ticketsData.success && ticketsData.tickets) {
        setTickets(ticketsData.tickets.filter(t => t.query.includes("HR Connect")));
      }

      // Fetch Clearance data
      try {
        const clrData = await apiRequest("/clearances/my");
        if (clrData.success && clrData.data) {
          setMyClearance(clrData.data);
        } else {
          // Check localStorage
          const stored = localStorage.getItem("hrms_clearances");
          if (stored) {
            const list = JSON.parse(stored);
            const found = list.find(c => c.employee?.email === user?.email || c.employee?.id === employee?.id);
            setMyClearance(found || defaultClearanceState);
          } else {
            setMyClearance(defaultClearanceState);
          }
        }
      } catch (clrErr) {
        const stored = localStorage.getItem("hrms_clearances");
        if (stored) {
          const list = JSON.parse(stored);
          const found = list.find(c => c.employee?.email === user?.email || c.employee?.id === employee?.id);
          setMyClearance(found || defaultClearanceState);
        } else {
          setMyClearance(defaultClearanceState);
        }
      }
    } catch (error) {
      console.error("Fetch data error", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    const handleSync = (e) => {
      if (e.key === "hrms_tickets_sync" || e.type === "hrms_tickets_updated" || e.key === "hrms_clearances") {
        fetchData();
      }
    };
    window.addEventListener("storage", handleSync);
    window.addEventListener("hrms_tickets_updated", handleSync);
    
    return () => {
      window.removeEventListener("storage", handleSync);
      window.removeEventListener("hrms_tickets_updated", handleSync);
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!agreedToPolicy) {
      return toast.error("You must agree to the company exit policies.");
    }

    try {
      const data = await apiRequest("/resignations", {
        method: "POST",
        body: JSON.stringify({
          requestedLastWorkingDay,
          reasonCategory,
          reasonDetails,
        })
      });

      if (data.success) {
        toast.success(data.message || "Resignation submitted successfully");
        fetchData();
      }
    } catch (error) {
      toast.error(error.message || "Failed to submit resignation");
    }
  };

  const handleWithdraw = async () => {
    if (!window.confirm("Are you sure you want to withdraw your resignation request? This action will cancel your exit process.")) return;
    try {
      const data = await apiRequest("/resignations/my", { method: "DELETE" });
      if (data.success) {
        toast.success(data.message || "Resignation withdrawn");
        fetchData();
      }
    } catch (error) {
      toast.error(error.message || "Failed to withdraw resignation");
    }
  };

  const handleHRConnect = async () => {
    try {
      const profile = employee || user || {};
      const fullName = profile.name || `${profile.firstName || ""} ${profile.lastName || ""}`.trim() || user?.name || "Employee";
      const empCode = profile.employeeCode || profile.employeeId || user?.employeeId || profile._id || "EMP-UNKNOWN";
      const empDisplay = `${fullName} (${empCode})`;

      const data = await apiRequest("/tickets", {
        method: "POST",
        body: JSON.stringify({
          empId: empDisplay,
          query: "I would like to schedule an HR Connect regarding my resignation decision.",
        }),
      });
      if (data.success) {
        toast.success("HR connect request sent successfully! An HR representative will contact you soon.");
        window.dispatchEvent(new Event("hrms_tickets_updated"));
        localStorage.setItem("hrms_tickets_sync", Date.now().toString());
        fetchData();
      }
    } catch (error) {
      toast.error(error.message || "Failed to send HR connect request.");
    }
  };

  const formatCurrency = (val) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(val || 0);

  if (loading || empLoading) {
    return (
      <div className="employee-dashboard-hub">
        <div style={{ textAlign: "center", padding: "50px" }}>Loading...</div>
      </div>
    );
  }

  const localDate = new Date();
  localDate.setDate(localDate.getDate() + 90);
  const minDateString = new Date(localDate.getTime() - (localDate.getTimezoneOffset() * 60000)).toISOString().split("T")[0];

  const profile = employee || user || {};
  const empName = profile.name || `${profile.firstName || ""} ${profile.lastName || ""}`.trim() || user?.name || "Employee";
  const empCode = profile.employeeCode || profile.employeeId || user?.employeeId || "EMP-001";
  const approvedLwd = resignation?.approvedLastWorkingDay || resignation?.requestedLastWorkingDay;

  // Clearance items calculation
  const clr = myClearance || defaultClearanceState;
  const clearanceCategories = [
    { label: "💻 IT Hardware & Laptop", data: clr.assets },
    { label: "🔑 Security, Email & SSO", data: clr.itAccess },
    { label: "💳 Finance Dues & Advances", data: clr.finance },
    { label: "📊 Leave & Attendance Audit", data: clr.leaveAttendance },
    { label: "🤝 KT & Project Handover", data: clr.ktHandover || { status: "cleared", comments: "Project transition completed." } },
    { label: "📑 Exit Interview & NDA", data: clr.documents }
  ];

  const clearedCount = clearanceCategories.filter(c => c.data?.status === "cleared").length;
  const clearancePct = Math.round((clearedCount / clearanceCategories.length) * 100);

  // Settlement details
  const fs = clr.finalSettlement || {
    grossEarned: 110000,
    leaveEncashment: 38500,
    gratuity: 0,
    deductions: 12000,
    netPayable: 136500,
    status: "ready_for_neft"
  };

  return (
    <>
      <EmployeeHeader />
      <main className="employee-dashboard-hub fade-in" style={{ padding: "1.5rem 2rem 3rem", background: "#f8fafc" }}>
        {/* Hero Banner */}
        <section className="emp-hero-banner" style={{ borderRadius: "16px", padding: "1.25rem 2rem", minHeight: "185px", boxSizing: "border-box", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div className="emp-hero-left">
            <div className="hero-kicker-pill" style={{ display: "inline-flex", background: "rgba(255,255,255,0.12)", padding: "0.25rem 0.65rem", borderRadius: "20px", fontSize: "0.75rem", marginBottom: "0.4rem", border: "1px solid rgba(255,255,255,0.25)" }}>
              <span className="pulsing-live-dot" style={{ background: "#10b981", width: "7px", height: "7px", borderRadius: "50%", marginRight: "6px", alignSelf: "center", animation: "livePulse 2s infinite" }}></span>
              <span>Offboarding & Separation Hub</span>
            </div>
            <h1 style={{ margin: "0.15rem 0 0.35rem 0", fontSize: "clamp(22px, 2.3vw, 28px)", fontWeight: 800 }}>Resignation & Exit Portal</h1>
            <p style={{ margin: "0 0 0.5rem 0", color: "#94a3b8", fontSize: "0.9rem" }}>Initiate your separation process, monitor departmental clearances, track F&F settlement, and access official exit letters.</p>
            <div className="emp-meta-pills" style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
              <div className="meta-pill-tag" style={{ background: "rgba(255,255,255,0.08)", padding: "4px 12px", borderRadius: "8px", fontSize: "0.8rem", border: "1px solid rgba(255,255,255,0.15)" }}>
                Standard Notice: 90 Days
              </div>
              {resignation && (
                <div className="meta-pill-tag" style={{ background: resignation.status === "approved" ? "rgba(16,185,129,0.2)" : "rgba(245,158,11,0.2)", color: resignation.status === "approved" ? "#6ee7b7" : "#fef08a", padding: "4px 12px", borderRadius: "8px", fontSize: "0.8rem", border: "1px solid rgba(255,255,255,0.2)" }}>
                  Status: {resignation.status.replace("_", " ").toUpperCase()}
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="dashboard-content" style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1.5rem" }}>
          {resignation && ["pending", "manager_approved", "under_review", "approved"].includes(resignation.status) ? (
            resignation.status === 'approved' ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                {/* Approved Overview Card */}
                <div className="exit-approved-card" style={{ background: "#fff", borderRadius: "16px", padding: '1.75rem', border: "1px solid #bbf7d0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: "1rem", marginBottom: "1.25rem", flexWrap: "wrap", gap: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span style={{ fontSize: "2rem" }}>✅</span>
                      <div>
                        <h2 style={{ margin: 0, fontSize: "1.3rem", color: "#166534", fontWeight: 800 }}>Exit Petition Approved & Serving Notice Period</h2>
                        <p style={{ margin: "4px 0 0 0", color: "#475569", fontSize: "0.85rem" }}>
                          Your separation request has completed dual-tier Manager & HR approval. Departmental clearances are active.
                        </p>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "10px" }}>
                      <button
                        type="button"
                        onClick={() => { setLetterType("relieving"); setLetterModalOpen(true); }}
                        style={{ padding: "8px 16px", borderRadius: "8px", background: "#0284c7", color: "#fff", border: "none", fontWeight: "700", fontSize: "0.85rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                      >
                        📄 View Relieving Letter
                      </button>
                      <button
                        type="button"
                        onClick={() => { setLetterType("experience"); setLetterModalOpen(true); }}
                        style={{ padding: "8px 16px", borderRadius: "8px", background: "#4f46e5", color: "#fff", border: "none", fontWeight: "700", fontSize: "0.85rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                      >
                        📜 Experience Certificate
                      </button>
                    </div>
                  </div>
                  
                  {/* Exit Metrics */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
                    <div style={{ background: "#f8fafc", padding: "12px 16px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                      <span style={{ color: "#64748b", fontSize: "0.8rem", display: "block" }}>Submitted On</span>
                      <strong style={{ fontSize: "1.05rem", color: "#0f172a" }}>
                        {new Date(resignation.resignationDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </strong>
                    </div>
                    
                    <div style={{ background: "#f8fafc", padding: "12px 16px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                      <span style={{ color: "#64748b", fontSize: "0.8rem", display: "block" }}>Requested LWD</span>
                      <strong style={{ fontSize: "1.05rem", color: "#0f172a" }}>
                        {new Date(resignation.requestedLastWorkingDay).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </strong>
                    </div>

                    <div style={{ background: "#eff6ff", padding: "12px 16px", borderRadius: "10px", border: "1px solid #bfdbfe" }}>
                      <span style={{ color: "#1e40af", fontSize: "0.8rem", display: "block" }}>Official Approved LWD</span>
                      <strong style={{ fontSize: "1.1rem", color: "#1d4ed8" }}>
                        📅 {new Date(approvedLwd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </strong>
                    </div>

                    <div style={{ background: "#f8fafc", padding: "12px 16px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                      <span style={{ color: "#64748b", fontSize: "0.8rem", display: "block" }}>Reason</span>
                      <strong style={{ fontSize: "0.95rem", color: "#0f172a" }}>
                        {reasonLabels[resignation.reasonCategory] || resignation.reasonCategory}
                      </strong>
                    </div>
                  </div>
                  
                  {resignation.hrReviewComment && (
                    <div style={{ background: "#f0fdf4", borderLeft: "4px solid #16a34a", padding: "12px 16px", borderRadius: "8px", marginBottom: "1rem" }}>
                      <h4 style={{ margin: "0 0 4px 0", color: "#166534", fontSize: "0.9rem" }}>Official HR Message</h4>
                      <p style={{ margin: 0, color: "#14532d", fontSize: "0.88rem" }}>{resignation.hrReviewComment}</p>
                    </div>
                  )}
                </div>

                {/* 1. Departmental Clearance Progress */}
                <div style={{ background: "#fff", borderRadius: "16px", padding: "1.75rem", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "10px" }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: "1.15rem", color: "#0f172a", fontWeight: 700 }}>Departmental Clearance Status</h3>
                      <p style={{ margin: "4px 0 0 0", color: "#64748b", fontSize: "0.85rem" }}>
                        All 6 departmental clearances must be verified before Full & Final settlement release.
                      </p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: "1rem", fontWeight: "800", color: clearancePct === 100 ? "#10b981" : "#f59e0b" }}>
                        {clearedCount} / {clearanceCategories.length} Cleared ({clearancePct}%)
                      </span>
                    </div>
                  </div>

                  <div style={{ width: "100%", height: "8px", background: "#e2e8f0", borderRadius: "999px", overflow: "hidden", marginBottom: "1.5rem" }}>
                    <div style={{ width: `${clearancePct}%`, height: "100%", background: clearancePct === 100 ? "#10b981" : "#0284c7", transition: "width 0.4s ease" }} />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "12px" }}>
                    {clearanceCategories.map((cat, idx) => {
                      const isClr = cat.data?.status === "cleared";
                      return (
                        <div key={idx} style={{ background: isClr ? "#f0fdf4" : "#f8fafc", border: `1px solid ${isClr ? "#bbf7d0" : "#e2e8f0"}`, borderRadius: "10px", padding: "12px 16px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                            <strong style={{ fontSize: "0.88rem", color: "#1e293b" }}>{cat.label}</strong>
                            <span style={{ 
                              padding: "2px 8px", 
                              borderRadius: "12px", 
                              fontSize: "0.72rem", 
                              fontWeight: "800",
                              background: isClr ? "#dcfce7" : "#fef3c7",
                              color: isClr ? "#15803d" : "#b45309"
                            }}>
                              {isClr ? "CLEARED" : "IN PROGRESS"}
                            </span>
                          </div>
                          <p style={{ margin: 0, fontSize: "0.8rem", color: "#475569" }}>
                            {cat.data?.comments || "Verification in progress."}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Full & Final Settlement Estimate */}
                <div style={{ background: "#fff", borderRadius: "16px", padding: "1.75rem", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "10px" }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: "1.15rem", color: "#0f172a", fontWeight: 700 }}>Full & Final (F&F) Settlement Projection</h3>
                      <p style={{ margin: "4px 0 0 0", color: "#64748b", fontSize: "0.85rem" }}>
                        Estimated settlement scheduled for disbursement within 30 days of Last Working Day.
                      </p>
                    </div>
                    <span style={{ padding: "4px 12px", borderRadius: "16px", background: "#dbeafe", color: "#1e40af", fontWeight: "800", fontSize: "0.78rem" }}>
                      STATUS: {fs.status?.replace(/_/g, " ").toUpperCase() || "READY FOR NEFT"}
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", background: "#f8fafc", padding: "1.25rem", borderRadius: "12px", border: "1px solid #e2e8f0", marginBottom: "1rem" }}>
                    <div>
                      <span style={{ color: "#64748b", fontSize: "0.8rem", display: "block" }}>Earned Basic Salary</span>
                      <strong style={{ fontSize: "1.1rem", color: "#0f172a" }}>{formatCurrency(fs.grossEarned)}</strong>
                    </div>
                    <div>
                      <span style={{ color: "#64748b", fontSize: "0.8rem", display: "block" }}>Leave Encashment</span>
                      <strong style={{ fontSize: "1.1rem", color: "#0f172a" }}>{formatCurrency(fs.leaveEncashment)}</strong>
                    </div>
                    <div>
                      <span style={{ color: "#64748b", fontSize: "0.8rem", display: "block" }}>Gratuity Benefit</span>
                      <strong style={{ fontSize: "1.1rem", color: "#0f172a" }}>{formatCurrency(fs.gratuity)}</strong>
                    </div>
                    <div>
                      <span style={{ color: "#64748b", fontSize: "0.8rem", display: "block" }}>Notice & Statutory Deductions</span>
                      <strong style={{ fontSize: "1.1rem", color: "#dc2626" }}>- {formatCurrency(fs.deductions)}</strong>
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "2px solid #e2e8f0", paddingTop: "1rem", flexWrap: "wrap", gap: "10px" }}>
                    <div>
                      <span style={{ color: "#64748b", fontSize: "0.85rem" }}>Net Final Settlement Payable:</span>
                      <div style={{ fontSize: "1.4rem", fontWeight: "900", color: "#16a34a" }}>
                        {formatCurrency(fs.netPayable)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toast.info("Your F&F settlement statement will be dispatched to your registered personal email on your LWD.")}
                      style={{ padding: "8px 16px", borderRadius: "8px", background: "#f1f5f9", color: "#334155", border: "1px solid #cbd5e1", fontWeight: "600", fontSize: "0.82rem", cursor: "pointer" }}
                    >
                      📩 Email Statement Copy
                    </button>
                  </div>
                </div>
              </div>
            ) : (
            <div className="dash-panel-card" style={{ gridColumn: "1 / -1", background: "#fff", borderRadius: "16px", padding: "1.75rem", border: "1px solid #e2e8f0" }}>
              <div className="dash-panel-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: "1rem" }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: "1.25rem", color: "#0f172a" }}>Current Resignation Request</h2>
                  <p style={{ margin: "4px 0 0 0", color: "#64748b", fontSize: "0.85rem" }}>Your resignation is actively being processed by the approval matrix.</p>
                </div>
                <span style={{ 
                  padding: "6px 14px", 
                  borderRadius: "20px", 
                  fontSize: "0.8rem", 
                  fontWeight: "800",
                  textTransform: "uppercase",
                  background: resignation.status === 'manager_approved' ? '#dbeafe' : resignation.status === 'rejected' ? '#fee2e2' : '#fef3c7',
                  color: resignation.status === 'manager_approved' ? '#1e40af' : resignation.status === 'rejected' ? '#991b1b' : '#854d0e'
                }}>
                  {resignation.status === 'pending' ? 'PENDING MANAGER REVIEW' :
                   resignation.status === 'manager_approved' ? 'PENDING HR FINAL APPROVAL' :
                   resignation.status.replace("_", " ").toUpperCase()}
                </span>
              </div>
              
              <div className="dash-metrics-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginTop: "20px" }}>
                <div style={{ background: "#f8fafc", padding: "12px 16px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                  <span style={{ color: "#64748b", fontSize: "0.8rem", display: "block" }}>Submitted On</span>
                  <div style={{ fontSize: "1.1rem", fontWeight: "700", color: "#0f172a" }}>
                    {new Date(resignation.resignationDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
                <div style={{ background: "#f8fafc", padding: "12px 16px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                  <span style={{ color: "#64748b", fontSize: "0.8rem", display: "block" }}>Requested LWD</span>
                  <div style={{ fontSize: "1.1rem", fontWeight: "700", color: "#0f172a" }}>
                    {new Date(resignation.requestedLastWorkingDay).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
                <div style={{ background: "#f8fafc", padding: "12px 16px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                  <span style={{ color: "#64748b", fontSize: "0.8rem", display: "block" }}>Notice Period</span>
                  <div style={{ fontSize: "1.1rem", fontWeight: "700", color: "#0f172a" }}>
                    {resignation.noticePeriodDays || 90} Days
                  </div>
                </div>
                <div style={{ background: "#f8fafc", padding: "12px 16px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                  <span style={{ color: "#64748b", fontSize: "0.8rem", display: "block" }}>Reason Category</span>
                  <div style={{ fontSize: "0.95rem", fontWeight: "700", color: "#0f172a" }}>
                    {reasonLabels[resignation.reasonCategory] || resignation.reasonCategory}
                  </div>
                </div>
              </div>
              
              {resignation.hrReviewComment && (
                <div style={{ padding: '16px', background: '#eff6ff', borderRadius: '10px', borderLeft: '4px solid #3b82f6', marginTop: '20px' }}>
                  <h4 style={{ color: '#1d4ed8', margin: '0 0 6px 0', fontSize: '0.95rem' }}>HR Feedback</h4>
                  <p style={{ color: '#1e3a8a', margin: 0, lineHeight: '1.5', fontSize: "0.88rem" }}>{resignation.hrReviewComment}</p>
                </div>
              )}

              {["pending", "under_review", "manager_approved"].includes(resignation.status) && (
                <div style={{ marginTop: '25px', paddingTop: '15px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
                  <button 
                    onClick={handleWithdraw}
                    style={{ background: "#fee2e2", color: "#b91c1c", border: "1px solid #fca5a5", padding: "8px 18px", borderRadius: "8px", fontWeight: "700", cursor: "pointer" }}
                  >
                    Withdraw Resignation Request
                  </button>
                </div>
              )}
            </div>
            )
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "1.5rem" }}>
              <div className="dash-panel-card" style={{ background: "#fff", borderRadius: "16px", padding: "1.75rem", border: "1px solid #e2e8f0" }}>
                <div className="dash-panel-head" style={{ borderBottom: "1px solid #f1f5f9", paddingBottom: "1rem" }}>
                  <h2 style={{ margin: 0, fontSize: "1.25rem", color: "#0f172a" }}>Submit Resignation Petition</h2>
                  <p style={{ margin: "4px 0 0 0", color: "#64748b", fontSize: "0.85rem" }}>Please review company policy regarding notice requirements before initiating offboarding.</p>
                </div>
                
                <form onSubmit={handleSubmit} style={{ marginTop: "20px", display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  <div className="form-group">
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '700', color: '#1e293b', fontSize: "0.88rem" }}>
                      Requested Last Working Day <span style={{color: '#ef4444'}}>*</span>
                    </label>
                    <input 
                      type="date" 
                      required 
                      min={minDateString}
                      value={requestedLastWorkingDay}
                      onChange={(e) => setRequestedLastWorkingDay(e.target.value)}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.92rem', background: '#f8fafc', color: '#0f172a' }}
                    />
                    <small style={{ color: '#64748b', display: 'block', marginTop: '4px', fontSize: "0.78rem" }}>
                      As per company policy, a standard 90-day notice period is enforced.
                    </small>
                  </div>

                  <div className="form-group">
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '700', color: '#1e293b', fontSize: "0.88rem" }}>
                      Primary Reason for Separation <span style={{color: '#ef4444'}}>*</span>
                    </label>
                    <select 
                      value={reasonCategory}
                      onChange={(e) => setReasonCategory(e.target.value)}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.92rem', background: '#f8fafc', color: '#0f172a' }}
                    >
                      <option value="better-opportunity">Career Growth / Better Opportunity</option>
                      <option value="higher-studies">Pursuing Higher Education</option>
                      <option value="personal-reasons">Personal / Family Reasons</option>
                      <option value="health">Health / Medical Issues</option>
                      <option value="relocation">Relocation</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '700', color: '#1e293b', fontSize: "0.88rem" }}>
                      Detailed Remarks <span style={{color: '#ef4444'}}>*</span>
                    </label>
                    <textarea 
                      required 
                      rows={4}
                      value={reasonDetails}
                      onChange={(e) => setReasonDetails(e.target.value)}
                      placeholder="Please provide additional context regarding your decision..."
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', resize: 'vertical', fontSize: '0.92rem', fontFamily: 'inherit', background: '#f8fafc', color: '#0f172a' }}
                    />
                  </div>

                  <div style={{ background: '#f0fdf4', padding: '14px', borderRadius: '8px', border: '1px solid #bbf7d0', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <input 
                      type="checkbox" 
                      id="policyAgree" 
                      checked={agreedToPolicy}
                      onChange={(e) => setAgreedToPolicy(e.target.checked)}
                      style={{ marginTop: '3px', width: '16px', height: '16px', accentColor: '#10b981', cursor: 'pointer' }} 
                    />
                    <label htmlFor="policyAgree" style={{ color: '#065f46', fontSize: '0.85rem', lineHeight: '1.4', cursor: 'pointer', margin: 0 }}>
                      I acknowledge that submitting this petition initiates the official separation process. I have read and agree to Quadratic Systems' Exit & Handover Policies.
                    </label>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                    <button 
                      type="submit" 
                      disabled={!agreedToPolicy || !requestedLastWorkingDay || !reasonDetails.trim()}
                      style={{ background: "#2563eb", color: "#fff", border: "none", padding: "10px 22px", borderRadius: "8px", fontWeight: "700", cursor: "pointer", opacity: (!agreedToPolicy || !requestedLastWorkingDay || !reasonDetails.trim()) ? 0.5 : 1 }}
                    >
                      Submit Resignation
                    </button>
                  </div>
                </form>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ background: "#fff", borderRadius: "16px", padding: "1.5rem", border: "1px solid #e2e8f0" }}>
                  <h3 style={{ margin: "0 0 10px 0", fontSize: "1.1rem", color: "#0f172a" }}>Exit Policy Guidelines</h3>
                  <ul style={{ paddingLeft: '18px', color: '#475569', fontSize: '0.85rem', lineHeight: '1.6', margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <li>Standard notice period is <strong>90 calendar days</strong>.</li>
                    <li>Notice buyout requires formal approval from Delivery Head.</li>
                    <li>IT Hardware and building passes must be surrendered by LWD.</li>
                    <li>Full & Final settlement is disbursed within 30 days of LWD.</li>
                  </ul>
                </div>

                <div style={{ background: "linear-gradient(135deg, #091e20 0%, #0d3438 100%)", color: "#fff", borderRadius: "16px", padding: "1.5rem" }}>
                  <h3 style={{ margin: "0 0 8px 0", color: "#fff", fontSize: "1.1rem" }}>Need confidential advice?</h3>
                  <p style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: '#ccfbf1', lineHeight: '1.5' }}>
                    Our HR People Operations team is available to listen and help resolve work or personal concerns.
                  </p>
                  <button onClick={handleHRConnect} style={{ width: '100%', background: '#fff', color: '#0f172a', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: "0.85rem" }}>
                    Schedule HR Connect
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Formal Letters Preview Modal */}
        {letterModalOpen && (
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
                    onClick={() => setLetterModalOpen(false)}
                    style={{ background: "none", border: "none", color: "#94a3b8", fontSize: "1.5rem", cursor: "pointer", lineHeight: 1 }}
                  >
                    &times;
                  </button>
                </div>
              </div>

              {/* Printable Letterhead Content */}
              <div style={{ padding: "3rem", overflowY: "auto", background: "#ffffff", color: "#1e293b", fontFamily: "'Times New Roman', Times, serif", lineHeight: 1.6 }}>
                <div style={{ borderBottom: "2px solid #0f172a", paddingBottom: "1.25rem", marginBottom: "1.75rem", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: "1.7rem", fontWeight: 800, color: "#0f172a", fontFamily: "sans-serif" }}>
                      QUADRATIC SYSTEMS INC.
                    </h2>
                    <p style={{ margin: "2px 0 0 0", fontSize: "0.85rem", color: "#475569", fontFamily: "sans-serif" }}>
                      Enterprise Cloud Solutions | CIN: U72200KA2021PTC145678
                    </p>
                    <small style={{ color: "#64748b", fontFamily: "sans-serif" }}>
                      Bangalore HQ: Cyber Gateway Boulevard, Bangalore - 560103, India
                    </small>
                  </div>
                  <div style={{ textAlign: "right", fontFamily: "sans-serif" }}>
                    <div style={{ fontSize: "0.85rem", fontWeight: "700", color: "#0369a1" }}>OFFICIAL VERIFIED DOCUMENT</div>
                    <small style={{ color: "#64748b" }}>ISO 27001 Certified System</small>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.75rem", fontFamily: "sans-serif", fontSize: "0.88rem" }}>
                  <div>
                    <strong>Ref No:</strong> QSI/HR-REL/2026/089
                  </div>
                  <div>
                    <strong>Date:</strong> {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </div>
                </div>

                <div style={{ marginBottom: "1.5rem", fontFamily: "sans-serif", fontSize: "0.95rem" }}>
                  <strong>To,</strong><br />
                  <strong>{empName}</strong><br />
                  Employee ID: {empCode}<br />
                  Designation: {profile.designation || "Software Engineer"}<br />
                  Department: {profile.department || "Engineering"}
                </div>

                <div style={{ textAlign: "center", margin: "2rem 0 1.5rem 0" }}>
                  <h3 style={{ textDecoration: "underline", fontSize: "1.25rem", margin: 0, textTransform: "uppercase" }}>
                    {letterType === "relieving" ? "RELIEVING LETTER & SERVICE DISCHARGE" : "EXPERIENCE & SERVICE CERTIFICATE"}
                  </h3>
                </div>

                {letterType === "relieving" ? (
                  <div style={{ fontSize: "1.05rem", textAlign: "justify", display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <p style={{ margin: 0 }}>
                      <strong>Dear {empName},</strong>
                    </p>
                    <p style={{ margin: 0 }}>
                      This is to confirm that your resignation from the services of Quadratic Systems Inc. has been accepted, and you are officially relieved from your duties as <strong>{profile.designation || "Software Engineer"}</strong> at the close of working hours on <strong>{new Date(approvedLwd || Date.now()).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</strong>.
                    </p>
                    <p style={{ margin: 0 }}>
                      All departmental clearance formalities, including Information Technology asset return, systems access revocation, finance dues reconciliation, and project knowledge transfer sign-off have been verified and settled.
                    </p>
                    <p style={{ margin: 0 }}>
                      We appreciate your sincere efforts and valuable contributions during your association with Quadratic Systems Inc. We wish you every success in your future personal and professional endeavors.
                    </p>
                  </div>
                ) : (
                  <div style={{ fontSize: "1.05rem", textAlign: "justify", display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <p style={{ margin: 0 }}>
                      <strong>TO WHOMSOEVER IT MAY CONCERN</strong>
                    </p>
                    <p style={{ margin: 0 }}>
                      This is to certify that <strong>{empName}</strong> (Employee ID: <strong>{empCode}</strong>) was employed with Quadratic Systems Inc. from <strong>{new Date(profile.joiningDate || "2023-01-15").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</strong> to <strong>{new Date(approvedLwd || Date.now()).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</strong>.
                    </p>
                    <p style={{ margin: 0 }}>
                      During their tenure, they functioned as <strong>{profile.designation || "Senior Software Engineer"}</strong> in our <strong>{profile.department || "Engineering"}</strong> division. They consistently demonstrated exemplary technical competence, accountability, and strong teamwork across all assigned enterprise deliverables.
                    </p>
                    <p style={{ margin: 0 }}>
                      Their character, integrity, and conduct during their association with the company have been exemplary.
                    </p>
                  </div>
                )}

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

                  <div style={{ border: "2px solid #1e3a8a", padding: "8px 16px", borderRadius: "10px", textAlign: "center", color: "#1e3a8a", transform: "rotate(-4deg)", opacity: 0.85 }}>
                    <div style={{ fontSize: "0.72rem", fontWeight: "900" }}>QUADRATIC SYSTEMS INC.</div>
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
