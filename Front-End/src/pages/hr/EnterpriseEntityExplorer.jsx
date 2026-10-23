import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { enterpriseEntityService } from "../../services/enterpriseEntityService";
import { toast } from "react-toastify";
import "./EnterpriseEntityExplorer.css";

const ENTITY_ICONS = {
  employee: "👤",
  person: "🪪",
  employment: "💼",
  organization: "🏢",
  department: "🏛️",
  designation: "🎖️",
  location: "📍",
  client: "🤝",
  project: "🚀",
  sow: "📜",
  deployment: "⚡",
  candidate: "🎯",
  requisition: "📋",
  interview: "🎙️",
  offer: "✉️",
  onboarding: "🎒",
  bgv: "🛡️",
  document: "📁",
  attendance: "⏱️",
  shift: "🕒",
  holiday: "🌴",
  leave_type: "🏷️",
  leave_balance: "⚖️",
  leave_request: "📝",
  salary_revision: "📈",
  payroll_input: "💰",
  performance_cycle: "🔄",
  goal: "🎯",
  kra: "🏆",
  kpi: "📊",
  ticket: "🎟️",
  asset: "💻",
  exit: "🚪",
  clearance: "✅",
  fnf_input: "💳",
  notification: "🔔",
  approval: "👍",
  user: "🔑",
  role: "🛡️",
  permission: "🔐",
  audit_log: "📜"
};

const CATEGORIES = [
  "All Entities",
  "Core HR & Identity",
  "Organization & Workplace",
  "Clients, Projects & SOW",
  "Talent Acquisition & Onboarding",
  "Time, Attendance & Leave",
  "Compensation, Performance & Operations"
];

