import { useCallback, useEffect, useState } from "react";
import {
  deleteDocument,
  getDocumentTypes,
  getMyDocuments,
  normalizeDocumentTypes,
  uploadDocument,
} from "../services/documentService";
import { useSyncRefresh } from "../utils/syncManager";

function listFrom(response) {
  const value = response?.data || response?.documents || response?.types || response || [];
  return Array.isArray(value) ? value : [];
}

export function useDocuments() {
  const [documents, setDocuments] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const [documentResponse, typeResponse] = await Promise.all([
        getMyDocuments(),
        getDocumentTypes(),
      ]);
      setDocuments(listFrom(documentResponse));
      setTypes(normalizeDocumentTypes(typeResponse));
    } catch (requestError) {
      if (!silent) setError(requestError.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useSyncRefresh(load, { interval: 30000, silent: true });

  const upload = async (file, data) => {
    await uploadDocument(file, data);
    await load(true);
  };

  const remove = async (id) => {
    await deleteDocument(id);
    await load(true);
  };

  return { documents, types, loading, error, reload: load, upload, remove };
}