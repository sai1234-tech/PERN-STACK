import express from "express";
import cors from "cors";
import path from "path";
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
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static uploaded files
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

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
app.get("/api/health", (req, res) => {
    res.status(200).json({ status: "OK", timestamp: new Date() });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/employee", employeeRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/manager", managerRoutes);
app.use("/api/clearance", clearanceRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/leaves", leaveRoutes);
app.use("/api/timesheets", timesheetRoutes);
app.use("/api/payrolls", payrollRoutes);
app.use("/api/performance", performanceRoutes);
app.use("/api/pulse", pulseRoutes);
app.use("/api/resignations", resignationRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/holidays", holidayRoutes);
app.use("/api/events", eventRoutes);

// Global Error Handler
app.use(errorHandler);

export default app;