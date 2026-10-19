import { useEffect, useRef } from "react";

// Event keys used across windows and storage
export const HRMS_SYNC_EVENT = "hrms_data_updated";
export const HRMS_LIVE_NOTICE_EVENT = "hrms:live_sync_notice";

/**
 * Dispatches an event to notify all active hooks and browser windows
 * that a mutation occurred in the backend.
 */
export function broadcastDataChange(category = "general", details = {}) {
  try {
    const timestamp = Date.now();
    const event = new CustomEvent(HRMS_SYNC_EVENT, {
      detail: { category, details, timestamp },
    });
    window.dispatchEvent(event);
    window.dispatchEvent(
      new CustomEvent("hrms:data_changed", {
        detail: { category, details, timestamp },
      })
    );
    localStorage.setItem(HRMS_SYNC_EVENT, String(timestamp));
    localStorage.setItem("hrms_data_last_mutation", String(timestamp));
  } catch {
    // Ignore environments where window/localStorage is unavailable
  }
}

export const isBackgroundSync = { current: false };

// Real-Time Server-Sent Events (SSE) Stream Controller
let sseConnection = null;
let sseReconnectTimer = null;
let sseRetryCount = 0;

export function initLiveSyncStream() {
  if (typeof window === "undefined" || !("EventSource" in window)) return;
  if (
    sseConnection &&
    (sseConnection.readyState === EventSource.OPEN ||
      sseConnection.readyState === EventSource.CONNECTING)
  ) {
    return;
  }

  const API_BASE_URL = (
    import.meta.env.VITE_API_URL ||
    "/api/v1"
  ).replace(/\/+$/, "");

  // Fallback to /api/sync/stream if VITE_API_URL has /v1
  const streamUrl = `${API_BASE_URL}/sync/stream`;

  try {
    sseConnection = new EventSource(streamUrl);

    sseConnection.onopen = () => {
      sseRetryCount = 0;
      if (sseReconnectTimer) {
        clearTimeout(sseReconnectTimer);
        sseReconnectTimer = null;
      }
    };

    sseConnection.onmessage = (event) => {
      try {
        if (!event?.data) return;
        const payload = JSON.parse(event.data);
        if (payload.type === "connected") return;

        const category = payload.category || "general";
        const details = payload.details || {};

        // 1. Immediately trigger all active React data hooks across the UI
        broadcastDataChange(category, details);

        // 2. Dispatch live visual sync notice for the HUD toast pill
        window.dispatchEvent(
          new CustomEvent(HRMS_LIVE_NOTICE_EVENT, {
            detail: {
              category,
              details,
              timestamp: payload.timestamp || Date.now(),
            },
          })
        );
      } catch {
        // Heartbeat or comment packet
      }
    };

    sseConnection.onerror = () => {
      if (sseConnection) {
        sseConnection.close();
        sseConnection = null;
      }
      if (!sseReconnectTimer) {
        sseRetryCount++;
        const delay = Math.min(2000 * Math.pow(1.5, sseRetryCount), 30000);
        sseReconnectTimer = setTimeout(() => {
          sseReconnectTimer = null;
          initLiveSyncStream();
        }, delay);
      }
    };
  } catch (err) {
    console.warn("[LiveSync] Failed to establish SSE:", err);
  }
}

// Auto-initialize real-time live sync stream
if (typeof window !== "undefined") {
  initLiveSyncStream();
}

/**
 * Custom hook to keep any component or data hook synchronized with backend changes in real-time.
 * Triggers refresh on:
 * 1. Live SSE push from backend (latency < 20ms)
 * 2. In-app data mutation events (hrms_data_updated / hrms:data_changed)
 * 3. Cross-tab storage events (actions performed in another tab/browser)
 * 4. Window focus (user returns to browser or clicks window)
 * 5. Document visibility change (user switches tabs)
 * 6. Adaptive background sync (every 4000ms when tab is visible as a secondary guarantee)
 */
export function useSyncRefresh(callback, options = {}) {
  const {
    interval = 4000, // Responsive 4-second visible poll as secondary guarantee
    enabled = true,
    silent = true,
  } = options;

  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) return;

    let isDestroyed = false;
    let isFetching = false;
    let errorCount = 0;
    let timerId = null;

    const scheduleNextPoll = () => {
      if (isDestroyed || !interval || interval <= 0) return;

      // Exponential backoff up to 60s only on consecutive errors
      const currentInterval = Math.min(interval * Math.pow(1.5, errorCount), 60000);

      timerId = setTimeout(() => {
        if (document.visibilityState === "visible") {
          triggerRefresh(true);
        } else {
          scheduleNextPoll();
        }
      }, currentInterval);
    };

    const triggerRefresh = async (isPoll = false) => {
      if (isDestroyed || isFetching) return;
      if (typeof callbackRef.current === "function") {
        try {
          isFetching = true;
          isBackgroundSync.current = true;
          await callbackRef.current(silent);
          errorCount = 0;
        } catch {
          errorCount++;
        } finally {
          isBackgroundSync.current = false;
          isFetching = false;
          if (isPoll && !isDestroyed) {
            scheduleNextPoll();
          }
        }
      }
    };

    // 1. Window focus listener
    const handleFocus = () => {
      triggerRefresh();
    };

    // 2. Visibility change listener
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        triggerRefresh();
      }
    };

    // 3. Custom in-app event (triggered by SSE or local mutation)
    const handleCustomSync = () => {
      triggerRefresh();
    };

    // 4. Cross-tab storage event
    const handleStorage = (e) => {
      if (e.key === HRMS_SYNC_EVENT) {
        triggerRefresh();
      }
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener(HRMS_SYNC_EVENT, handleCustomSync);
    window.addEventListener("hrms:data_changed", handleCustomSync);
    window.addEventListener("storage", handleStorage);
    document.addEventListener("visibilitychange", handleVisibility);

    // 5. Start periodic visible background sync
    scheduleNextPoll();

    return () => {
      isDestroyed = true;
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener(HRMS_SYNC_EVENT, handleCustomSync);
      window.removeEventListener("hrms:data_changed", handleCustomSync);
      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (timerId) clearTimeout(timerId);
    };
  }, [enabled, interval, silent]);
}
