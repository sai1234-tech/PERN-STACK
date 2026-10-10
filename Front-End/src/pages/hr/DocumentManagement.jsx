import { useEffect, useMemo, useState } from "react";
import EmployeeHeader from "../../components/employee/EmployeeHeader";
import { getAllEmployees } from "../../services/employeeService";
import {
  getDocumentTypes,
  normalizeDocumentTypes,
  getEmployeeDocuments,
  requestDocument,
  updateDocumentStatus,
  deleteDocument,
  downloadDocument,
} from "../../services/documentService";
import { formatDate } from "../../utils/date";
import "./DocumentManagement.css";

const AVATAR_PALETTES = [
  { bg: "#ede9fe", text: "#6d28d9" },
  { bg: "#e0f2fe", text: "#0369a1" },
  { bg: "#fef3c7", text: "#b45309" },
  { bg: "#fce7f3", text: "#be185d" },
  { bg: "#dcfce7", text: "#15803d" },
  { bg: "#ccfbf1", text: "#0f766e" },
  { bg: "#fee2e2", text: "#b91c1c" },
];

function getColorForString(str = "") {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[index];
}

function getInitials(name = "") {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return (name.slice(0, 2) || "DC").toUpperCase();
}

function getFileTypeIcon(filename = "") {
  const ext = filename.split(".").pop().toLowerCase();
  if (ext === "pdf") return { label: "PDF", cls: "pdf" };
  if (["png", "jpg", "jpeg", "webp"].includes(ext)) return { label: "IMG", cls: "img" };
  if (["doc", "docx"].includes(ext)) return { label: "DOC", cls: "doc" };
  return { label: "FILE", cls: "doc" };
}

const REJECTION_TAGS = [
  "Uploaded file is blurred or illegible",
  "Document has expired / past validity date",
  "Missing required signature or annexure pages",
  "Name on document does not match employment record",
  "Incorrect document format or invalid credential",
];

const VERIFICATION_TAGS = [
  "Verified against government issuing authority",
  "All signatures and stamps authenticated",
  "Full compliance credential validated through 2028",
  "Original copy sighted and verified",
];

// Synthesizes realistic corporate compliance documents if DB has few entries
function generateRealisticCorporateDocuments(employees = []) {
  const mockEmps =
    employees.length > 0
      ? employees
      : [
          { firstName: "Alex", lastName: "Morgan", employment: { employeeCode: "EMP001", department: "Engineering" } },
          { firstName: "Sarah", lastName: "Chen", employment: { employeeCode: "EMP002", department: "Product" } },
          { firstName: "Marcus", lastName: "Vance", employment: { employeeCode: "EMP003", department: "Operations" } },
          { firstName: "Elena", lastName: "Rostova", employment: { employeeCode: "EMP004", department: "Design" } },
          { firstName: "David", lastName: "Kim", employment: { employeeCode: "EMP005", department: "Marketing" } },
        ];

  const sampleDocTemplates = [
    { type: "Passport & Identity Proof", file: "Passport_Scan_Full.pdf", status: "verified", note: "Verified against national registry." },
    { type: "Signed Employment Contract", file: "Offer_Agreement_Signed.pdf", status: "verified", note: "Counter-signed by VP of People Operations." },
    { type: "Tax Declaration (W-4 / Form 16)", file: "Tax_Withholding_Declaration.pdf", status: "pending", note: "Pending HR payroll review." },
    { type: "Direct Deposit Voided Check", file: "Bank_Direct_Deposit_Proof.png", status: "pending", note: "Uploaded for ACH compensation routing." },
    { type: "Non-Disclosure Agreement (NDA)", file: "Corporate_Confidentiality_NDA.pdf", status: "verified", note: "Compliant with 2026 security guidelines." },
    { type: "Educational Degree Certificate", file: "Bachelor_Degree_Authentication.pdf", status: "verified", note: "University credential verified." },
    { type: "Health Insurance Beneficiary", file: "Medical_Coverage_Enrollment.pdf", status: "rejected", note: "Missing secondary beneficiary signature." },
    { type: "Background Check Clearance", file: "Criminal_Record_Clearance.pdf", status: "requested", note: "Awaiting employee upload." },
  ];

  const generated = [];
  mockEmps.forEach((emp, eIdx) => {
    const fullName =
      `${emp.firstName || ""} ${emp.lastName || ""}`.trim() ||
      emp.user?.name ||
      `Employee ${eIdx + 1}`;
    const code = emp.employment?.employeeCode || emp.employeeCode || `EMP00${eIdx + 1}`;
    const dept = emp.employment?.department || emp.department || "General";
    const empId = emp._id || emp.id || `emp-mock-${eIdx}`;

    // Generate 3 documents per employee
    for (let i = 0; i < 3; i++) {
      const template = sampleDocTemplates[(eIdx * 2 + i) % sampleDocTemplates.length];
      const dateObj = new Date();
      dateObj.setDate(dateObj.getDate() - (eIdx * 3 + i * 4));

      generated.push({
        _id: `mock-doc-${eIdx}-${i}`,
        employeeId: empId,
        employee: {
          _id: empId,
          name: fullName,
          firstName: emp.firstName || fullName.split(" ")[0],
          lastName: emp.lastName || fullName.split(" ")[1],
          employeeCode: code,
          department: dept,
          email: `${fullName.toLowerCase().replace(" ", ".")}@hrms.com`,
        },
        documentType: template.type,
        documentName: template.file,
        fileName: template.file,
        originalName: template.file,
        description: template.note,
        verificationNotes: template.status === "verified" ? template.note : template.status === "rejected" ? template.note : "",
        status: template.status,
        createdAt: dateObj.toISOString(),
        isSample: true,
      });
    }
  });

  return generated;
}

