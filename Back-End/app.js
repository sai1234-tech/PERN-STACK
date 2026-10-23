import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import authRoutes from "./routes/authRoutes.js";
import attendanceRoutes from "./routes/attendanceRoutes.js";
import employeeRoutes from "./routes/employeeRoutes.js";
import documentRoutes from "./routes/documentRoutes.js";
import leaveRoutes from "./routes/leaveRoutes.js";
import timesheetRoutes from "./routes/timesheetRoutes.js";
import payrollRoutes from "./routes/payrollRoutes.js";
import performanceRoutes from "./routes/performanceRoutes.js";
import pulseRoutes from "./routes/pulseRoutes.js";
import resignationRoutes from "./routes/resignationRoutes.js";
import ticketRoutes from "./routes/ticketRoutes.js";
import departmentRoutes from "./routes/departmentRoutes.js";
import holidayRoutes from "./routes/holidayRoutes.js";
import eventRoutes from "./routes/eventRoutes.js";
import managerRoutes from "./routes/managerRoutes.js";
import clearanceRoutes from "./routes/clearanceRoutes.js";
import allocationRoutes from "./routes/allocationRoutes.js";
import candidateRoutes from "./routes/candidateRoutes.js";
import auditRoutes from "./routes/auditRoutes.js";
import lifecycleRoutes from "./routes/lifecycleRoutes.js";
import clientMasterRoutes from "./routes/clientMasterRoutes.js";
import enterpriseEntityRoutes from "./routes/enterpriseEntityRoutes.js";
import integrationRoutes from "./routes/integrationRoutes.js";
import securityGovernanceRoutes from "./routes/securityGovernanceRoutes.js";
import enterpriseAutomationsRoutes from "./routes/enterpriseAutomationsRoutes.js";
import auditEffectiveDatingRoutes from "./routes/auditEffectiveDatingRoutes.js";
import enterpriseOperationsRoutes from "./routes/enterpriseOperationsRoutes.js";
import techStackSelectionRoutes from "./routes/techStackSelectionRoutes.js";
import deliveryAiRoutes from "./routes/deliveryAiRoutes.js";
import lifecycleOpsRoutes from "./routes/lifecycleOpsRoutes.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { sseStreamHandler, sseBroadcastMiddleware } from "./services/sseService.js";
import { securityHeaders, rateLimiter } from "./middleware/securityMiddleware.js";
import { performanceMonitor } from "./middleware/performanceMonitorMiddleware.js";

import { initUserTable } from "./repositories/userRepository.js";
import { initEmployeeTable } from "./repositories/employeeRepository.js";
import { initAttendanceTable } from "./repositories/attendanceRepository.js";
import { initDocumentTable } from "./repositories/documentRepository.js";
import { initLeaveTables } from "./repositories/leaveRepository.js";
import { initTimesheetTable } from "./repositories/timesheetRepository.js";
import { initPayrollTable } from "./repositories/payrollRepository.js";
import { initPerformanceTable } from "./repositories/performanceRepository.js";
import { initPulseTable } from "./repositories/pulseRepository.js";
import { initEventTable } from "./repositories/eventRepository.js";
import { initResignationTable } from "./repositories/resignationRepository.js";
import { initClearanceTable } from "./repositories/clearanceRepository.js";
import { initTicketTable } from "./repositories/ticketRepository.js";
import { initDepartmentTable } from "./repositories/departmentRepository.js";
import { initHolidayTable } from "./repositories/holidayRepository.js";
import { initAllocationTable } from "./repositories/allocationRepository.js";
import { initCandidateTable } from "./repositories/candidateRepository.js";
import { initAuditTable } from "./repositories/auditRepository.js";
import { initClientTables } from "./repositories/clientMasterRepository.js";

const app = express();
const backendDir = path.dirname(fileURLToPath(import.meta.url));

// Enterprise HTTP Security Headers & Rate Limiting
app.use(securityHeaders);
app.use(rateLimiter);
app.use(performanceMonitor);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static uploaded files
app.use("/uploads", express.static(path.join(backendDir, "uploads")));

