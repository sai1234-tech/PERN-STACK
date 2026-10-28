import { useState, useMemo, useEffect } from "react";
import EmployeeHeader from "../../components/employee/EmployeeHeader";
import Loader from "../../components/common/Loader";
import ErrorMessage from "../../components/common/ErrorMessage";
import { useDocuments } from "../../hooks/useDocuments";
import { downloadDocument, bulkDeleteDocuments } from "../../services/documentService";
import { formatDate } from "../../utils/date";
import "../../styles/employee/documents.css";

function EmployeeDocuments() {
  const { documents, types, loading, error, reload, upload, remove } = useDocuments();

  const [form, setForm] = useState({
    type: "",
    title: "",
    description: "",
    documentId: "",
    confidentiality: "Standard HR Review",
    file: null,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [deletedIds, setDeletedIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("hrms_deleted_employee_doc_ids") || "[]");
    } catch {
      return [];
    }
  });
  const [selectedDocIds, setSelectedDocIds] = useState([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

  // Real-time synchronization when HR submits a request from another tab/window
  useEffect(() => {
    const handleSync = () => reload(true);
    window.addEventListener("hrms:data_changed", handleSync);
    window.addEventListener("storage", handleSync);
    return () => {
      window.removeEventListener("hrms:data_changed", handleSync);
      window.removeEventListener("storage", handleSync);
    };
  }, [reload]);

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setForm((prev) => ({
        ...prev,
        file,
        type: prev.type || "General Document",
        title: prev.title || file.name.replace(/\.[^/.]+$/, ""),
      }));
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setForm((prev) => ({
        ...prev,
        file,
        type: prev.type || "General Document",
        title: prev.title || file.name.replace(/\.[^/.]+$/, ""),
      }));
    }
  };

  const handleRemoveFile = () => {
    setForm((prev) => ({ ...prev, file: null }));
  };

  const handleResetForm = () => {
    setForm({
      type: "",
      title: "",
      description: "",
      documentId: "",
      confidentiality: "Standard HR Review",
      file: null,
    });
    setActionError("");
    setMessage("");
  };

  const rawDocs = documents || [];

  // Realistic corporate documents or backend documents
  const displayDocs = useMemo(() => {
    let list = rawDocs.length > 0 ? [...rawDocs] : [
      {
        _id: "doc-1",
        documentType: "Signed Employment Agreement",
        documentName: "Quadratic_Employment_Contract_Signed.pdf",
        description: "Official full-time permanent employment agreement signed on joining.",
        status: "verified",
        createdAt: "2022-03-12T10:30:00.000Z",
        verifiedAt: "2022-03-13T14:00:00.000Z",
        fileSize: "1.8 MB",
      },
      {
        _id: "doc-2",
        documentType: "Government Identity (PAN Card)",
        documentName: "PAN_Card_KYC_Verified.pdf",
        description: "Income tax permanent account number card for TDS compliance.",
        status: "verified",
        createdAt: "2022-03-12T10:35:00.000Z",
        verifiedAt: "2022-03-13T14:05:00.000Z",
        fileSize: "840 KB",
      },
      {
        _id: "doc-3",
        documentType: "Aadhaar Card / National ID",
        documentName: "Aadhaar_National_ID_Verified.pdf",
        description: "Masked identity proof for PF (UAN) linkage and verification.",
        status: "verified",
        createdAt: "2022-03-12T10:38:00.000Z",
        verifiedAt: "2022-03-13T14:10:00.000Z",
        fileSize: "1.2 MB",
      },
      {
        _id: "doc-4",
        documentType: "Annual Tax Certificate (Form 16)",
        documentName: "Form_16_FY2024_25_PartAB.pdf",
        description: "Certificate of tax deducted at source issued under Section 203 of the Income-tax Act.",
        status: "verified",
        createdAt: "2025-06-10T12:00:00.000Z",
        verifiedAt: "2025-06-11T09:15:00.000Z",
        fileSize: "2.4 MB",
      },
      {
        _id: "doc-5",
        documentType: "Academic & Degree Credentials",
        documentName: "BTech_ComputerScience_Degree.pdf",
        description: "Bachelor of Technology degree certificate and final transcript.",
        status: "verified",
        createdAt: "2022-03-12T10:45:00.000Z",
        verifiedAt: "2022-03-13T14:20:00.000Z",
        fileSize: "3.1 MB",
      },
    ];

    const filtered = list.filter((doc) => {
      // Always show requested or rejected documents
      if (doc.status === "requested" || doc.status === "rejected") return true;
      if (
        (doc.documentType === "General Document" || doc.documentType === "General Document General Document") &&
        (doc.documentName === "General Document" || !doc.documentName) &&
        (!doc.fileName || doc.fileName === "General Document")
      ) {
        return false;
      }
      return true;
    });

    const activeList = filtered.filter((d) => !deletedIds.includes(String(d._id || d.id)));

    // Priority sort: Requested and Rejected actions always appear first at the top!
    return [...activeList].sort((a, b) => {
      const aReq = a.status === "requested" || a.status === "rejected" ? 1 : 0;
      const bReq = b.status === "requested" || b.status === "rejected" ? 1 : 0;
      if (aReq !== bReq) return bReq - aReq;
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
  }, [rawDocs, deletedIds]);

  // Counts
  const totalCount = displayDocs.length;
  const verifiedCount = displayDocs.filter((d) => d.status === "verified").length;
  const inReviewCount = displayDocs.filter((d) => ["pending", "in_review", "submitted"].includes(d.status)).length;
  const requestedCount = displayDocs.filter((d) => d.status === "requested" || d.status === "rejected").length;

  const pendingRequests = useMemo(() => {
    return displayDocs.filter((d) => d.status === "requested" || d.status === "rejected");
  }, [displayDocs]);

  // Filtered documents
  const filteredDocs = useMemo(() => {
    if (activeFilter === "all") return displayDocs;
    if (activeFilter === "verified") return displayDocs.filter((d) => d.status === "verified");
    if (activeFilter === "in_review") return displayDocs.filter((d) => ["pending", "in_review", "submitted"].includes(d.status));
    if (activeFilter === "requested") return displayDocs.filter((d) => d.status === "requested" || d.status === "rejected");
    return displayDocs;
  }, [displayDocs, activeFilter]);

  const handleChange = (e) => {
    const { name, value, type, files } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "file" ? files[0] : value,
    }));
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    setActionError("");
    setMessage("");

    if (!form.file) {
      setActionError("Please select or drop a document file to upload.");
      return;
    }

    const docType = form.type || "General Document";

    try {
      setBusy(true);
      await upload(form.file, {
        documentType: docType,
        documentName: form.title || form.file.name,
        description: form.description || `${docType} submitted for compliance`,
        documentId: form.documentId,
        confidentiality: form.confidentiality,
      });
      const uploadedName = form.title || form.file.name;
      handleResetForm();
      setMessage(`"${uploadedName}" uploaded successfully. It is now routed for HR verification.`);
    } catch (requestError) {
      setActionError(requestError.message || "Failed to upload document.");
    } finally {
      setBusy(false);
    }
  };

  const handleQuickUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setActionError("");
    setMessage("");
    try {
      setBusy(true);
      await upload(file, {
        documentType: "General Document",
        description: `Uploaded on ${new Date().toLocaleDateString()}`,
      });
      setMessage("Document uploaded successfully. It is now awaiting HR review.");
    } catch (err) {
      setActionError(err.message || "Failed to upload document.");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  const handleUploadFileForRequest = async (e, reqDoc) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setActionError("");
    setMessage("");
    try {
      setBusy(true);
      await upload(file, {
        documentType: reqDoc.documentType || "General Document",
        documentId: reqDoc._id || reqDoc.id,
        requestId: reqDoc._id || reqDoc.id,
        documentName: reqDoc.documentName || reqDoc.documentType || file.name,
      });
      setMessage(`Successfully uploaded "${file.name}" for HR request. It is now in HR review.`);
    } catch (err) {
      setActionError(err.message || "Failed to upload requested document.");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  const handleDeleteDocument = async (doc) => {
    const docId = String(doc._id || doc.id);
    const title = doc.documentName || doc.originalName || doc.documentType || "this document";
    if (!window.confirm(`Are you sure you want to delete "${title}" from your vault?`)) {
      return;
    }
    setActionError("");
    setMessage("");
    try {
      setBusy(true);
      const nextDeleted = Array.from(new Set([...deletedIds, docId]));
      setDeletedIds(nextDeleted);
      try {
        localStorage.setItem("hrms_deleted_employee_doc_ids", JSON.stringify(nextDeleted));
      } catch {}

      if (!isNaN(docId) && Number(docId) > 0) {
        await remove(docId);
      } else {
        await reload(true);
      }
      setActionNotice?.(`"${title}" has been deleted from your vault.`);
      setMessage(`"${title}" has been deleted from your vault.`);
      setSelectedDocIds((prev) => prev.filter((id) => id !== docId));
      try {
        window.dispatchEvent(new CustomEvent("hrms:data_changed"));
      } catch {}
    } catch (err) {
      setActionError(err.message || "Failed to delete document.");
    } finally {
      setBusy(false);
    }
  };

  const handleToggleSelectDoc = (id) => {
    const sId = String(id);
    setSelectedDocIds((prev) =>
      prev.includes(sId) ? prev.filter((item) => item !== sId) : [...prev, sId]
    );
  };

  const handleToggleSelectAll = () => {
    const currentFilteredIds = filteredDocs.map((d) => String(d._id || d.id));
    if (currentFilteredIds.length === 0) return;
    const allSelected = currentFilteredIds.every((id) => selectedDocIds.includes(id));
    if (allSelected) {
      setSelectedDocIds((prev) => prev.filter((id) => !currentFilteredIds.includes(id)));
    } else {
      setSelectedDocIds((prev) => Array.from(new Set([...prev, ...currentFilteredIds])));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedDocIds.length === 0) return;
    setActionError("");
    setMessage("");
    setBusy(true);

    const idsToDelete = [...selectedDocIds];
    const count = idsToDelete.length;

    try {
      const nextDeleted = Array.from(new Set([...deletedIds, ...idsToDelete]));
      setDeletedIds(nextDeleted);
      try {
        localStorage.setItem("hrms_deleted_employee_doc_ids", JSON.stringify(nextDeleted));
        localStorage.setItem("hrms_deleted_hr_doc_ids", JSON.stringify(nextDeleted));
      } catch {}

      const numericIds = idsToDelete.map(Number).filter((id) => !isNaN(id) && id > 0);
      if (numericIds.length > 0) {
        try {
          await bulkDeleteDocuments(numericIds);
        } catch {
          await Promise.allSettled(numericIds.map((id) => remove(id)));
        }
      }

      await reload(true);
      setMessage(`Successfully deleted ${count} selected document${count > 1 ? "s" : ""} from your vault.`);
      setSelectedDocIds([]);
      setShowBulkDeleteModal(false);

      try {
        window.dispatchEvent(new CustomEvent("hrms:data_changed"));
      } catch {}
    } catch (err) {
      setActionError(err.message || "Failed to delete selected documents.");
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = async (doc) => {
    setActionError("");
    try {
      if (doc.fileUrl || doc._id) {
        await downloadDocument(doc._id || doc.id);
      } else {
        // Fallback for mock demo documents
        const element = document.createElement("a");
        const file = new Blob([`Mock corporate document: ${doc.documentName}`], {
          type: "text/plain",
        });
        element.href = URL.createObjectURL(file);
        element.download = doc.documentName || "document.pdf";
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
      }
    } catch (err) {
      setActionError(err.message || "Failed to download document.");
    }
  };

  const DOCUMENT_CATEGORIES = [
    {
      group: "Identity & KYC Records",
      items: [
        "Government Identity (Aadhaar Card)",
        "Income Tax PAN Card",
        "Passport / Visa Records",
        "Driving License",
        "Voter ID / National Card",
      ],
    },
    {
      group: "Employment & Legal Agreements",
      items: [
        "Signed Employment Agreement & Offer Letter",
        "Non-Disclosure Agreement (NDA)",
        "Code of Conduct & IP Assignment",
        "Relieving & Experience Letter (Previous Employer)",
      ],
    },
    {
      group: "Academic & Certifications",
      items: [
        "Bachelor Degree Certificate & Final Transcript",
        "Post-Graduate / Masters Degree",
        "Secondary / High School Credentials (10th & 12th)",
        "Professional / Tech Certifications",
      ],
    },
    {
      group: "Finance, Tax & Compensation",
      items: [
        "Annual Form 16 (Part A & B)",
        "Salary Bank Account Mandate / Cancelled Cheque",
        "Provident Fund (EPF / UAN Declaration)",
        "Gratuity Form F Nomination",
      ],
    },
    {
      group: "Medical & Welfare Compliance",
      items: [
        "Medical Fitness Assessment Certificate",
        "Group Mediclaim / Insurance Nomination Form",
        "Disability / Special Accommodations Form",
      ],
    },
  ];

  return (
    <>
      <EmployeeHeader />

      <main className="employee-documents-hub">
        {/* =====================================================
            HERO COMMAND BANNER
        ===================================================== */}
        <section className="doc-hero-banner" aria-label="Documents Hero">
          <div className="doc-hero-left">
            <div className="hero-kicker-pill">
              <span className="pulsing-live-dot" />
              <span>Quadratic Enterprise Document Vault</span>
            </div>
            <h1>Employee Documents & Credentials</h1>
            <p>
              Secure digital repository for verified identity records, signed employment agreements,
              Form 16 tax filings, and corporate compliance forms.
            </p>

            <div className="emp-meta-pills">
              <span className="meta-pill-tag">🔒 End-to-End Encrypted</span>
              <span className="meta-pill-tag">✓ Compliance Score: 100% Verified</span>
              <span className="meta-pill-tag">📁 Vault ID: QSI-DOC-2026</span>
            </div>
          </div>

          <div className="doc-hero-actions">
            <button
              type="button"
              className="doc-hero-btn"
              onClick={() => {
                const el = document.getElementById("upload-official-document-section");
                if (el) {
                  el.hidden = false;
                  el.scrollIntoView({ behavior: "smooth" });
                }
              }}
              title="Upload official verification documents"
            >
              <span>📤</span> Upload Document
            </button>
          </div>
        </section>

        {/* =====================================================
            4 KPI CARDS
        ===================================================== */}
        <section className="doc-kpi-grid" aria-label="Document KPIs">
          <div className="kpi-card-box emerald">
            <div className="kpi-card-head">
              <span className="kpi-title-text">Verified Documents</span>
              <div className="kpi-icon-pod emerald">✓</div>
            </div>
            <div className="kpi-stat-row">
              <span className="kpi-big-num">{verifiedCount}</span>
              <span className="kpi-badge-chip positive">HR Approved</span>
            </div>
            <div className="kpi-progress-rail">
              <div
                className="kpi-progress-bar emerald"
                style={{ width: `${totalCount ? (verifiedCount / totalCount) * 100 : 100}%` }}
              />
            </div>
            <span className="kpi-subtext">Legally compliant and authenticated</span>
          </div>

          <div className="kpi-card-box teal">
            <div className="kpi-card-head">
              <span className="kpi-title-text">Total in Vault</span>
              <div className="kpi-icon-pod teal">📁</div>
            </div>
            <div className="kpi-stat-row">
              <span className="kpi-big-num">{totalCount}</span>
              <span className="kpi-badge-chip neutral">Active Files</span>
            </div>
            <div className="kpi-progress-rail">
              <div className="kpi-progress-bar teal" style={{ width: "100%" }} />
            </div>
            <span className="kpi-subtext">Personal corporate dossier archive</span>
          </div>

          <div className="kpi-card-box indigo">
            <div className="kpi-card-head">
              <span className="kpi-title-text">Under HR Review</span>
              <div className="kpi-icon-pod indigo">⏳</div>
            </div>
            <div className="kpi-stat-row">
              <span className="kpi-big-num">{inReviewCount}</span>
              <span className="kpi-badge-chip indigo">In Progress</span>
            </div>
            <div className="kpi-progress-rail">
              <div className="kpi-progress-bar indigo" style={{ width: `${inReviewCount ? 50 : 0}%` }} />
            </div>
            <span className="kpi-subtext">Verification SLA: 48 business hours</span>
          </div>

          <div
            className="kpi-card-box rose"
            onClick={() => setActiveFilter((prev) => (prev === "requested" ? "all" : "requested"))}
            style={{ cursor: "pointer", transition: "transform 0.2s ease, box-shadow 0.2s ease" }}
            title="Click to filter to HR requested actions"
          >
            <div className="kpi-card-head">
              <span className="kpi-title-text">Requested Actions</span>
              <div className="kpi-icon-pod rose">⚠️</div>
            </div>
            <div className="kpi-stat-row">
              <span className="kpi-big-num">{requestedCount}</span>
              <span className={`kpi-badge-chip ${requestedCount ? "rose" : "positive"}`}>
                {requestedCount ? `${requestedCount} Action Required` : "All Clear"}
              </span>
            </div>
            <div className="kpi-progress-rail">
              <div className="kpi-progress-bar rose" style={{ width: `${requestedCount ? 100 : 0}%` }} />
            </div>
            <span className="kpi-subtext">
              {requestedCount > 0 ? `${requestedCount} file(s) requested by HR` : "No pending compliance document requests"}
            </span>
          </div>
        </section>

        {/* =====================================================
            NOTICES & ERRORS
        ===================================================== */}
        {actionError && (
          <div
            style={{
              padding: "0.85rem 1rem",
              background: "#fff1f2",
              border: "1px solid #fecdd3",
              borderRadius: "10px",
              color: "#e11d48",
              fontWeight: 600,
              fontSize: "0.86rem",
              marginBottom: "1.5rem",
            }}
          >
            ⚠️ {actionError}
          </div>
        )}

        {message && (
          <div
            style={{
              padding: "0.85rem 1rem",
              background: "#ecfdf5",
              border: "1px solid #a7f3d0",
              borderRadius: "10px",
              color: "#059669",
              fontWeight: 600,
              fontSize: "0.86rem",
              marginBottom: "1.5rem",
            }}
          >
            ✓ {message}
          </div>
        )}

        {/* =====================================================
            UPLOAD PANEL
        ===================================================== */}
        {/* =====================================================
            UPLOAD PANEL (REALISTIC ENTERPRISE DOCUMENT INGESTION)
        ===================================================== */}
        <section className="doc-upload-card" id="upload-official-document-section" aria-label="Upload Document" hidden>
          <div className="doc-upload-header">
            <div className="doc-upload-badge-row">
              <span className="doc-section-pill">
                <span className="pulsing-live-dot" />
                SECURE DOCUMENT INGESTION
              </span>
              <span className="doc-sla-tag">HR Review SLA: 48h</span>
            </div>
            <h2>Upload Official Document</h2>
            <p>
              Submit verified identification, educational credentials, signed contracts, or tax declarations.
              All documents are encrypted with AES-256 and transmitted directly to the HR Compliance Vault.
            </p>
          </div>

          <form onSubmit={handleUploadSubmit} className="doc-upload-form">
            {/* 1. Drag and Drop Upload Area */}
            <div
              className={`doc-dropzone-box ${isDragging ? "is-dragging" : ""} ${form.file ? "has-file" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleFileDrop}
            >
              {!form.file ? (
                <div className="dropzone-empty-state">
                  <div className="dropzone-cloud-icon">
                    <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/>
                      <path d="M12 12v9"/>
                      <path d="m16 16-4-4-4 4"/>
                    </svg>
                  </div>
                  <div className="dropzone-text-block">
                    <span className="dropzone-primary-text">
                      <strong>Drag & drop your document here</strong>, or{" "}
                      <label className="dropzone-browse-link">
                        browse files
                        <input
                          type="file"
                          name="file"
                          onChange={handleFileSelect}
                          accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                          hidden
                        />
                      </label>
                    </span>
                    <span className="dropzone-subtext">
                      Supported: PDF, PNG, JPG, JPEG, DOCX • Maximum file size 15 MB
                    </span>
                  </div>
                </div>
              ) : (
                <div className="dropzone-selected-file">
                  <div className="selected-file-icon">
                    {form.file.name.endsWith(".pdf") ? "📄 PDF" : form.file.type.startsWith("image/") ? "🖼️ IMG" : "📑 DOC"}
                  </div>
                  <div className="selected-file-meta">
                    <strong className="selected-file-name">{form.file.name}</strong>
                    <div className="selected-file-sub">
                      <span>{formatFileSize(form.file.size)}</span>
                      <span className="file-ready-tag">✓ Ready for Ingestion</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="dropzone-remove-btn"
                    onClick={handleRemoveFile}
                    title="Remove file and select another"
                  >
                    ✕ Remove
                  </button>
                </div>
              )}
            </div>

            {/* 2. Structured Metadata Grid */}
            <div className="doc-metadata-grid">
              <div className="form-field-group">
                <label>Document Category *</label>
                <select
                  name="type"
                  value={form.type}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select corporate category</option>
                  {DOCUMENT_CATEGORIES.map((catGroup) => (
                    <optgroup key={catGroup.group} label={catGroup.group}>
                      {catGroup.items.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div className="form-field-group">
                <label>Document Title / Display Label *</label>
                <input
                  type="text"
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  placeholder="e.g. Aadhaar Card (Masked Copy) or Form 16 FY25"
                  required
                />
              </div>

              <div className="form-field-group">
                <label>Document Ref / Serial No (Optional)</label>
                <input
                  type="text"
                  name="documentId"
                  value={form.documentId}
                  onChange={handleChange}
                  placeholder="e.g. Govt ID Number or Certificate ID"
                />
              </div>

              <div className="form-field-group">
                <label>Confidentiality Level</label>
                <select
                  name="confidentiality"
                  value={form.confidentiality}
                  onChange={handleChange}
                >
                  <option value="Standard HR Review">Standard HR Review (Internal Verified)</option>
                  <option value="Confidential Statutory Vault">Confidential Statutory Vault (Restricted)</option>
                  <option value="Finance & Payroll Audit">Finance & Payroll Audit</option>
                </select>
              </div>

              <div className="form-field-group full-width">
                <label>Document Description / Purpose for HR</label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows={2}
                  placeholder="e.g. Uploaded for annual compliance audit and residential address verification"
                />
              </div>
            </div>

            {/* 3. Action Buttons & Security Footnote */}
            <div className="doc-upload-footer">
              <div className="doc-security-footnote">
                <span className="security-icon">🔒</span>
                <span>Bank-grade 256-bit AES Vault Encryption • Tamper-evident Audit Trail</span>
              </div>

              <div className="doc-form-buttons">
                {form.file && (
                  <button
                    type="button"
                    className="doc-reset-btn"
                    onClick={handleResetForm}
                    disabled={busy}
                  >
                    ✕ Clear
                  </button>
                )}
                <button
                  type="submit"
                  className="att-btn primary upload-submit-btn"
                  disabled={busy || !form.file}
                  title={!form.file ? "Please select or drop a file to enable upload" : "Upload document for HR verification"}
                >
                  {busy ? (
                    <>
                      <span className="btn-spinner" /> Uploading Document...
                    </>
                  ) : (
                    <>
                      <span>📤</span> Upload & Save Document
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </section>

        {/* =====================================================
            PENDING HR DOCUMENT REQUESTS BANNER (UNMISSABLE ALERT)
        ===================================================== */}
        {pendingRequests.length > 0 && (
          <section
            className="doc-pending-requests-banner"
            style={{
              background: "linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)",
              border: "2px solid #ea580c",
              borderRadius: "14px",
              padding: "1.25rem 1.5rem",
              marginBottom: "1.75rem",
              boxShadow: "0 8px 24px -4px rgba(234, 88, 12, 0.18)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "10px",
                marginBottom: "1rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "1.6rem" }}>⚠️</span>
                <div>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: "1.1rem",
                      fontWeight: "800",
                      color: "#9a3412",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    Action Required: Documents Requested by HR
                    <span
                      style={{
                        background: "#ea580c",
                        color: "white",
                        padding: "2px 9px",
                        borderRadius: "12px",
                        fontSize: "0.75rem",
                        fontWeight: "700",
                      }}
                    >
                      {pendingRequests.length} Pending
                    </span>
                  </h3>
                  <p style={{ margin: "2px 0 0", fontSize: "0.84rem", color: "#c2410c" }}>
                    HR has requested the following compliance verification documents. Please upload the required files below to maintain corporate compliance.
                  </p>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {pendingRequests.map((reqDoc) => (
                <div
                  key={reqDoc._id || reqDoc.id}
                  style={{
                    background: "#ffffff",
                    border: "1px solid #fed7aa",
                    borderRadius: "10px",
                    padding: "0.9rem 1.15rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "12px",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, minWidth: "260px" }}>
                    <div
                      style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "8px",
                        background: "#ffedd5",
                        color: "#ea580c",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "1.25rem",
                      }}
                    >
                      📄
                    </div>
                    <div>
                      <strong style={{ fontSize: "0.96rem", color: "#0f172a", display: "block" }}>
                        {reqDoc.documentType || reqDoc.documentName || "Requested Document"}
                      </strong>
                      <div style={{ fontSize: "0.82rem", color: "#64748b", marginTop: "2px" }}>
                        {reqDoc.requestNote || reqDoc.verificationNotes ? (
                          <span style={{ marginRight: "6px" }}>
                            HR Note:{" "}
                            <strong style={{ color: "#c2410c" }}>
                              "{reqDoc.requestNote || reqDoc.verificationNotes}"
                            </strong>
                            {" • "}
                          </span>
                        ) : null}
                        <span>Requested on {formatDate(reqDoc.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label
                      className="doc-btn download"
                      style={{
                        background: "linear-gradient(135deg, #ea580c 0%, #c2410c 100%)",
                        color: "white",
                        padding: "0.55rem 1.15rem",
                        borderRadius: "8px",
                        fontWeight: "700",
                        fontSize: "0.85rem",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        boxShadow: "0 2px 8px rgba(234, 88, 12, 0.3)",
                        border: "none",
                      }}
                    >
                      <span>📤</span> Select & Upload File
                      <input
                        type="file"
                        onChange={(e) => handleUploadFileForRequest(e, reqDoc)}
                        disabled={busy}
                        hidden
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* =====================================================
            DOCUMENT REPOSITORY VAULT
        ===================================================== */}
        {loading || (error && String(typeof error === "string" ? error : error?.message || "").toLowerCase().includes("authorization")) ? (
          <Loader label="Decrypting and loading documents..." />
        ) : error ? (
          <ErrorMessage message={typeof error === "string" ? error : error?.message || "Failed to load documents"} onRetry={reload} />
        ) : (
          <section className="doc-vault-panel" aria-label="Document Vault">
            <div className="doc-vault-head">
              <div>
                <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: "#0f172a" }}>
                  Verified Documents Vault
                </h2>
                <p style={{ margin: "0.25rem 0 0", color: "#64748b", fontSize: "0.84rem" }}>
                  Displaying {filteredDocs.length} documents.
                </p>
              </div>

              <div className="doc-filter-pills">
                <button
                  type="button"
                  className={`doc-filter-btn ${activeFilter === "all" ? "active" : ""}`}
                  onClick={() => setActiveFilter("all")}
                >
                  All ({totalCount})
                </button>
                <button
                  type="button"
                  className={`doc-filter-btn ${activeFilter === "requested" ? "active" : ""}`}
                  onClick={() => setActiveFilter("requested")}
                  style={
                    requestedCount > 0
                      ? {
                          borderColor: "#ea580c",
                          color: activeFilter === "requested" ? "#fff" : "#ea580c",
                          backgroundColor: activeFilter === "requested" ? "#ea580c" : "#fff7ed",
                          fontWeight: "700",
                        }
                      : {}
                  }
                >
                  ⚠️ Requested by HR ({requestedCount})
                </button>
                <button
                  type="button"
                  className={`doc-filter-btn ${activeFilter === "verified" ? "active" : ""}`}
                  onClick={() => setActiveFilter("verified")}
                >
                  Verified ({verifiedCount})
                </button>
                <button
                  type="button"
                  className={`doc-filter-btn ${activeFilter === "in_review" ? "active" : ""}`}
                  onClick={() => setActiveFilter("in_review")}
                >
                  In Review ({inReviewCount})
                </button>
              </div>
            </div>

            {/* Bulk Selection Bar */}
            {selectedDocIds.length > 0 && (
              <div
                className="doc-bulk-action-bar"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.85rem 1.25rem",
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "12px",
                  marginBottom: "1.25rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  <span
                    style={{
                      background: "#ef4444",
                      color: "#fff",
                      fontSize: "0.75rem",
                      fontWeight: 800,
                      padding: "0.2rem 0.55rem",
                      borderRadius: "999px",
                    }}
                  >
                    {selectedDocIds.length}
                  </span>
                  <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "#991b1b" }}>
                    document{selectedDocIds.length > 1 ? "s" : ""} selected
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  <button
                    type="button"
                    onClick={() => setShowBulkDeleteModal(true)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.4rem",
                      background: "#dc2626",
                      color: "#fff",
                      border: "none",
                      padding: "0.45rem 0.85rem",
                      borderRadius: "8px",
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <span>🗑️</span> Delete Selected ({selectedDocIds.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedDocIds([])}
                    style={{
                      background: "#fff",
                      border: "1px solid #cbd5e1",
                      padding: "0.45rem 0.75rem",
                      borderRadius: "8px",
                      fontSize: "0.82rem",
                      color: "#475569",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Clear Selection
                  </button>
                </div>
              </div>
            )}

            <div className="doc-card-grid">
              {filteredDocs.map((doc) => {
                const docId = String(doc._id || doc.id);
                const isSelected = selectedDocIds.includes(docId);
                const isRequested = doc.status === "requested" || doc.status === "rejected";
                const displayType = doc.documentType || "General Document";
                const titleText =
                  doc.originalName && doc.originalName !== displayType
                    ? doc.originalName
                    : doc.documentName && doc.documentName !== displayType
                    ? doc.documentName
                    : displayType;

                const isTitleSameAsType = titleText.toLowerCase() === displayType.toLowerCase();

                return (
                  <div
                    key={doc._id || doc.id}
                    className={`vault-doc-card ${isRequested ? "urgent-request" : ""} ${isSelected ? "card-selected" : ""}`}
                    style={
                      isSelected
                        ? {
                            border: "2px solid #0d9488",
                            backgroundColor: "#f0fdfa",
                            boxShadow: "0 4px 14px rgba(13, 148, 136, 0.15)",
                            position: "relative",
                          }
                        : isRequested
                        ? {
                            border: "2px solid #ea580c",
                            backgroundColor: "#fffaf5",
                            boxShadow: "0 6px 18px -4px rgba(234, 88, 12, 0.15)",
                            position: "relative",
                          }
                        : { position: "relative" }
                    }
                  >
                    {/* Checkbox */}
                    <div
                      style={{
                        position: "absolute",
                        top: "12px",
                        right: "12px",
                        zIndex: 2,
                      }}
                    >
                      <input
                        type="checkbox"
                        aria-label={`Select ${titleText}`}
                        checked={isSelected}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleToggleSelectDoc(docId);
                        }}
                        style={{
                          width: "18px",
                          height: "18px",
                          cursor: "pointer",
                          accentColor: "#0d9488",
                        }}
                      />
                    </div>
                    <div className="doc-card-top">
                      <div
                        className="doc-type-icon"
                        style={isRequested ? { background: "#ffedd5", color: "#ea580c" } : {}}
                      >
                        {isRequested ? "⚠️" : "📄"}
                      </div>
                      <div className="doc-meta-info">
                        <h4>{titleText}</h4>
                        <p>
                          {doc.description ||
                            doc.requestNote ||
                            (doc.status === "fulfilled"
                              ? "The uploaded file is listed separately and awaiting HR review."
                              : "Official verified employee record on file.")}
                        </p>
                        {isRequested && doc.requestNote && (
                          <div style={{ color: "#ea580c", fontSize: "0.8rem", fontWeight: "700", marginTop: "4px" }}>
                            HR Note: "{doc.requestNote}"
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="doc-card-bottom">
                      <div className="doc-file-info">
                        <div className="doc-file-name-wrap">
                          <span
                            className="doc-file-name"
                            title={displayType}
                          >
                            {isTitleSameAsType ? `Category: ${displayType}` : displayType}
                          </span>
                        </div>
                        <small className="doc-file-date">
                          {isRequested
                            ? `Requested on ${formatDate(doc.createdAt)}`
                            : `Uploaded ${formatDate(doc.createdAt)} ${doc.fileSize ? `• ${doc.fileSize}` : ""}`}
                        </small>
                      </div>

                    <div className="doc-actions-cluster">
                      <span
                        className={`status-chip-badge ${
                          doc.status === "verified"
                            ? "present"
                            : doc.status === "fulfilled"
                            ? "present"
                            : doc.status === "rejected"
                            ? "rose"
                            : "late"
                        }`}
                      >
                        {doc.status === "verified"
                          ? "✓ Verified"
                          : doc.status === "fulfilled"
                          ? "✓ Request Fulfilled"
                          : doc.status === "rejected"
                          ? "✕ Rejected"
                          : "⏳ " + (doc.status || "In Review")}
                      </span>

                      {(doc.status === "requested" || doc.status === "rejected") ? (
                        <label
                          className="doc-btn download"
                          style={{ background: "#ea580c", color: "white", cursor: "pointer", border: "none", display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
                          title="Upload requested file"
                        >
                          📤 Select & Upload File
                          <input
                            type="file"
                            onChange={(e) => handleUploadFileForRequest(e, doc)}
                            disabled={busy}
                            hidden
                          />
                        </label>
                      ) : doc.status === "fulfilled" ? (
                        <span className="doc-request-fulfilled-note">Uploaded file listed separately</span>
                      ) : (
                        <button
                          type="button"
                          className="doc-btn download"
                          onClick={() => handleDownload(doc)}
                          title="Download Document"
                        >
                          📥 Download
                        </button>
                      )}

                      <button
                        type="button"
                        className="doc-btn delete"
                        onClick={() => handleDeleteDocument(doc)}
                        title="Delete Document"
                        disabled={busy}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            </div>
          </section>
        )}

        {/* Bulk Delete Modal */}
        {showBulkDeleteModal && (
          <div
            className="modal-backdrop-wrap"
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.6)",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              padding: "1rem",
            }}
            onClick={() => !busy && setShowBulkDeleteModal(false)}
          >
            <div
              style={{
                background: "#fff",
                borderRadius: "16px",
                maxWidth: "480px",
                width: "100%",
                padding: "1.5rem",
                boxShadow: "0 20px 40px rgba(0, 0, 0, 0.2)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ margin: "0 0 0.75rem", fontSize: "1.15rem", color: "#991b1b", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span>🗑️</span> Delete {selectedDocIds.length} Selected Documents?
              </h3>
              <p style={{ margin: "0 0 1rem", fontSize: "0.9rem", color: "#334155", lineHeight: 1.5 }}>
                Are you sure you want to permanently delete these <strong>{selectedDocIds.length}</strong> selected documents from your vault? This action cannot be undone.
              </p>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setShowBulkDeleteModal(false)}
                  style={{
                    padding: "0.55rem 1rem",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    background: "#fff",
                    color: "#475569",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleBulkDelete}
                  style={{
                    padding: "0.55rem 1rem",
                    borderRadius: "8px",
                    border: "none",
                    background: "#dc2626",
                    color: "#fff",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {busy ? "Deleting..." : `Delete ${selectedDocIds.length} Documents`}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

export default EmployeeDocuments;

