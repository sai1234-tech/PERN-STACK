import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import {
  getAutomationsOverview,
  getOnboardingTemplates,
  createOnboardingTemplate,
  getOnboardingInstances,
  generateOnboardingChecklist,
  updateOnboardingTaskStatus,
  getMissingDocumentReminders,
  triggerMissingDocReminder,
  scanMissingDocuments,
  getBgvSlaEscalations,
  triggerBgvEscalation,
  getCutoffBatches,
  executeMonthlyCutoff,
  getProbationAlerts,
  updateProbationDecision,
  getPerformanceAlerts,
  dispatchPerformanceReminder,
  getExitClearanceTasks,
  createExitClearanceWorkflow,
  updateClearanceTaskStatus,
  getTicketSlaEscalations,
  evaluateTicketSlas,
  getScheduledReports,
  runScheduledReport,
  getReportExecutions,
} from "../controllers/enterpriseAutomationsController.js";

const router = express.Router();

router.use(verifyToken);

// 0. Automation Center Executive Overview
router.get("/overview", authorizeRoles("admin", "super_admin", "hr", "manager", "leadership", "auditor"), getAutomationsOverview);

// 1. Role / Client Onboarding Checklists
router.get("/onboarding/templates", authorizeRoles("admin", "super_admin", "hr", "manager"), getOnboardingTemplates);
router.post("/onboarding/templates", authorizeRoles("admin", "super_admin", "hr"), createOnboardingTemplate);
router.get("/onboarding/instances", authorizeRoles("admin", "super_admin", "hr", "manager", "employee"), getOnboardingInstances);
router.post("/onboarding/generate", authorizeRoles("admin", "super_admin", "hr", "manager"), generateOnboardingChecklist);
router.patch("/onboarding/instances/:id", authorizeRoles("admin", "super_admin", "hr", "manager", "employee"), updateOnboardingTaskStatus);

// 2. Missing-Document Reminders
router.get("/documents/missing", authorizeRoles("admin", "super_admin", "hr", "auditor"), getMissingDocumentReminders);
router.post("/documents/remind", authorizeRoles("admin", "super_admin", "hr"), triggerMissingDocReminder);
router.post("/documents/scan", authorizeRoles("admin", "super_admin", "hr"), scanMissingDocuments);

// 3. BGV SLA Escalations
router.get("/bgv/slas", authorizeRoles("admin", "super_admin", "hr", "recruiter", "auditor"), getBgvSlaEscalations);
router.post("/bgv/escalate", authorizeRoles("admin", "super_admin", "hr", "recruiter"), triggerBgvEscalation);

// 4. Monthly Payroll Cut-off Input Generation
router.get("/payroll/cutoffs", authorizeRoles("admin", "super_admin", "hr", "payroll", "finance", "auditor"), getCutoffBatches);
router.post("/payroll/cutoff", authorizeRoles("admin", "super_admin", "payroll", "finance"), executeMonthlyCutoff);

// 5. Probation & Confirmation Reminders
router.get("/probation/alerts", authorizeRoles("admin", "super_admin", "hr", "manager", "leadership"), getProbationAlerts);
router.patch("/probation/decision/:id", authorizeRoles("admin", "super_admin", "hr", "manager"), updateProbationDecision);

// 6. Performance-Cycle Reminders
router.get("/performance/alerts", authorizeRoles("admin", "super_admin", "hr", "manager", "leadership"), getPerformanceAlerts);
router.post("/performance/remind", authorizeRoles("admin", "super_admin", "hr", "manager"), dispatchPerformanceReminder);

// 7. Exit Clearance (5 Departments)
router.get("/exit/tasks", authorizeRoles("admin", "super_admin", "hr", "manager", "it_admin", "finance", "auditor"), getExitClearanceTasks);
router.post("/exit/workflow", authorizeRoles("admin", "super_admin", "hr", "manager"), createExitClearanceWorkflow);
router.patch("/exit/tasks/:id", authorizeRoles("admin", "super_admin", "hr", "manager", "it_admin", "finance"), updateClearanceTaskStatus);

// 8. Helpdesk SLA Escalations
router.get("/helpdesk/slas", authorizeRoles("admin", "super_admin", "hr", "it_admin", "manager"), getTicketSlaEscalations);
router.post("/helpdesk/evaluate", authorizeRoles("admin", "super_admin", "hr", "it_admin"), evaluateTicketSlas);

// 9. Scheduled Authorized Dashboards & Reports
router.get("/reports/scheduled", authorizeRoles("admin", "super_admin", "hr", "leadership", "payroll", "auditor", "manager", "it_admin"), getScheduledReports);
router.post("/reports/run", authorizeRoles("admin", "super_admin", "hr", "leadership", "payroll", "auditor", "manager", "it_admin"), runScheduledReport);
router.get("/reports/executions", authorizeRoles("admin", "super_admin", "hr", "leadership", "auditor"), getReportExecutions);

export default router;
