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
    const normalizedUser = { ...session.user, role: normalizeRole(session.user) };
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

    if (!isBlob) {
      sessionStorage.setItem("hrms_profile_photo", photoUrl);
      localStorage.setItem("hrms_profile_photo", photoUrl);
    }

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
    sessionStorage.removeItem("hrms_token");
    sessionStorage.removeItem("hrms_user");
    sessionStorage.removeItem("hrms_employee");
    sessionStorage.removeItem("hrms_profile_photo");
    sessionStorage.removeItem("hrms_demo_mode");
    sessionStorage.removeItem("hrms_selected_employee_id");
    localStorage.removeItem("hrms_profile_photo");
    localStorage.removeItem("hrms_selected_employee_id");

    setUser(null);
    setEmployee(null);
  };

  useEffect(() => {
    const restoreSession = async () => {
      const token = sessionStorage.getItem("hrms_token");

      // Clean up dead blob URLs from storage on start
      const sPhoto = sessionStorage.getItem("hrms_profile_photo");
      const lPhoto = localStorage.getItem("hrms_profile_photo");
      if (sPhoto && sPhoto.startsWith("blob:")) sessionStorage.removeItem("hrms_profile_photo");
      if (lPhoto && lPhoto.startsWith("blob:")) localStorage.removeItem("hrms_profile_photo");

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
            setUser({ ...storedUser, role: normalizeRole(storedUser) });
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
        const fetchedUser = session.user ? { ...session.user, role: normalizeRole(session.user) } : null;
        const fetchedEmp = session.employee || (sessionStorage.getItem("hrms_employee") ? JSON.parse(sessionStorage.getItem("hrms_employee")) : null);

        const serverPhoto = fetchedEmp?.profilePhoto || fetchedUser?.profilePhoto;
        const validCachedPhoto = serverPhoto ||
          (sessionStorage.getItem("hrms_profile_photo") && !sessionStorage.getItem("hrms_profile_photo").startsWith("blob:") ? sessionStorage.getItem("hrms_profile_photo") : null) ||
          (localStorage.getItem("hrms_profile_photo") && !localStorage.getItem("hrms_profile_photo").startsWith("blob:") ? localStorage.getItem("hrms_profile_photo") : null);

        if (validCachedPhoto) {
          sessionStorage.setItem("hrms_profile_photo", validCachedPhoto);
          localStorage.setItem("hrms_profile_photo", validCachedPhoto);
          if (fetchedEmp && !fetchedEmp.profilePhoto) fetchedEmp.profilePhoto = validCachedPhoto;
          if (fetchedUser && !fetchedUser.profilePhoto) fetchedUser.profilePhoto = validCachedPhoto;
        }

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
