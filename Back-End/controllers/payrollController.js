import PDFDocument from "pdfkit";
import {
    findEmployeeByUserId,
    findEmployeeByEmail,
    findAllEmployees,
    updateEmployeeRecord,
    findEmployeeById,
    createEmployeeRecord,
    findEmployeeByCodeOrEmail,
} from "../repositories/employeeRepository.js";
import { findUserById } from "../repositories/userRepository.js";
import {
    findPayrollByEmployeeAndMonth,
    upsertPayrollRecord,
    updatePayrollAmounts,
    findAllPayrollsByMonth,
    findPayrollById,
    updatePayrollRecordById
} from "../repositories/payrollRepository.js";

const roundMoney = (value) => Number(Number(value || 0).toFixed(2));

const parseMonth = (monthInput) => {
    const value = monthInput || new Date().toISOString().slice(0, 7);

    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
        throw new Error("Month must use YYYY-MM format");
    }

    return `${value}-01`;
};

const calculatePayroll = ({
    basicSalary,
    allowances = 0,
    bonus = 0,
    tax = 0,
    pf = 0,
    deduction = 0,
}) => {
    const amounts = {
        basicSalary: Number(basicSalary),
        allowances: Number(allowances),
        bonus: Number(bonus),
        tax: Number(tax),
        pf: Number(pf),
        deduction: Number(deduction),
    };

    if (
        Object.values(amounts).some(
            (amount) => !Number.isFinite(amount) || amount < 0,
        )
    ) {
        throw new Error("Payroll amounts must be non-negative numbers");
    }

    const grossSalary = roundMoney(
        amounts.basicSalary + amounts.allowances + amounts.bonus
    );

    const totalDeductions = roundMoney(
        amounts.pf + amounts.tax + amounts.deduction
    );

    const netSalary = roundMoney(grossSalary - totalDeductions);

    return {
        ...amounts,
        grossSalary,
        totalDeductions,
        netSalary,
    };
};

const getEmployeeByUser = async (userId, email) => {
    let employee = await findEmployeeByUserId(userId);

    if (!employee && email) {
        employee = await findEmployeeByEmail(email.trim().toLowerCase());
        if (employee && !employee.user_id) {
            await updateEmployeeRecord(employee.id, { user_id: userId });
        }
    }

    if (!employee && userId) {
        const user = await findUserById(userId);
        if (user) {
            const nameParts = (user.name || "Employee User").trim().split(" ");
            const firstName = nameParts[0] || "Employee";
            const lastName = nameParts.slice(1).join(" ") || "User";
            const empCode = `EMP${String(user.id).padStart(4, "0")}`;
            try {
                employee = await createEmployeeRecord({
                    userId: user.id,
                    employeeCode: empCode,
                    firstName,
                    lastName,
                    email: user.email.toLowerCase().trim()
                });
            } catch (e) {
                employee = await findEmployeeByUserId(userId);
            }
        }
    }

    return employee;
};

const deriveSalaryBreakdown = (rawSalary) => {
    const numSalary = Number(rawSalary || 0);
    const annualSalary = numSalary > 0 && numSalary < 300000 ? numSalary * 12 : numSalary;
    const monthlyGross = Math.round(annualSalary / 12);

    const basicSalary = Math.round(monthlyGross * 0.5);
    const allowances = Math.round(monthlyGross * 0.5);
    const pf = monthlyGross > 0 ? Math.min(Math.round(basicSalary * 0.12), 3600) : 0;
    const tax = monthlyGross > 0 ? 200 : 0;
    const deduction = Math.round(monthlyGross * 0.08);
    const totalDeductions = pf + tax + deduction;
    const netSalary = Math.max(0, monthlyGross - totalDeductions);

    return {
        annualSalary,
        monthlyGross,
        basicSalary,
        allowances,
        pf,
        tax,
        deduction,
        totalDeductions,
        netSalary,
    };
};

