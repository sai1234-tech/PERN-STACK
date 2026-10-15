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
import { errorHandler } from "./middleware/errorHandler.js";

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

const app = express();
const backendDir = path.dirname(fileURLToPath(import.meta.url));
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
    { paths: ["/event", "/events"], handler: eventRoutes }
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