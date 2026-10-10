import React, { useState, useMemo } from "react";
import EmployeeHeader from "../../components/employee/EmployeeHeader";
import { useEnterpriseOps } from "../../hooks/useEnterpriseOps";
import "./Helpdesk.css";

const AI_SUGGESTIONS = {
  monitor: "Hardware Replacement Ticket #HW-4092 logged with IT Support. A new Dell 27\" UltraSharp Monitor will be dispatched to your workstation by tomorrow 11:00 AM.",
  hardware: "IT Operations desk notified for replacement. Temporary loaner laptop/equipment allocated at Desk 4B.",
  remote: "As per Quad HR Policy Sec 4.2, 2 days/week remote work is permitted with manager sign-off. Your remote request for this Friday has been approved in the portal.",
  policy: "Corporate Policy Document HR-2026 attached. Remote work requests must be logged 24 hours in advance via the Employee Portal.",
  payroll: "Salary breakdown & Form 16 tax statement updated in your Employee Vault under Finance & Records tab.",
  leave: "Leave balance verified and approved. Attendance records adjusted automatically for the specified dates.",
};

const CATEGORIES = [
  "ALL",
  "IT Hardware & Equipment",
  "Payroll & Compensation",
  "Leave & Remote Work",
  "Workplace & Facilities",
  "General Inquiry",
];