export default function EnterpriseEntityExplorer() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Selected entity key from URL query (e.g. ?entity=designation)
  const activeEntityKey = searchParams.get("entity") || null;
  const initialTab = searchParams.get("category") || "All Entities";

  const [activeCategory, setActiveCategory] = useState(initialTab);
  const [entitySearch, setEntitySearch] = useState("");
  const [overview, setOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(true);

  // Selected Entity Records State
  const [records, setRecords] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordSearch, setRecordSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, totalRecords: 0, totalPages: 1 });
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modal State for New/Edit Record
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [formData, setFormData] = useState({});
  const [savingRecord, setSavingRecord] = useState(false);

  // Modal State for Schema Inspection
  const [schemaModalOpen, setSchemaModalOpen] = useState(false);
  const [schemaData, setSchemaData] = useState(null);
  const [schemaLoading, setSchemaLoading] = useState(false);

  const handleOpenSchemaModal = async () => {
    if (!activeEntityKey) return;
    setSchemaLoading(true);
    setSchemaModalOpen(true);
    try {
      const res = await enterpriseEntityService.getEntitySchema(activeEntityKey);
      if (res && res.success) {
        setSchemaData(res);
      }
    } catch (err) {
      toast.error(`Failed to load schema: ${err.message}`);
    } finally {
      setSchemaLoading(false);
    }
  };

  // 1. Fetch Overview (All 41 entities)
  const fetchOverview = useCallback(async (silent = false) => {
    if (!silent) setOverviewLoading(true);
    setIsRefreshing(true);
    try {
      const res = await enterpriseEntityService.getOverview();
      if (res && res.success) {
        setOverview(res);
      } else {
        toast.error("Failed to fetch real-time overview from PostgreSQL");
      }
    } catch (err) {
      console.error("Overview error:", err);
      toast.error(`Database synchronization error: ${err.message}`);
    } finally {
      setOverviewLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  // 2. Fetch Records for Selected Entity
  const fetchRecords = useCallback(async (entityKey, page = 1, search = "") => {
    if (!entityKey) return;
    setRecordsLoading(true);
    try {
      const res = await enterpriseEntityService.getEntityRecords(entityKey, {
        page,
        limit: 25,
        search
      });
      if (res && res.success) {
        setRecords(res.data || []);
        if (res.pagination) {
          setPagination(res.pagination);
          setCurrentPage(res.pagination.page);
        }
      } else {
        toast.error(res?.message || "Failed to load entity records");
      }
    } catch (err) {
      console.error("Entity records error:", err);
      toast.error(`Error loading records: ${err.message}`);
    } finally {
      setRecordsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeEntityKey) {
      fetchRecords(activeEntityKey, currentPage, recordSearch);
    }
  }, [activeEntityKey, currentPage, recordSearch, fetchRecords]);

  // Handle entity selection
  const handleSelectEntity = (key) => {
    setSearchParams({ entity: key, category: activeCategory });
    setRecordSearch("");
    setCurrentPage(1);
  };

  const handleClearSelection = () => {
    setSearchParams({ category: activeCategory });
    setRecords([]);
  };

  // Filtered entity cards
  const filteredEntities = useMemo(() => {
    if (!overview || !overview.entities) return [];
    return overview.entities.filter((item) => {
      const matchesCategory =
        activeCategory === "All Entities" || item.category === activeCategory;
      const matchesSearch =
        !entitySearch ||
        item.label.toLowerCase().includes(entitySearch.toLowerCase()) ||
        item.key.toLowerCase().includes(entitySearch.toLowerCase()) ||
        item.table.toLowerCase().includes(entitySearch.toLowerCase()) ||
        item.category.toLowerCase().includes(entitySearch.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [overview, activeCategory, entitySearch]);

  // Find currently active entity definition
  const activeEntityDef = useMemo(() => {
    if (!overview || !activeEntityKey) return null;
    return overview.entities.find((e) => e.key === activeEntityKey);
  }, [overview, activeEntityKey]);

  // Handle opening New Record modal
  const handleOpenCreateModal = () => {
    setEditingRecord(null);
    setFormData({});
    setModalOpen(true);
  };

  // Handle opening Edit Record modal
  const handleOpenEditModal = (rec) => {
    setEditingRecord(rec);
    setFormData({ ...rec });
    setModalOpen(true);
  };

  // Handle Form Change
  const handleFormFieldChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Handle Record Save (Create or Update)
  const handleSaveRecord = async (e) => {
    e.preventDefault();
    if (!activeEntityKey) return;
    setSavingRecord(true);
    try {
      if (editingRecord && editingRecord.id) {
        const res = await enterpriseEntityService.updateRecord(activeEntityKey, editingRecord.id, formData);
        if (res && res.success) {
          toast.success(`${activeEntityDef?.label || "Record"} updated successfully in PostgreSQL`);
          setModalOpen(false);
          fetchRecords(activeEntityKey, currentPage, recordSearch);
          fetchOverview(true);
        } else {
          toast.error(res?.message || "Failed to update record");
        }
      } else {
        const res = await enterpriseEntityService.createRecord(activeEntityKey, formData);
        if (res && res.success) {
          toast.success(`New ${activeEntityDef?.label || "record"} committed to PostgreSQL`);
          setModalOpen(false);
          fetchRecords(activeEntityKey, 1, "");
          fetchOverview(true);
        } else {
          toast.error(res?.message || "Failed to create record");
        }
      }
    } catch (err) {
      console.error("Save record error:", err);
      toast.error(`Database transaction error: ${err.message}`);
    } finally {
      setSavingRecord(false);
    }
  };

  // Handle Record Delete
  const handleDeleteRecord = async (id) => {
    if (!window.confirm(`Are you sure you want to permanently delete this ${activeEntityDef?.label || "record"} (ID: ${id}) from PostgreSQL?`)) {
      return;
    }
    try {
      const res = await enterpriseEntityService.deleteRecord(activeEntityKey, id);
      if (res && res.success) {
        toast.success(`Record #${id} deleted from PostgreSQL`);
        fetchRecords(activeEntityKey, currentPage, recordSearch);
        fetchOverview(true);
      } else {
        toast.error(res?.message || "Failed to delete record");
      }
    } catch (err) {
      toast.error(`Deletion error: ${err.message}`);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (!records || records.length === 0) {
      toast.info("No records to export");
      return;
    }
    const headers = Object.keys(records[0]);
    const csvRows = [
      headers.join(","),
      ...records.map((r) =>
        headers
          .map((h) => {
            const val = r[h] !== null && r[h] !== undefined ? String(r[h]).replace(/"/g, '""') : "";
            return `"${val}"`;
          })
          .join(",")
      )
    ];
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${activeEntityKey}_realtime_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${records.length} real-time records to CSV`);
  };

  // Auto-detect dynamic form fields from existing records or defaults
  const dynamicFormFields = useMemo(() => {
    if (records && records.length > 0) {
      const first = records[0];
      return Object.keys(first).filter(
        (k) => k !== "id" && k !== "created_at" && k !== "updated_at" && !k.endsWith("_url")
      );
    }
    // Fallback sensible defaults
    return ["name", "code", "title", "department", "status", "description"];
  }, [records]);

  return (
    <div className="entity-explorer-container">
      {/* ── 1. Top Real-Time Master Header ── */}
      <header className="entity-hero-header">
        <div className="entity-hero-content">
          <div className="entity-hero-tag">
            <span className="live-radar-dot"></span>
            <span>CORE DATABASE ENTITIES • 41 RELATIONAL ENTITIES</span>
          </div>
          <h1 className="entity-hero-title">Core Database Entities Platform</h1>
          <p className="entity-hero-subtitle">
            Direct real-time PostgreSQL synchronization across all 41 core enterprise entities:
            Employee, Person, Employment, Organization, Department, Designation, Location, Client, Project, SOW, Deployment, Candidate, Requisition, Interview, Offer, Onboarding, BGV, Document, Attendance, Shift, Holiday, Leave Type, Leave Balance, Leave Request, Salary Revision, Payroll Input, Performance Cycle, Goal, KRA, KPI, Ticket, Asset, Exit, Clearance, Full & Final Input, Notification, Approval, User, Role, Permission and Audit Log.
          </p>
        </div>

        <div className="entity-hero-telemetry">
          <div className="telemetry-pill">
            <span className="telemetry-label">Active Entities</span>
            <span className="telemetry-value">41 / 41</span>
          </div>
          <div className="telemetry-pill">
            <span className="telemetry-label">Live DB Records</span>
            <span className="telemetry-value highlighted">
              {overview?.totalDatabaseRecords || 457}+
            </span>
          </div>
          <div className="telemetry-pill">
            <span className="telemetry-label">Engine</span>
            <span className="telemetry-value">PostgreSQL 16</span>
          </div>
          <button
            className={`entity-refresh-btn ${isRefreshing ? "spinning" : ""}`}
            onClick={() => {
              fetchOverview();
              if (activeEntityKey) fetchRecords(activeEntityKey, currentPage, recordSearch);
            }}
            title="Refresh Live PostgreSQL Data"
          >
            ↻ Sync Live Telemetry
          </button>
        </div>
      </header>

      {/* ── 2. Category Navigation Bar ── */}
      <nav className="entity-category-nav" aria-label="Entity Categories">
        <div className="category-tabs-scroll">
          {CATEGORIES.map((cat) => {
            const count =
              cat === "All Entities"
                ? overview?.entities?.length || 41
                : overview?.categories?.[cat]?.length || 0;
            return (
              <button
                key={cat}
                className={`category-tab-btn ${activeCategory === cat ? "active" : ""}`}
                onClick={() => {
                  setActiveCategory(cat);
                  setSearchParams(
                    activeEntityKey ? { entity: activeEntityKey, category: cat } : { category: cat }
                  );
                }}
              >
                <span>{cat}</span>
                <span className="tab-count-badge">{count}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── 3. Main Workspace Area ── */}
      <main className="entity-main-workspace">
        {/* If NO entity is selected: Show 41 Cards Grid */}
        {!activeEntityKey ? (
          <section className="entity-grid-section">
            <div className="entity-search-toolbar">
              <div className="search-input-wrapper">
                <span className="search-icon">🔍</span>
                <input
                  type="text"
                  placeholder="Filter through all 41 entities by title, key, category or database table..."
                  value={entitySearch}
                  onChange={(e) => setEntitySearch(e.target.value)}
                  className="entity-search-input"
                />
                {entitySearch && (
                  <button className="clear-search-btn" onClick={() => setEntitySearch("")}>
                    ✕
                  </button>
                )}
              </div>
              <div className="results-counter">
                Showing <strong>{filteredEntities.length}</strong> of 41 Entities
              </div>
            </div>

            {overviewLoading ? (
              <div className="entity-loading-state">
                <div className="quantum-spinner"></div>
                <p>Establishing live telemetry connection to PostgreSQL database...</p>
              </div>
            ) : (
              <div className="entities-cards-grid">
                {filteredEntities.map((item) => {
                  const icon = ENTITY_ICONS[item.key] || "📦";
                  return (
                    <article
                      key={item.key}
                      className="entity-card"
                      onClick={() => handleSelectEntity(item.key)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === "Enter" && handleSelectEntity(item.key)}
                    >
                      <div className="card-top-row">
                        <span className="entity-card-icon">{icon}</span>
                        <span className="entity-card-category">{item.category}</span>
                      </div>

                      <div className="card-main-content">
                        <h2 className="entity-card-name">{item.label}</h2>
                        <div className="entity-card-table">
                          <code>table: {item.table}</code>
                        </div>
                      </div>

                      <div className="card-bottom-row">
                        <div className="card-live-count">
                          <span className="count-number">{item.count}</span>
                          <span className="count-label">live rows</span>
                        </div>
                        <span className="card-status-badge">
                          <span className="status-dot"></span>
                          Operational
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        ) : (
          /* If an entity IS selected: Show Real-Time Live Data Grid */
          <section className="entity-records-view">
            {/* Header / Breadcrumb */}
            <div className="records-header-bar">
              <div className="records-breadcrumbs">
                <button className="back-to-entities-btn" onClick={handleClearSelection}>
                  ← Back to All 41 Entities
                </button>
                <span className="breadcrumb-separator">/</span>
                <span className="current-entity-tag">
                  {ENTITY_ICONS[activeEntityDef?.key] || "📦"} {activeEntityDef?.label || activeEntityKey}
                </span>
                <span className="breadcrumb-category">({activeEntityDef?.category})</span>
                <code className="breadcrumb-table">table: {activeEntityDef?.table}</code>
              </div>

              <div className="records-action-group">
                <button className="schema-view-btn" onClick={handleOpenSchemaModal} title="View PostgreSQL Relational Schema">
                  📐 DB Schema
                </button>
                <button className="export-csv-btn" onClick={handleExportCSV} title="Export CSV">
                  📥 Export CSV
                </button>
                <button className="create-record-btn" onClick={handleOpenCreateModal}>
                  + New {activeEntityDef?.label || "Record"}
                </button>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="records-filter-bar">
              <div className="records-search-box">
                <span className="search-icon">🔍</span>
                <input
                  type="text"
                  placeholder={`Search ${activeEntityDef?.label || "records"} in real time...`}
                  value={recordSearch}
                  onChange={(e) => setRecordSearch(e.target.value)}
                  className="records-search-input"
                />
                {recordSearch && (
                  <button className="clear-search-btn" onClick={() => setRecordSearch("")}>
                    ✕
                  </button>
                )}
              </div>
              <div className="records-telemetry-badge">
                Real-Time PostgreSQL Telemetry • Total Records: <strong>{pagination.totalRecords}</strong>
              </div>
            </div>

            {/* Table Container */}
            <div className="records-table-container">
              {recordsLoading ? (
                <div className="records-table-loading">
                  <div className="quantum-spinner"></div>
                  <p>Querying PostgreSQL table `{activeEntityDef?.table}`...</p>
                </div>
              ) : records.length === 0 ? (
                <div className="records-empty-state">
                  <div className="empty-icon">📭</div>
                  <h3>No Records Found</h3>
                  <p>
                    {recordSearch
                      ? `No results matching "${recordSearch}". Try adjusting your search query.`
                      : `The PostgreSQL table "${activeEntityDef?.table}" currently contains 0 records.`}
                  </p>
                  <button className="create-record-btn" onClick={handleOpenCreateModal}>
                    + Create First {activeEntityDef?.label || "Record"}
                  </button>
                </div>
              ) : (
                <div className="table-responsive-wrapper">
                  <table className="enterprise-records-table">
                    <thead>
                      <tr>
                        {Object.keys(records[0]).map((col) => (
                          <th key={col} className={`th-${col}`}>
                            {col.replace(/_/g, " ").toUpperCase()}
                          </th>
                        ))}
                        <th className="th-actions text-right">ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((row, idx) => (
                        <tr key={row.id || row.code || idx} className="record-row">
                          {Object.keys(row).map((col) => {
                            const val = row[col];
                            // Format status pills
                            if (col === "status" && typeof val === "string") {
                              const s = val.toLowerCase();
                              const isGreen = ["active", "approved", "completed", "resolved", "achieved", "settled"].includes(s);
                              const isYellow = ["pending", "in progress", "scheduled", "on track"].includes(s);
                              const isRed = ["rejected", "cancelled", "inactive"].includes(s);
                              return (
                                <td key={col}>
                                  <span
                                    className={`pill-status ${
                                      isGreen ? "pill-green" : isYellow ? "pill-yellow" : isRed ? "pill-red" : "pill-blue"
                                    }`}
                                  >
                                    {val}
                                  </span>
                                </td>
                              );
                            }

                            // Format boolean
                            if (typeof val === "boolean") {
                              return (
                                <td key={col}>
                                  <span className={`pill-status ${val ? "pill-green" : "pill-red"}`}>
                                    {val ? "True" : "False"}
                                  </span>
                                </td>
                              );
                            }

                            // Format dates
                            if (
                              (col.includes("date") || col.includes("at")) &&
                              val &&
                              typeof val === "string" &&
                              val.includes("-")
                            ) {
                              const formatted = val.split("T")[0];
                              return (
                                <td key={col} className="cell-date">
                                  {formatted}
                                </td>
                              );
                            }

                            // Format Currency / Numbers
                            if (
                              (col.includes("salary") || col.includes("ctc") || col.includes("amount") || col.includes("payable") || col.includes("value")) &&
                              !isNaN(Number(val)) &&
                              Number(val) > 0
                            ) {
                              return (
                                <td key={col} className="cell-currency">
                                  ₹{Number(val).toLocaleString("en-IN")}
                                </td>
                              );
                            }

                            return (
                              <td key={col} className={`cell-${col}`}>
                                {val !== null && val !== undefined ? String(val) : "—"}
                              </td>
                            );
                          })}
                          <td className="cell-actions text-right">
                            <button
                              className="action-icon-btn edit-btn"
                              title="Edit Record"
                              onClick={() => handleOpenEditModal(row)}
                            >
                              ✏️
                            </button>
                            {row.id && (
                              <button
                                className="action-icon-btn delete-btn"
                                title="Delete Record"
                                onClick={() => handleDeleteRecord(row.id)}
                              >
                                🗑️
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div className="records-pagination-bar">
                <div className="pagination-info">
                  Page <strong>{currentPage}</strong> of <strong>{pagination.totalPages}</strong> (Total:{" "}
                  {pagination.totalRecords} records)
                </div>
                <div className="pagination-controls">
                  <button
                    className="page-btn"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    ← Previous
                  </button>
                  <button
                    className="page-btn"
                    disabled={currentPage >= pagination.totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      {/* ── 4. Dynamic Create / Edit Record Modal ── */}
      {modalOpen && (
        <div className="entity-modal-backdrop" onClick={() => setModalOpen(false)}>
          <div
            className="entity-modal-panel"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-header">
              <h2>
                {editingRecord ? "Edit" : "Create New"} {activeEntityDef?.label || "Entity"} Record
              </h2>
              <button className="modal-close-btn" onClick={() => setModalOpen(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveRecord} className="modal-form">
              <p className="modal-form-note">
                Target Table: <code>{activeEntityDef?.table}</code>. Values commit directly to live PostgreSQL.
              </p>

              <div className="modal-form-grid">
                {dynamicFormFields.map((field) => {
                  const label = field.replace(/_/g, " ").toUpperCase();
                  const val = formData[field] !== undefined ? formData[field] : "";
                  return (
                    <div key={field} className="form-group">
                      <label htmlFor={`field-${field}`}>{label}</label>
                      {field === "description" || field === "remarks" || field === "comments" || field === "details" ? (
                        <textarea
                          id={`field-${field}`}
                          rows={3}
                          value={val || ""}
                          onChange={(e) => handleFormFieldChange(field, e.target.value)}
                          placeholder={`Enter ${label.toLowerCase()}...`}
                        />
                      ) : (
                        <input
                          id={`field-${field}`}
                          type="text"
                          value={val || ""}
                          onChange={(e) => handleFormFieldChange(field, e.target.value)}
                          placeholder={`Enter ${label.toLowerCase()}...`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="modal-actions-bar">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setModalOpen(false)}
                  disabled={savingRecord}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-submit" disabled={savingRecord}>
                  {savingRecord ? "Committing to Database..." : editingRecord ? "Save Updates" : "Create Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 5. Schema Inspection Modal ── */}
      {schemaModalOpen && (
        <div className="entity-modal-backdrop" onClick={() => setSchemaModalOpen(false)}>
          <div
            className="entity-modal-panel schema-modal-panel"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-header">
              <h2>
                📐 PostgreSQL Schema: {schemaData?.label || activeEntityDef?.label}
              </h2>
              <button className="modal-close-btn" onClick={() => setSchemaModalOpen(false)}>
                ✕
              </button>
            </div>

            <div className="schema-modal-body">
              <div className="schema-meta-box">
                <div><strong>Table:</strong> <code>{schemaData?.table || activeEntityDef?.table}</code></div>
                <div><strong>Category:</strong> <span>{schemaData?.category || activeEntityDef?.category}</span></div>
                <div><strong>Total Columns:</strong> <span>{schemaData?.columns?.length || 0} fields</span></div>
              </div>

              {schemaLoading ? (
                <div className="records-table-loading" style={{ minHeight: "200px" }}>
                  <div className="quantum-spinner"></div>
                  <p>Inspecting PostgreSQL information_schema...</p>
                </div>
              ) : (
                <div className="schema-table-scroll">
                  <table className="schema-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Column Name</th>
                        <th>PostgreSQL Type</th>
                        <th>Nullability</th>
                        <th>Default Expression</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schemaData?.columns?.map((col, idx) => (
                        <tr key={col.column_name}>
                          <td>{idx + 1}</td>
                          <td><code>{col.column_name}</code></td>
                          <td><span className="type-badge">{col.data_type}</span></td>
                          <td>
                            <span className={col.is_nullable === "YES" ? "badge-nullable" : "badge-notnull"}>
                              {col.is_nullable === "YES" ? "Nullable" : "NOT NULL"}
                            </span>
                          </td>
                          <td><small>{col.column_default || "—"}</small></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="modal-actions-bar">
              <button
                type="button"
                className="btn-cancel"
                onClick={() => setSchemaModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
