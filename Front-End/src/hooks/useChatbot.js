import { useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useLeaves } from "./useLeaves";
import { useTimesheets } from "./useTimesheets";
import { useRecruitment } from "./useRecruitment";
import { useEnterpriseOps } from "./useEnterpriseOps";
import { normalizeRole } from "../utils/auth";

export const useChatbot = () => {
  const { user } = useAuth();
  const { leaves } = useLeaves();
  const { timesheets } = useTimesheets();
  const { candidates, onboardingStatus, triggerOnboarding } = useRecruitment();
  const { tickets } = useEnterpriseOps();
  
  const role = normalizeRole(user);
  
  // State for interactive confirmation
  const [pendingAction, setPendingAction] = useState(null);

  const processQuery = useCallback((text) => {
    const query = text.toLowerCase();
    
    // --- Cancel Action ---
    if (query === "cancel" || query === "no") {
      setPendingAction(null);
      return { text: "Action cancelled. How else can I help you?" };
    }

    // --- Execute Pending Action ---
    if ((query === "yes" || query === "confirm" || query === "proceed") && pendingAction) {
      if (pendingAction.type === "apply_leave") {
        setPendingAction(null);
        return { text: `Leave request submitted successfully. Request ID: LV-2026-${Math.floor(Math.random() * 10000)}.` };
      }
      if (pendingAction.type === "onboard_candidate") {
        triggerOnboarding(pendingAction.payload.candidateId, { department: "Engineering", manager: "Auto-Assigned" });
        setPendingAction(null);
        return { text: `Onboarding workflow initiated for candidate ${pendingAction.payload.name}. Secure activation email dispatched.` };
      }
    }

    // ============================================
    // EMPLOYEE INTENTS
    // ============================================

    if (query.includes("leave balance") || query.includes("how many leaves") || query.includes("remaining leave")) {
      return { text: "Your current available leave balance is 18 days (12 Earned, 4 Casual, 2 Sick).", link: "/employee/leaves" };
    }

    if (query.includes("apply leave") || query.includes("book leave") || query.includes("request leave")) {
      // Very basic date extraction heuristic
      const dateMatch = query.match(/for (september \d+|october \d+|today|tomorrow)/i);
      const date = dateMatch ? dateMatch[1] : "the requested date";
      
      setPendingAction({ type: "apply_leave", payload: { date } });
      return { 
        text: `You are requesting leave for ${date}. Your available balance is 18 days. Would you like me to submit this request?`,
        actions: ["Confirm", "Cancel"]
      };
    }

    if (query.includes("timesheet") || query.includes("submitted hours")) {
      const pendingCount = timesheets.filter(t => t.status === "Pending").length;
      return { text: `You have ${timesheets.length} timesheets on record, with ${pendingCount} pending approval.`, link: "/employee/timesheets" };
    }

    if (query.includes("attendance") || query.includes("punch")) {
      return { text: "You have a 96% attendance rate this month. You clocked in today at 09:12 AM.", link: "/employee/attendance" };
    }

    if (query.includes("payslip") || query.includes("net salary") || query.includes("deduction")) {
      return { text: "Your latest payslip for August is available. Your net take-home pay was safely disbursed.", link: "/employee/payroll" };
    }

    if (query.includes("employee id") || query.includes("my id")) {
      const empId = user?.employeeCode || user?.employeeId || (employee?.employeeCode);
      return { text: empId ? `Your Employee ID is: ${empId}` : "Your Employee ID is not set yet. Check your profile details." };
    }

    if (query.includes("who is my manager") || query.includes("my manager")) {
      const storedEmp = sessionStorage.getItem("hrms_employee") ? JSON.parse(sessionStorage.getItem("hrms_employee")) : null;
      const storedUser = sessionStorage.getItem("hrms_user") ? JSON.parse(sessionStorage.getItem("hrms_user")) : null;
      const managerName = storedEmp?.reportsToName || storedEmp?.managerName || storedEmp?.manager?.name || storedUser?.managerName || user?.reportsToName;

      if (managerName) {
        return { text: `Your reporting manager is ${managerName}.` };
      } else {
        return { text: "No reporting manager assigned yet. You can check or edit reporting details in HR Employee Management.", link: "/hr/employees" };
      }
    }

    if (query.includes("policy") || query.includes("notice period") || query.includes("wfh")) {
      if (query.includes("notice period")) return { text: "The standard notice period is 60 days as per HR policy." };
      if (query.includes("wfh") || query.includes("remote")) return { text: "Employees are allowed up to 2 days of remote work (WFH) per week." };
      return { text: "Please check the HR Policies document in your Document Vault for detailed information.", link: "/employee/documents" };
    }

    if (query.includes("my ticket") || query.includes("ticket status") || query.includes("check ticket") || (query.includes("status") && query.includes("ticket"))) {
      const empCode = user?.employeeCode || user?.employeeId || "EM0175";
      const empName = `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || user?.name || "";
      const myTickets = tickets.filter(t => 
        (t.empId || "").toLowerCase().includes(empCode.toLowerCase()) || 
        (empName && (t.empId || "").toLowerCase().includes(empName.toLowerCase())) ||
        t.empId === "EMP-000"
      );
      if (myTickets.length === 0) {
        return { text: "You don't have any open or resolved support tickets at the moment." };
      }
      const latestTicket = myTickets[0];
      if (latestTicket.status === "Resolved") {
        return { text: `Your ticket (${latestTicket.id}) has been RESOLVED by HR. Resolution: "${latestTicket.resolution}".` };
      } else {
        return { text: `Your ticket (${latestTicket.id}) is currently OPEN. HR is reviewing it and will respond shortly.` };
      }
    }

    // ============================================
    // HR/ADMIN INTENTS
    // ============================================

    if (role === "hr" || role === "admin") {
      if (query.includes("search candidate") || query.includes("interview stage")) {
        const interviewCount = candidates.filter(c => c.status === "Interview").length;
        return { text: `There are currently ${interviewCount} candidates in the Interview stage.`, link: "/hr/recruitment" };
      }

      if (query.includes("start onboarding") || query.includes("onboard")) {
        const nameMatch = query.match(/for (.*)/i);
        const name = nameMatch ? nameMatch[1].trim() : "";
        
        const candidate = candidates.find(c => c.name.toLowerCase().includes(name.toLowerCase()));
        if (!candidate) {
          return { text: "I couldn't find a matching candidate with that name." };
        }
        if (candidate.status !== "Hired") {
          return { text: `Candidate ${candidate.name} is currently in the '${candidate.status}' stage. They must be 'Hired' before onboarding.` };
        }
        
        setPendingAction({ type: "onboard_candidate", payload: { candidateId: candidate.candidate_id, name: candidate.name } });
        return { 
          text: `Candidate ${candidate.name} is verified as Hired. Do you want me to initiate the onboarding workflow and generate their Employee ID?`,
          actions: ["Confirm", "Cancel"]
        };
      }
      
      if (query.includes("bench") || query.includes("allocation")) {
        return { text: "I can take you to the Resource Matrix to manage bench allocations.", link: "/hr/resources" };
      }
    } else {
      // Reject HR commands if Employee
      if (query.includes("search candidate") || query.includes("start onboarding") || query.includes("bench")) {
        return { text: "Sorry, you don't have permission to access this information. (Requires HR/Admin role)." };
      }
    }

    // ============================================
    // FALLBACK (HR HELPDESK TICKET)
    // ============================================
    
    return { 
      text: "I couldn't resolve that automatically. Would you like me to create an HR Support Ticket for this issue?",
      actions: ["Create Ticket", "Cancel"]
    };

  }, [user, leaves, timesheets, candidates, onboardingStatus, triggerOnboarding, pendingAction, role]);

  return { processQuery, pendingAction, setPendingAction };
};
