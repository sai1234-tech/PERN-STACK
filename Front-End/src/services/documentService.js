import { apiRequest, apiDownload } from "./apiClient";

export function getDocumentTypes() {
  return apiRequest("/documents/types");
}

export function normalizeDocumentTypes(response) {
  let value = response?.data ?? response;

  // Backend response:
  // { success: true, data: [...] }
  if (value?.data) {
    value = value.data;
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((type, index) => {
    // Current backend returns strings:
    // "Aadhaar / ID Proof", "PAN", etc.
    if (typeof type === "string") {
      return {
        id: type,
        label: type,
      };
    }

    // Keep compatibility if backend later returns objects
    return {
      ...type,
      id:
        type._id ||
        type.id ||
        type.value ||
        type.code ||
        String(index),
      label:
        type.name ||
        type.title ||
        type.typeName ||
        type.documentTypeName ||
        type.label ||
        type.documentType ||
        type.code ||
        `Document type ${index + 1}`,
    };
  });
}

export function getMyDocuments() {
  return apiRequest("/documents/my");
}

export function uploadDocument(file, data = {}) {
  const body = new FormData();

  // IMPORTANT:
  // Backend uses upload.single("document")
  body.append("document", file);

  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      body.append(key, value);
    }
  });

  return apiRequest("/documents/upload", {
    method: "POST",
    body,
  });
}

export function getEmployeeDocuments(employeeId) {
  return apiRequest(`/documents/employee/${employeeId}`);
}

export function requestDocument(data) {
  return apiRequest("/documents/request", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getDocument(documentId) {
  return apiRequest(`/documents/${documentId}`);
}

export async function downloadDocument(
  documentId,
  filename = "document",
) {
  return apiDownload(`/documents/${documentId}/download`, filename);
}

export function updateDocumentStatus(
  documentId,
  status,
  verificationNotes = "",
) {
  return apiRequest(`/documents/${documentId}/status`, {
    method: "PATCH",
    body: JSON.stringify({
      status,
      verificationNotes,
    }),
  });
}

export function deleteDocument(documentId) {
  return apiRequest(`/documents/${documentId}`, {
    method: "DELETE",
  });
}