import NProgress from "nprogress";
import { broadcastDataChange, isBackgroundSync } from "../utils/syncManager";
import { handleDemoApi } from "../data/demoAccounts";

// Configure NProgress with spinner enabled for a more effective loading indication
NProgress.configure({ showSpinner: true, minimum: 0.1, speed: 400 });

const API_BASE_URL = (
  import.meta.env.VITE_API_URL ||
  "/api/v1"
).replace(/\/+$/, "");

let activeRequests = 0;

function toggleGlobalLoader(isLoading) {
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
      overlay.innerHTML = `
        <div class="global-api-spinner"></div>
        <div class="global-api-text">Processing...</div>
      `;
      document.body.appendChild(overlay);
    }
    overlay.classList.add("visible");
  } else if (overlay) {
    overlay.classList.remove("visible");
  }
}

export async function apiRequest(endpoint, options = {}) {
  const token = sessionStorage.getItem("hrms_token");
  const isDemo =
    sessionStorage.getItem("hrms_demo_mode") === "true" ||
    (token && token.startsWith("demo-token-"));

  const normalizedEndpoint = endpoint.startsWith("/")
    ? endpoint
    : `/${endpoint}`;

  // If in Standalone Demo Mode (e.g. on Netlify preview with no backend)
  if (isDemo && !normalizedEndpoint.includes("/auth/login")) {
    return handleDemoApi(normalizedEndpoint, options);
  }

  const url = `${API_BASE_URL}${normalizedEndpoint}`;

  const headers = {
    ...(options.body instanceof FormData
      ? {}
      : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  console.log(`[API Request] ${url}`);
  console.log(`[API Request] Token from sessionStorage:`, token ? `${token.substring(0, 10)}...` : null);
  console.log(`[API Request] Headers:`, headers);

  if (!isBackgroundSync.current) {
    NProgress.start();
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
        // We will NOT aggressively remove the token here because if multiple concurrent
        // requests are made, one 401 will wipe the token for the rest and mask the real error.
        
        // Only redirect if it's not a login attempt
        if (!endpoint.includes("/auth/login") && window.location.pathname !== "/login") {
          // window.location.href = "/login"; // Also disabling forced redirect to see the UI error
        }
      }

      const errorMessage = typeof data === "object" && data?.message
          ? data.message
          : (typeof data === "string" ? data : `API request failed with status ${response.status}`);
          
      throw new Error(errorMessage);
    }

    // If a data-mutating call succeeded, broadcast an update event so all views sync
    const method = (options.method || "GET").toUpperCase();
    if (method !== "GET") {
      broadcastDataChange(normalizedEndpoint, { method, timestamp: Date.now() });
    }

    return data;
  } finally {
    if (!isBackgroundSync.current) {
      NProgress.done();
      toggleGlobalLoader(false);
    }
  }
}

export async function apiDownload(endpoint, filename = "download") {
  const token = sessionStorage.getItem("hrms_token");

  const normalizedEndpoint = endpoint.startsWith("/")
    ? endpoint
    : `/${endpoint}`;

  const url = `${API_BASE_URL}${normalizedEndpoint}`;

  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

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
