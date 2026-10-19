import { createContext, useContext, useEffect, useState } from "react";
import { getCurrentUser, loginUser, signupUser } from "../services/authService";
import { normalizeRole } from "../utils/auth";
import { getDemoFallbackSession } from "../data/demoAccounts";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);

  const saveSession = (response) => {
    const session = response?.data && (response.data.user || response.data.token) ? response.data : response;
    const normalizedUser = { ...session.user, role: normalizeRole(session.user, session.employee) };

    // Clear previous user's cached storage items
    try {
      sessionStorage.clear();
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith("hrms_")) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {}

    sessionStorage.setItem("hrms_token", session.token);
    sessionStorage.setItem("hrms_user", JSON.stringify(normalizedUser));

    if (session.employee) {
      sessionStorage.setItem(
        "hrms_employee",
        JSON.stringify(session.employee),
      );
    }

    setUser(normalizedUser);
    setEmployee(session.employee || null);
    window.dispatchEvent(new CustomEvent("hrms:data_changed"));
    return { ...session, user: normalizedUser };
  };

  const login = async (email, password) => {
    try {
      sessionStorage.removeItem("hrms_selected_employee_id");
      localStorage.removeItem("hrms_selected_employee_id");
      const response = await loginUser({ email, password });
      sessionStorage.removeItem("hrms_demo_mode");
      return saveSession(response);
    } catch (apiError) {
      // If backend is unreachable or on a static deploy like Netlify, gracefully fall back to Demo Mode
      const demoSession = getDemoFallbackSession(email);
      if (demoSession) {
        console.warn("[Auth] Backend unreachable, falling back to Demo Mode:", demoSession.user.role);
        sessionStorage.setItem("hrms_demo_mode", "true");
        return saveSession(demoSession);
      }
      throw apiError;
    }
  };

  const signup = async (userData) => {
    const response = await signupUser(userData);

    const session = response?.data && (response.data.user || response.data.token) ? response.data : response;
    if (session.token && session.user) {
      return saveSession(response);
    }

    return login(userData.email, userData.password);
  };

  const updateProfilePhoto = (photoUrl) => {
    if (!photoUrl) return;

    const isBlob = photoUrl.startsWith("blob:");

    setEmployee((prev) => {
      const updated = prev ? { ...prev, profilePhoto: photoUrl } : { profilePhoto: photoUrl };
      if (!isBlob) {
        sessionStorage.setItem("hrms_employee", JSON.stringify(updated));
      }
      return updated;
    });

    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, profilePhoto: photoUrl };
      if (!isBlob) {
        sessionStorage.setItem("hrms_user", JSON.stringify(updated));
      }
      return updated;
    });

    window.dispatchEvent(
      new CustomEvent("hrms:profile_photo_updated", {
        detail: { profilePhoto: photoUrl },
      })
    );
  };

  const logout = () => {
    try {
      sessionStorage.clear();
      localStorage.removeItem("hrms_profile_photo");
      localStorage.removeItem("hrms_selected_employee_id");
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith("hrms_") && key !== "hrms_theme" && key !== "hrms_remember_email") {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {}

    setUser(null);
    setEmployee(null);
    window.dispatchEvent(new CustomEvent("hrms:data_changed"));
  };

  useEffect(() => {
    const restoreSession = async () => {
      const token = sessionStorage.getItem("hrms_token");

      // Purge unscoped legacy photo keys from storage on start
      sessionStorage.removeItem("hrms_profile_photo");
      localStorage.removeItem("hrms_profile_photo");

      if (!token) {
        setLoading(false);
        return;
      }

      // Check if session is a standalone demo session
      if (
        token.startsWith("demo-token-") ||
        sessionStorage.getItem("hrms_demo_mode") === "true"
      ) {
        try {
          const storedUser = JSON.parse(sessionStorage.getItem("hrms_user") || "null");
          const storedEmp = JSON.parse(sessionStorage.getItem("hrms_employee") || "null");
          if (storedUser) {
            setUser({ ...storedUser, role: normalizeRole(storedUser, storedEmp) });
            setEmployee(storedEmp);
            setLoading(false);
            return;
          }
        } catch (e) {
          // ignore parse error and proceed to normal flow
        }
      }

      try {
        const response = await getCurrentUser();

        const session = response?.data && response.data.user ? response.data : response;
        const fetchedEmp = session.employee || (sessionStorage.getItem("hrms_employee") ? JSON.parse(sessionStorage.getItem("hrms_employee")) : null);
        const fetchedUser = session.user ? { ...session.user, role: normalizeRole(session.user, fetchedEmp) } : null;

        // Ensure profilePhoto is strictly scoped to this authenticated user/employee only
        const userPhoto = fetchedEmp?.profilePhoto || fetchedUser?.profilePhoto || "";
        if (fetchedEmp) fetchedEmp.profilePhoto = userPhoto;
        if (fetchedUser) fetchedUser.profilePhoto = userPhoto;

        setUser(fetchedUser);
        setEmployee(fetchedEmp);
        if (fetchedEmp) sessionStorage.setItem("hrms_employee", JSON.stringify(fetchedEmp));
        if (fetchedUser) sessionStorage.setItem("hrms_user", JSON.stringify(fetchedUser));
      } catch (error) {
        if (!token.startsWith("demo-token-")) {
          logout();
        }
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, []);

  // Listen for real-time data sync events to update employee state
  useEffect(() => {
    const handleSync = async () => {
      try {
        const storedEmp = JSON.parse(sessionStorage.getItem("hrms_employee") || "null");
        if (storedEmp) {
          setEmployee(storedEmp);
        }
        const token = sessionStorage.getItem("hrms_token");
        if (token && !token.startsWith("demo-token-")) {
          const res = await getCurrentUser();
          const session = res?.data?.user ? res.data : res;
          if (session?.employee) {
            setEmployee(session.employee);
            sessionStorage.setItem("hrms_employee", JSON.stringify(session.employee));
          }
        }
      } catch (e) {}
    };

    window.addEventListener("hrms_data_updated", handleSync);
    window.addEventListener("hrms:data_changed", handleSync);
    return () => {
      window.removeEventListener("hrms_data_updated", handleSync);
      window.removeEventListener("hrms:data_changed", handleSync);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, employee, login, signup, logout, loading, updateProfilePhoto }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
