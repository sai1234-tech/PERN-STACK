import "dotenv/config";
import pool from "../config/db.js";

async function seedEnterpriseData() {
  console.log("=== SEEDING REALISTIC ENTERPRISE DATA FOR ALL 12 SCREENS ===");

  // 1. Get key employee IDs
  const empMapRes = await pool.query(`
    SELECT e.id, e.user_id, e.employee_code, e.first_name, e.last_name, u.email, u.role
    FROM employees e
    LEFT JOIN users u ON e.user_id = u.id
    ORDER BY e.id
  `);
  
  const empByCode = {};
  const empByEmail = {};
  for (const r of empMapRes.rows) {
    if (r.employee_code) empByCode[r.employee_code] = r;
    if (r.email) empByEmail[r.email] = r;
  }

  const arjun = empByCode["EMP-2014"] || empByEmail["employee@hrms.com"];
  const ananya = empByCode["EMP-2012"] || empByEmail["hr@hrms.com"];
  const vikas = empByCode["EMP-2013"] || empByEmail["manager@hrms.com"];
  const admin = empByCode["EMP-2011"] || empByEmail["admin@hrms.com"];
  const aisha = empByCode["EMP-110"] || empByEmail["aisha.sharma@example.com"];
  const saikiran = empByCode["EMP175"] || empByEmail["skushangala@quadratics.com"];

  console.log(`Key employees found:
    Arjun Reddy (EMP-2014): ID ${arjun?.id}, UserID ${arjun?.user_id}
    Ananya Sharma (EMP-2012): ID ${ananya?.id}, UserID ${ananya?.user_id}
    Vikas Guru (EMP-2013): ID ${vikas?.id}, UserID ${vikas?.user_id}
    Admin (EMP-2011): ID ${admin?.id}, UserID ${admin?.user_id}
    Aisha Sharma (EMP-110): ID ${aisha?.id}, UserID ${aisha?.user_id}
  `);

  // 2. SEED REALISTIC TICKETS (Helpdesk)
  console.log("\n--- Seeding Realistic Tickets ---");
  const ticketsToSeed = [
    {
      ticketId: "TICK-42001",
      empId: "Arjun Reddy (EMP-2014)",
      query: "Tax Exemption Declaration: Submitted investment proofs for Section 80C (PPF ₹1.5L) and Section 80D (Health Insurance ₹25,000) for FY2026-27. Requesting verification and tax deduction adjustment in the next payroll cycle.",
      status: "In Progress",
      resolution: "HR Operations has acknowledged your tax proofs. Verification under progress with the Finance & Accounts team.",
      created_at: "2026-10-18 10:15:00"
    },
    {
      ticketId: "TICK-42002",
      empId: "Arjun Reddy (EMP-2014)",
      query: "IT Infrastructure: Requesting replacement HDMI-to-Type-C adapter and Dell 27-inch secondary 4K monitor setup for backend development and multi-monitor debugging.",
      status: "Resolved",
      resolution: "Dell 27-inch display (Asset Tag: MON-DELL-9921) dispatched and configured by IT Support. Desk setup verified.",
      created_at: "2026-10-12 14:30:00"
    },
    {
      ticketId: "TICK-42003",
      empId: "Arjun Reddy (EMP-2014)",
      query: "Provident Fund UAN Transfer: Requesting support for transferring EPF balance from previous employer (Cognizant Technology Solutions) to current Quadratic Systems UAN account.",
      status: "Open",
      resolution: "",
      created_at: "2026-10-21 09:45:00"
    },
    {
      ticketId: "TICK-42004",
      empId: "Aisha Sharma (EMP-110)",
      query: "Access Management: Requesting AWS production CloudWatch log stream read access for troubleshooting high latency in auth microservice.",
      status: "Resolved",
      resolution: "IAM role 'CloudWatch-Log-Auditor' granted via SSO. Access verified.",
      created_at: "2026-10-19 11:20:00"
    },
    {
      ticketId: "TICK-42005",
      empId: "Vikas Guru (EMP-2013)",
      query: "HR Operations: Requesting headcount requisition approval for 2 Senior Cloud Architects for FinTech Migration sprint.",
      status: "In Progress",
      resolution: "Under review with HR Director Ananya Sharma.",
      created_at: "2026-10-20 16:00:00"
    }
  ];

  for (const t of ticketsToSeed) {
    const existing = await pool.query("SELECT id FROM tickets WHERE ticket_id = $1", [t.ticketId]);
    if (existing.rows.length === 0) {
      await pool.query(`
        INSERT INTO tickets (ticket_id, emp_id, query, status, resolution, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6::timestamp, $6::timestamp)
      `, [t.ticketId, t.empId, t.query, t.status, t.resolution, t.created_at]);
      console.log(`  + Created ticket ${t.ticketId} for ${t.empId}`);
    }
  }

  // 3. SEED REALISTIC OKRS / PERFORMANCE REVIEWS
  console.log("\n--- Seeding Realistic OKRs / Performance Reviews ---");
  const okrsToSeed = [];

  if (arjun) {
    okrsToSeed.push({
      employeeId: arjun.id,
      objective: "**Objective:** Accelerate Core Platform Migration to PostgreSQL & Modern Cloud Architecture.\n\n**Key Results:**\n1. Migrate 24 relational schemas and foreign keys from MongoDB to PostgreSQL with zero data loss.\n2. Implement optimized indexing and connection pooling, reducing API response latency under 45ms.\n3. Build comprehensive end-to-end integration tests achieving >90% code coverage across auth, payroll, and exit modules.\n4. Mentor junior engineers on clean repository-controller design patterns and secure JWT session handling.",
      result: "Reviewed",
      score: 4.8,
      reviewerId: vikas ? vikas.user_id : 13,
      feedback: "Exceptional execution during Q3/Q4. Arjun demonstrated deep architectural ownership during the database migration and delivered high quality, maintainable code."
    });
    okrsToSeed.push({
      employeeId: arjun.id,
      objective: "**Objective:** Cloud Infrastructure Security & Zero-Downtime CI/CD Pipeline Automation.\n\n**Key Results:**\n1. Automate Docker containerized builds and health check probes in GitHub Actions.\n2. Conduct penetration test remediation for OWASP Top 10 vulnerabilities.\n3. Integrate automated database migration rollbacks with PostgreSQL transaction safety.",
      result: "Reviewed",
      score: 4.6,
      reviewerId: vikas ? vikas.user_id : 13,
      feedback: "High initiative in CI/CD pipeline automation and database backup reliability."
    });
  }

  if (aisha) {
    okrsToSeed.push({
      employeeId: aisha.id,
      objective: "**Objective:** Enhance UI/UX Component Library and Design System Consistency.\n\n**Key Results:**\n1. Refactor 12 enterprise screens to pure Vanilla CSS theme variables with zero Tailwind dependency.\n2. Ensure 100% WCAG 2.1 AA accessibility compliance across contrast, keyboard navigation, and aria labels.\n3. Optimize web application bundle sizes and client render time under 1.2s.",
      result: "Reviewed",
      score: 4.7,
      reviewerId: vikas ? vikas.user_id : 13,
      feedback: "Outstanding work on the design system. Frontend components are exceptionally responsive and polished."
    });
  }

  if (saikiran) {
    okrsToSeed.push({
      employeeId: saikiran.id,
      objective: "**Objective:** Scalable Microservices Architecture & Data Ingestion Optimization.\n\n**Key Results:**\n1. Optimize batch data pipelines processing daily attendance and biometric punches.\n2. Integrate real-time notification telemetry for leave and payroll dispatch.",
      result: "Reviewed",
      score: 4.5,
      reviewerId: ananya ? ananya.user_id : 12,
      feedback: "Great analytical skills and reliable delivery throughout tenure."
    });
  }

  for (const o of okrsToSeed) {
    const existing = await pool.query(
      "SELECT id FROM okrs WHERE employee_id = $1 AND objective ILIKE $2",
      [o.employeeId, `%${o.objective.slice(0, 30)}%`]
    );
    if (existing.rows.length === 0) {
      await pool.query(`
        INSERT INTO okrs (employee_id, objective, result, score, reviewer_id, feedback, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [o.employeeId, o.objective, o.result, o.score, o.reviewerId, o.feedback]);
      console.log(`  + Created OKR for employee ID ${o.employeeId} (Score: ${o.score})`);
    }
  }

  // 4. SEED REALISTIC CALENDAR EVENTS
  console.log("\n--- Seeding Realistic Corporate Calendar Events ---");
  const eventsToSeed = [];
  const targetEmps = [arjun, ananya, vikas, aisha].filter(Boolean);

  for (const emp of targetEmps) {
    eventsToSeed.push(
      {
        employeeId: emp.id,
        date: "2026-10-23",
        title: "Sprint Retrospective & Release Planning Q4",
        time: "10:00 AM - 11:30 AM",
        startTime: "10:00",
        endTime: "11:30",
        duration: "1 hr 30 mins",
        category: "Meeting",
        tag: "Engineering Sprint",
        type: "custom"
      },
      {
        employeeId: emp.id,
        date: "2026-10-26",
        title: "Architecture Review: High-Availability Database Clustered Failover",
        time: "02:00 PM - 03:30 PM",
        startTime: "14:00",
        endTime: "15:30",
        duration: "1 hr 30 mins",
        category: "Technical",
        tag: "Tech Architecture",
        type: "custom"
      },
      {
        employeeId: emp.id,
        date: "2026-10-28",
        title: "HR Monthly All-Hands & Leadership Townhall",
        time: "04:00 PM - 05:30 PM",
        startTime: "16:00",
        endTime: "17:30",
        duration: "1 hr 30 mins",
        category: "Company",
        tag: "All-Hands",
        type: "custom"
      },
      {
        employeeId: emp.id,
        date: "2026-11-04",
        title: "Manager 1-on-1 Performance Check-in",
        time: "11:00 AM - 11:45 AM",
        startTime: "11:00",
        endTime: "11:45",
        duration: "45 mins",
        category: "Review",
        tag: "1-on-1",
        type: "custom"
      }
    );
  }

  for (const evt of eventsToSeed) {
    const existing = await pool.query(
      "SELECT id FROM events WHERE employee_id = $1 AND date = $2 AND title = $3",
      [evt.employeeId, evt.date, evt.title]
    );
    if (existing.rows.length === 0) {
      await pool.query(`
        INSERT INTO events (employee_id, date, title, time, start_time, end_time, duration, category, tag, type, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [evt.employeeId, evt.date, evt.title, evt.time, evt.startTime, evt.endTime, evt.duration, evt.category, evt.tag, evt.type]);
    }
  }
  console.log(`  + Seeded corporate calendar events for ${targetEmps.length} active employees`);

  // 5. UPDATE RECRUITMENT CANDIDATES TO AUTHENTIC PROFILES
  console.log("\n--- Updating Recruitment Candidates with Authentic Industry Profiles ---");
  const authenticCandidates = [
    {
      candidate_id: "CAND-005",
      name: "Ananya Deshmukh",
      email: "ananya.deshmukh@techcorp.io",
      phone: "+91 98451 23450",
      skills: "AWS Cloud, Kubernetes, Terraform, Docker, CI/CD",
      experience: "5.5 Years",
      status: "Screening",
      bgv_status: "In Progress",
      department: "Engineering",
      designation: "Senior DevOps & Cloud Engineer",
      manager: "Vikas Guru"
    },
    {
      candidate_id: "CAND-006",
      name: "Kartik Iyer",
      email: "kartik.iyer@fintechpro.com",
      phone: "+91 97312 88419",
      skills: "Product Roadmap, Agile/Scrum, Jira, User Stories, Data Analytics",
      experience: "7 Years",
      status: "Interview",
      bgv_status: "Verified",
      department: "Product",
      designation: "Lead Product Strategy Manager",
      manager: "Sarah Jenkins"
    },
    {
      candidate_id: "CAND-007",
      name: "Priya Nair",
      email: "priya.nair@cloudarchitects.net",
      phone: "+91 94481 77203",
      skills: "Node.js, PostgreSQL, Microservices, Redis, Event-Driven Architecture",
      experience: "6 Years",
      status: "Offered",
      bgv_status: "Verified",
      department: "Engineering",
      designation: "Staff Backend Engineer",
      manager: "Vikas Guru"
    },
    {
      candidate_id: "CAND-008",
      name: "Vikramaditya Rathore",
      email: "v.rathore@enterprisearc.com",
      phone: "+91 96118 44021",
      skills: "React 19, TypeScript, Webpack, State Management, Accessibility",
      experience: "4.5 Years",
      status: "Offer Accepted",
      bgv_status: "Verified",
      department: "Engineering",
      designation: "Senior Frontend Engineer",
      manager: "Vikas Guru"
    },
    {
      candidate_id: "CAND-009",
      name: "Meera Subramanian",
      email: "meera.subramanian@hrglobal.org",
      phone: "+91 98860 33119",
      skills: "Talent Acquisition, Technical Sourcing, LinkedIn Recruiter, Diversity Hiring",
      experience: "4 Years",
      status: "Applied",
      bgv_status: "Pending",
      department: "Human Resources",
      designation: "Technical Talent Acquisition Partner",
      manager: "Ananya Sharma"
    },
    {
      candidate_id: "CAND-010",
      name: "Devendra Joshi",
      email: "d.joshi@cyberdefense.org",
      phone: "+91 99201 55674",
      skills: "ISO 27001, SOC2, IAM, SIEM, Penetration Testing, Cloud Security",
      experience: "8 Years",
      status: "Hired",
      bgv_status: "Verified",
      department: "IT Infrastructure",
      designation: "Principal Information Security Officer",
      manager: "Anilk"
    }
  ];

  for (const c of authenticCandidates) {
    await pool.query(`
      UPDATE candidates
      SET name = $1, email = $2, phone = $3, skills = $4, experience = $5,
          status = $6, bgv_status = $7, department = $8, designation = $9, manager = $10,
          updated_at = CURRENT_TIMESTAMP
      WHERE candidate_id = $11
    `, [c.name, c.email, c.phone, c.skills, c.experience, c.status, c.bgv_status, c.department, c.designation, c.manager, c.candidate_id]);
    console.log(`  + Updated ${c.candidate_id} to authentic candidate: ${c.name} (${c.designation})`);
  }

  // 6. SEED REALISTIC PAYROLLS FOR KEY DEMO ACCOUNTS
  console.log("\n--- Seeding Detailed Monthly Payroll Records ---");
  const months = ["2026-08-01", "2026-09-01", "2026-10-01"];
  
  const payrollProfiles = [
    {
      emp: arjun,
      basic: 37500.00,
      allowances: 37500.00,
      bonus: 0.00,
      tax: 200.00,
      pf: 3600.00,
      deduction: 6000.00,
      gross: 75000.00,
      totDeduct: 9800.00,
      net: 65200.00,
      status: "generated"
    },
    {
      emp: ananya,
      basic: 55000.00,
      allowances: 55000.00,
      bonus: 5000.00,
      tax: 200.00,
      pf: 3600.00,
      deduction: 8800.00,
      gross: 115000.00,
      totDeduct: 12600.00,
      net: 102400.00,
      status: "generated"
    },
    {
      emp: vikas,
      basic: 65000.00,
      allowances: 65000.00,
      bonus: 0.00,
      tax: 200.00,
      pf: 3600.00,
      deduction: 10400.00,
      gross: 130000.00,
      totDeduct: 14200.00,
      net: 115800.00,
      status: "generated"
    },
    {
      emp: aisha,
      basic: 35000.00,
      allowances: 35000.00,
      bonus: 0.00,
      tax: 200.00,
      pf: 3600.00,
      deduction: 5600.00,
      gross: 70000.00,
      totDeduct: 9400.00,
      net: 60600.00,
      status: "generated"
    }
  ];

  for (const m of months) {
    for (const p of payrollProfiles) {
      if (!p.emp) continue;
      const existing = await pool.query(
        "SELECT id FROM payrolls WHERE employee_id = $1 AND month = $2",
        [p.emp.id, m]
      );
      if (existing.rows.length === 0) {
        await pool.query(`
          INSERT INTO payrolls (
            employee_id, month, basic_salary, allowances, bonus, tax, pf,
            deduction, gross_salary, total_deductions, net_salary, status,
            generated_by, generated_at, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
        `, [
          p.emp.id, m, p.basic, p.allowances, p.bonus, p.tax, p.pf,
          p.deduction, p.gross, p.totDeduct, p.net, p.status,
          ananya ? ananya.user_id : 12
        ]);
        console.log(`  + Seeded payroll for ${p.emp.first_name} ${p.emp.last_name} (${m}): Net ₹${p.net}`);
      }
    }
  }

  // 7. SEED AUDIT LOGS FOR COMPLETE TELEMETRY
  console.log("\n--- Seeding Enterprise Audit Logs ---");
  const auditLogs = [
    {
      action: "PAYROLL_RUN_OCTOBER",
      entityType: "Payroll",
      entityId: "OCT-2026",
      details: "Disbursed monthly payroll run for 24 corporate employees via NEFT batch processing.",
      userName: "Ananya Sharma (HR)",
      userRole: "hr",
      ipAddress: "192.168.1.105"
    },
    {
      action: "PERFORMANCE_OKR_REVIEW",
      entityType: "Performance",
      entityId: "Q3-2026",
      details: "Completed Q3 performance evaluations and scored OKR submissions for Engineering team.",
      userName: "Vikas Guru (Manager)",
      userRole: "manager",
      ipAddress: "192.168.1.112"
    },
    {
      action: "CANDIDATE_OFFER_EXTENDED",
      entityType: "Recruitment",
      entityId: "CAND-007",
      details: "Extended formal offer letter to Priya Nair (Staff Backend Engineer) with joining date Nov 15, 2026.",
      userName: "Ananya Sharma (HR)",
      userRole: "hr",
      ipAddress: "192.168.1.105"
    },
    {
      action: "RBAC_ROLE_AUDIT",
      entityType: "Security",
      entityId: "RBAC-ROOT",
      details: "Verified two-tier authorization policies and cryptographic JWT secret rotation.",
      userName: "System Administrator",
      userRole: "admin",
      ipAddress: "192.168.1.1"
    }
  ];

  for (const a of auditLogs) {
    await pool.query(`
      INSERT INTO audit_logs (action, entity_type, entity_id, details, user_name, user_role, ip_address, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
    `, [a.action, a.entityType, a.entityId, a.details, a.userName, a.userRole, a.ipAddress]);
  }
  console.log(`  + Inserted 4 enterprise audit trail events`);

  console.log("\n=== ALL REALISTIC ENTERPRISE DATA SEEDED SUCCESSFULLY! ===");
  process.exit(0);
}

seedEnterpriseData().catch(err => {
  console.error("FATAL ERROR SEEDING ENTERPRISE DATA:", err);
  process.exit(1);
});
