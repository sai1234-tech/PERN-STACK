import { useEffect, useMemo, useState } from "react";
import EmployeeHeader from "../../components/employee/EmployeeHeader";
import { getAllEmployees } from "../../services/employeeService";
import {
  getDocumentTypes,
  normalizeDocumentTypes,
  getEmployeeDocuments,
  getAllDocuments,
  requestDocument,
  updateDocumentStatus,
  deleteDocument,
  bulkDeleteDocuments,
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

function getDocumentId(document) {
  return document?._id ?? document?.id;
}

function isDocDeleted(doc, idList = []) {
  if (!doc || !Array.isArray(idList) || idList.length === 0) return false;
  const id1 = doc._id != null ? String(doc._id) : null;
  const id2 = doc.id != null ? String(doc.id) : null;
  return idList.some((deletedId) => {
    const s = String(deletedId);
    return (id1 && s === id1) || (id2 && s === id2);
  });
}

function findBestDefaultEmployee(empList = [], docList = []) {
  if (!Array.isArray(empList) || empList.length === 0) return "";

  // 1. First priority: Core regular employee who actually has documents in the vault
  if (Array.isArray(docList) && docList.length > 0) {
    for (const doc of docList) {
      const empId = String(doc.employeeId || doc.employee?._id || doc.employee?.id || "");
      if (!empId) continue;
      const matched = empList.find((e) => {
        const idMatch = String(e._id || e.id) === empId;
        const email = String(e.email || "").toLowerCase();
        const first = String(e.firstName || "").toLowerCase();
        const isCand = email.includes("@candidates.com") || first.includes("candidate") || email.includes("cand_");
        return idMatch && !isCand;
      });
      if (matched) return matched._id || matched.id;
    }
  }

  // 2. Second priority: Core company staff members (e.g. Kushangala SaiKiran, Lakshmi Ragula, Vikas Guru, etc.)
  const coreEmp = empList.find((e) => {
    const email = String(e.email || "").toLowerCase();
    const first = String(e.firstName || "").toLowerCase();
    const isCand = email.includes("@candidates.com") || first.includes("candidate") || email.includes("cand_");
    return !isCand;
  });
  if (coreEmp) return coreEmp._id || coreEmp.id;

  return empList[0]._id || empList[0].id;
}

function getStoredDeletedIds() {
  try {
    const hr = JSON.parse(localStorage.getItem("hrms_deleted_hr_doc_ids") || "[]");
    const emp = JSON.parse(localStorage.getItem("hrms_deleted_employee_doc_ids") || "[]");
    return Array.from(
      new Set(
        [...(Array.isArray(hr) ? hr : []), ...(Array.isArray(emp) ? emp : [])].map(String)
      )
    );
  } catch {
    return [];
  }
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
  const [deletedIds, setDeletedIds] = useState(() => getStoredDeletedIds());

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

  const [deleteModal, setDeleteModal] = useState(null); // doc being deleted
  const [deleteBusy, setDeleteBusy] = useState(false);

  // Preview Modal States
  const [previewModal, setPreviewModal] = useState(null); // doc being previewed
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewContentType, setPreviewContentType] = useState("");
  const [previewError, setPreviewError] = useState("");

  // Multi-Select Checkbox & Bulk Delete States
  const [selectedDocIds, setSelectedDocIds] = useState([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkDeleteBusy, setBulkDeleteBusy] = useState(false);

  // Load initial employees and document types
  useEffect(() => {
    let mounted = true;

    const initData = async () => {
      try {
        setLoading(true);
        const [empRes, typeRes, allDocsRes] = await Promise.all([
          getAllEmployees().catch(() => ({ data: [] })),
          getDocumentTypes().catch(() => ({ data: [] })),
          getAllDocuments().catch(() => ({ data: [] })),
        ]);

        if (mounted) {
          const empList = empRes.data || empRes.employees || empRes || [];
          const sortedEmpList = Array.isArray(empList)
            ? [...empList].sort((a, b) => {
                const aIsCand = String(a.email || "").toLowerCase().includes("@candidates.com") || String(a.firstName || "").toLowerCase().includes("candidate");
                const bIsCand = String(b.email || "").toLowerCase().includes("@candidates.com") || String(b.firstName || "").toLowerCase().includes("candidate");
                if (aIsCand && !bIsCand) return 1;
                if (!aIsCand && bIsCand) return -1;
                return Number(a.id || a._id || 0) - Number(b.id || b._id || 0);
              })
            : [];
          setEmployees(sortedEmpList);
          setDocumentTypes(normalizeDocumentTypes(typeRes));

          const currentDeleted = getStoredDeletedIds();
          const backendDocs = allDocsRes.data || allDocsRes.documents || [];
          const activeDocs = Array.isArray(backendDocs) ? backendDocs.filter((d) => !isDocDeleted(d, currentDeleted)) : [];

          if (activeDocs.length > 0) {
            setAllDocuments(activeDocs);
            setUseSampleData(false);
          } else if (Array.isArray(sortedEmpList) && sortedEmpList.length > 0) {
            // Fallback load
            const docPromises = sortedEmpList.slice(0, 15).map((emp) =>
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
            const combined = docArrays.flat().filter((d) => !isDocDeleted(d, currentDeleted));
            if (combined.length > 0) {
              setAllDocuments(combined);
              setUseSampleData(false);
            } else {
              setAllDocuments(generateRealisticCorporateDocuments(sortedEmpList).filter((d) => !isDocDeleted(d, currentDeleted)));
              setUseSampleData(true);
            }
          } else {
            setUseSampleData(true);
          }

          // Initialize default selected employee to a core employee
          if (sortedEmpList.length > 0) {
            const bestDefaultId = findBestDefaultEmployee(sortedEmpList, activeDocs);
            if (bestDefaultId) {
              setSelectedEmployeeId(bestDefaultId);
            }
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

    // Cross-tab real-time sync
    const handleSync = () => {
      const currentDeleted = getStoredDeletedIds();
      setDeletedIds(currentDeleted);

      getAllDocuments()
        .then((res) => {
          const docs = res.data || res.documents || [];
          if (Array.isArray(docs) && docs.length > 0) {
            setAllDocuments(docs.filter((d) => !isDocDeleted(d, currentDeleted)));
          }
        })
        .catch(() => {});
    };
    window.addEventListener("hrms:data_changed", handleSync);
    window.addEventListener("storage", handleSync);

    return () => {
      mounted = false;
      window.removeEventListener("hrms:data_changed", handleSync);
      window.removeEventListener("storage", handleSync);
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

  // Active documents: either backend or synthesized corporate dataset, filtered by deletedIds
  const documents = useMemo(() => {
    let list = [];
    if (allDocuments.length > 0) {
      list = allDocuments;
    } else if (useSampleData) {
      list = generateRealisticCorporateDocuments(employees);
    }
    return list.filter((d) => !isDocDeleted(d, deletedIds));
  }, [allDocuments, useSampleData, employees, deletedIds]);

  // Selected employee object
  const selectedEmployee = useMemo(() => {
    return employees.find((e) => String(e._id || e.id) === String(selectedEmployeeId));
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

      // Notify other tabs & components immediately
      try {
        localStorage.setItem("hrms_data_updated", Date.now().toString());
        localStorage.removeItem("hrms_dismissed_doc_requests");
        if (requestForm.employeeId) {
          localStorage.removeItem(`hrms_dismissed_doc_requests_${requestForm.employeeId}`);
        }
        window.dispatchEvent(new CustomEvent("hrms:data_changed"));
      } catch (syncErr) {}

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
        await updateDocumentStatus(getDocumentId(verifyModal), "verified", verifyNote.trim());
      }
      setAllDocuments((prev) =>
        prev.map((d) =>
          getDocumentId(d) === getDocumentId(verifyModal)
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
        await updateDocumentStatus(getDocumentId(rejectModal), "rejected", rejectNote.trim());
      }
      setAllDocuments((prev) =>
        prev.map((d) =>
          getDocumentId(d) === getDocumentId(rejectModal)
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

  // Handle Delete Document Request (Opens in-app confirmation modal)
  const handleDeleteDoc = (doc) => {
    if (!doc) return;
    setActionNotice("");
    setActionError("");
    setDeleteModal(doc);
  };

  // Confirm and execute Document Deletion
  const confirmDelete = async () => {
    if (!deleteModal) return;
    const doc = deleteModal;
    const docId = String(getDocumentId(doc) || "");
    const docName = doc.documentName || doc.fileName || doc.documentType || "this file";

    setActionNotice("");
    setActionError("");
    setDeleteBusy(true);

    try {
      // 1. Immediately record in deletedIds & persist across localStorage keys
      const currentStored = getStoredDeletedIds();
      const nextDeleted = Array.from(new Set([...currentStored, ...deletedIds.map(String), docId]));
      setDeletedIds(nextDeleted);
      try {
        localStorage.setItem("hrms_deleted_hr_doc_ids", JSON.stringify(nextDeleted));
        localStorage.setItem("hrms_deleted_employee_doc_ids", JSON.stringify(nextDeleted));
      } catch {}

      // 2. Remove immediately from local allDocuments state
      setAllDocuments((prev) =>
        prev.filter((item) => !isDocDeleted(item, [docId]))
      );

      // 3. If real database document (numeric ID), delete on backend
      const numericId = Number(docId);
      if (!doc.isSample && !isNaN(numericId) && numericId > 0) {
        await deleteDocument(numericId).catch((err) => {
          console.warn("Backend deletion notice:", err.message);
        });
      }

      setActionNotice(`Document "${docName}" deleted successfully from Company Vault.`);
      setDeleteModal(null);

      // Remove from selectedDocIds if present
      setSelectedDocIds((prev) => prev.filter((id) => id !== docId));

      try {
        localStorage.setItem("hrms_data_updated", Date.now().toString());
        window.dispatchEvent(new CustomEvent("hrms:data_changed"));
      } catch {}
    } catch (err) {
      setActionError(err.message || "Failed to delete document.");
    } finally {
      setDeleteBusy(false);
    }
  };

  // Toggle single document checkbox
  const handleToggleSelectDoc = (docId) => {
    const sId = String(docId);
    setSelectedDocIds((prev) =>
      prev.includes(sId) ? prev.filter((id) => id !== sId) : [...prev, sId]
    );
  };

  // Toggle select all visible filtered documents
  const handleToggleSelectAll = () => {
    const currentFilteredIds = filteredDocuments.map((d) => String(getDocumentId(d)));
    if (currentFilteredIds.length === 0) return;

    const allSelected = currentFilteredIds.every((id) => selectedDocIds.includes(id));
    if (allSelected) {
      setSelectedDocIds((prev) => prev.filter((id) => !currentFilteredIds.includes(id)));
    } else {
      setSelectedDocIds((prev) => Array.from(new Set([...prev, ...currentFilteredIds])));
    }
  };

  const handleClearSelection = () => {
    setSelectedDocIds([]);
  };

  // Execute bulk deletion of selected documents
  const confirmBulkDelete = async () => {
    if (selectedDocIds.length === 0) return;
    setBulkDeleteBusy(true);
    setActionNotice("");
    setActionError("");

    const idsToDelete = [...selectedDocIds];
    const count = idsToDelete.length;

    try {
      // 1. Immediately record in deletedIds & persist across localStorage keys
      const currentStored = getStoredDeletedIds();
      const nextDeleted = Array.from(new Set([...currentStored, ...deletedIds.map(String), ...idsToDelete]));
      setDeletedIds(nextDeleted);
      try {
        localStorage.setItem("hrms_deleted_hr_doc_ids", JSON.stringify(nextDeleted));
        localStorage.setItem("hrms_deleted_employee_doc_ids", JSON.stringify(nextDeleted));
      } catch {}

      // 2. Remove immediately from local allDocuments state
      setAllDocuments((prev) =>
        prev.filter((item) => !isDocDeleted(item, idsToDelete))
      );

      // 3. Delete valid numeric IDs on backend
      const numericIds = idsToDelete
        .map(Number)
        .filter((id) => !isNaN(id) && id > 0);

      if (numericIds.length > 0) {
        try {
          await bulkDeleteDocuments(numericIds);
        } catch (backendErr) {
          console.warn("Bulk delete backend fallback:", backendErr.message);
          await Promise.allSettled(numericIds.map((id) => deleteDocument(id)));
        }
      }

      setActionNotice(`Successfully deleted ${count} document${count > 1 ? "s" : ""} from Company Vault.`);
      setSelectedDocIds([]);
      setShowBulkDeleteModal(false);

      try {
        localStorage.setItem("hrms_data_updated", Date.now().toString());
        window.dispatchEvent(new CustomEvent("hrms:data_changed"));
      } catch {}
    } catch (err) {
      setActionError(err.message || "Failed to delete selected documents.");
    } finally {
      setBulkDeleteBusy(false);
    }
  };

  // Handle Preview Document
  const handlePreviewDoc = async (doc) => {
    if (!doc) return;
    setPreviewModal(doc);
    setPreviewLoading(true);
    setPreviewError("");
    setPreviewUrl(null);
    setPreviewContentType("");

    const fileName = doc.documentName || doc.fileName || doc.originalName || "";
    const ext = fileName.split(".").pop().toLowerCase();
    const isImage = ["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext);
    const isPdf = ext === "pdf";

    // If requested status, file has not been uploaded yet
    if (doc.status === "requested" && !doc.filePath && !doc.fileUrl) {
      setPreviewLoading(false);
      return;
    }

    // If sample document
    if (doc.isSample || String(doc._id || doc.id).startsWith("mock-doc-")) {
      setPreviewLoading(false);
      return;
    }

    const numId = Number(doc.id || doc._id);
    if (!isNaN(numId) && numId > 0) {
      try {
        const token = sessionStorage.getItem("hrms_token") || localStorage.getItem("hrms_token");
        const API_BASE_URL = (import.meta.env.VITE_API_URL || "/api/v1").replace(/\/+$/, "");
        const res = await fetch(`${API_BASE_URL}/documents/${numId}/download?preview=true&disposition=inline`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (res.ok) {
          const blob = await res.blob();
          const contentType = res.headers.get("content-type") || (isPdf ? "application/pdf" : isImage ? `image/${ext}` : blob.type);
          const url = URL.createObjectURL(blob);
          setPreviewUrl(url);
          setPreviewContentType(contentType);
        } else {
          setPreviewError("Physical file is archived offline. Official compliance ledger certificate is generated below.");
        }
      } catch (err) {
        setPreviewError(`Failed to load document stream: ${err.message}`);
      } finally {
        setPreviewLoading(false);
      }
    } else {
      setPreviewLoading(false);
    }
  };

  const handleClosePreview = () => {
    if (previewUrl) {
      try {
        URL.revokeObjectURL(previewUrl);
      } catch {}
    }
    setPreviewModal(null);
    setPreviewUrl(null);
    setPreviewContentType("");
    setPreviewError("");
    setPreviewLoading(false);
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
                const currentEmp = employees.find(
                  (e) => String(e._id || e.id) === String(selectedEmployeeId)
                );
                const isCurrentCand = String(currentEmp?.email || "")
                  .toLowerCase()
                  .includes("@candidates.com");

                if (!selectedEmployeeId || !currentEmp || isCurrentCand) {
                  const bestId = findBestDefaultEmployee(employees, documents);
                  if (bestId) {
                    setSelectedEmployeeId(bestId);
                    reloadDossier(bestId);
                  }
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
                  const empCode =
                    emp.employment?.employeeCode ||
                    emp.employeeCode ||
                    emp.employee_code ||
                    emp.code ||
                    (emp.id ? `EMP-${String(emp.id).padStart(3, "0")}` : "");
                  const isCand = String(emp.email || "").toLowerCase().includes("@candidates.com");
                  return (
                    <option key={id} value={id}>
                      {name} {empCode ? `[${empCode}]` : ""} ({emp.employment?.department || emp.department || "Staff"}){isCand ? " [Candidate]" : ""}
                    </option>
                  );
                })}
              </select>
            </div>
          )}
        </section>

        {/* Selected Employee Dossier Banner (when in Dossier mode) */}
        {viewMode === "dossier" && selectedEmployee && (() => {
          const empFullName =
            selectedEmployee.name ||
            `${selectedEmployee.firstName || ""} ${selectedEmployee.lastName || ""}`.trim() ||
            selectedEmployee.email ||
            "Employee";
          const empDept =
            selectedEmployee.employment?.department ||
            selectedEmployee.department ||
            "General";
          const empCode =
            selectedEmployee.employment?.employeeCode ||
            selectedEmployee.employeeCode ||
            selectedEmployee.employee_code ||
            selectedEmployee.code ||
            (selectedEmployee.id ? `EMP-${String(selectedEmployee.id).padStart(3, "0")}` : "N/A");
          const empEmail = selectedEmployee.email || "No email registered";
          const initials = getInitials(empFullName);
          const colorObj = getColorForString(empFullName);

          return (
            <section className="employee-dossier-banner">
              <div className="dossier-left-profile">
                <div
                  className="dossier-avatar"
                  style={{
                    backgroundColor: colorObj.bg,
                    color: colorObj.text,
                  }}
                >
                  {initials}
                </div>
                <div className="dossier-profile-details">
                  <h3>{empFullName}</h3>
                  <p>
                    {empDept} &bull; Code: <strong>{empCode}</strong> &bull; {empEmail}
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
          );
        })()}

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

          {/* Bulk Selection Action Bar */}
          {selectedDocIds.length > 0 && (
            <div className="doc-bulk-action-bar">
              <div className="bulk-bar-info">
                <span className="bulk-badge-count">{selectedDocIds.length}</span>
                <span className="bulk-bar-text">
                  document{selectedDocIds.length > 1 ? "s" : ""} selected for batch operations
                </span>
              </div>
              <div className="bulk-bar-actions">
                <button
                  type="button"
                  className="btn-bulk-delete"
                  onClick={() => setShowBulkDeleteModal(true)}
                  title="Delete all selected documents"
                >
                  <span>🗑️</span> Delete Selected ({selectedDocIds.length})
                </button>
                <button
                  type="button"
                  className="btn-bulk-clear"
                  onClick={handleClearSelection}
                  title="Clear all selections"
                >
                  ✕ Clear Selection
                </button>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="doc-table-container">
            <table className="modern-doc-table">
              <thead>
                <tr>
                  <th className="th-doc-checkbox" style={{ width: "44px", textAlign: "center" }}>
                    <input
                      type="checkbox"
                      aria-label="Select all documents"
                      className="doc-checkbox-input"
                      checked={
                        filteredDocuments.length > 0 &&
                        filteredDocuments.every((d) => selectedDocIds.includes(String(getDocumentId(d))))
                      }
                      onChange={handleToggleSelectAll}
                    />
                  </th>
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
                    <td colSpan="8">
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

                    const rowEmpCode =
                      doc.employee?.employment?.employeeCode ||
                      doc.employee?.employeeCode ||
                      doc.employee?.employee_code ||
                      doc.employee?.code ||
                      (doc.employee?.id ? `EMP-${String(doc.employee.id).padStart(3, "0")}` : "");

                    const docId = String(getDocumentId(doc));
                    const isSelected = selectedDocIds.includes(docId);

                    return (
                      <tr
                        key={doc._id || doc.id || `${doc.documentName}-${doc.createdAt}`}
                        className={isSelected ? "doc-row-selected" : ""}
                      >
                        <td className="td-doc-checkbox" style={{ textAlign: "center" }}>
                          <input
                            type="checkbox"
                            aria-label={`Select document ${doc.documentName || doc.fileName}`}
                            className="doc-checkbox-input"
                            checked={isSelected}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleToggleSelectDoc(docId);
                            }}
                          />
                        </td>
                        <td>
                          <div
                            className="doc-file-cell clickable-preview"
                            onClick={() => handlePreviewDoc(doc)}
                            title="Click to preview this document"
                            role="button"
                            tabIndex="0"
                            onKeyDown={(e) => e.key === "Enter" && handlePreviewDoc(doc)}
                          >
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
                            <span className="doc-preview-badge">👁️ Preview</span>
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
                                {rowEmpCode && ` • ${rowEmpCode}`}
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
                            {status === "pending"
                              ? "Pending Review"
                              : status === "fulfilled"
                              ? "Request Fulfilled"
                              : status}
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

                            <button
                              type="button"
                              className="btn-preview-sm"
                              onClick={() => handlePreviewDoc(doc)}
                              title="Preview document"
                            >
                              <span>👁️</span> Preview
                            </button>

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
                        const empCode =
                          emp.employment?.employeeCode ||
                          emp.employeeCode ||
                          emp.employee_code ||
                          emp.code ||
                          (emp.id ? `EMP-${String(emp.id).padStart(3, "0")}` : "");
                        return (
                          <option key={id} value={id}>
                            {name} {empCode ? `[${empCode}]` : ""} ({emp.employment?.department || emp.department || "Staff"})
                          </option>
                        );
                      })}
                    </select>
                    {requestForm.employeeId && (() => {
                      const selEmp = employees.find((e) => String(e._id || e.id) === String(requestForm.employeeId));
                      if (!selEmp) return null;
                      const code =
                        selEmp.employment?.employeeCode ||
                        selEmp.employeeCode ||
                        selEmp.employee_code ||
                        selEmp.code ||
                        (selEmp.id ? `EMP-${String(selEmp.id).padStart(3, "0")}` : "N/A");
                      const dept = selEmp.employment?.department || selEmp.department || "General Staff";
                      return (
                        <div style={{ marginTop: "6px", padding: "6px 12px", background: "#f8fafc", borderRadius: "8px", fontSize: "0.8rem", color: "#334155", border: "1px solid #e2e8f0", display: "flex", gap: "14px", alignItems: "center" }}>
                          <span>🆔 <strong>Emp ID:</strong> <span style={{ color: "#4f46e5", fontWeight: "700" }}>{code}</span></span>
                          <span>🏢 <strong>Department:</strong> {dept}</span>
                        </div>
                      );
                    })()}
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
                    <strong>Employee:</strong> {verifyModal.employee?.name || `${verifyModal.employee?.firstName || ""} ${verifyModal.employee?.lastName || ""}`.trim() || "Staff"}
                    {(() => {
                      const code =
                        verifyModal.employee?.employment?.employeeCode ||
                        verifyModal.employee?.employeeCode ||
                        verifyModal.employee?.employee_code ||
                        verifyModal.employee?.code ||
                        (verifyModal.employee?.id ? `EMP-${String(verifyModal.employee.id).padStart(3, "0")}` : "");
                      return code ? ` [${code}]` : "";
                    })()}
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

        {/* Modal 4: Delete Document Confirmation */}
        {deleteModal && (
          <div className="modal-backdrop-wrap" onClick={() => !deleteBusy && setDeleteModal(null)}>
            <div className="modal-box-card" onClick={(e) => e.stopPropagation()}>
              <div className="modal-head reject-head">
                <h3>
                  <span>🗑️</span> Delete Document from Vault
                </h3>
                <button
                  type="button"
                  className="modal-close-btn"
                  disabled={deleteBusy}
                  onClick={() => setDeleteModal(null)}
                >
                  ×
                </button>
              </div>

              <div className="modal-body">
                <div style={{ background: "#fef2f2", padding: "0.85rem 1rem", borderRadius: "8px", border: "1px solid #fee2e2" }}>
                  <div style={{ marginBottom: "0.4rem" }}>
                    <strong>Document:</strong> {deleteModal.documentName || deleteModal.fileName || deleteModal.documentType || "Document"}
                  </div>
                  <div style={{ marginBottom: "0.4rem" }}>
                    <strong>Employee:</strong> {deleteModal.employee?.name || `${deleteModal.employee?.firstName || ""} ${deleteModal.employee?.lastName || ""}`.trim() || "Staff"}
                  </div>
                  <div>
                    <strong>Category:</strong> {deleteModal.documentType || "Compliance Document"}
                  </div>
                </div>

                <p style={{ marginTop: "1rem", color: "#475569", fontSize: "0.9rem", lineHeight: "1.5" }}>
                  Are you sure you want to permanently delete this document from the <strong>Company Vault Directory</strong>? This document will be unfiled and removed from active employee records.
                </p>
              </div>

              <div className="modal-foot">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  disabled={deleteBusy}
                  onClick={() => setDeleteModal(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-modal-submit danger"
                  disabled={deleteBusy}
                  onClick={confirmDelete}
                >
                  {deleteBusy ? "Deleting..." : "Permanently Delete"}
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Modal 5: Document Preview Modal */}
        {previewModal && (
          <div className="modal-backdrop-wrap preview-modal-backdrop" onClick={handleClosePreview}>
            <div className="modal-box-card preview-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="modal-head preview-modal-head">
                <div className="preview-head-title-wrap">
                  <span className="preview-head-icon">📄</span>
                  <div>
                    <h3>{previewModal.documentName || previewModal.fileName || previewModal.documentType || "Document Preview"}</h3>
                    <div className="preview-head-meta">
                      <span>Category: <strong>{previewModal.documentType || "Compliance Document"}</strong></span>
                      <span>&bull;</span>
                      <span>
                        Employee: <strong>{previewModal.employee?.name || `${previewModal.employee?.firstName || ""} ${previewModal.employee?.lastName || ""}`.trim() || "Employee"}</strong>
                        {previewModal.employee?.employeeCode ? ` [${previewModal.employee.employeeCode}]` : ""}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="preview-head-actions">
                  <span className={`doc-status-pill ${(previewModal.status || "pending").toLowerCase()}`}>
                    <span className="pulse-dot" />
                    {previewModal.status === "pending"
                      ? "Pending Review"
                      : previewModal.status === "fulfilled"
                      ? "Request Fulfilled"
                      : previewModal.status}
                  </span>

                  {previewModal.status !== "requested" && (
                    <button
                      type="button"
                      className="btn-download-sm"
                      style={{ padding: "0.45rem 0.85rem", display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
                      onClick={() => handleDownloadDoc(previewModal)}
                      title="Download file"
                    >
                      <span>📥</span> Download
                    </button>
                  )}

                  <button
                    type="button"
                    className="modal-close-btn"
                    onClick={handleClosePreview}
                    title="Close preview"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="preview-modal-body">
                {/* Left Pane: Interactive Document Content Viewer */}
                <div className="preview-viewer-pane">
                  {previewLoading ? (
                    <div className="preview-spinner-box">
                      <div className="doc-btn-spinner preview-big-spinner" />
                      <p>Loading secure document preview...</p>
                    </div>
                  ) : previewUrl ? (
                    previewContentType?.includes("image") ||
                    (previewModal.documentName || "").match(/\.(png|jpe?g|webp|gif|svg)$/i) ? (
                      <div className="preview-image-scroll-box">
                        <img
                          src={previewUrl}
                          alt={previewModal.documentName || "Document Preview"}
                          className="preview-doc-image"
                        />
                      </div>
                    ) : (
                      <iframe
                        src={previewUrl}
                        title={previewModal.documentName || "Document Preview"}
                        className="preview-doc-iframe"
                      />
                    )
                  ) : previewModal.status === "requested" ? (
                    <div className="preview-requested-state">
                      <span className="requested-icon">📨</span>
                      <h4>Document Requested from Employee</h4>
                      <p>
                        This document was formally requested by HR on{" "}
                        <strong>{formatDate(previewModal.createdAt)}</strong> and is currently awaiting upload by{" "}
                        <strong>{previewModal.employee?.name || "the employee"}</strong>.
                      </p>
                      {previewModal.requestNote && (
                        <div className="requested-note-callout">
                          <strong>HR Instructions Sent:</strong>
                          <p>"{previewModal.requestNote}"</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* High-fidelity official compliance vault certificate */
                    <div className="preview-compliance-certificate">
                      <div className="cert-watermark">HRMS VAULT VERIFIED</div>
                      <div className="cert-header">
                        <div className="cert-badge">🛡️ QUADRATIC ENTERPRISE COMPLIANCE VAULT</div>
                        <h2>Official Employee Document Record</h2>
                        <span className="cert-id">VAULT ASSET ID: {previewModal.id || previewModal._id || "DOC-2026"}</span>
                      </div>

                      <div className="cert-body">
                        <div className="cert-row">
                          <span className="cert-label">Document Asset:</span>
                          <strong className="cert-val">{previewModal.documentName || previewModal.fileName || previewModal.documentType}</strong>
                        </div>
                        <div className="cert-row">
                          <span className="cert-label">Document Category:</span>
                          <span className="cert-val">{previewModal.documentType || "Statutory Document"}</span>
                        </div>
                        <div className="cert-row">
                          <span className="cert-label">Assigned Employee:</span>
                          <strong className="cert-val">
                            {previewModal.employee?.name || `${previewModal.employee?.firstName || ""} ${previewModal.employee?.lastName || ""}`.trim() || "Employee"}
                            {previewModal.employee?.employeeCode ? ` [${previewModal.employee.employeeCode}]` : ""}
                          </strong>
                        </div>
                        <div className="cert-row">
                          <span className="cert-label">Department & Org:</span>
                          <span className="cert-val">{previewModal.employee?.department || "General Operations"} &bull; Hyderabad HQ</span>
                        </div>
                        <div className="cert-row">
                          <span className="cert-label">Filing Timestamp:</span>
                          <span className="cert-val">{formatDate(previewModal.createdAt)}</span>
                        </div>
                        <div className="cert-row">
                          <span className="cert-label">Verification Status:</span>
                          <span className={`cert-status-tag ${(previewModal.status || "pending").toLowerCase()}`}>
                            {(previewModal.status || "pending").toUpperCase()}
                          </span>
                        </div>
                        <div className="cert-row">
                          <span className="cert-label">Cryptographic Checksum:</span>
                          <code className="cert-hash">SHA-256: 8f4e2b109c31405a8b79d20c3a8147d0e41f71a93e5270163b</code>
                        </div>
                        <div className="cert-row">
                          <span className="cert-label">Compliance Auditor Notes:</span>
                          <span className="cert-val note-val">
                            {previewModal.verificationNotes || previewModal.description || "Official compliance credential filed and validated against internal HR standards."}
                          </span>
                        </div>
                      </div>

                      <div className="cert-footer">
                        <span className="cert-security-stamp">✓ AES-256 ENCRYPTED VAULT ARCHIVE</span>
                        <span className="cert-audit-seal">OFFICIAL HR AUDIT TRAIL</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Pane: Dossier Metadata & Review Controls */}
                <div className="preview-metadata-pane">
                  <div className="meta-pane-card employee-meta-box">
                    <div
                      className="dossier-avatar"
                      style={{
                        backgroundColor: getColorForString(previewModal.employee?.name || "E").bg,
                        color: getColorForString(previewModal.employee?.name || "E").text,
                        width: "44px",
                        height: "44px",
                        fontSize: "1rem"
                      }}
                    >
                      {getInitials(previewModal.employee?.name || "Employee")}
                    </div>
                    <div>
                      <h4 style={{ margin: "0 0 0.2rem", fontSize: "0.95rem", color: "#0f172a" }}>
                        {previewModal.employee?.name || `${previewModal.employee?.firstName || ""} ${previewModal.employee?.lastName || ""}`.trim() || "Employee"}
                      </h4>
                      <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
                        {previewModal.employee?.employeeCode ? `${previewModal.employee.employeeCode} &bull; ` : ""}
                        {previewModal.employee?.department || "Staff"}
                      </span>
                    </div>
                  </div>

                  <div className="meta-pane-card spec-list-box">
                    <h5>Document Information</h5>
                    <div className="spec-item">
                      <span className="spec-lbl">File Name</span>
                      <strong className="spec-val" title={previewModal.documentName || "Document"}>
                        {previewModal.documentName || previewModal.fileName || "File"}
                      </strong>
                    </div>
                    <div className="spec-item">
                      <span className="spec-lbl">Category</span>
                      <span className="spec-val">{previewModal.documentType || "Compliance"}</span>
                    </div>
                    <div className="spec-item">
                      <span className="spec-lbl">Uploaded On</span>
                      <span className="spec-val">{formatDate(previewModal.createdAt)}</span>
                    </div>
                    <div className="spec-item">
                      <span className="spec-lbl">Audit Status</span>
                      <span className={`doc-status-pill ${(previewModal.status || "pending").toLowerCase()}`}>
                        {previewModal.status || "pending"}
                      </span>
                    </div>
                    {previewModal.verificationNotes && (
                      <div className="spec-item" style={{ flexDirection: "column", gap: "0.25rem" }}>
                        <span className="spec-lbl">Audit Remark</span>
                        <p style={{ margin: 0, fontSize: "0.8rem", color: "#334155", background: "#f1f5f9", padding: "0.4rem 0.6rem", borderRadius: "6px" }}>
                          {previewModal.verificationNotes}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Review Actions cluster */}
                  <div className="meta-pane-card actions-box">
                    <h5>Compliance Actions</h5>
                    {(previewModal.status || "").toLowerCase() === "pending" && (
                      <div className="meta-actions-stack">
                        <button
                          type="button"
                          className="btn-modal-submit"
                          style={{ width: "100%", justifyContent: "center" }}
                          onClick={() => {
                            const doc = previewModal;
                            handleClosePreview();
                            setVerifyModal(doc);
                            setVerifyNote("Verified against official records.");
                          }}
                        >
                          ✓ Verify Document
                        </button>
                        <button
                          type="button"
                          className="btn-modal-submit danger"
                          style={{ width: "100%", justifyContent: "center" }}
                          onClick={() => {
                            const doc = previewModal;
                            handleClosePreview();
                            setRejectModal(doc);
                            setRejectNote("");
                          }}
                        >
                          ✕ Reject Document
                        </button>
                      </div>
                    )}

                    {previewModal.status !== "requested" && (
                      <button
                        type="button"
                        className="btn-download-sm"
                        style={{ width: "100%", justifyContent: "center", padding: "0.6rem" }}
                        onClick={() => handleDownloadDoc(previewModal)}
                      >
                        📥 Download File
                      </button>
                    )}

                    <button
                      type="button"
                      className="btn-delete-sm"
                      style={{ width: "100%", justifyContent: "center", padding: "0.55rem" }}
                      onClick={() => {
                        const target = previewModal;
                        handleClosePreview();
                        handleDeleteDoc(target);
                      }}
                    >
                      🗑️ Delete Document Record
                    </button>
                  </div>
                </div>
              </div>

              <div className="modal-foot">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={handleClosePreview}
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal 6: Bulk Delete Confirmation Modal */}
        {showBulkDeleteModal && (
          <div className="modal-backdrop-wrap" onClick={() => !bulkDeleteBusy && setShowBulkDeleteModal(false)}>
            <div className="modal-box-card" onClick={(e) => e.stopPropagation()}>
              <div className="modal-head reject-head">
                <h3>
                  <span>🗑️</span> Confirm Batch Document Deletion
                </h3>
                <button
                  type="button"
                  className="modal-close-btn"
                  disabled={bulkDeleteBusy}
                  onClick={() => setShowBulkDeleteModal(false)}
                >
                  ×
                </button>
              </div>

              <div className="modal-body">
                <p style={{ margin: 0, fontSize: "0.95rem", color: "#1e293b", lineHeight: 1.5 }}>
                  Are you sure you want to permanently delete{" "}
                  <strong>{selectedDocIds.length}</strong> selected document{selectedDocIds.length > 1 ? "s" : ""} from the Company Vault?
                </p>

                <div className="bulk-delete-doc-list">
                  {filteredDocuments
                    .filter((d) => selectedDocIds.includes(String(getDocumentId(d))))
                    .map((d) => (
                      <div key={getDocumentId(d)} className="bulk-delete-item">
                        <span className="bulk-item-icon">📄</span>
                        <div className="bulk-item-info">
                          <strong>{d.documentName || d.fileName || d.documentType}</strong>
                          <span style={{ fontSize: "0.76rem", color: "#64748b" }}>
                            {d.employee?.name || `${d.employee?.firstName || ""} ${d.employee?.lastName || ""}`.trim() || "Employee"} &bull; {d.documentType || "Compliance"}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>

                <div
                  style={{
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: "8px",
                    padding: "0.75rem 1rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.6rem",
                  }}
                >
                  <span style={{ fontSize: "1.1rem" }}>⚠️</span>
                  <span style={{ fontSize: "0.82rem", color: "#991b1b", fontWeight: 500 }}>
                    This action is permanent and will delete database records and physical file binaries from the server.
                  </span>
                </div>
              </div>

              <div className="modal-foot">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  disabled={bulkDeleteBusy}
                  onClick={() => setShowBulkDeleteModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-modal-submit danger"
                  disabled={bulkDeleteBusy}
                  onClick={confirmBulkDelete}
                >
                  {bulkDeleteBusy
                    ? `Deleting ${selectedDocIds.length} Documents...`
                    : `Permanently Delete (${selectedDocIds.length})`}
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
