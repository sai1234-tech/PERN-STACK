import {
  handleEmployeeAssistantQuery,
  handleHrAnalyticsQuery,
  detectAttendanceAnomalies,
  analyzeCandidateRecruitment,
  searchHrPolicies
} from "../services/aiIntelligenceService.js";

/**
 * 1. AI HR Assistant (Chat)
 * POST /api/v1/ai/assistant/chat
 */
export const chatAssistant = async (req, res, next) => {
  try {
    const { prompt, question } = req.body || {};
    const userPrompt = prompt || question;
    const userId = req.user?.userId || req.user?.id;
    const role = req.user?.role || "employee";

    if (!userPrompt || !userPrompt.trim()) {
      return res.status(400).json({ success: false, message: "Prompt is required." });
    }

    const response = await handleEmployeeAssistantQuery(userId, role, userPrompt);
    return res.status(200).json(response);
  } catch (err) {
    next(err);
  }
};

/**
 * 2. AI HR Analytics (Natural Language Query)
 * POST /api/v1/ai/analytics/query
 */
export const queryAnalytics = async (req, res, next) => {
  try {
    const { query } = req.body || {};
    const role = req.user?.role || "admin";

    const response = await handleHrAnalyticsQuery(role, query);
    return res.status(200).json(response);
  } catch (err) {
    next(err);
  }
};

/**
 * 3. Smart Attendance Monitoring (Anomalies Feed)
 * GET /api/v1/ai/attendance/anomalies
 */
export const getAttendanceAnomalies = async (req, res, next) => {
  try {
    const lookbackDays = Number(req.query?.lookbackDays || 30);
    const response = await detectAttendanceAnomalies({ lookbackDays });
    return res.status(200).json(response);
  } catch (err) {
    next(err);
  }
};

/**
 * 4. AI Recruitment Assistant (Candidate & Resume Match)
 * POST /api/v1/ai/recruitment/analyze
 */
export const analyzeCandidate = async (req, res, next) => {
  try {
    const { candidateId, customResumeText, targetRole } = req.body || {};
    const response = await analyzeCandidateRecruitment(candidateId, customResumeText, targetRole);
    return res.status(200).json(response);
  } catch (err) {
    next(err);
  }
};

/**
 * 5. HR Policy Search (Semantic Retrieval)
 * POST /api/v1/ai/policy/search
 */
export const searchPolicy = async (req, res, next) => {
  try {
    const { query } = req.body || {};
    const role = req.user?.role || "employee";

    if (!query || !query.trim()) {
      return res.status(400).json({ success: false, message: "Search query is required." });
    }

    const response = await searchHrPolicies(query, role);
    return res.status(200).json(response);
  } catch (err) {
    next(err);
  }
};

/**
 * 6. Consolidated AI Hub Overview
 * GET /api/v1/ai/overview
 */
export const getAiHubOverview = async (req, res, next) => {
  try {
    const [anomalyData, analyticsData] = await Promise.all([
      detectAttendanceAnomalies({ lookbackDays: 30 }),
      handleHrAnalyticsQuery(req.user?.role || "admin", "overview")
    ]);

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      featuresEnabled: [
        { id: "assistant", name: "AI HR Assistant", status: "Active", capability: "Natural Language Employee Self-Service" },
        { id: "analytics", name: "AI HR Analytics", status: "Active", capability: "Natural Language Workforce Analytics & Visual Dashboards" },
        { id: "attendance", name: "Smart Attendance Monitoring", status: "Active", capability: "Automated Pattern & Anomaly Detection" },
        { id: "recruitment", name: "AI Recruitment Assistant", status: "Active", capability: "Resume Parsing, Skill Match & Human-Governed Selection" },
        { id: "policy", name: "HR Policy Search", status: "Active", capability: "Semantic Document Search with Clause Citations" }
      ],
      attendanceSummary: {
        anomaliesDetected: anomalyData.anomaliesFound,
        criticalAlerts: anomalyData.criticalCount,
        warningAlerts: anomalyData.warningCount
      },
      workforceSummary: analyticsData.keyMetrics
    });
  } catch (err) {
    next(err);
  }
};
