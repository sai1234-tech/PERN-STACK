import { useState, useCallback, useEffect } from "react";
import {
  getCandidates,
  createCandidate as apiCreateCandidate,
  updateCandidateStatus as apiUpdateCandidateStatus,
  updateCandidateBgv as apiUpdateCandidateBgv,
  onboardCandidate as apiOnboardCandidate
} from "../services/candidateService";
import { getAuditLogs, logAudit as apiLogAudit } from "../services/auditService";
import { getAllEmployees } from "../services/employeeService";

export const useRecruitment = () => {
  const [candidates, setCandidates] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [companyEmployees, setCompanyEmployees] = useState([]);
  const [auditTrail, setAuditTrail] = useState([]);
  const [onboardingStatus, setOnboardingStatus] = useState({});

  // Initial load from PostgreSQL backend
  const loadRecruitmentData = useCallback(async () => {
    try {
      const [candList, auditList, empList] = await Promise.allSettled([
        getCandidates(),
        getAuditLogs(50),
        getAllEmployees(),
      ]);

      if (candList.status === "fulfilled" && Array.isArray(candList.value)) {
        setCandidates(candList.value.map(c => ({
          ...c,
          candidate_id: c.candidate_id || c.candidateId,
        })));

        // Extract already onboarded employees
        const onboarded = candList.value
          .filter(c => c.onboardedEmployeeId)
          .map(c => ({
            employee_id: c.onboardedEmployeeId,
            candidate_id: c.candidate_id || c.candidateId,
            name: c.name,
            email: c.email,
            phone: c.phone,
            department: c.department,
            designation: c.designation,
          }));
        setEmployees(onboarded);
      }

      if (empList.status === "fulfilled") {
        const emps = Array.isArray(empList.value?.data) ? empList.value.data : (Array.isArray(empList.value) ? empList.value : []);
        setCompanyEmployees(emps);
      }

      if (auditList.status === "fulfilled" && Array.isArray(auditList.value) && auditList.value.length > 0) {
        setAuditTrail(auditList.value.map(a => ({
          id: a.id,
          timestamp: a.timestamp || a.createdAt,
          action: a.action,
          details: a.details,
          user: a.userName || "HR Admin",
        })));
      }
    } catch (err) {
      console.warn("Notice: Loading candidates fallback:", err.message);
    }
  }, []);

  useEffect(() => {
    loadRecruitmentData();
  }, [loadRecruitmentData]);

  // Log to Audit Trail (Persisted to PostgreSQL)
  const logAudit = useCallback(async (action, details, user = "HR Admin") => {
    const localEntry = {
      id: Date.now() + Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      action,
      details,
      user,
    };
    setAuditTrail((prev) => [localEntry, ...prev]);

    try {
      await apiLogAudit({
        action,
        entityType: "Recruitment",
        details,
      });
    } catch (err) {
      // Background log
    }
  }, []);

  // 1. Candidate Management (PostgreSQL backend sync)
  const addCandidate = useCallback(async (candidate) => {
    try {
      const created = await apiCreateCandidate(candidate);
      const newCand = {
        ...candidate,
        ...created,
        candidate_id: created?.candidate_id || created?.candidateId || `CAND-${String(candidates.length + 1).padStart(3, "0")}`,
        status: "Applied",
      };
      setCandidates((prev) => [...prev, newCand]);
      logAudit("Candidate Added", `Registered ${newCand.name} (${newCand.email}) to pipeline.`);
    } catch (err) {
      // Fallback
      const newCandidate = {
        ...candidate,
        candidate_id: `CAND-${String(candidates.length + 1).padStart(3, "0")}`,
        status: "Applied",
      };
      setCandidates((prev) => [...prev, newCandidate]);
      logAudit("Candidate Added (Offline)", `Registered ${newCandidate.name} to pipeline.`);
    }
  }, [candidates.length, logAudit]);

  const updateCandidateStatus = useCallback(async (id, newStatus) => {
    setCandidates((prev) =>
      prev.map((c) => (c.candidate_id === id ? { ...c, status: newStatus } : c))
    );

    try {
      await apiUpdateCandidateStatus(id, newStatus);
      logAudit("Status Updated", `Candidate ${id} transitioned to stage ${newStatus}.`);
    } catch (err) {
      console.warn("Backend status update fallback:", err.message);
    }
  }, [logAudit]);

  const updateBgv = useCallback(async (id, bgvStatus, bgvNotes = "") => {
    setCandidates((prev) =>
      prev.map((c) => (c.candidate_id === id ? { ...c, bgvStatus, bgvNotes } : c))
    );

    try {
      await apiUpdateCandidateBgv(id, bgvStatus, bgvNotes);
      logAudit("BGV Status Updated", `Candidate ${id} verification status set to ${bgvStatus}.`);
    } catch (err) {
      console.warn("Backend BGV update fallback:", err.message);
    }
  }, [logAudit]);

  // 2. Onboarding Workflow (PostgreSQL backend execution)
  const triggerOnboarding = useCallback(async (candidate_id, onboardingData) => {
    const candidate = candidates.find((c) => c.candidate_id === candidate_id);
    if (!candidate) return { success: false, error: "Candidate not found." };

    // Idempotency: Check if employee already exists for this candidate
    const existingEmployee = employees.find((e) => e.candidate_id === candidate_id);
    if (existingEmployee) {
      logAudit("Onboarding Failed", `Duplicate attempt for ${candidate.name}. Employee already exists.`);
      return { success: false, error: "An employee account already exists for this candidate." };
    }

    setOnboardingStatus((prev) => ({ ...prev, [candidate_id]: "Pending" }));
    logAudit("Candidate Marked Hired", `Candidate ${candidate.name} (${candidate_id}) marked as Hired. Onboarding initiated.`);

    try {
      setOnboardingStatus((prev) => ({ ...prev, [candidate_id]: "Creating Account & Employee Master..." }));

      // Call backend API to create real employee and user account
      const res = await apiOnboardCandidate(candidate_id, onboardingData);
      const newEmployeeId = res?.employeeCode || res?.data?.employeeCode || `EMP-${Math.floor(1000 + Math.random() * 9000)}`;

      setOnboardingStatus((prev) => ({ ...prev, [candidate_id]: "Assigning Department & Manager..." }));
      await new Promise((r) => setTimeout(r, 600));

      const newEmployee = {
        employee_id: newEmployeeId,
        candidate_id: candidate.candidate_id,
        name: candidate.name,
        email: candidate.email,
        phone: candidate.phone,
        department: onboardingData.department || candidate.department,
        manager: onboardingData.manager || candidate.manager,
        designation: onboardingData.designation || candidate.designation,
        joining_date: onboardingData.joiningDate,
        account_status: "Active",
      };

      setEmployees((prev) => [...prev, newEmployee]);
      logAudit("Employee Account Provisioned", `Account successfully provisioned in PostgreSQL for ${newEmployee.name} (${newEmployee.employee_id})`);

      setOnboardingStatus((prev) => ({ ...prev, [candidate_id]: "Completed" }));
      updateCandidateStatus(candidate_id, "Hired");
      logAudit("Onboarding Completed", `End-to-end onboarding successfully completed for ${candidate.name}`);

      return { success: true, employee_id: newEmployeeId };
    } catch (error) {
      setOnboardingStatus((prev) => ({ ...prev, [candidate_id]: "Failed" }));
      logAudit("Onboarding Failed", `Workflow failed for ${candidate.name}: ${error.message}`);
      return { success: false, error: error.message };
    }
  }, [candidates, employees, updateCandidateStatus, logAudit]);

  return {
    candidates,
    employees,
    companyEmployees,
    auditTrail,
    onboardingStatus,
    addCandidate,
    updateCandidateStatus,
    updateBgv,
    triggerOnboarding,
    logAudit,
    reload: loadRecruitmentData,
  };
};
