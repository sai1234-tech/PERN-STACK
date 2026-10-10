import { useState, useCallback, useEffect } from "react";

const INITIAL_CANDIDATES = [
  {
    candidate_id: "CAND-001",
    name: "Aisha Sharma",
    email: "aisha.sharma@example.com",
    phone: "+91 98765 43210",
    skills: "React, Node.js, AWS",
    experience: "5 Years",
    status: "Interview",
  },
  {
    candidate_id: "CAND-002",
    name: "Rohan Das",
    email: "rohan.das@example.com",
    phone: "+91 87654 32109",
    skills: "Python, Django, PostgreSQL",
    experience: "3 Years",
    status: "Applied",
  },
  {
    candidate_id: "CAND-003",
    name: "Sneha Patel",
    email: "sneha.patel@example.com",
    phone: "+91 76543 21098",
    skills: "Figma, UI/UX, CSS",
    experience: "4 Years",
    status: "Selected",
  },
];

export const useRecruitment = () => {
  const [candidates, setCandidates] = useState(INITIAL_CANDIDATES);
  const [employees, setEmployees] = useState([]);
  const [auditTrail, setAuditTrail] = useState([]);
  const [onboardingStatus, setOnboardingStatus] = useState({}); // track status by candidate_id

  // 1. Candidate Management
  const addCandidate = useCallback((candidate) => {
    const newCandidate = {
      ...candidate,
      candidate_id: `CAND-${String(candidates.length + 1).padStart(3, "0")}`,
      status: "Applied",
    };
    setCandidates((prev) => [...prev, newCandidate]);
  }, [candidates.length]);

  const updateCandidateStatus = useCallback((id, newStatus) => {
    setCandidates((prev) =>
      prev.map((c) => (c.candidate_id === id ? { ...c, status: newStatus } : c))
    );
  }, []);

  // Log to Audit Trail
  const logAudit = useCallback((action, details, user = "HR Admin") => {
    const logEntry = {
      id: Date.now() + Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      action,
      details,
      user,
    };
    setAuditTrail((prev) => [logEntry, ...prev]);
  }, []);

  // 2. Onboarding Workflow Simulation
  const triggerOnboarding = useCallback(async (candidate_id, onboardingData) => {
    // Check if candidate exists
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
      // Step 1: Account Creation & ID Generation
      setOnboardingStatus((prev) => ({ ...prev, [candidate_id]: "Creating Account..." }));
      await new Promise((res) => setTimeout(res, 1000));
      
      const newEmployeeId = `EMP-${Math.floor(1000 + Math.random() * 9000)}`;
      logAudit("Employee ID Generated", `Generated unique ID: ${newEmployeeId} for ${candidate.name}`);

      // Step 2: Department & Manager Assignment
      setOnboardingStatus((prev) => ({ ...prev, [candidate_id]: "Assigning Department & Manager..." }));
      await new Promise((res) => setTimeout(res, 1000));

      const newEmployee = {
        employee_id: newEmployeeId,
        candidate_id: candidate.candidate_id,
        name: candidate.name,
        email: candidate.email,
        phone: candidate.phone,
        department: onboardingData.department,
        manager: onboardingData.manager,
        designation: onboardingData.designation,
        joining_date: onboardingData.joiningDate,
        account_status: "Active",
      };
      
      setEmployees((prev) => [...prev, newEmployee]);
      logAudit("Department & Manager Assigned", `${newEmployee.name} assigned to ${newEmployee.department} under ${newEmployee.manager}`);
      logAudit("Employee Account Created", `Account successfully provisioned for ${newEmployee.name} (${newEmployee.employee_id})`);

      // Step 3: Welcome Email
      setOnboardingStatus((prev) => ({ ...prev, [candidate_id]: "Sending Welcome Email..." }));
      await new Promise((res) => setTimeout(res, 1200));
      
      // Simulate failure randomly (10% chance) just to show error handling and retry if needed, but for smooth testing let's not randomly fail.
      logAudit("Welcome Email Sent", `Sent secure activation link and onboarding details to ${candidate.email}`);

      // Final Step
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
    auditTrail,
    onboardingStatus,
    addCandidate,
    updateCandidateStatus,
    triggerOnboarding,
    logAudit,
  };
};
