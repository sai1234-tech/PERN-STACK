import express from "express";
import {
    viewMySalary,
    getMyPayslip,
    downloadMyPayslip,
    generatePayroll,
    updateEmployeeSalary,
    getPayroll,
} from "../controllers/payrollController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();
const ALL_ROLES = ["employee", "manager", "hr", "admin"];

// Employee payroll self-service
router.get("/my/salary", verifyToken, authorizeRoles(...ALL_ROLES), viewMySalary);
router.get("/my/payslip", verifyToken, authorizeRoles(...ALL_ROLES), getMyPayslip);
router.get("/my/payslip/download", verifyToken, authorizeRoles(...ALL_ROLES), downloadMyPayslip);

// HR and admin payroll management
router.post("/generate", verifyToken, authorizeRoles("hr", "admin"), generatePayroll);
router.get("/", verifyToken, authorizeRoles("hr", "admin"), getPayroll);
router.patch("/employees/:employeeId/salary", verifyToken, authorizeRoles("hr", "admin"), updateEmployeeSalary);

export default router;
