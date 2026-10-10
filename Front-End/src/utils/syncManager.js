import { useEffect, useRef } from "react";

// Event key used across windows and storage
export const HRMS_SYNC_EVENT = "hrms_data_updated";

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
    localStorage.setItem(HRMS_SYNC_EVENT, String(timestamp));
  } catch {
    // Ignore environments where window/localStorage is unavailable
  }
}

export const isBackgroundSync = { current: false };

/**
 * Custom hook to keep any component or data hook synchronized with backend changes in milliseconds.
 * Triggers refresh on:
 * 1. Window focus (user returns to browser or clicks window)
 * 2. Document visibility change (user switches tabs)
 * 3. In-app data mutation events (hrms_data_updated)
 * 4. Cross-tab storage events (actions performed in another tab)
 * 5. Periodic visible poll (every 3500ms when tab is active)
 */
export function useSyncRefresh(callback, options = {}) {
  const {
    interval = 30000, // Increased default from 3500 to 30000 to prevent backend spam
    enabled = true,
    silent = true,
  } = options;

  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) return;

    let isDestroyed = false;
    let isFetching = false;
    let errorCount = 0; // Track consecutive errors
    let timerId = null;

    const scheduleNextPoll = () => {
      if (isDestroyed || !interval || interval <= 0) return;
      
      // Exponential backoff: max 2 minutes (120000ms)
      const currentInterval = Math.min(interval * Math.pow(2, errorCount), 120000);
      
      timerId = setTimeout(() => {
        if (document.visibilityState === "visible") {
          triggerRefresh(true);
        } else {
          // If hidden, just schedule next check without fetching
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
          errorCount = 0; // Reset on success
        } catch {
          // Silent failure during background sync to avoid user disruption
          errorCount++; // Increase backoff multiplier on failure
        } finally {
          isBackgroundSync.current = false;
          isFetching = false;
          if (isPoll) {
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

    // 3. Custom in-app event
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
    window.addEventListener("storage", handleStorage);
    document.addEventListener("visibilitychange", handleVisibility);

    // 5. Start periodic visible background sync
    scheduleNextPoll();

    return () => {
      isDestroyed = true;
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener(HRMS_SYNC_EVENT, handleCustomSync);
      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (timerId) clearTimeout(timerId);
    };
  }, [enabled, interval, silent]);
}