const formatEmployeeProfile = (employee) => {
    if (!employee) return null;
    const fName = employee.first_name || employee.firstName || employee.name?.split(" ")[0] || "";
    const lName = employee.last_name || employee.lastName || (employee.name?.split(" ").slice(1).join(" ")) || "";
    const mgrName = employee.manager_first_name
        ? `${employee.manager_first_name} ${employee.manager_last_name || ""}`.trim()
        : null;

    return {
        _id: employee.id || employee._id,
        id: employee.id || employee._id,
        employeeCode: employee.employee_code || employee.employeeCode || "",
        firstName: fName,
        lastName: lName,
        name: employee.name || `${fName} ${lName}`.trim(),
        email: employee.email || "",
        phone: employee.phone || "",
        reportsTo: employee.reports_to || employee.reportsTo || null,
        reportsToName: mgrName,
        employment: {
            department: employee.employment?.department || employee.department || "Engineering",
            designation: employee.employment?.designation || employee.designation || "Developer",
            joiningDate: employee.employment?.joiningDate || employee.joiningDate || employee.joining_date || "",
            employmentType: employee.employment?.employmentType || employee.employmentType || "Full Time",
            status: employee.employment?.status || employee.status || "Active",
        },
    };
};

const formatPayroll = (payroll) => {
    if (!payroll) return null;
    const basicSalary = Number(payroll.basicSalary || 0);
    const allowances = Number(payroll.allowances || 0);
    const bonus = Number(payroll.bonus || 0);
    const tax = Number(payroll.tax || 0);
    const pf = Number(payroll.pf || 0);
    const deduction = Number(payroll.deduction || 0);
    const rawGross = Number(payroll.grossSalary || (basicSalary + allowances + bonus));
    const grossSalary = rawGross >= 300000 ? Math.round(rawGross / 12) : rawGross;
    const totalDeductions = Number(payroll.totalDeductions ?? (tax + pf + deduction));
    const netSalary = Number(payroll.netSalary ?? Math.max(0, grossSalary - totalDeductions));
    const annualSalary = grossSalary * 12;

    const empProfile = typeof payroll.employee === "object" ? payroll.employee : null;
    const resolvedEmployeeId =
        payroll.employeeId ||
        payroll.employee_id ||
        (empProfile ? (empProfile.id || empProfile._id) : payroll.employee);

    return {
        _id: payroll.id,
        id: payroll.id,
        employeeId: resolvedEmployeeId,
        employee: empProfile ? formatEmployeeProfile(empProfile) : payroll.employee,
        month: payroll.month,
        annualSalary,
        monthlySalary: grossSalary,
        basicSalary,
        allowances,
        bonus,
        tax,
        pf,
        deduction,
        totalDeductions,
        grossSalary,
        netSalary,
        status: payroll.status,
        generatedAt: payroll.generatedAt,
    };
};

const buildSalarySummary = (employee, payroll, month = new Date()) => {
    const monthStr = typeof month === "string" ? month : parseMonth(new Date().toISOString().slice(0, 7));

    if (payroll) {
        return {
            ...formatPayroll(payroll),
            employeeId: employee?.id || null,
            employeeCode: employee?.employee_code || employee?.employeeCode || null,
            employee: formatEmployeeProfile(employee || payroll.employee),
            message:
                payroll.status === "generated"
                    ? "Payroll generated"
                    : "Awaiting payroll run",
            currency: "INR",
        };
    }

    const breakdown = deriveSalaryBreakdown(employee?.employment?.salary);

    return {
        employeeId: employee?.id || null,
        employeeCode: employee?.employee_code || employee?.employeeCode || null,
        employee: formatEmployeeProfile(employee),
        month: monthStr,
        annualSalary: breakdown.annualSalary,
        monthlySalary: breakdown.monthlyGross,
        basicSalary: breakdown.basicSalary,
        allowances: breakdown.allowances,
        bonus: 0,
        tax: breakdown.tax,
        pf: breakdown.pf,
        deduction: breakdown.deduction,
        totalDeductions: breakdown.totalDeductions,
        grossSalary: breakdown.monthlyGross,
        netSalary: breakdown.netSalary,
        status: "not_generated",
        message: breakdown.monthlyGross > 0 ? "Awaiting payroll run" : "Salary not configured",
        currency: "INR",
    };
};

