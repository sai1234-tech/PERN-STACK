import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import {
  chatAssistant,
  queryAnalytics,
  getAttendanceAnomalies,
  analyzeCandidate,
  searchPolicy,
  getAiHubOverview
} from "../controllers/aiIntelligenceController.js";

const router = express.Router();
router.use(verifyToken);

const ALL_ROLES = ["employee", "manager", "hr", "admin", "super_admin", "leadership", "finance", "payroll", "recruiter", "it_admin", "auditor"];
const MGMT_ROLES = ["admin", "super_admin", "hr", "manager", "leadership", "finance"];
const HIRING_ROLES = ["admin", "super_admin", "hr", "recruiter", "manager", "leadership"];

// 1. AI HR Assistant (Chatbot for all employees)
router.post("/assistant/chat", authorizeRoles(...ALL_ROLES), chatAssistant);

// 2. AI HR Analytics (Natural Language Analytics for Workforce Insights)
router.post("/analytics/query", authorizeRoles(...ALL_ROLES), queryAnalytics);

// 3. Smart Attendance Monitoring (Pattern & Anomaly Detection)
router.get("/attendance/anomalies", authorizeRoles(...ALL_ROLES), getAttendanceAnomalies);

// 4. AI Recruitment Assistant (Candidate & Resume Parsing)
router.post("/recruitment/analyze", authorizeRoles(...ALL_ROLES), analyzeCandidate);

// 5. HR Policy Search (Semantic Retrieval with Citations)
router.post("/policy/search", authorizeRoles(...ALL_ROLES), searchPolicy);

// 6. Consolidated AI Overview
router.get("/overview", authorizeRoles(...ALL_ROLES), getAiHubOverview);

export default router;
