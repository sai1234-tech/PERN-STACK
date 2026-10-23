import NProgress from "nprogress";
import { broadcastDataChange, isBackgroundSync } from "../utils/syncManager";
import { handleDemoApi } from "../data/demoAccounts";
import { getAuthToken } from "../utils/auth";

// Configure NProgress with spinner enabled for a more effective loading indication
NProgress.configure({ showSpinner: true, minimum: 0.1, speed: 400 });

const API_BASE_URL = (
  import.meta.env.VITE_API_URL ||
  "/api/v1"
).replace(/\/+$/, "");

let activeRequests = 0;
let loaderFailsafeTimer = null;

function toggleGlobalLoader(isLoading, customText = "Updating Workspace...") {
  if (isLoading) {
    activeRequests++;
  } else {
    activeRequests = Math.max(0, activeRequests - 1);
  }

  let overlay = document.getElementById("global-api-loader");
  
  if (activeRequests > 0) {
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "global-api-loader";
      overlay.setAttribute("role", "status");
      overlay.setAttribute("aria-live", "polite");
      overlay.innerHTML = `
        <div class="global-api-glass-pod">
          <div class="global-orbital-chassis">
            <div class="global-ring global-ring-outer"></div>
            <div class="global-ring global-ring-inner"></div>
            <div class="global-core-pod">QSI</div>
          </div>
          <div class="global-api-message-group">
            <span class="global-api-text">${customText}</span>
            <span class="global-api-subtext">Applying real-time backend updates</span>
          </div>
          <div class="global-api-stream-bar">
            <div class="global-api-stream-beam"></div>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
    }
    overlay.classList.add("visible");

    // Failsafe: Clear loader after 3.5s maximum to prevent infinite stuck screens
    if (loaderFailsafeTimer) clearTimeout(loaderFailsafeTimer);
    loaderFailsafeTimer = setTimeout(() => {
      activeRequests = 0;
      if (overlay) overlay.classList.remove("visible");
    }, 3500);
  } else if (overlay) {
    if (loaderFailsafeTimer) clearTimeout(loaderFailsafeTimer);
    overlay.classList.remove("visible");
  }
}

function resolveEndpoint(endpoint) {
  const normalized = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return {
    normalized,
    url: `${API_BASE_URL}${normalized}`,
  };
}

function buildHeaders(customHeaders = {}, isFormData = false) {
  const token = getAuthToken();
  return {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...customHeaders,
  };
}

export async function apiRequest(endpoint, options = {}) {
  const token = getAuthToken();
  const isDemo =
    sessionStorage.getItem("hrms_demo_mode") === "true" ||
    (token && token.startsWith("demo-token-"));

  const { normalized: normalizedEndpoint, url } = resolveEndpoint(endpoint);

  // If in Standalone Demo Mode (e.g. on Netlify preview with no backend)
  if (isDemo && !normalizedEndpoint.includes("/auth/login")) {
    const res = handleDemoApi(normalizedEndpoint, options);
    const m = (options.method || "GET").toUpperCase();
    if (m !== "GET") {
      broadcastDataChange(normalizedEndpoint, { method: m, timestamp: Date.now() });
    }
    return res;
  }

  const headers = buildHeaders(options.headers, options.body instanceof FormData);
  const method = (options.method || "GET").toUpperCase();
  const shouldShowGlobalOverlay =
    !isBackgroundSync.current &&
    (method !== "GET" || options.showGlobalLoader === true);

  if (!isBackgroundSync.current) {
    NProgress.start();
  }
  if (shouldShowGlobalOverlay) {
    toggleGlobalLoader(true);
  }

  try {
    let response;

    try {
      const fetchOptions = {
        ...options,
        headers,
      };
      
      // Prevent aggressive browser caching for GET requests
      if (!fetchOptions.method || fetchOptions.method === 'GET') {
        fetchOptions.cache = 'no-store';
      }
      
      response = await fetch(url, fetchOptions);
    } catch (error) {
      console.error("[API Error] Network error:", error);
      throw new Error(
        `Cannot reach HRMS API at ${url}. Check that the backend is running and the frontend API URL is correct.`
      );
    }

    const contentType = response.headers.get("content-type") || "";
    let data;

    try {
      data = contentType.includes("application/json")
        ? await response.json()
        : await response.text();
    } catch (parseError) {
      console.error("[API Error] Failed to parse response:", parseError);
      throw new Error("Invalid response from server. Failed to parse data.");
    }

    if (!response.ok) {
      console.error("[API Error] Server returned error:", response.status, data);
      
      if (response.status === 401) {
        console.warn("[API Error] 401 Unauthorized received for endpoint", endpoint);
        // Dispatch session expired event so context can handle clean re-authentication
        if (!endpoint.includes("/auth/login")) {
          window.dispatchEvent(new CustomEvent("hrms:auth_expired", { detail: { message: data?.message } }));
        }
      }

      const errorMessage = typeof data === "object" && data?.message
          ? data.message
          : (typeof data === "string" ? data : `API request failed with status ${response.status}`);
          
      throw new Error(errorMessage);
    }

    // If a data-mutating call succeeded, broadcast an update event so all views sync
    if (method !== "GET") {
      broadcastDataChange(normalizedEndpoint, { method, timestamp: Date.now() });
    }

    return data;
  } finally {
    if (!isBackgroundSync.current) {
      NProgress.done();
    }
    if (shouldShowGlobalOverlay) {
      toggleGlobalLoader(false);
    }
  }
}

export async function apiDownload(endpoint, filename = "download") {
  const { url } = resolveEndpoint(endpoint);
  const headers = buildHeaders();

  NProgress.start();
  toggleGlobalLoader(true);

  try {
    let response;
    try {
      response = await fetch(url, { headers });
    } catch (error) {
      throw new Error(`Cannot reach HRMS API at ${url}. Check that the backend is running and the frontend API URL is correct.`);
    }

    if (!response.ok) {
      if (response.status === 401) {
        sessionStorage.removeItem("hrms_token");
        sessionStorage.removeItem("hrms_user");
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
      }
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        let data;
        try {
          data = await response.json();
        } catch (parseError) {
          throw new Error(`Download failed with status ${response.status}`);
        }
        throw new Error(data?.message || `Download failed with status ${response.status}`);
      }
      throw new Error(`Download failed with status ${response.status}`);
    }

    let blob;
    try {
      blob = await response.blob();
    } catch (parseError) {
      throw new Error("Failed to process download data.");
    }
    
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
  } finally {
    NProgress.done();
    toggleGlobalLoader(false);
  }
}