const isBeforeJoiningMonth = (employee, monthDateStr) => {
    const joiningDateRaw =
        employee?.employment?.joiningDate ||
        employee?.joining_date ||
        employee?.joiningDate;

    if (!joiningDateRaw) return false;
    const joiningDate = new Date(joiningDateRaw);
    if (isNaN(joiningDate.getTime())) return false;

    const monthDate = new Date(monthDateStr);
    const joiningMonthStart = new Date(
        Date.UTC(joiningDate.getUTCFullYear(), joiningDate.getUTCMonth(), 1)
    );
    const requestedMonthStart = new Date(
        Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth(), 1)
    );

    return requestedMonthStart < joiningMonthStart;
};

// =====================================================
// VIEW MY SALARY
// =====================================================
export const viewMySalary = async (req, res) => {
    try {
        const employee = await getEmployeeByUser(req.user.userId, req.user.email);

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee profile not found",
            });
        }

        const monthStr = parseMonth(req.query.month);

        if (isBeforeJoiningMonth(employee, monthStr)) {
            return res.status(200).json({
                success: true,
                data: {
                    employeeId: employee.id,
                    employeeCode: employee.employee_code,
                    month: monthStr,
                    isBeforeJoining: true,
                    status: "not_applicable",
                    message: "Payroll is not applicable prior to your joining date",
                },
            });
        }

        let payroll = await findPayrollByEmployeeAndMonth(employee.id, monthStr);

        if (!payroll) {
            const empSal = employee?.employment?.salary || employee?.salary;
            if (empSal && Number(empSal) > 0) {
                const breakdown = deriveSalaryBreakdown(empSal);
                const amounts = calculatePayroll({
                    basicSalary: breakdown.basicSalary,
                    allowances: breakdown.allowances,
                    bonus: 0,
                    tax: breakdown.tax,
                    pf: breakdown.pf,
                    deduction: breakdown.deduction,
                });
                payroll = await upsertPayrollRecord({
                    ...amounts,
                    employeeId: employee.id,
                    month: monthStr,
                    generatedBy: employee.user_id || req.user.userId,
                    status: "generated",
                });
            }
        }

        return res.status(200).json({
            success: true,
            data: buildSalarySummary(employee, payroll, monthStr),
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Unable to fetch salary",
        });
    }
};

// =====================================================
// GET MY PAYSLIP
// =====================================================
export const getMyPayslip = async (req, res, next) => {
    try {
        const employee = await getEmployeeByUser(req.user.userId, req.user.email);
        const monthStr = parseMonth(req.query.month);

        if (!employee) {
            return res
                .status(404)
                .json({ success: false, message: "Employee profile not found" });
        }

        if (isBeforeJoiningMonth(employee, monthStr)) {
            return res.status(200).json({
                success: true,
                data: {
                    employeeId: employee.id,
                    employeeCode: employee.employee_code,
                    month: monthStr,
                    isBeforeJoining: true,
                    status: "not_applicable",
                    message: "Payslip is not applicable prior to your joining date",
                },
            });
        }

        let payroll = await findPayrollByEmployeeAndMonth(employee.id, monthStr);

        if (!payroll) {
            const empSal = employee?.employment?.salary || employee?.salary;
            if (empSal && Number(empSal) > 0) {
                const breakdown = deriveSalaryBreakdown(empSal);
                const amounts = calculatePayroll({
                    basicSalary: breakdown.basicSalary,
                    allowances: breakdown.allowances,
                    bonus: 0,
                    tax: breakdown.tax,
                    pf: breakdown.pf,
                    deduction: breakdown.deduction,
                });
                payroll = await upsertPayrollRecord({
                    ...amounts,
                    employeeId: employee.id,
                    month: monthStr,
                    generatedBy: employee.user_id || req.user.userId,
                    status: "generated",
                });
            }
        }

        if (!payroll) {
            return res.status(200).json({
                success: true,
                data: {
                    ...buildSalarySummary(employee, null, monthStr),
                    month: monthStr,
                    status: "not_generated",
                    message: "Awaiting payroll run",
                },
            });
        }

        return res.status(200).json({ success: true, data: formatPayroll(payroll) });
    } catch (error) {
        return next(error);
    }
};

