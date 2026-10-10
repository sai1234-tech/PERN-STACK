import { useCallback, useEffect, useState } from "react";
import {
  deleteDocument,
  getDocumentTypes,
  getEmployeeDocuments,
  normalizeDocumentTypes,
  requestDocument,
  updateDocumentStatus,
} from "../services/documentService";
import { useSyncRefresh } from "../utils/syncManager";

function listFrom(response) {
  const value =
    response?.data || response?.documents || response?.types || response || [];
  return Array.isArray(value) ? value : [];
}

export function useHRDocuments(employeeId) {
  const [documents, setDocuments] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (silent = false) => {
    if (!employeeId) {
      setDocuments([]);
      return;
    }
    if (!silent) setLoading(true);
    setError("");
    try {
      const [documentResponse, typeResponse] = await Promise.all([
        getEmployeeDocuments(employeeId),
        getDocumentTypes(),
      ]);
      setDocuments(listFrom(documentResponse));
      setTypes(normalizeDocumentTypes(typeResponse));
    } catch (requestError) {
      if (!silent) setError(requestError.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    load();
  }, [load]);

  useSyncRefresh(load, { interval: 30000, silent: true, enabled: Boolean(employeeId) });

  const request = async (data) => {
    await requestDocument(data);
    await load(true);
  };

  const setStatus = async (id, status, verificationNotes = "") => {
    await updateDocumentStatus(id, status, verificationNotes);
    await load(true);
  };

  const remove = async (id) => {
    await deleteDocument(id);
    await load(true);
  };

  return {
    documents,
    types,
    loading,
    error,
    reload: load,
    request,
    setStatus,
    remove,
  };
}
