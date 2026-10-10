import { useState, useCallback, useEffect } from "react";
import * as performanceService from "../services/performanceService";

export const usePerformance = (isManagerOrHr = false) => {
  const [okrs, setOkrs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchOkrs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (isManagerOrHr) {
        const response = await performanceService.getAllOkrs();
        setOkrs(response.data || []);
      } else {
        const response = await performanceService.getMyOkrs();
        setOkrs(response.data || []);
      }
    } catch (err) {
      console.error("Fetch OKRs Error:", err);
      setError(err.response?.data?.message || "Failed to fetch OKRs");
    } finally {
      setLoading(false);
    }
  }, [isManagerOrHr]);

  useEffect(() => {
    fetchOkrs();
  }, [fetchOkrs]);

  const addOkr = async (objective) => {
    try {
      const response = await performanceService.createOkr(objective);
      if (response.success && response.data) {
        setOkrs((prev) => [response.data, ...prev]);
        return response.data;
      }
    } catch (err) {
      console.error("Add OKR Error:", err);
      setError(err.response?.data?.message || "Failed to add OKR");
      throw err;
    }
  };

  const rateOkr = async (okrId, score, feedback) => {
    try {
      const response = await performanceService.rateOkr(okrId, score, feedback);
      if (response.success && response.data) {
        setOkrs((prev) =>
          prev.map((o) => (o._id === okrId ? response.data : o))
        );
        return response.data;
      }
    } catch (err) {
      console.error("Rate OKR Error:", err);
      setError(err.response?.data?.message || "Failed to rate OKR");
      throw err;
    }
  };

  return {
    okrs,
    loading,
    error,
    addOkr,
    rateOkr,
    refreshOkrs: fetchOkrs,
  };
};