// =====================================================
// DOWNLOAD MY PAYSLIP (PDF)
// =====================================================
export const downloadMyPayslip = async (req, res, next) => {
    try {
        const employee = await getEmployeeByUser(req.user.userId, req.user.email);

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee profile not found for this account",
            });
        }

        const monthStr = parseMonth(req.query.month);

        if (isBeforeJoiningMonth(employee, monthStr)) {
            return res.status(400).json({
                success: false,
                message: "Payslips cannot be downloaded for periods prior to your date of joining",
            });
        }

        const payroll = await findPayrollByEmployeeAndMonth(employee.id, monthStr);

        if (!payroll) {
            return res.status(404).json({
                success: false,
                message: `Payslip not generated for ${req.query.month || "this month"}`,
            });
        }

        const monthLabel = new Date(monthStr).toLocaleString("en-US", {
            month: "long",
            year: "numeric",
        });

        const empProfile = formatEmployeeProfile(employee);
        const employeeName = `${empProfile?.firstName || ""} ${empProfile?.lastName || ""}`.trim();
        const designation = empProfile?.employment?.designation || "N/A";
        const department = empProfile?.employment?.department || "N/A";
        const dateOfJoining = empProfile?.employment?.joiningDate
            ? new Date(empProfile.employment.joiningDate).toLocaleDateString("en-IN")
            : "N/A";

        const basicSalary = Number(payroll.basicSalary || 0);
        const allowances = Number(payroll.allowances || 0);
        const bonus = Number(payroll.bonus || 0);
        const tax = Number(payroll.tax || 0);
        const pf = Number(payroll.pf || 0);
        const otherDeduction = Number(payroll.deduction || 0);
        const grossSalary = Number(payroll.grossSalary || 0);
        const netSalary = Number(payroll.netSalary || 0);
        const totalDeductions = tax + pf + otherDeduction;

        const doc = new PDFDocument({ margin: 50, size: "A4" });
        const fileName = `payslip-${req.query.month || "current"}.pdf`;

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

        doc.pipe(res);

        // Header
        doc.fontSize(24).text("Quadratics Inc", { align: "center" });
        doc.moveDown(0.3);
        doc.fontSize(16).text("Payslip", { align: "center" });
        doc.moveDown();
        doc.fontSize(10).text("This is a system generated payslip", { align: "center" });
        doc.moveDown(2);

        // Employee Info
        doc.fontSize(11);
        doc.text(`Date of Joining : ${dateOfJoining}`);
        doc.text(`Pay Period      : ${monthLabel}`);
        doc.text(`Employee Name   : ${employeeName}`);
        doc.text(`Designation     : ${designation}`);
        doc.text(`Department      : ${department}`);

        doc.moveDown(1.5);

        // Earnings / Deductions Header
        doc.fontSize(14).text("Earnings");
        doc.moveDown(0.5);

        const earningsX = 50;
        const amountX = 250;

        doc.fontSize(11);
        doc.text("Earnings", earningsX, doc.y);
        doc.text("Amount", amountX, doc.y);
        doc.moveDown(0.5);

        const earningsStartY = doc.y;

        doc.text("Basic Salary", earningsX, earningsStartY);
        doc.text(`₹${basicSalary.toFixed(2)}`, amountX, earningsStartY);

        doc.text("Allowances", earningsX, earningsStartY + 20);
        doc.text(`₹${allowances.toFixed(2)}`, amountX, earningsStartY + 20);

        doc.text("Bonus", earningsX, earningsStartY + 40);
        doc.text(`₹${bonus.toFixed(2)}`, amountX, earningsStartY + 40);

        const deductionsX = 320;
        const deductionsAmountX = 500;

        doc.text("Deductions", deductionsX, earningsStartY - 20);
        doc.text("Amount", deductionsAmountX, earningsStartY - 20);

        doc.text("Provident Fund", deductionsX, earningsStartY);
        doc.text(`₹${pf.toFixed(2)}`, deductionsAmountX, earningsStartY);

        doc.text("Professional Tax", deductionsX, earningsStartY + 20);
        doc.text(`₹${tax.toFixed(2)}`, deductionsAmountX, earningsStartY + 20);

        doc.text("Other Deduction", deductionsX, earningsStartY + 40);
        doc.text(`₹${otherDeduction.toFixed(2)}`, deductionsAmountX, earningsStartY + 40);

        doc.moveDown(4);

        // Totals
        doc.fontSize(12);
        doc.text(`Total Earnings: ₹${grossSalary.toFixed(2)}`);
        doc.text(`Total Deductions: ₹${totalDeductions.toFixed(2)}`);
        doc.moveDown(0.5);
        doc.fontSize(15).text(`Net Pay: ₹${netSalary.toFixed(2)}`);
        doc.moveDown(0.5);

        const numberToWords = (num) => {
            const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
            const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

            const convert = (n) => {
                if (n < 20) return ones[n];
                if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ` ${ones[n % 10]}` : "");
                if (n < 1000) return `${ones[Math.floor(n / 100)]} Hundred` + (n % 100 ? ` ${convert(n % 100)}` : "");
                if (n < 100000) return `${convert(Math.floor(n / 1000))} Thousand` + (n % 1000 ? ` ${convert(n % 1000)}` : "");
                if (n < 10000000) return `${convert(Math.floor(n / 100000))} Lakh` + (n % 100000 ? ` ${convert(n % 100000)}` : "");
                return `${convert(Math.floor(n / 10000000))} Crore` + (n % 10000000 ? ` ${convert(n % 10000000)}` : "");
            };

            const rounded = Math.round(num);
            if (rounded === 0) return "Zero";
            return convert(rounded);
        };

        doc.fontSize(11).text(`${numberToWords(netSalary)} Rupees Only`);
        doc.moveDown(3);

        doc.text("Employer Signature", 70, doc.y);
        doc.text("Employee Signature", 380, doc.y);
        doc.moveDown(3);

        doc.fontSize(9).text(
            "Quadratics Inc - This is a system generated payslip and does not require a physical signature.",
            { align: "center" }
        );

        doc.end();
    } catch (error) {
        return next(error);
    }
};

