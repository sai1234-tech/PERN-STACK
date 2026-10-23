import http from 'http';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import pool from '../config/db.js';
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'pern_hrms_secret_jwt_key_2026!@#';

function apiCall(endpoint, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const customHeaders = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
    if (payload) customHeaders['Content-Length'] = Buffer.byteLength(payload);

    const req = http.request({
      hostname: 'localhost',
      port: 5005,
      path: endpoint,
      method,
      headers: customHeaders
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });

    req.on('error', err => reject(err));
    if (payload) req.write(payload);
    req.end();
  });
}

async function verifyAllAiFeatures() {
  console.log("================================================================================");
  console.log("       VERIFYING 5 AI FEATURES IMPLEMENTATION ACROSS THE HRMS STACK             ");
  console.log("================================================================================");

  const scorecard = {};

  try {
    // 0. Tokens
    const adminUser = (await pool.query("SELECT * FROM users WHERE role = 'admin' LIMIT 1")).rows[0];
    const empUser = (await pool.query("SELECT * FROM users WHERE role = 'employee' LIMIT 1")).rows[0];

    const tokenAdmin = jwt.sign({ userId: adminUser.id, role: 'admin' }, JWT_SECRET, { expiresIn: '8h' });
    const tokenEmp = jwt.sign({ userId: empUser.id, role: 'employee' }, JWT_SECRET, { expiresIn: '8h' });

    console.log("✓ Tokens ready for Admin and Employee personas.");

    // -------------------------------------------------------------------------
    // 1. AI HR Assistant
    // -------------------------------------------------------------------------
    console.log("\n>>> FEATURE 1: AI HR Assistant (Natural Language Q&A)");
    const q1 = await apiCall('/api/v1/ai/assistant/chat', 'POST', {
      prompt: "How many leaves do I have remaining?"
    }, tokenEmp);

    console.log(`✓ Query 1 ("How many leaves do I have remaining?"):`);
    console.log(`   - Intent:     ${q1.data?.intent}`);
    console.log(`   - Confidence: ${q1.data?.confidence}`);
    console.log(`   - Answer:     ${q1.data?.answer?.slice(0, 110)}...`);
    console.log(`   - Balances:   ${q1.data?.structuredData?.balances?.length} leave categories returned.`);

    const q2 = await apiCall('/api/v1/ai/assistant/chat', 'POST', {
      prompt: "What is my current client/project deployment?"
    }, tokenEmp);

    console.log(`✓ Query 2 ("What is my current client/project deployment?"):`);
    console.log(`   - Intent:     ${q2.data?.intent}`);
    console.log(`   - Answer:     ${q2.data?.answer?.slice(0, 110)}...`);

    const q3 = await apiCall('/api/v1/ai/assistant/chat', 'POST', {
      prompt: "How do I request an employment letter?"
    }, tokenEmp);

    console.log(`✓ Query 3 ("How do I request an employment letter?"):`);
    console.log(`   - Intent:     ${q3.data?.intent}`);
    console.log(`   - Links:      ${q3.data?.actionableLinks?.map(l => l.label).join(", ")}`);

    if (q1.status === 200 && q2.status === 200 && q3.status === 200) {
      scorecard['Feature 1: AI HR Assistant'] = 'PASSED ✓';
    } else {
      throw new Error(`Feature 1 failed with status: ${q1.status}`);
    }

    // -------------------------------------------------------------------------
    // 2. AI HR Analytics
    // -------------------------------------------------------------------------
    console.log("\n>>> FEATURE 2: AI HR Analytics (Natural Language Workforce Intelligence)");
    const a1 = await apiCall('/api/v1/ai/analytics/query', 'POST', {
      query: "Which departments have the highest absenteeism?"
    }, tokenAdmin);

    console.log(`✓ Analytics 1 ("Which departments have highest absenteeism?"):`);
    console.log(`   - Title:   ${a1.data?.metricTitle}`);
    console.log(`   - Summary: ${a1.data?.summary?.slice(0, 120)}...`);
    console.log(`   - Chart:   ${a1.data?.chartType} with ${a1.data?.chartData?.length} department data points.`);

    const a2 = await apiCall('/api/v1/ai/analytics/query', 'POST', {
      query: "Summarize this month's attendance."
    }, tokenAdmin);

    console.log(`✓ Analytics 2 ("Summarize this month's attendance."):`);
    console.log(`   - Title:   ${a2.data?.metricTitle}`);
    console.log(`   - Metrics: ${a2.data?.keyMetrics?.map(m => `${m.label}: ${m.value}`).join(" | ")}`);

    const a3 = await apiCall('/api/v1/ai/analytics/query', 'POST', {
      query: "Show pending leave approvals by department."
    }, tokenAdmin);

    console.log(`✓ Analytics 3 ("Show pending leave approvals by department."):`);
    console.log(`   - Title:   ${a3.data?.metricTitle}`);
    console.log(`   - Summary: ${a3.data?.summary?.slice(0, 120)}...`);

    if (a1.status === 200 && a2.status === 200 && a3.status === 200) {
      scorecard['Feature 2: AI HR Analytics'] = 'PASSED ✓';
    } else {
      throw new Error(`Feature 2 failed with status: ${a1.status}`);
    }

    // -------------------------------------------------------------------------
    // 3. Smart Attendance Monitoring
    // -------------------------------------------------------------------------
    console.log("\n>>> FEATURE 3: Smart Attendance Monitoring (Pattern & Anomaly Detection)");
    const attRes = await apiCall('/api/v1/ai/attendance/anomalies?lookbackDays=30', 'GET', null, tokenAdmin);

    console.log(`✓ Anomaly Engine Results:`);
    console.log(`   - Scanned Punches:     ${attRes.data?.scannedPunches}`);
    console.log(`   - Scanned Consultants: ${attRes.data?.scannedEmployees}`);
    console.log(`   - Anomalies Detected:  ${attRes.data?.anomaliesFound}`);
    console.log(`   - Critical Anomalies:  ${attRes.data?.criticalCount}`);
    console.log(`   - Warning Anomalies:   ${attRes.data?.warningCount}`);

    if (attRes.data?.anomalies?.length) {
      const topAnom = attRes.data.anomalies[0];
      console.log(`   - Sample Anomaly: [${topAnom.patternType}] ${topAnom.employeeName} (${topAnom.severityScore} pts)`);
      console.log(`     Explanation: ${topAnom.narrativeExplanation}`);
      console.log(`     Action:      ${topAnom.suggestedAction}`);
    }

    if (attRes.status === 200 && attRes.data?.success) {
      scorecard['Feature 3: Smart Attendance Monitoring'] = 'PASSED ✓';
    } else {
      throw new Error(`Feature 3 failed with status: ${attRes.status}`);
    }

    // -------------------------------------------------------------------------
    // 4. AI Recruitment Assistant
    // -------------------------------------------------------------------------
    console.log("\n>>> FEATURE 4: AI Recruitment Assistant (Skill Extraction & Gap Analysis)");
    const candidate = (await pool.query("SELECT * FROM candidates LIMIT 1")).rows[0];
    const recRes = await apiCall('/api/v1/ai/recruitment/analyze', 'POST', {
      candidateId: candidate ? candidate.candidate_id : null,
      targetRole: "Lead Cloud Architect"
    }, tokenAdmin);

    console.log(`✓ Recruitment Analysis for "${recRes.data?.candidateName}":`);
    console.log(`   - Target Role:         ${recRes.data?.targetRole}`);
    console.log(`   - Match Score:         ${recRes.data?.matchPercentage}% (${recRes.data?.matchRating})`);
    console.log(`   - Matched Skills:      ${recRes.data?.matchedSkills?.join(", ")}`);
    console.log(`   - Missing Skills:      ${recRes.data?.missingRequiredSkills?.join(", ") || "None"}`);
    console.log(`   - Experience Summary:  ${recRes.data?.experienceSummary}`);
    console.log(`   - Interview Questions: ${recRes.data?.suggestedInterviewQuestions?.length} custom questions generated.`);
    console.log(`   - Governance:          ${recRes.data?.humanGovernanceNotice}`);

    if (recRes.status === 200 && recRes.data?.success) {
      scorecard['Feature 4: AI Recruitment Assistant'] = 'PASSED ✓';
    } else {
      throw new Error(`Feature 4 failed with status: ${recRes.status}`);
    }

    // -------------------------------------------------------------------------
    // 5. HR Policy Search
    // -------------------------------------------------------------------------
    console.log("\n>>> FEATURE 5: HR Policy Search (Semantic Retrieval with Clause Citations)");
    const polRes1 = await apiCall('/api/v1/ai/policy/search', 'POST', {
      query: "notice period and resignation policy"
    }, tokenEmp);

    console.log(`✓ Policy Query 1 ("notice period and resignation policy"):`);
    console.log(`   - Confidence: ${polRes1.data?.confidence}%`);
    console.log(`   - Answer:     ${polRes1.data?.answer?.slice(0, 130)}...`);
    console.log(`   - Sources:    ${polRes1.data?.sources?.map(s => `[${s.policy_code}] ${s.title}`).join(", ")}`);

    const polRes2 = await apiCall('/api/v1/ai/policy/search', 'POST', {
      query: "leave encashment and casual leave rules"
    }, tokenEmp);

    console.log(`✓ Policy Query 2 ("leave encashment and casual leave rules"):`);
    console.log(`   - Confidence: ${polRes2.data?.confidence}%`);
    console.log(`   - Answer:     ${polRes2.data?.answer?.slice(0, 130)}...`);

    if (polRes1.status === 200 && polRes2.status === 200) {
      scorecard['Feature 5: HR Policy Search'] = 'PASSED ✓';
    } else {
      throw new Error(`Feature 5 failed with status: ${polRes1.status}`);
    }

    // -------------------------------------------------------------------------
    // Consolidated Overview
    // -------------------------------------------------------------------------
    console.log("\n>>> AUDITING CONSOLIDATED AI HUB OVERVIEW ENDPOINT:");
    const ovRes = await apiCall('/api/v1/ai/overview', 'GET', null, tokenAdmin);
    console.log(`✓ Overview Endpoint Status: ${ovRes.status}`);
    console.log(`   - Active AI Capabilities: ${ovRes.data?.featuresEnabled?.length} features enabled.`);
    for (const f of ovRes.data?.featuresEnabled || []) {
      console.log(`     * [${f.id.toUpperCase().padEnd(12)}] ${f.name.padEnd(28)}: ${f.status} (${f.capability})`);
    }

    // Scorecard
    console.log("\n================================================================================");
    console.log("                     5 AI FEATURES VERIFICATION SCORECARD                       ");
    console.log("================================================================================");
    for (const [key, val] of Object.entries(scorecard)) {
      console.log(`${key.padEnd(65)}: ${val}`);
    }
    console.log("================================================================================");
    console.log("ALL 5 AI FEATURES SUCCESSFULLY IMPLEMENTED AND VERIFIED ON BACKEND!");
    console.log("================================================================================\n");

    process.exit(0);
  } catch (err) {
    console.error("\n❌ VERIFICATION ERROR:", err);
    process.exit(1);
  }
}

verifyAllAiFeatures();