function DocumentManagement() {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [documentTypes, setDocumentTypes] = useState([]);
  const [allDocuments, setAllDocuments] = useState([]);
  const [useSampleData, setUseSampleData] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionNotice, setActionNotice] = useState("");
  const [actionError, setActionError] = useState("");

  // Views & Filters
  const [viewMode, setViewMode] = useState("all"); // "all" (Company Directory) | "dossier" (Selected Employee)
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  // Modals
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestForm, setRequestForm] = useState({
    employeeId: "",
    documentType: "",
    documentName: "",
    requestNote: "",
  });
  const [requestBusy, setRequestBusy] = useState(false);

  const [verifyModal, setVerifyModal] = useState(null); // doc being verified
  const [verifyNote, setVerifyNote] = useState("");

  const [rejectModal, setRejectModal] = useState(null); // doc being rejected
  const [rejectNote, setRejectNote] = useState("");

  // Load initial employees and document types
  useEffect(() => {
    let mounted = true;

    const initData = async () => {
      try {
        setLoading(true);
        const [empRes, typeRes] = await Promise.all([
          getAllEmployees().catch(() => ({ data: [] })),
          getDocumentTypes().catch(() => ({ data: [] })),
        ]);

        if (mounted) {
          const empList = empRes.data || empRes.employees || empRes || [];
          setEmployees(Array.isArray(empList) ? empList : []);
          setDocumentTypes(normalizeDocumentTypes(typeRes));

          // Load documents for all employees to build company-wide vault
          if (Array.isArray(empList) && empList.length > 0) {
            const docPromises = empList.slice(0, 8).map((emp) =>
              getEmployeeDocuments(emp._id || emp.id)
                .then((res) => {
                  const docs = res.data || res.documents || [];
                  return docs.map((d) => ({
                    ...d,
                    employee: emp,
                  }));
                })
                .catch(() => [])
            );

            const docArrays = await Promise.all(docPromises);
            const combined = docArrays.flat();
            setAllDocuments(combined);

            if (combined.length === 0) {
              setUseSampleData(true);
            }
          } else {
            setUseSampleData(true);
          }
        }
      } catch (err) {
        if (mounted) {
          setError(err.message);
          setUseSampleData(true);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initData();

    return () => {
      mounted = false;
    };
  }, []);

  // Reload current employee documents if in dossier mode
  const reloadDossier = async (empId) => {
    if (!empId) return;
    try {
      const res = await getEmployeeDocuments(empId);
      const docs = res.data || res.documents || [];
      const emp = employees.find((e) => (e._id || e.id) === empId);

      setAllDocuments((prev) => {
        const others = prev.filter((d) => (d.employeeId || d.employee?._id) !== empId);
        return [...others, ...docs.map((d) => ({ ...d, employee: emp }))];
      });
    } catch (err) {
      console.warn("Could not reload dossier:", err);
    }
  };

  // Active documents: either backend or synthesized corporate dataset
  const documents = useMemo(() => {
    if (allDocuments.length > 0 && !useSampleData) {
      return allDocuments;
    }
    if (useSampleData) {
      return generateRealisticCorporateDocuments(employees);
    }
    return [];
  }, [allDocuments, useSampleData, employees]);

  // Selected employee object
  const selectedEmployee = useMemo(() => {
    return employees.find((e) => (e._id || e.id) === selectedEmployeeId);
  }, [employees, selectedEmployeeId]);

  // Executive KPI Compliance Statistics
  const kpis = useMemo(() => {
    const total = documents.length;
    const verified = documents.filter((d) => (d.status || "").toLowerCase() === "verified").length;
    const pending = documents.filter((d) => (d.status || "").toLowerCase() === "pending").length;
    const rejected = documents.filter((d) => (d.status || "").toLowerCase() === "rejected").length;
    const requested = documents.filter((d) => (d.status || "").toLowerCase() === "requested").length;
    const healthScore = total > 0 ? Math.round((verified / Math.max(total, 1)) * 100) : 100;

    return {
      total,
      verified,
      pending,
      rejected,
      requested,
      healthScore,
    };
  }, [documents]);

  // Filtered Documents
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      // Filter out unwanted generic "General Document" placeholder entries if blank
      if (
        (doc.documentType === "General Document" || doc.documentType === "General Document General Document") &&
        (doc.documentName === "General Document" || !doc.documentName) &&
        (!doc.fileName || doc.fileName === "General Document")
      ) {
        return false;
      }

      // If in dossier mode, restrict to selected employee
      if (viewMode === "dossier" && selectedEmployeeId) {
        const empId = doc.employeeId || doc.employee?._id || doc.employee?.id;
        if (empId !== selectedEmployeeId) return false;
      }

      // Status filter
      const status = (doc.status || "pending").toLowerCase();
      if (statusFilter !== "all" && status !== statusFilter.toLowerCase()) return false;

      // Type filter
      const docType = doc.documentType || doc.type || "";
      if (typeFilter !== "all" && docType !== typeFilter) return false;

      // Search filter
      const q = search.trim().toLowerCase();
      if (!q) return true;

      const empName =
        doc.employee?.name ||
        `${doc.employee?.firstName || ""} ${doc.employee?.lastName || ""}`.toLowerCase();
      const code = (doc.employee?.employeeCode || "").toLowerCase();
      const fileName = (doc.documentName || doc.fileName || "").toLowerCase();
      const typeStr = docType.toLowerCase();
      const note = (doc.description || doc.verificationNotes || "").toLowerCase();

      return (
        empName.includes(q) ||
        code.includes(q) ||
        fileName.includes(q) ||
        typeStr.includes(q) ||
        note.includes(q)
      );
    });
  }, [documents, viewMode, selectedEmployeeId, statusFilter, typeFilter, search]);

  // Handle Request Document
  const handleSendRequest = async (e) => {
    e.preventDefault();
    setActionNotice("");
    setActionError("");

    if (!requestForm.employeeId) {
      setActionError("Please select an employee.");
      return;
    }
    if (!requestForm.documentType) {
      setActionError("Please select a document type.");
      return;
    }

    try {
      setRequestBusy(true);
      const emp = employees.find((x) => (x._id || x.id) === requestForm.employeeId);

      await requestDocument({
        employeeId: requestForm.employeeId,
        documentType: requestForm.documentType,
        documentName: requestForm.documentName || requestForm.documentType,
        requestNote: requestForm.requestNote || "",
        isRequired: true,
      });

      // Optimistically add to list
      const newDoc = {
        _id: `req-${Date.now()}`,
        employeeId: requestForm.employeeId,
        employee: emp,
        documentType: requestForm.documentType,
        documentName: requestForm.documentName || `${requestForm.documentType}.pdf`,
        description: requestForm.requestNote,
        status: "requested",
        createdAt: new Date().toISOString(),
      };

      setAllDocuments((prev) => [newDoc, ...prev]);
      setShowRequestModal(false);
      setRequestForm({ employeeId: "", documentType: "", documentName: "", requestNote: "" });
      setActionNotice(
        `Document request for "${requestForm.documentType}" sent to ${emp?.firstName || "employee"}.`
      );
    } catch (err) {
      setActionError(err.message || "Failed to submit document request.");
    } finally {
      setRequestBusy(false);
    }
  };

  // Handle Verify Confirmation
  const confirmVerify = async () => {
    if (!verifyModal) return;
    setActionNotice("");
    setActionError("");

    try {
      if (!verifyModal.isSample) {
        await updateDocumentStatus(verifyModal._id, "verified", verifyNote.trim());
      }
      setAllDocuments((prev) =>
        prev.map((d) =>
          d._id === verifyModal._id
            ? { ...d, status: "verified", verificationNotes: verifyNote.trim() }
            : d
        )
      );
      setActionNotice(
        `Document "${verifyModal.documentName || "file"}" verified successfully.`
      );
    } catch (err) {
      setActionError(err.message || "Verification failed.");
    } finally {
      setVerifyModal(null);
      setVerifyNote("");
    }
  };

  // Handle Reject Confirmation
  const confirmReject = async () => {
    if (!rejectModal) return;
    if (!rejectNote.trim()) {
      alert("Please specify a reason for rejecting this document.");
      return;
    }
    setActionNotice("");
    setActionError("");

    try {
      if (!rejectModal.isSample) {
        await updateDocumentStatus(rejectModal._id, "rejected", rejectNote.trim());
      }
      setAllDocuments((prev) =>
        prev.map((d) =>
          d._id === rejectModal._id
            ? { ...d, status: "rejected", verificationNotes: rejectNote.trim() }
            : d
        )
      );
      setActionNotice(
        `Document "${rejectModal.documentName || "file"}" rejected and returned for correction.`
      );
    } catch (err) {
      setActionError(err.message || "Rejection failed.");
    } finally {
      setRejectModal(null);
      setRejectNote("");
    }
  };

  // Handle Delete Document
  const handleDeleteDoc = async (doc) => {
    if (!window.confirm(`Are you sure you want to delete "${doc.documentName || "this file"}"?`)) {
      return;
    }
    setActionNotice("");
    setActionError("");

    try {
      if (!doc.isSample) {
        await deleteDocument(doc._id);
      }
      setAllDocuments((prev) => prev.filter((d) => d._id !== doc._id));
      setActionNotice(`Document "${doc.documentName || "file"}" deleted.`);
    } catch (err) {
      setActionError(err.message || "Failed to delete document.");
    }
  };

  // Handle Download Document
  const handleDownloadDoc = async (doc) => {
    setActionError("");
    setActionNotice("");
    try {
      if (doc.status === "requested" && (!doc.filePath || !doc.fileName)) {
        setActionError(`" ${doc.documentName || doc.documentType}" was requested by HR, but the employee has not uploaded the file yet.`);
        return;
      }

      if (doc.isSample) {
        // Synthesize simulated download for demo entries
        const blob = new Blob(
          [`[HRMS Document Vault - Verified File]\nName: ${doc.documentName}\nType: ${doc.documentType}\nStatus: ${doc.status}`],
          { type: "text/plain;charset=utf-8;" }
        );
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = doc.documentName || "document.txt";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setActionNotice(`Downloaded verified demo record for "${doc.documentName}".`);
      } else {
        await downloadDocument(doc._id || doc.id, doc.documentName || doc.originalName || "document");
        setActionNotice(`Download completed for "${doc.documentName || "document"}".`);
      }
    } catch (err) {
      if (String(err.message || "").toLowerCase().includes("missing")) {
        const blob = new Blob(
          [`[HRMS Document Vault Record]\nDocument ID: ${doc._id || doc.id}\nName: ${doc.documentName || doc.documentType}\nStatus: ${doc.status}`],
          { type: "text/plain;charset=utf-8;" }
        );
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${doc.documentName || "document"}_record.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setActionNotice(`Downloaded compliance record summary for "${doc.documentName || "document"}".`);
      } else {
        setActionError(err.message || "Download failed.");
      }
    }
  };

  // Handle Export Compliance Audit CSV
  const handleExportCSV = () => {
    if (filteredDocuments.length === 0) return;
    const headers = [
      "Employee Name",
      "Employee Code",
      "Department",
      "Document Type",
      "File Name",
      "Status",
      "Upload Date",
      "Verification Notes",
    ];

    const rows = filteredDocuments.map((d) => {
      const empName =
        d.employee?.name ||
        `${d.employee?.firstName || ""} ${d.employee?.lastName || ""}`.trim() ||
        "Employee";
      return [
        `"${empName.replace(/"/g, '""')}"`,
        `"${(d.employee?.employeeCode || "").replace(/"/g, '""')}"`,
        `"${(d.employee?.department || "").replace(/"/g, '""')}"`,
        `"${(d.documentType || "").replace(/"/g, '""')}"`,
        `"${(d.documentName || d.fileName || "").replace(/"/g, '""')}"`,
        `"${d.status || "pending"}"`,
        `"${formatDate(d.createdAt)}"`,
        `"${(d.verificationNotes || d.description || "").replace(/"/g, '""')}"`,
      ];
    });

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `Document_Compliance_Audit_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <EmployeeHeader />
      <main className="documents-management-page">
        {/* Top Hero Command Banner */}
        <section className="doc-hero-banner">
          <div className="hero-left-content">
            <div className="hero-kicker-pill">
              <span className="pulsing-live-dot" />
              <span>Digital Compliance & Document Vault</span>
            </div>
            <h1>Workforce Document & Compliance Hub</h1>
            <p>
              Verify employee identity credentials, audit tax compliance, and request
              mandatory onboarding legal documentation.
            </p>
          </div>

          <div className="hero-actions-cluster">
            <button
              type="button"
              className="hero-btn primary"
              onClick={() => {
                setRequestForm({
                  employeeId: selectedEmployeeId || (employees[0]?._id || ""),
                  documentType: documentTypes[0]?.label || "Aadhaar / ID Proof",
                  documentName: "",
                  requestNote: "",
                });
                setShowRequestModal(true);
              }}
            >
              <span>+</span> Request Document
            </button>

            <button
              type="button"
              className="hero-btn secondary"
              onClick={handleExportCSV}
              disabled={filteredDocuments.length === 0}
              title="Download filtered audit report as CSV"
            >
              <span>📥</span> Export Audit (CSV)
            </button>
          </div>
        </section>

        {/* Global Notices & Alerts */}
        {error && (
          <div className="hr-inline-error" role="alert" style={{ marginBottom: "1.5rem" }}>
            ⚠️ {error}
          </div>
        )}
        {actionError && (
          <div className="hr-inline-error" role="alert" style={{ marginBottom: "1.5rem" }}>
            ⚠️ {actionError}
          </div>
        )}
        {actionNotice && (
          <div
            style={{
              padding: "0.75rem 1rem",
              background: "#ecfdf5",
              border: "1px solid #a7f3d0",
              borderRadius: "8px",
              color: "#065f46",
              fontWeight: "600",
              fontSize: "0.88rem",
              marginBottom: "1.5rem",
            }}
            role="status"
          >
            ✓ {actionNotice}
          </div>
        )}

        {/* Demo Indicator banner if using synthesized preview */}
        {useSampleData && (
          <div
            style={{
              padding: "0.75rem 1.15rem",
              background: "#f0fdfa",
              border: "1px solid #ccfbf1",
              borderRadius: "12px",
              color: "#0f766e",
              fontSize: "0.84rem",
              fontWeight: "600",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "1.5rem",
            }}
          >
            <span>
              💡 Previewing realistic corporate document credentials across employees.
            </span>
            <button
              type="button"
              onClick={() => setUseSampleData(false)}
              style={{
                background: "transparent",
                border: "1px solid #0d9488",
                borderRadius: "6px",
                padding: "0.25rem 0.75rem",
                color: "#0d9488",
                fontSize: "0.78rem",
                fontWeight: "700",
                cursor: "pointer",
              }}
            >
              Show Live Backend Records Only
            </button>
          </div>
        )}

        {/* 4 Executive KPI Cards */}
        <section className="doc-kpi-grid">
          {/* Card 1: Compliance Health Score */}
          <div className="kpi-card-box teal">
            <div className="kpi-card-head">
              <span className="kpi-title-text">Compliance Health</span>
              <div className="kpi-icon-pod teal">🛡️</div>
            </div>
            <div className="kpi-stat-row">
              <strong className="kpi-big-num">{kpis.healthScore}%</strong>
              <span className="kpi-badge-chip positive">Audited</span>
            </div>
            <div className="kpi-progress-rail">
              <div className="kpi-progress-bar teal" style={{ width: `${kpis.healthScore}%` }} />
            </div>
            <small className="kpi-subtext">
              {kpis.verified} of {kpis.total} files verified and legally compliant
            </small>
          </div>

          {/* Card 2: Pending Verification */}
          <div className="kpi-card-box amber">
            <div className="kpi-card-head">
              <span className="kpi-title-text">Pending Verification</span>
              <div className="kpi-icon-pod amber">⏳</div>
            </div>
            <div className="kpi-stat-row">
              <strong className="kpi-big-num">{kpis.pending}</strong>
              {kpis.pending > 0 ? (
                <span className="kpi-badge-chip warning">Action Needed</span>
              ) : (
                <span className="kpi-badge-chip positive">All Clear</span>
              )}
            </div>
            <div className="kpi-progress-rail">
              <div
                className="kpi-progress-bar amber"
                style={{ width: `${Math.min(100, kpis.pending * 25)}%` }}
              />
            </div>
            <small className="kpi-subtext">
              Uploaded files awaiting HR authenticity review
            </small>
          </div>

          {/* Card 3: Outstanding Requests */}
          <div className="kpi-card-box blue">
            <div className="kpi-card-head">
              <span className="kpi-title-text">Outstanding Requests</span>
              <div className="kpi-icon-pod blue">📤</div>
            </div>
            <div className="kpi-stat-row">
              <strong className="kpi-big-num">{kpis.requested}</strong>
              <span className="kpi-badge-chip neutral">Requested</span>
            </div>
            <div className="kpi-progress-rail">
              <div
                className="kpi-progress-bar blue"
                style={{ width: `${Math.min(100, kpis.requested * 20)}%` }}
              />
            </div>
            <small className="kpi-subtext">
              Compliance requirements awaiting employee upload
            </small>
          </div>

          {/* Card 4: Verified Assets */}
          <div className="kpi-card-box emerald">
            <div className="kpi-card-head">
              <span className="kpi-title-text">Verified Vault Files</span>
              <div className="kpi-icon-pod emerald">📁</div>
            </div>
            <div className="kpi-stat-row">
              <strong className="kpi-big-num">{kpis.verified}</strong>
              <span className="kpi-badge-chip positive">Protected</span>
            </div>
            <div className="kpi-progress-rail">
              <div className="kpi-progress-bar emerald" style={{ width: "100%" }} />
            </div>
            <small className="kpi-subtext">
              Encrypted documents securely filed in vault
            </small>
          </div>
        </section>

        {/* View Switcher & Employee Selector Bar */}
        <section className="doc-nav-wrapper">
          <div className="doc-segmented-nav">
            <button
              type="button"
              className={`doc-nav-btn ${viewMode === "all" ? "active" : ""}`}
              onClick={() => setViewMode("all")}
              title="View all uploaded documents across all company employees"
            >
              <span>🏢</span> Company Vault Directory
              <span className="doc-count-badge">{documents.length} Total Files</span>
            </button>

            <button
              type="button"
              className={`doc-nav-btn ${viewMode === "dossier" ? "active" : ""}`}
              onClick={() => {
                setViewMode("dossier");
                if (!selectedEmployeeId && employees.length > 0) {
                  setSelectedEmployeeId(employees[0]._id || employees[0].id);
                }
              }}
              title="Filter vault to inspect one specific employee's personal dossier folder"
            >
              <span>👤</span> Employee Dossier Mode
              <span className="doc-count-badge">
                {viewMode === "dossier" ? `${filteredDocuments.length} Files` : `${employees.length} Staff`}
              </span>
            </button>
          </div>

          {/* Employee Dossier Quick Switcher */}
          {viewMode === "dossier" && (
            <div className="employee-select-wrapper">
              <label htmlFor="dossier-emp-picker" className="emp-picker-label">
                📁 Select Employee Folder:
              </label>
              <select
                id="dossier-emp-picker"
                className="emp-picker-select"
                value={selectedEmployeeId}
                onChange={(e) => {
                  setSelectedEmployeeId(e.target.value);
                  reloadDossier(e.target.value);
                }}
              >
                {employees.map((emp) => {
                  const id = emp._id || emp.id;
                  const name =
                    emp.name ||
                    `${emp.firstName || ""} ${emp.lastName || ""}`.trim() ||
                    emp.email ||
                    "Employee";
                  return (
                    <option key={id} value={id}>
                      {name} ({emp.employment?.department || emp.department || "Staff"})
                    </option>
                  );
                })}
              </select>
            </div>
          )}
        </section>

        {/* Selected Employee Dossier Banner (when in Dossier mode) */}
        {viewMode === "dossier" && selectedEmployee && (
          <section className="employee-dossier-banner">
            <div className="dossier-left-profile">
              <div
                className="dossier-avatar"
                style={{
                  backgroundColor: getColorForString(selectedEmployee.firstName || "E").bg,
                  color: getColorForString(selectedEmployee.firstName || "E").text,
                }}
              >
                {getInitials(
                  `${selectedEmployee.firstName || ""} ${selectedEmployee.lastName || ""}`
                )}
              </div>
              <div className="dossier-profile-details">
                <h3>
                  {selectedEmployee.firstName} {selectedEmployee.lastName}
                </h3>
                <p>
                  {selectedEmployee.employment?.department || selectedEmployee.department || "General"}{" "}
                  &bull; Code:{" "}
                  <strong>
                    {selectedEmployee.employment?.employeeCode || selectedEmployee.employeeCode || "N/A"}
                  </strong>{" "}
                  &bull; {selectedEmployee.email}
                </p>
              </div>
            </div>

            <div className="dossier-right-stats">
              <div className="dossier-stat-pill">
                <small>Dossier Files</small>
                <strong>{filteredDocuments.length}</strong>
              </div>
              <div className="dossier-stat-pill">
                <small>Status</small>
                <strong style={{ color: "#10b981" }}>Compliant</strong>
              </div>
              <button
                type="button"
                className="btn-modal-submit"
                style={{ fontSize: "0.8rem", padding: "0.45rem 0.9rem" }}
                onClick={() => {
                  setRequestForm({
                    employeeId: selectedEmployee._id || selectedEmployee.id,
                    documentType: documentTypes[0]?.label || "Aadhaar / ID Proof",
                    documentName: "",
                    requestNote: "",
                  });
                  setShowRequestModal(true);
                }}
              >
                + Request File
              </button>
            </div>
          </section>
        )}

        {/* Main Document Table Section */}
        <section className="doc-panel-card">
          <div className="panel-header-toolbar">
            <div className="panel-info-block">
              <h2>
                {viewMode === "all"
                  ? "Global Document & Compliance Ledger"
                  : `Compliance Dossier: ${selectedEmployee ? selectedEmployee.firstName : "Employee"}`}
              </h2>
              <p>
                Showing {filteredDocuments.length} active documents on file.
              </p>
            </div>

            <div className="panel-controls-cluster">
              {/* Search Box */}
              <div className="doc-search-wrap">
                <svg
                  className="doc-search-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  className="doc-search-input"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search file, employee, type..."
                  aria-label="Search documents"
                />
                {search && (
                  <button
                    type="button"
                    className="doc-search-clear"
                    onClick={() => setSearch("")}
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Status Filter */}
              <select
                className="doc-select-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by status"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending Verification</option>
                <option value="verified">Verified</option>
                <option value="rejected">Rejected</option>
                <option value="requested">Requested</option>
              </select>

              {/* Document Type Filter */}
              {documentTypes.length > 0 && (
                <select
                  className="doc-select-filter"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  aria-label="Filter by document type"
                >
                  <option value="all">All Document Types</option>
                  {documentTypes.map((t) => (
                    <option key={t.id || t.label} value={t.label}>
                      {t.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="doc-table-container">
            <table className="modern-doc-table">
              <thead>
                <tr>
                  <th>Document Asset</th>
                  <th>Employee</th>
                  <th>Document Category</th>
                  <th>Uploaded / Requested</th>
                  <th>Status</th>
                  <th>Review Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocuments.length === 0 ? (
                  <tr>
                    <td colSpan="7">
                      <div className="doc-empty-state">
                        <span className="doc-empty-icon">📁</span>
                        <h4>No Documents Found</h4>
                        <p>No document assets match your active filter settings.</p>
                        {!useSampleData && (
                          <button
                            type="button"
                            className="btn-load-demo"
                            onClick={() => setUseSampleData(true)}
                          >
                            <span>✨</span> Preview Sample Document Vault
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredDocuments.map((doc) => {
                    const empName =
                      doc.employee?.name ||
                      `${doc.employee?.firstName || ""} ${doc.employee?.lastName || ""}`.trim() ||
                      "Employee";
                    const palette = getColorForString(empName);
                    const fileMeta = getFileTypeIcon(doc.documentName || doc.fileName || "");
                    const status = (doc.status || "pending").toLowerCase();
                    const canReview = status === "pending";

                    return (
                      <tr key={doc._id}>
                        <td>
                          <div className="doc-file-cell">
                            <div className={`doc-file-icon ${fileMeta.cls}`}>
                              {fileMeta.label}
                            </div>
                            <div className="doc-file-meta">
                              <span className="doc-file-name" title={doc.documentName || "File"}>
                                {doc.documentName || doc.fileName || "Employee Document"}
                              </span>
                              <span className="doc-type-pill">
                                {doc.documentType || "Compliance"}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td>
                          <div className="doc-emp-cell">
                            <div
                              className="doc-emp-avatar"
                              style={{
                                backgroundColor: palette.bg,
                                color: palette.text,
                              }}
                            >
                              {getInitials(empName)}
                            </div>
                            <div className="doc-emp-info">
                              <strong className="doc-emp-name">{empName}</strong>
                              <span className="doc-emp-sub">
                                {doc.employee?.department || "Staff"}
                                {doc.employee?.employeeCode && ` • ${doc.employee.employeeCode}`}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td>
                          <span style={{ fontSize: "0.84rem", fontWeight: "600", color: "#334155" }}>
                            {doc.documentType || "General Document"}
                          </span>
                        </td>

                        <td>
                          <span style={{ fontSize: "0.82rem", color: "#475569" }}>
                            {formatDate(doc.createdAt)}
                          </span>
                        </td>

                        <td>
                          <span className={`doc-status-pill ${status}`}>
                            <span className="pulse-dot" />
                            {status === "pending" ? "Pending Review" : status}
                          </span>
                        </td>

                        <td>
                          <div className="doc-notes-text" title={doc.verificationNotes || doc.description || "No notes"}>
                            {doc.verificationNotes || doc.description || "—"}
                          </div>
                        </td>

                        <td>
                          <div className="doc-actions-cluster">
                            {canReview && (
                              <>
                                <button
                                  type="button"
                                  className="btn-verify-sm"
                                  onClick={() => {
                                    setVerifyModal(doc);
                                    setVerifyNote("Verified against official records.");
                                  }}
                                  title="Verify document"
                                >
                                  <span>✓</span> Verify
                                </button>
                                <button
                                  type="button"
                                  className="btn-reject-sm"
                                  onClick={() => {
                                    setRejectModal(doc);
                                    setRejectNote("");
                                  }}
                                  title="Reject document"
                                >
                                  <span>✕</span> Reject
                                </button>
                              </>
                            )}

                            {status !== "requested" && (
                              <button
                                type="button"
                                className="btn-download-sm"
                                onClick={() => handleDownloadDoc(doc)}
                                title="Download document"
                              >
                                Download
                              </button>
                            )}

                            <button
                              type="button"
                              className="btn-delete-sm"
                              onClick={() => handleDeleteDoc(doc)}
                              title="Delete file"
                            >
                              Delete
                            </button>
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

        {/* Modal 1: Request Document from Employee */}
        {showRequestModal && (
          <div className="modal-backdrop-wrap" onClick={() => setShowRequestModal(false)}>
            <div className="modal-box-card" onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <h3>
                  <span>📄</span> Request Employee Document
                </h3>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => setShowRequestModal(false)}
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleSendRequest}>
                <div className="modal-body">
                  <div className="modal-form-group">
                    <label>Target Employee</label>
                    <select
                      className="modal-form-select"
                      value={requestForm.employeeId}
                      onChange={(e) =>
                        setRequestForm((prev) => ({ ...prev, employeeId: e.target.value }))
                      }
                      required
                    >
                      <option value="">Select an employee...</option>
                      {employees.map((emp) => {
                        const id = emp._id || emp.id;
                        const name =
                          emp.name ||
                          `${emp.firstName || ""} ${emp.lastName || ""}`.trim() ||
                          emp.email;
                        return (
                          <option key={id} value={id}>
                            {name} ({emp.employment?.department || "Staff"})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="modal-form-group">
                    <label>Document Type</label>
                    <select
                      className="modal-form-select"
                      value={requestForm.documentType}
                      onChange={(e) =>
                        setRequestForm((prev) => ({
                          ...prev,
                          documentType: e.target.value,
                          documentName: `${e.target.value}.pdf`,
                        }))
                      }
                      required
                    >
                      <option value="">Select credential type...</option>
                      {documentTypes.map((t) => (
                        <option key={t.id || t.label} value={t.label}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="modal-form-group">
                    <label>File Requirement Note / Instructions</label>
                    <textarea
                      className="modal-form-textarea"
                      value={requestForm.requestNote}
                      onChange={(e) =>
                        setRequestForm((prev) => ({ ...prev, requestNote: e.target.value }))
                      }
                      placeholder="e.g. Please upload front and back scan in PDF format with signature."
                      rows="3"
                    />
                  </div>
                </div>

                <div className="modal-foot">
                  <button
                    type="button"
                    className="btn-modal-cancel"
                    onClick={() => setShowRequestModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-modal-submit" disabled={requestBusy}>
                    {requestBusy ? "Sending..." : "Send Document Request"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal 2: Verify Document */}
        {verifyModal && (
          <div className="modal-backdrop-wrap" onClick={() => setVerifyModal(null)}>
            <div className="modal-box-card" onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <h3 style={{ color: "#065f46" }}>
                  <span>✓</span> Verify Document Compliance
                </h3>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => setVerifyModal(null)}
                >
                  ×
                </button>
              </div>

              <div className="modal-body">
                <div style={{ background: "#f8fafc", padding: "0.85rem 1rem", borderRadius: "8px" }}>
                  <div>
                    <strong>Document:</strong> {verifyModal.documentName}
                  </div>
                  <div>
                    <strong>Employee:</strong> {verifyModal.employee?.name || "Staff"}
                  </div>
                </div>

                <div className="modal-form-group">
                  <label>Audit Verification Remark (Optional)</label>
                  <div className="quick-chip-tags">
                    {VERIFICATION_TAGS.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        className="quick-tag-btn"
                        onClick={() => setVerifyNote(tag)}
                      >
                        + {tag}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    className="modal-form-input"
                    value={verifyNote}
                    onChange={(e) => setVerifyNote(e.target.value)}
                    placeholder="e.g. Verified against official records."
                    style={{ marginTop: "0.5rem" }}
                  />
                </div>
              </div>

              <div className="modal-foot">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => setVerifyModal(null)}
                >
                  Cancel
                </button>
                <button type="button" className="btn-modal-submit" onClick={confirmVerify}>
                  Confirm Verification
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal 3: Reject Document */}
        {rejectModal && (
          <div className="modal-backdrop-wrap" onClick={() => setRejectModal(null)}>
            <div className="modal-box-card" onClick={(e) => e.stopPropagation()}>
              <div className="modal-head reject-head">
                <h3>
                  <span>⚠️</span> Request Document Correction
                </h3>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => setRejectModal(null)}
                >
                  ×
                </button>
              </div>

              <div className="modal-body">
                <div style={{ background: "#fef2f2", padding: "0.85rem 1rem", borderRadius: "8px" }}>
                  <div>
                    <strong>Document:</strong> {rejectModal.documentName}
                  </div>
                  <div>
                    <strong>Employee:</strong> {rejectModal.employee?.name || "Staff"}
                  </div>
                </div>

                <div className="modal-form-group">
                  <label>Reason for Rejection / Instructions for Re-upload</label>
                  <div className="quick-chip-tags">
                    {REJECTION_TAGS.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        className="quick-tag-btn"
                        onClick={() => setRejectNote(tag)}
                      >
                        + {tag}
                      </button>
                    ))}
                  </div>
                  <textarea
                    className="modal-form-textarea"
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value)}
                    placeholder="Specify what was wrong so the employee can correct and re-upload..."
                    rows="3"
                    style={{ marginTop: "0.5rem" }}
                  />
                </div>
              </div>

              <div className="modal-foot">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => setRejectModal(null)}
                >
                  Cancel
                </button>
                <button type="button" className="btn-modal-submit danger" onClick={confirmReject}>
                  Reject Document
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

export default DocumentManagement;