// =====================================================
// GENERATE PAYROLL (HR / ADMIN)
// =====================================================
export const generatePayroll = async (req, res, next) => {
    try {
        const monthStr = parseMonth(req.body.month);
        const employees = await findAllEmployees();
        const activeEmployees = employees.filter((e) => e.employment?.status !== "Terminated");
        const results = [];

        for (const employee of activeEmployees) {
            if (isBeforeJoiningMonth(employee, monthStr)) {
                continue;
            }

            const breakdown = deriveSalaryBreakdown(employee.employment?.salary);

            const basicSalary = req.body.basicSalary !== undefined ? Number(req.body.basicSalary) : breakdown.basicSalary;
            const allowances = req.body.allowances !== undefined ? Number(req.body.allowances) : breakdown.allowances;
            const bonus = req.body.bonus || 0;
            const tax = req.body.tax !== undefined ? Number(req.body.tax) : breakdown.tax;
            const pf = req.body.pf !== undefined ? Number(req.body.pf) : breakdown.pf;
            const deduction = req.body.deduction !== undefined ? Number(req.body.deduction) : breakdown.deduction;

            const amounts = calculatePayroll({ basicSalary, allowances, bonus, tax, pf, deduction });

            const payroll = await upsertPayrollRecord({
                ...amounts,
                employeeId: employee.id,
                month: monthStr,
                generatedBy: req.user.userId,
                status: "generated",
            });

            payroll.employee = formatEmployeeProfile(employee);
            results.push(payroll);
        }

        return res.status(200).json({
            success: true,
            message: `Payroll generated successfully for ${results.length} employees`,
            data: {
                month: monthStr,
                count: results.length,
                payroll: results.map(formatPayroll),
            },
        });
    } catch (error) {
        return next(error);
    }
};

