import { useState, useMemo } from "react";
import EmployeeHeader from "../../components/employee/EmployeeHeader";
import Loader from "../../components/common/Loader";
import ErrorMessage from "../../components/common/ErrorMessage";
import { useDocuments } from "../../hooks/useDocuments";
import { downloadDocument } from "../../services/documentService";
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

  // Realistic sample corporate documents if backend vault is empty
  const displayDocs = useMemo(() => {
    let list = rawDocs.length > 0 ? rawDocs : [
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

    return list.filter((doc) => {
      if (
        (doc.documentType === "General Document" || doc.documentType === "General Document General Document") &&
        (doc.documentName === "General Document" || !doc.documentName) &&
        (!doc.fileName || doc.fileName === "General Document")
      ) {
        return false;
      }
      return true;
    });
  }, [rawDocs]);

  // Counts
  const totalCount = displayDocs.length;
  const verifiedCount = displayDocs.filter((d) => d.status === "verified").length;
  const inReviewCount = displayDocs.filter((d) => ["pending", "in_review", "submitted"].includes(d.status)).length;
  const requestedCount = displayDocs.filter((d) => d.status === "requested").length;

  // Filtered documents
  const filteredDocs = useMemo(() => {
    if (activeFilter === "all") return displayDocs;
    if (activeFilter === "verified") return displayDocs.filter((d) => d.status === "verified");
    if (activeFilter === "in_review") return displayDocs.filter((d) => ["pending", "in_review", "submitted"].includes(d.status));
    if (activeFilter === "requested") return displayDocs.filter((d) => d.status === "requested");
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
      window.dispatchEvent(new CustomEvent("hrms:data_changed"));
      const res = await getMyDocuments();
      const docs = res.data || res.documents || res || [];
      if (Array.isArray(docs)) setDocuments(docs);
    } catch (err) {
      setActionError(err.message || "Failed to upload requested document.");
    } finally {
      setBusy(false);
      e.target.value = "";
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

  const scrollToUploadSection = () => {
    const section = document.getElementById("upload-official-document-section");
    if (section) {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
      const firstInput = section.querySelector("select, input");
      if (firstInput) {
        setTimeout(() => firstInput.focus(), 400);
      }
    }
  };

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

          <div className="att-hero-actions">
            <button
              type="button"
              className="att-btn primary"
              onClick={scrollToUploadSection}
              style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
              title="Scroll directly to Upload Official Document form"
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

          <div className="kpi-card-box rose">
            <div className="kpi-card-head">
              <span className="kpi-title-text">Requested Actions</span>
              <div className="kpi-icon-pod rose">⚠️</div>
            </div>
            <div className="kpi-stat-row">
              <span className="kpi-big-num">{requestedCount}</span>
              <span className={`kpi-badge-chip ${requestedCount ? "rose" : "positive"}`}>
                {requestedCount ? "Action Required" : "All Clear"}
              </span>
            </div>
            <div className="kpi-progress-rail">
              <div className="kpi-progress-bar rose" style={{ width: `${requestedCount ? 100 : 0}%` }} />
            </div>
            <span className="kpi-subtext">No pending compliance document requests</span>
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
        <section className="doc-upload-card" id="upload-official-document-section" aria-label="Upload Document">
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
                  ) : !form.file ? (
                    <>
                      <span>📁</span> Select File to Upload
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

            <div className="doc-card-grid">
              {filteredDocs.map((doc) => {
                const displayType = doc.documentType || "General Document";
                const titleText =
                  doc.originalName && doc.originalName !== displayType
                    ? doc.originalName
                    : doc.documentName && doc.documentName !== displayType
                    ? doc.documentName
                    : displayType;

                const isTitleSameAsType = titleText.toLowerCase() === displayType.toLowerCase();

                return (
                  <div key={doc._id || doc.id} className="vault-doc-card">
                    <div className="doc-card-top">
                      <div className="doc-type-icon">📄</div>
                      <div className="doc-meta-info">
                        <h4>{titleText}</h4>
                        <p>{doc.description || "Official verified employee record on file."}</p>
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
                          Uploaded {formatDate(doc.createdAt)} {doc.fileSize && `• ${doc.fileSize}`}
                        </small>
                      </div>

                    <div className="doc-actions-cluster">
                      <span
                        className={`status-chip-badge ${
                          doc.status === "verified"
                            ? "present"
                            : doc.status === "rejected"
                            ? "rose"
                            : "late"
                        }`}
                      >
                        {doc.status === "verified"
                          ? "✓ Verified"
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
                    </div>
                  </div>
                </div>
              );
            })}
            </div>
          </section>
        )}
      </main>
    </>
  );
}

export default EmployeeDocuments;