export default function Helpdesk() {
  const { tickets, resolveTicket, addTicket } = useEnterpriseOps();
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [resolutionText, setResolutionText] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [notice, setNotice] = useState("");

  // New Ticket Modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [newEmpId, setNewEmpId] = useState("EMP-101");
  const [newQuery, setNewQuery] = useState("");
  const prevTicketCount = React.useRef(tickets.length);

  // Notify when a new ticket arrives
  React.useEffect(() => {
    if (tickets.length > prevTicketCount.current && prevTicketCount.current !== 0) {
      setNotice(`New HR Connect ticket received!`);
      setTimeout(() => setNotice(""), 4000);
    }
    prevTicketCount.current = tickets.length;
  }, [tickets.length]);

  // Auto-detect category helper
  const detectCategory = (query = "") => {
    const q = query.toLowerCase();
    if (q.includes("monitor") || q.includes("computer") || q.includes("hardware") || q.includes("laptop")) return "IT Hardware & Equipment";
    if (q.includes("remote") || q.includes("policy") || q.includes("leave") || q.includes("friday")) return "Leave & Remote Work";
    if (q.includes("salary") || q.includes("payroll") || q.includes("tax") || q.includes("payslip")) return "Payroll & Compensation";
    if (q.includes("desk") || q.includes("badge") || q.includes("access") || q.includes("facility")) return "Workplace & Facilities";
    return "General Inquiry";
  };

  // Auto-detect priority helper
  const detectPriority = (query = "") => {
    const q = query.toLowerCase();
    if (q.includes("broken") || q.includes("cannot code") || q.includes("urgent") || q.includes("error")) return { label: "High", theme: "high", icon: "🔥" };
    if (q.includes("remote") || q.includes("policy") || q.includes("friday")) return { label: "Medium", theme: "medium", icon: "⚡" };
    return { label: "Low", theme: "low", icon: "🟢" };
  };

  // Generate AI Suggestion based on query keywords
  const generateAiSuggestion = (query = "") => {
    const q = query.toLowerCase();
    for (const [key, text] of Object.entries(AI_SUGGESTIONS)) {
      if (q.includes(key)) return text;
    }
    return "Your HR ticket has been received and processed by HR Operations. The requested action has been updated in the system.";
  };

  const handleResolve = () => {
    if (!resolutionText.trim() || !selectedTicket) return;
    resolveTicket(selectedTicket.id, resolutionText);
    setNotice(`Ticket ${selectedTicket.id} marked as resolved & employee notified.`);
    setSelectedTicket(prev => prev ? { ...prev, status: "Resolved", resolution: resolutionText } : null);
    setTimeout(() => setNotice(""), 3500);
  };

  const handleCreateTicket = (e) => {
    e.preventDefault();
    if (!newQuery.trim()) return;
    const newId = addTicket(newEmpId, newQuery.trim());
    setNotice(`Created new ticket ${newId} for ${newEmpId}.`);
    setShowNewModal(false);
    setNewQuery("");
    setTimeout(() => setNotice(""), 3500);
  };

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      const q = t.query || "";
      const id = t.id || "";
      const emp = t.empId || "";
      const cat = detectCategory(q);

      const matchesSearch = id.toLowerCase().includes(search.toLowerCase()) || emp.toLowerCase().includes(search.toLowerCase()) || q.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "ALL" || t.status === statusFilter;
      const matchesCat = categoryFilter === "ALL" || cat === categoryFilter;

      return matchesSearch && matchesStatus && matchesCat;
    });
  }, [tickets, search, statusFilter, categoryFilter]);

  const openCount = tickets.filter(t => t.status === "Open").length;
  const resolvedCount = tickets.filter(t => t.status === "Resolved").length;

  return (
    <>
      <EmployeeHeader />
      <main className="helpdesk-hub-page">
        {/* Banner */}
        <header className="helpdesk-banner">
          <div>
            <span className="helpdesk-kicker">AI-Powered Workplace Service Desk</span>
            <h1>HR Support & Helpdesk Command Center</h1>
            <p>Resolve employee support requests, automate responses using HR AI intelligence, and monitor SLA response times.</p>
          </div>
          <button 
            type="button" 
            className="helpdesk-btn primary"
            onClick={() => setShowNewModal(true)}
          >
            ➕ Log New HR Ticket
          </button>
        </header>

        {/* KPI Metrics */}
        <section className="helpdesk-kpi-grid">
          <div className="helpdesk-kpi-card total">
            <span className="kpi-label">Total Support Tickets</span>
            <strong className="kpi-val">{tickets.length}</strong>
            <small className="kpi-sub">Received via AI Chatbot & Portal</small>
          </div>

          <div className="helpdesk-kpi-card open">
            <span className="kpi-label">⚡ Pending Open Tickets</span>
            <strong className="kpi-val">{openCount}</strong>
            <small className="kpi-sub">Awaiting HR Specialist Action</small>
          </div>

          <div className="helpdesk-kpi-card resolved">
            <span className="kpi-label">✅ Resolved & Closed</span>
            <strong className="kpi-val">{resolvedCount}</strong>
            <small className="kpi-sub">SLA Resolved & Employee Notified</small>
          </div>

          <div className="helpdesk-kpi-card sla">
            <span className="kpi-label">🤖 AI Resolution Rate</span>
            <strong className="kpi-val">98.4%</strong>
            <small className="kpi-sub">Avg Resolution Time: 4.2 mins</small>
          </div>
        </section>

        {/* Notice alert */}
        {notice && <div className="helpdesk-notice">✓ {notice}</div>}

        {/* Filter Toolbar */}
        <section className="helpdesk-toolbar">
          <input
            type="text"
            placeholder="Search tickets by ID, employee, category, or issue query..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="hd-search-input"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="hd-filter-select"
          >
            <option value="ALL">All Statuses</option>
            <option value="Open">Open Pending</option>
            <option value="Resolved">Resolved & Closed</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="hd-filter-select"
          >
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{c === "ALL" ? "All Categories" : c}</option>
            ))}
          </select>
        </section>

        {/* Workspace Split Layout */}
        <div className="helpdesk-workspace-grid">
          {/* Left: Ticket Cards Column */}
          <div className="ticket-cards-panel">
            <div className="panel-header-strip">
              <span>SUPPORT TICKETS INBOX</span>
              <strong>{filteredTickets.length} Tickets</strong>
            </div>

            <div className="ticket-cards-scroll">
              {filteredTickets.length > 0 ? (
                filteredTickets.map(ticket => {
                  const priority = detectPriority(ticket.query);
                  const category = detectCategory(ticket.query);
                  const isSelected = selectedTicket?.id === ticket.id;

                  return (
                    <div
                      key={ticket.id}
                      className={`ticket-card-box ${ticket.status.toLowerCase()} ${isSelected ? 'is-active' : ''}`}
                      onClick={() => {
                        setSelectedTicket(ticket);
                        setResolutionText(ticket.resolution || "");
                      }}
                    >
                      <div className="tcard-top">
                        <span className="tcard-id">{ticket.id}</span>
                        <div className="tcard-badges">
                          <span className={`priority-badge ${priority.theme}`}>
                            {priority.icon} {priority.label}
                          </span>
                          <span className={`status-pill ${ticket.status.toLowerCase()}`}>
                            {ticket.status === "Open" ? "⚡ Open" : "✓ Resolved"}
                          </span>
                        </div>
                      </div>

                      <div className="tcard-emp">
                        <span>Employee:</span>
                        <strong>{ticket.empId}</strong>
                        <small className="tcard-cat">{category}</small>
                      </div>

                      <p className="tcard-query">{ticket.query}</p>

                      <div className="tcard-footer">
                        <span>Channel: AI Chatbot</span>
                        <span className="action-hint">{isSelected ? "Viewing Details →" : "Click to view"}</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="helpdesk-empty-state">
                  <span>📭 No tickets matching current filters</span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Ticket Inspector Workspace */}
          <div className="ticket-inspector-panel">
            {selectedTicket ? (
              <div className="inspector-workspace">
                {/* Inspector Header */}
                <div className="inspector-header">
                  <div>
                    <div className="inspector-title-row">
                      <h2>Ticket {selectedTicket.id}</h2>
                      <span className={`status-pill ${selectedTicket.status.toLowerCase()}`}>
                        {selectedTicket.status === "Open" ? "⚡ Open Pending Action" : "✓ SLA Resolved & Closed"}
                      </span>
                    </div>
                    <p className="inspector-subtitle">Channel: AI Assistant Chatbot • Logged in HRMS Knowledge Base</p>
                  </div>

                  <div className="inspector-meta-pills">
                    <span className={`priority-badge ${detectPriority(selectedTicket.query).theme}`}>
                      {detectPriority(selectedTicket.query).icon} {detectPriority(selectedTicket.query).label} Priority
                    </span>
                  </div>
                </div>

                {/* Employee Dossier Strip */}
                <div className="employee-dossier-strip">
                  <div className="dossier-avatar">{selectedTicket.empId.slice(-3)}</div>
                  <div className="dossier-info">
                    <strong>Employee ID: {selectedTicket.empId}</strong>
                    <span>Department: Engineering & Product Operations • Active Roster</span>
                  </div>
                  <span className="dossier-badge">Verified Employee</span>
                </div>

                {/* Employee Query Box */}
                <div className="query-display-card">
                  <span className="card-label">📥 Employee Issue / Inquiry:</span>
                  <p className="query-text">{selectedTicket.query}</p>
                </div>

                {/* AI Recommended Auto-Response Banner */}
                {selectedTicket.status === "Open" && (
                  <div className="ai-suggestion-banner">
                    <div className="ai-banner-head">
                      <span>🤖 AI Assistant Recommended Resolution:</span>
                      <button
                        type="button"
                        className="ai-apply-btn"
                        onClick={() => setResolutionText(generateAiSuggestion(selectedTicket.query))}
                      >
                        ✨ Apply AI Resolution
                      </button>
                    </div>
                    <p className="ai-suggestion-text">{generateAiSuggestion(selectedTicket.query)}</p>
                  </div>
                )}

                {/* Resolution Workspace */}
                <div className="resolution-composer-card">
                  <span className="card-label">
                    {selectedTicket.status === "Resolved" ? "✅ Resolution Response Provided:" : "✏️ Compose Resolution Response:"}
                  </span>

                  {selectedTicket.status === "Resolved" ? (
                    <div className="resolved-receipt-box">
                      <p>{selectedTicket.resolution}</p>
                      <div className="receipt-footer">
                        <span>✓ Resolved by HR Specialist & Dispatched to Employee</span>
                        <small>Status: Closed</small>
                      </div>
                    </div>
                  ) : (
                    <>
                      <textarea
                        className="resolution-textarea"
                        placeholder="Type the official HR resolution response to close this support ticket..."
                        value={resolutionText}
                        onChange={(e) => setResolutionText(e.target.value)}
                      />

                      {/* Quick Template Buttons */}
                      <div className="quick-templates-strip">
                        <span className="template-label">Quick Response Presets:</span>
                        <div className="template-chips">
                          <button
                            type="button"
                            className="template-btn"
                            onClick={() => setResolutionText(AI_SUGGESTIONS.monitor)}
                          >
                            🖥️ Hardware Replacement
                          </button>
                          <button
                            type="button"
                            className="template-btn"
                            onClick={() => setResolutionText(AI_SUGGESTIONS.remote)}
                          >
                            🌴 Remote Work Approved
                          </button>
                          <button
                            type="button"
                            className="template-btn"
                            onClick={() => setResolutionText(AI_SUGGESTIONS.payroll)}
                          >
                            💰 Payroll Vault Updated
                          </button>
                        </div>
                      </div>

                      <div className="composer-actions">
                        <button
                          type="button"
                          className="helpdesk-btn primary"
                          onClick={handleResolve}
                          disabled={!resolutionText.trim()}
                        >
                          ✅ Mark as Resolved & Send Response
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="inspector-empty-state">
                <span className="empty-icon">📥</span>
                <h3>Select a Ticket to View Inspector Workspace</h3>
                <p>Choose an open or resolved support ticket from the left panel to review details, inspect employee inquiry, and compose responses using AI assistance.</p>
              </div>
            )}
          </div>
        </div>

        {/* Log New Ticket Modal */}
        {showNewModal && (
          <div className="hd-modal-backdrop" onClick={() => setShowNewModal(false)}>
            <form className="hd-modal-card" onSubmit={handleCreateTicket} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <span className="helpdesk-kicker">HR Support Desk</span>
                  <h2>Log New HR Support Ticket</h2>
                </div>
                <button type="button" className="close-btn" onClick={() => setShowNewModal(false)}>×</button>
              </div>

              <div className="modal-body">
                <label className="form-field">
                  <span>Employee ID *</span>
                  <select
                    value={newEmpId}
                    onChange={(e) => setNewEmpId(e.target.value)}
                    required
                  >
                    <option value="EMP-101">EMP-101 • Aisha Sharma</option>
                    <option value="EMP-102">EMP-102 • Rohan Das</option>
                    <option value="EMP-103">EMP-103 • Sneha Patel</option>
                    <option value="EMP-104">EMP-104 • Karan Singh</option>
                    <option value="EM0175">EM0175 • Kushangala Sai Kiran</option>
                  </select>
                </label>

                <label className="form-field">
                  <span>Employee Query / Support Issue *</span>
                  <textarea
                    rows={4}
                    required
                    placeholder="Describe the employee query or hardware issue..."
                    value={newQuery}
                    onChange={(e) => setNewQuery(e.target.value)}
                  />
                </label>
              </div>

              <div className="modal-footer">
                <button type="submit" className="helpdesk-btn primary">Create Ticket</button>
                <button type="button" className="helpdesk-btn secondary" onClick={() => setShowNewModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        )}
      </main>
    </>
  );
}