// =====================================================
// UPDATE EMPLOYEE SALARY
// =====================================================
export const updateEmployeeSalary = async (req, res, next) => {
    try {
        const rawParam = req.params.employeeId;
        const employeeId = Number(rawParam);

        let existingEmp = null;
        if (employeeId && !Number.isNaN(employeeId)) {
            existingEmp = await findEmployeeById(employeeId);
            if (!existingEmp) {
                existingEmp = await findEmployeeByUserId(employeeId);
            }
        }
        if (!existingEmp && rawParam) {
            existingEmp = await findEmployeeByCodeOrEmail(String(rawParam));
        }

        if (!existingEmp) {
            return res.status(404).json({ success: false, message: "Employee not found" });
        }

        const inputSalary = Number(req.body.salary);

        if (!Number.isFinite(inputSalary) || inputSalary < 0) {
            return res.status(400).json({
                success: false,
                message: "Salary must be a non-negative number",
            });
        }

        const annualSalary = inputSalary > 0 && inputSalary < 300000 ? inputSalary * 12 : inputSalary;
        const resolvedEmpId = existingEmp.id;

        const employment = existingEmp.employment || {};
        employment.salary = annualSalary;

        const employee = await updateEmployeeRecord(resolvedEmpId, { employment });

        const targetMonthStr = req.body.month
            ? parseMonth(req.body.month)
            : parseMonth(new Date().toISOString().slice(0, 7));

        const existingPayroll = await findPayrollByEmployeeAndMonth(resolvedEmpId, targetMonthStr);
        const newMonthlyGross = Math.round(annualSalary / 12);

        let amounts;
        if (existingPayroll && Number(existingPayroll.grossSalary) > 0 && Number(existingPayroll.grossSalary) === newMonthlyGross) {
            amounts = {
                basicSalary: Number(existingPayroll.basicSalary),
                allowances: Number(existingPayroll.allowances),
                bonus: Number(existingPayroll.bonus || 0),
                tax: Number(existingPayroll.tax),
                pf: Number(existingPayroll.pf),
                deduction: Number(existingPayroll.deduction),
                grossSalary: newMonthlyGross,
                totalDeductions: Number(existingPayroll.totalDeductions),
                netSalary: Number(existingPayroll.netSalary),
            };
        } else {
            const breakdown = deriveSalaryBreakdown(annualSalary);
            amounts = calculatePayroll({
                basicSalary: breakdown.basicSalary,
                allowances: breakdown.allowances,
                bonus: Number(existingPayroll?.bonus || 0),
                tax: breakdown.tax,
                pf: breakdown.pf,
                deduction: breakdown.deduction,
            });
        }

        await upsertPayrollRecord({
            ...amounts,
            employeeId: resolvedEmpId,
            month: targetMonthStr,
            generatedBy: req.user?.userId || 1,
            status: "generated",
        });

        return res.status(200).json({
            success: true,
            message: "Employee salary updated successfully",
            data: employee,
        });
    } catch (error) {
        return next(error);
    }
};

// =====================================================
// GET PAYROLL RECORDS
// =====================================================
export const getPayroll = async (req, res, next) => {
    try {
        const monthStr = req.query.month ? parseMonth(req.query.month) : parseMonth();
        const reqEmployeeId = req.query.employeeId ? Number(req.query.employeeId) : null;

        const existingPayrolls = await findAllPayrollsByMonth(monthStr, reqEmployeeId);
        const existingPayrollMap = new Map();
        existingPayrolls.forEach((p) => {
            const empId = typeof p.employee === "object" ? p.employee?.id : p.employee;
            if (empId) existingPayrollMap.set(Number(empId), p);
        });

        const employees = await findAllEmployees();
        const activeEmployees = employees.filter((e) => e.employment?.status !== "Terminated");

        const records = [];

        for (const employee of activeEmployees) {
            if (reqEmployeeId && employee.id !== reqEmployeeId) {
                continue;
            }

            if (isBeforeJoiningMonth(employee, monthStr)) {
                continue;
            }

            const existingPayroll = existingPayrollMap.get(employee.id);
            if (existingPayroll) {
                records.push(formatPayroll(existingPayroll));
            } else {
                records.push(buildSalarySummary(employee, null, monthStr));
            }
        }

        return res.status(200).json({ success: true, data: records });
    } catch (error) {
        return next(error);
    }
};