// Initialize Database Tables
const initDB = async () => {
    try {
        await initUserTable();
        console.log("Users table initialized.");
        await initEmployeeTable();
        console.log("Employees table initialized.");
        await initAttendanceTable();
        console.log("Attendance table initialized.");
        await initDocumentTable();
        console.log("Employee documents table initialized.");
        await initLeaveTables();
        console.log("Leave and LeaveType tables initialized.");
        await initTimesheetTable();
        console.log("Timesheets table initialized.");
        await initPayrollTable();
        console.log("Payrolls table initialized.");
        await initPerformanceTable();
        console.log("Performance OKRs table initialized.");
        await initPulseTable();
        console.log("Daily Pulses table initialized.");
        await initEventTable();
        console.log("Events table initialized.");
        await initResignationTable();
        console.log("Resignations table initialized.");
        await initClearanceTable();
        console.log("Clearances table initialized.");
        await initTicketTable();
        console.log("Tickets table initialized.");
        await initDepartmentTable();
        console.log("Departments table initialized.");
        await initHolidayTable();
        console.log("Holidays table initialized.");
        await initAllocationTable();
        console.log("Project Allocations table initialized.");
        await initCandidateTable();
        console.log("Candidates table initialized.");
        await initAuditTable();
        console.log("Audit Logs table initialized.");
        await initClientTables();
        console.log("Client Master, SOW, Rate-Card & Transition tables initialized.");
    } catch (err) {
        console.error("Database initialization notice:", err.message);
    }
};
initDB();

// Health Check Route
const handleHealth = (req, res) => {
    res.status(200).json({ status: "OK", timestamp: new Date() });
};
app.get("/api/health", handleHealth);
app.get("/api/v1/health", handleHealth);

// Real-Time Server-Sent Events (SSE) Live Synchronization Stream
app.get("/api/sync/stream", sseStreamHandler);
app.get("/api/v1/sync/stream", sseStreamHandler);

// Universal real-time mutation broadcast middleware (detects all successful POST/PUT/PATCH/DELETE)
app.use(sseBroadcastMiddleware);

// Route mapping configuration supporting both singular and plural prefixes under /api and /api/v1
const routeMappings = [
    { paths: ["/auth"], handler: authRoutes },
    { paths: ["/attendance"], handler: attendanceRoutes },
    { paths: ["/employee", "/employees"], handler: employeeRoutes },
    { paths: ["/manager"], handler: managerRoutes },
    { paths: ["/clearance", "/clearances"], handler: clearanceRoutes },
    { paths: ["/document", "/documents"], handler: documentRoutes },
    { paths: ["/leave", "/leaves"], handler: leaveRoutes },
    { paths: ["/timesheet", "/timesheets"], handler: timesheetRoutes },
    { paths: ["/payroll", "/payrolls"], handler: payrollRoutes },
    { paths: ["/performance"], handler: performanceRoutes },
    { paths: ["/pulse"], handler: pulseRoutes },
    { paths: ["/resignation", "/resignations"], handler: resignationRoutes },
    { paths: ["/ticket", "/tickets"], handler: ticketRoutes },
    { paths: ["/department", "/departments"], handler: departmentRoutes },
    { paths: ["/holiday", "/holidays"], handler: holidayRoutes },
    { paths: ["/event", "/events"], handler: eventRoutes },
    { paths: ["/allocation", "/allocations"], handler: allocationRoutes },
    { paths: ["/candidate", "/candidates"], handler: candidateRoutes },
    { paths: ["/audit", "/audits"], handler: auditRoutes },
    { paths: ["/lifecycle"], handler: lifecycleRoutes },
    { paths: ["/client-master", "/client-masters", "/clients"], handler: clientMasterRoutes },
    { paths: ["/entities", "/entity"], handler: enterpriseEntityRoutes },
    { paths: ["/integrations", "/integration"], handler: integrationRoutes },
    { paths: ["/governance", "/security"], handler: securityGovernanceRoutes },
    { paths: ["/automations", "/automation", "/workflow-slas"], handler: enterpriseAutomationsRoutes },
    { paths: ["/audit-governance", "/audit-effective", "/compliance-governance"], handler: auditEffectiveDatingRoutes },
    { paths: ["/operations", "/operation", "/architecture-nfr", "/nfr"], handler: enterpriseOperationsRoutes },
    { paths: ["/stack-selection", "/tech-stack", "/architecture-stack"], handler: techStackSelectionRoutes },
    { paths: ["/delivery"], handler: deliveryAiRoutes },
    { paths: ["/lifecycle-ops"], handler: lifecycleOpsRoutes }
];

routeMappings.forEach(({ paths, handler }) => {
    paths.forEach((p) => {
        app.use(`/api${p}`, handler);
        app.use(`/api/v1${p}`, handler);
    });
});

// Global Error Handler
app.use(errorHandler);

export default app;