// =====================================================
// UPDATE OR UPSERT FULL PAYROLL RECORD (FOR HR)
// =====================================================
export const updatePayrollRecord = async (req, res, next) => {
    try {
        const id = req.params.id ? Number(req.params.id) : (req.body.id ? Number(req.body.id) : null);
        let employeeId = Number(
            req.body.employeeId ||
            req.body.employee?.id ||
            req.body.employee?._id ||
            req.params.employeeId
        );

        const monthInput = req.body.month || req.query.month;
        const monthStr = parseMonth(monthInput);

        const basicSalary = Number(req.body.basicSalary ?? 0);
        const allowances = Number(req.body.allowances ?? 0);
        const bonus = Number(req.body.bonus ?? 0);
        const tax = Number(req.body.tax ?? 0);
        const pf = Number(req.body.pf ?? 0);
        const deduction = Number(req.body.deduction ?? req.body.otherDeductions ?? 0);

        const grossSalary = req.body.grossSalary !== undefined && req.body.grossSalary !== null && req.body.grossSalary !== ""
            ? Number(req.body.grossSalary)
            : roundMoney(basicSalary + allowances + bonus);

        const totalDeductions = req.body.totalDeductions !== undefined && req.body.totalDeductions !== null && req.body.totalDeductions !== ""
            ? Number(req.body.totalDeductions)
            : roundMoney(tax + pf + deduction);

        const netSalary = req.body.netSalary !== undefined && req.body.netSalary !== null && req.body.netSalary !== ""
            ? Number(req.body.netSalary)
            : roundMoney(grossSalary - totalDeductions);

        const status = req.body.status || "generated";

        let payroll = null;

        if (id && !Number.isNaN(id)) {
            payroll = await updatePayrollRecordById(id, {
                basicSalary,
                allowances,
                bonus,
                tax,
                pf,
                deduction,
                grossSalary,
                totalDeductions,
                netSalary,
                status
            });

            if (payroll && !employeeId) {
                employeeId = typeof payroll.employee === "object" ? payroll.employee?.id : payroll.employee;
            }
        }

        if (!payroll) {
            if (!employeeId || Number.isNaN(employeeId)) {
                return res.status(400).json({
                    success: false,
                    message: "A valid payroll ID or employee ID is required to update payroll",
                });
            }

            payroll = await upsertPayrollRecord({
                employeeId,
                month: monthStr,
                basicSalary,
                allowances,
                bonus,
                tax,
                pf,
                deduction,
                grossSalary,
                totalDeductions,
                netSalary,
                generatedBy: req.user.userId,
                status
            });
        }

        if (!payroll) {
            return res.status(404).json({
                success: false,
                message: "Payroll record could not be found or created",
            });
        }

        // Synchronize employment salary whenever payroll record is saved
        if (employeeId && grossSalary > 0) {
            let emp = await findEmployeeById(employeeId);
            if (!emp) emp = await findEmployeeByUserId(employeeId);
            if (!emp) emp = await findEmployeeByCodeOrEmail(String(employeeId));
            if (emp) {
                const employment = emp.employment || {};
                employment.salary = grossSalary * 12;
                await updateEmployeeRecord(emp.id, { employment });
            }
        }

        return res.status(200).json({
            success: true,
            message: "Payroll record updated successfully",
            data: formatPayroll(payroll),
        });
    } catch (error) {
        return next(error);
    }
};

