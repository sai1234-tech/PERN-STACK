import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import { createUser, findUserByEmail, findUserById } from "../repositories/userRepository.js";
import {
    createEmployeeRecord,
    findEmployeeById,
    findEmployeeByCode,
    findEmployeeByUserId,
    findEmployeeByEmail,
    findEmployeeByCodeOrEmail,
    findAllEmployees,
    updateEmployeeRecord,
    deleteEmployeeRecord,
    countEmployees,
    isCircularReporting,
    resolveManagerEmployee,
    generateNextEmployeeCode,
    logEmployeeHistory,
    getEmployeeHistory
} from "../repositories/employeeRepository.js";
import { upsertAllocationRecord } from "../repositories/allocationRepository.js";

// Helper to format employee database row into JSON
export const formatEmployeeResponse = (emp) => {
    if (!emp) return null;

    const isVikas = Boolean(
        (emp.first_name && emp.first_name.toLowerCase().includes("vikas")) ||
        (emp.last_name && emp.last_name.toLowerCase().includes("guru")) ||
        (emp.email && (emp.email.toLowerCase().includes("vikas") || emp.email.toLowerCase().includes("gvikas"))) ||
        (emp.user_name && emp.user_name.toLowerCase().includes("vikas")) ||
        (emp.user_email && (emp.user_email.toLowerCase().includes("vikas") || emp.user_email.toLowerCase().includes("gvikas")))
    );

    const resolvedRole = isVikas ? "manager" : (emp.user_role || "employee");
    const resolvedDesignation = isVikas
        ? (emp.employment?.designation && !["staff", "employee"].includes(emp.employment.designation.toLowerCase()) ? emp.employment.designation : "Team Manager")
        : (emp.employment?.designation || emp.designation || "Staff");

    const employmentObj = {
        ...(emp.employment || {}),
        department: isVikas ? "Engineering" : (emp.employment?.department || emp.department || "General"),
        designation: resolvedDesignation,
        status: emp.employment?.status || emp.status || "Active"
    };

    return {
        id: emp.id,
        user: (emp.user_id || isVikas) ? {
            id: emp.user_id || 17,
            name: emp.user_name || `${emp.first_name || ""} ${emp.last_name || ""}`.trim() || "Vikas Guru",
            email: emp.user_email || emp.email,
            role: resolvedRole,
            isActive: emp.user_is_active ?? true
        } : null,
        role: resolvedRole,
        designation: resolvedDesignation,
        reportsTo: emp.reports_to ? {
            id: emp.reports_to,
            employeeCode: emp.manager_code || "",
            name: `${emp.manager_first_name || ""} ${emp.manager_last_name || ""}`.trim()
        } : null,
        matrixReportsTo: emp.matrix_manager_id ? {
            id: emp.matrix_manager_id,
            employeeCode: emp.matrix_code || "",
            name: `${emp.matrix_first_name || ""} ${emp.matrix_last_name || ""}`.trim()
        } : (emp.employment?.matrixReportsTo ? {
            name: typeof emp.employment.matrixReportsTo === "object" ? emp.employment.matrixReportsTo.name : emp.employment.matrixReportsTo
        } : null),
        entity: emp.entity || emp.employment?.entity || "Quadratic Systems Inc.",
        function: emp.function || emp.employment?.function || "Engineering & Technology",
        costCenter: emp.cost_center || emp.employment?.costCenter || "CC-101-GEN",
        assignedHr: emp.hr_id ? {
            id: emp.hr_id,
            employeeCode: emp.hr_code || "",
            name: `${emp.hr_first_name || ""} ${emp.hr_last_name || ""}`.trim(),
            email: emp.hr_email || ""
        } : (emp.employment?.hrPartnerName ? {
            name: emp.employment.hrPartnerName,
            email: emp.employment.hrPartnerEmail || ""
        } : {
            name: "Lakshmi Ragula",
            email: "lragula@quadratics.com"
        }),
        employeeCode: emp.employee_code,
        firstName: emp.first_name,
        lastName: emp.last_name || "",
        email: emp.email,
        phone: emp.phone || "",
        pan: emp.pan || "",
        uan: emp.uan || "",
        aadhaar: emp.aadhaar || emp.statutory?.aadhaar || "",
        esiNumber: emp.esi_number || emp.statutory?.esiNumber || "",
        taxRegime: emp.tax_regime || emp.statutory?.taxRegime || "New Regime",
        profilePhoto: emp.profile_photo || "",
        workLocation: emp.work_location || "",
        personal: emp.personal || {},
        employment: emp.employment || {},
        address: emp.address || {},
        emergencyContact: emp.emergency_contact || {},
        banking: emp.banking || {},
        skills: emp.skills || [],
        certifications: emp.certifications || [],
        awards: emp.awards || [],
        createdAt: emp.created_at,
        updatedAt: emp.updated_at
    };
};

// =====================================================
// 1. CREATE MULTIPLE EMPLOYEES
// =====================================================
export const createMultipleEmployees = async (req, res) => {
    try {
        let employees = req.body;

        if (employees && !Array.isArray(employees)) {
            if (Array.isArray(employees.employees)) {
                employees = employees.employees;
            } else if (typeof employees === "object" && Object.keys(employees).length > 0) {
                employees = [employees];
            }
        }

        if (!Array.isArray(employees) || employees.length === 0) {
            return res.status(400).json({
                success: false,
                message: "At least one employee object is required"
            });
        }

        const createdEmployees = [];

        for (const employee of employees) {
            let employeeCode = (employee.employeeCode && employee.employeeCode.trim().toUpperCase()) || "";
            if (!employeeCode) {
                employeeCode = await generateNextEmployeeCode();
            }

            if (!employee.firstName) {
                return res.status(400).json({ success: false, message: "First name is required" });
            }
            if (!employee.email) {
                return res.status(400).json({ success: false, message: "Email is required" });
            }

            const email = employee.email.trim().toLowerCase();

            // Find or create user
            let user = await findUserByEmail(email);
            if ((employee.grantLogin || employee.loginPassword) && !user) {
                const passToHash = (employee.loginPassword && employee.loginPassword.trim()) || "Password@123";
                const hashedPassword = await bcrypt.hash(passToHash, 10);
                user = await createUser({
                    name: `${employee.firstName.trim()} ${employee.lastName ? employee.lastName.trim() : ""}`.trim(),
                    email,
                    password: hashedPassword,
                    role: employee.loginRole || "employee",
                    isActive: true
                });
            }

            // Check existing employee
            const existingEmployee = await findEmployeeByCodeOrEmail(email) || await findEmployeeByCode(employeeCode);
            const phoneVal = String(employee.phone || employee.phoneNumber || "").trim();

            // Resolve reportsTo if provided
            let reportsToId = null;
            const rawReportsTo = employee.reportsTo !== undefined ? employee.reportsTo : (employee.reports_to !== undefined ? employee.reports_to : employee.employment?.reportsTo);
            if (rawReportsTo && rawReportsTo !== "" && rawReportsTo !== "null" && rawReportsTo !== "None") {
                const mgrEmp = await resolveManagerEmployee(rawReportsTo);
                if (mgrEmp) {
                    if (existingEmployee && Number(mgrEmp.id) === Number(existingEmployee.id)) {
                        return res.status(400).json({ success: false, message: "An employee cannot report to themselves" });
                    }
                    if (existingEmployee && await isCircularReporting(existingEmployee.id, mgrEmp.id)) {
                        return res.status(400).json({ success: false, message: "Circular reporting hierarchy detected" });
                    }
                    reportsToId = mgrEmp.id;
                }
            }

            // Resolve matrix manager if provided
            let matrixReportsToId = null;
            const rawMatrix =
                employee.matrixManagerId !== undefined
                    ? employee.matrixManagerId
                    : employee.matrixReportsTo || employee.matrix_reports_to || employee.employment?.matrixReportsTo;
            if (rawMatrix && rawMatrix !== "" && rawMatrix !== "null" && rawMatrix !== "None") {
                const matEmp = await resolveManagerEmployee(rawMatrix);
                if (matEmp) {
                    matrixReportsToId = matEmp.id;
                }
            }

            const rawSalary = employee.salary !== undefined ? employee.salary : employee.employment?.salary;
            const salaryVal = rawSalary !== undefined && rawSalary !== "" && !Number.isNaN(Number(rawSalary)) ? Number(rawSalary) : undefined;

            const entityVal = employee.entity || employee.employment?.entity || "Quadratic Systems Inc.";
            const functionVal = employee.function || employee.employment?.function || "Engineering & Technology";
            const costCenterVal = employee.costCenter || employee.cost_center || employee.employment?.costCenter || "CC-101-GEN";
            const aadhaarVal = employee.aadhaar ? String(employee.aadhaar).trim() : "";
            const esiNumberVal = employee.esiNumber || employee.esi_number ? String(employee.esiNumber || employee.esi_number).trim() : "";
            const taxRegimeVal = employee.taxRegime || employee.tax_regime || "New Regime";
            const employmentTypeVal = employee.employment?.employmentType || employee.employmentType || "Permanent";

            if (existingEmployee) {
                const existingReportsTo = reportsToId !== null ? reportsToId : (rawReportsTo === null || rawReportsTo === "" ? null : existingEmployee.reports_to);
                const updated = await updateEmployeeRecord(existingEmployee.id, {
                    employee_code: employeeCode,
                    first_name: employee.firstName.trim(),
                    last_name: employee.lastName ? employee.lastName.trim() : "",
                    email,
                    phone: phoneVal,
                    reports_to: existingReportsTo,
                    matrix_manager_id: matrixReportsToId !== null ? matrixReportsToId : existingEmployee.matrix_manager_id,
                    entity: entityVal,
                    function: functionVal,
                    cost_center: costCenterVal,
                    aadhaar: aadhaarVal || existingEmployee.aadhaar,
                    esi_number: esiNumberVal || existingEmployee.esi_number,
                    tax_regime: taxRegimeVal,
                    user_id: user ? user.id : existingEmployee.user_id,
                    employment: {
                        department: employee.employment?.department || employee.department || "Engineering",
                        designation: employee.employment?.designation || employee.designation || "Developer",
                        joiningDate: employee.employment?.joiningDate || employee.joiningDate || new Date().toISOString(),
                        employmentType: employmentTypeVal,
                        status: employee.employment?.status || employee.status || "Active",
                        salary: salaryVal !== undefined ? salaryVal : existingEmployee.employment?.salary,
                        reportsTo: existingReportsTo,
                        matrixReportsTo: matrixReportsToId,
                        entity: entityVal,
                        function: functionVal,
                        costCenter: costCenterVal
                    }
                });
                createdEmployees.push(formatEmployeeResponse(await findEmployeeById(updated.id)));
                continue;
            }

            // Create new employee object
            const newEmp = await createEmployeeRecord({
                userId: user ? user.id : null,
                reportsTo: reportsToId,
                matrixManagerId: matrixReportsToId,
                employeeCode,
                firstName: employee.firstName.trim(),
                lastName: employee.lastName ? employee.lastName.trim() : "",
                email,
                phone: phoneVal,
                pan: employee.pan ? String(employee.pan).trim().toUpperCase() : "",
                uan: employee.uan ? String(employee.uan).trim() : "",
                aadhaar: aadhaarVal,
                esiNumber: esiNumberVal,
                taxRegime: taxRegimeVal,
                entity: entityVal,
                function: functionVal,
                costCenter: costCenterVal,
                banking: employee.banking || {},
                personal: employee.personal || { phone: phoneVal },
                employment: {
                    department: employee.employment?.department || employee.department || "Engineering",
                    designation: employee.employment?.designation || employee.designation || "Developer",
                    joiningDate: employee.employment?.joiningDate || employee.joiningDate || new Date().toISOString(),
                    employmentType: employmentTypeVal,
                    status: employee.employment?.status || employee.status || "Active",
                    salary: salaryVal,
                    reportsTo: reportsToId,
                    matrixReportsTo: matrixReportsToId,
                    entity: entityVal,
                    function: functionVal,
                    costCenter: costCenterVal
                },
                address: employee.address || {},
                emergencyContact: employee.emergencyContact || {},
                profilePhoto: employee.profilePhoto || ""
            });

            const createdFormatted = formatEmployeeResponse(await findEmployeeById(newEmp.id));
            createdEmployees.push(createdFormatted);

            // Automatically place newly created employee into Resource Allocation COST CENTER (On Bench)
            try {
                await upsertAllocationRecord({
                    empId: String(newEmp.id),
                    employeeName: `${newEmp.first_name || ""} ${newEmp.last_name || ""}`.trim() || email,
                    employeeCode: newEmp.employee_code || employeeCode,
                    department: newEmp.employment?.department || employee.department || "Engineering",
                    role: newEmp.employment?.designation || employee.designation || "Developer",
                    projectName: "",
                    clientName: "Internal Cost Center",
                    status: "Bench",
                    billability: "Internal",
                    allocationPercentage: 0,
                    sowNumber: ""
                });
            } catch (allocErr) {
                console.warn("Auto-bench registration notice:", allocErr.message);
            }
        }

        return res.status(201).json({
            success: true,
            message: "Employees created successfully",
            count: createdEmployees.length,
            data: createdEmployees,
            employee: createdEmployees[0]
        });
    } catch (error) {
        console.error("CREATE EMPLOYEE ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to create employees",
            error: error.message
        });
    }
};

// =====================================================
// 2. GET ALL EMPLOYEES
// =====================================================
export const getEmployee = async (req, res) => {
    try {
        const { search } = req.query;
        const employees = await findAllEmployees(search);
        const formatted = employees.map(formatEmployeeResponse);

        return res.status(200).json({
            success: true,
            count: formatted.length,
            data: formatted
        });
    } catch (error) {
        console.error("GET EMPLOYEES ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to get employees",
            error: error.message
        });
    }
};

// =====================================================
// 3. GET SINGLE EMPLOYEE
// =====================================================
export const getSingleEmployee = async (req, res) => {
    try {
        const { id } = req.params;
        let employee = null;

        if (!isNaN(id)) {
            employee = await findEmployeeById(Number(id));
        }

        if (!employee) {
            employee = await findEmployeeByCode(id) || await findEmployeeByCodeOrEmail(id);
        }

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            });
        }

        const formatted = formatEmployeeResponse(employee);
        return res.status(200).json({
            success: true,
            data: formatted
        });

    } catch (error) {
        console.error("GET SINGLE EMPLOYEE ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to get employee",
            error: error.message
        });
    }
};

// =====================================================
// 4. UPDATE EMPLOYEE
// =====================================================
export const updateEmployee = async (req, res) => {
    try {
        const { id } = req.params;
        let employee = !isNaN(id) ? await findEmployeeById(Number(id)) : await findEmployeeByCode(id);

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            });
        }

        const updates = {};
        if (req.body.employeeCode) updates.employee_code = req.body.employeeCode.trim().toUpperCase();
        if (req.body.firstName) updates.first_name = req.body.firstName.trim();
        if (req.body.lastName !== undefined) updates.last_name = req.body.lastName.trim();
        if (req.body.phone !== undefined) updates.phone = String(req.body.phone).trim();
        if (req.body.email) updates.email = req.body.email.trim().toLowerCase();
        if (req.body.workLocation !== undefined) {
            updates.work_location = String(req.body.workLocation).trim();
        }
        if (req.body.profilePhoto) updates.profile_photo = req.body.profilePhoto;
        if (req.body.pan) updates.pan = String(req.body.pan).trim().toUpperCase();
        if (req.body.uan) updates.uan = String(req.body.uan).trim();
        if (req.body.aadhaar !== undefined) updates.aadhaar = String(req.body.aadhaar).trim();
        if (req.body.esiNumber !== undefined) updates.esi_number = String(req.body.esiNumber).trim();
        if (req.body.taxRegime) updates.tax_regime = String(req.body.taxRegime).trim();
        if (req.body.entity) updates.entity = String(req.body.entity).trim();
        if (req.body.function) updates.function = String(req.body.function).trim();
        if (req.body.costCenter) updates.cost_center = String(req.body.costCenter).trim();

        if (req.body.personal) updates.personal = { ...(employee.personal || {}), ...req.body.personal };
        if (req.body.employment) updates.employment = { ...(employee.employment || {}), ...req.body.employment };
        if (req.body.address) updates.address = { ...(employee.address || {}), ...req.body.address };
        if (req.body.emergencyContact) updates.emergency_contact = { ...(employee.emergency_contact || {}), ...req.body.emergencyContact };
        if (req.body.banking) updates.banking = { ...(employee.banking || {}), ...req.body.banking };
        if (req.body.skills) updates.skills = req.body.skills;
        if (req.body.certifications) updates.certifications = req.body.certifications;
        if (req.body.awards) updates.awards = req.body.awards;

        // Matrix Manager
        const reqMatrix =
            req.body.matrixManagerId !== undefined
                ? req.body.matrixManagerId
                : req.body.matrixReportsTo !== undefined
                ? req.body.matrixReportsTo
                : req.body.matrix_reports_to;
        if (reqMatrix !== undefined) {
            if (reqMatrix === null || reqMatrix === "" || reqMatrix === "null" || reqMatrix === "None") {
                updates.matrix_manager_id = null;
            } else {
                const matEmp = await resolveManagerEmployee(reqMatrix);
                if (matEmp) {
                    updates.matrix_manager_id = matEmp.id;
                }
            }
            updates.employment = {
                ...(updates.employment || {}),
                matrixReportsTo: updates.matrix_manager_id
            };
        }

        const reqSalary = req.body.salary !== undefined ? req.body.salary : req.body.employment?.salary;
        if (reqSalary !== undefined) {
            const numS = reqSalary !== "" && !Number.isNaN(Number(reqSalary)) ? Number(reqSalary) : null;
            updates.employment = {
                ...(employee.employment || {}),
                ...(updates.employment || {}),
                salary: numS !== null ? numS : undefined,
            };
        }

        const reqReportsTo = req.body.reportsTo !== undefined
            ? req.body.reportsTo
            : (req.body.reports_to !== undefined ? req.body.reports_to : req.body.employment?.reportsTo);

        if (reqReportsTo !== undefined) {
            if (reqReportsTo === null || reqReportsTo === "" || reqReportsTo === "null" || reqReportsTo === "None") {
                updates.reports_to = null;
            } else {
                const mgrEmp = await resolveManagerEmployee(reqReportsTo);
                if (!mgrEmp) {
                    return res.status(400).json({
                        success: false,
                        message: "The selected reporting manager does not exist."
                    });
                }

                // Check self-reporting
                if (Number(mgrEmp.id) === Number(employee.id)) {
                    return res.status(400).json({
                        success: false,
                        message: "An employee cannot be assigned as their own reporting manager."
                    });
                }

                // Check active status
                const mgrStatus = (mgrEmp.employment?.status || mgrEmp.status || "Active").toLowerCase();
                if (mgrStatus !== "active") {
                    return res.status(400).json({
                        success: false,
                        message: `Selected reporting manager (${mgrEmp.first_name} ${mgrEmp.last_name || ""}) is not active.`
                    });
                }

                // Check circular hierarchy
                const circular = await isCircularReporting(employee.id, mgrEmp.id);
                if (circular) {
                    return res.status(400).json({
                        success: false,
                        message: `Cannot assign ${mgrEmp.first_name} ${mgrEmp.last_name || ""}: this creates a circular reporting relationship.`
                    });
                }

                updates.reports_to = mgrEmp.id;
            }

            updates.employment = {
                ...(employee.employment || {}),
                ...(updates.employment || {}),
                reportsTo: updates.reports_to
            };
        }

        // ── Detect and Log Promotions, Transfers, Salary Revisions, and Reporting Changes ──
        const effectiveDate = req.body.effectiveDate || new Date().toISOString().slice(0, 10);
        const changeReason = req.body.changeReason || req.body.reason || "Administrative update";
        const changedBy = req.user?.userId || req.user?.id || null;

        // 1. Designation Promotion
        const oldDesig = employee.designation || employee.employment?.designation || "";
        const newDesig = updates.employment?.designation || updates.designation;
        if (newDesig && oldDesig && newDesig.toLowerCase() !== oldDesig.toLowerCase()) {
            await logEmployeeHistory({
                employeeId: employee.id,
                changeType: "PROMOTION",
                fieldChanged: "designation",
                oldValue: oldDesig,
                newValue: newDesig,
                effectiveDate,
                reason: changeReason,
                changedBy,
                metadata: { previousDesignation: oldDesig, newDesignation: newDesig }
            }).catch(console.error);
        }

        // 2. Department Transfer
        const oldDept = employee.department || employee.employment?.department || "";
        const newDept = updates.employment?.department || updates.department;
        if (newDept && oldDept && newDept.toLowerCase() !== oldDept.toLowerCase()) {
            await logEmployeeHistory({
                employeeId: employee.id,
                changeType: "TRANSFER",
                fieldChanged: "department",
                oldValue: oldDept,
                newValue: newDept,
                effectiveDate,
                reason: changeReason,
                changedBy,
                metadata: { previousDepartment: oldDept, newDepartment: newDept }
            }).catch(console.error);
        }

        // 3. Salary Revision
        const oldSalary = employee.employment?.salary;
        const newSalary = updates.employment?.salary;
        if (newSalary !== undefined && oldSalary !== undefined && Number(newSalary) !== Number(oldSalary)) {
            await logEmployeeHistory({
                employeeId: employee.id,
                changeType: "SALARY_REVISION",
                fieldChanged: "salary",
                oldValue: String(oldSalary),
                newValue: String(newSalary),
                effectiveDate,
                reason: changeReason,
                changedBy,
                metadata: { previousSalary: oldSalary, newSalary }
            }).catch(console.error);
        }

        // 4. Reporting Manager Change
        if (updates.reports_to !== undefined && updates.reports_to !== employee.reports_to) {
            await logEmployeeHistory({
                employeeId: employee.id,
                changeType: "MANAGER_CHANGE",
                fieldChanged: "reports_to",
                oldValue: String(employee.reports_to || "None"),
                newValue: String(updates.reports_to || "None"),
                effectiveDate,
                reason: changeReason,
                changedBy,
                metadata: { previousManagerId: employee.reports_to, newManagerId: updates.reports_to }
            }).catch(console.error);
        }

        const updated = await updateEmployeeRecord(employee.id, updates);
        const formatted = formatEmployeeResponse(await findEmployeeById(updated.id));

        return res.status(200).json({
            success: true,
            message: "Employee updated successfully",
            data: formatted
        });
    } catch (error) {
        console.error("UPDATE EMPLOYEE ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to update employee",
            error: error.message
        });
    }
};

// =====================================================
// 4b. EMPLOYEE HISTORY CONTROLLERS
// =====================================================
export const getEmployeeHistoryController = async (req, res) => {
    try {
        const { id } = req.params;
        const currentUserId = req.user?.userId || req.user?.id;
        const currentUserRole = (req.user?.role || "").toLowerCase();

        let employee;
        if (id === "me") {
            employee = await findEmployeeByUserId(currentUserId);
        } else if (!isNaN(id)) {
            employee = await findEmployeeById(Number(id));
        } else {
            employee = await findEmployeeByCode(id);
        }

        if (!employee) {
            return res.status(404).json({ success: false, message: "Employee not found" });
        }

        const isSelf = employee.user_id && Number(employee.user_id) === Number(currentUserId);
        const canViewCompensation = isSelf || ["admin", "superadmin", "hr", "finance"].includes(currentUserRole);

        let history = await getEmployeeHistory(employee.id);

        if (!canViewCompensation) {
            history = history.map(item => {
                if (item.change_type === "SALARY_REVISION" || item.field_changed === "salary") {
                    return {
                        ...item,
                        old_value: "••••••",
                        new_value: "••••••",
                        metadata: { restricted: true }
                    };
                }
                return item;
            });
        }

        return res.status(200).json({ success: true, count: history.length, data: history });
    } catch (error) {
        console.error("GET EMPLOYEE HISTORY ERROR:", error);
        return res.status(500).json({ success: false, message: "Failed to retrieve employee history" });
    }
};

export const addEmployeeHistoryRecordController = async (req, res) => {
    try {
        const { id } = req.params;
        let employee;
        if (id === "me") {
            employee = await findEmployeeByUserId(req.user?.userId || req.user?.id);
        } else if (!isNaN(id)) {
            employee = await findEmployeeById(Number(id));
        } else {
            employee = await findEmployeeByCode(id);
        }
        if (!employee) {
            return res.status(404).json({ success: false, message: "Employee not found" });
        }

        const { changeType, fieldChanged, oldValue, newValue, effectiveDate, reason, metadata } = req.body;
        const record = await logEmployeeHistory({
            employeeId: employee.id,
            changeType: changeType || "EMPLOYMENT_UPDATE",
            fieldChanged: fieldChanged || "",
            oldValue: oldValue || "",
            newValue: newValue || "",
            effectiveDate: effectiveDate || new Date().toISOString().slice(0, 10),
            reason: reason || "Manual administrative history entry",
            changedBy: req.user?.userId || req.user?.id || null,
            metadata: metadata || {}
        });

        return res.status(201).json({ success: true, message: "History record created successfully", data: record });
    } catch (error) {
        console.error("ADD EMPLOYEE HISTORY ERROR:", error);
        return res.status(500).json({ success: false, message: "Failed to record employee history" });
    }
};

// =====================================================
// 5. DELETE EMPLOYEE
// =====================================================
export const deleteEmployee = async (req, res) => {
    try {
        const { id } = req.params;
        const empId = Number(id);
        const employee = await findEmployeeById(empId);

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            });
        }

        await deleteEmployeeRecord(empId);
        return res.status(200).json({
            success: true,
            message: "Employee deleted successfully"
        });
    } catch (error) {
        console.error("DELETE EMPLOYEE ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to delete employee",
            error: error.message
        });
    }
};

// =====================================================
// 6. GET MY PROFILE
// =====================================================
export const getMyProfile = async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        const user = await findUserById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User profile not found"
            });
        }

        let employee = await findEmployeeByUserId(user.id);
        if (!employee && user.email) {
            employee = await findEmployeeByEmail(user.email);
            if (employee && !employee.user_id) {
                await updateEmployeeRecord(employee.id, { user_id: user.id });
                employee = await findEmployeeById(employee.id);
            }
        }

        if (!employee) {
            const count = await countEmployees();
            const generatedCode = `EMP${String(count + 1).padStart(3, "0")}`;
            const nameParts = (user.name || "Employee User").trim().split(" ");
            const firstName = nameParts[0] || "Employee";
            const lastName = nameParts.slice(1).join(" ") || "";

            const newEmp = await createEmployeeRecord({
                userId: user.id,
                employeeCode: generatedCode,
                firstName,
                lastName,
                email: user.email,
                employment: {
                    department: "Engineering",
                    designation: "Software Engineer",
                    joiningDate: new Date().toISOString().slice(0, 10),
                    employmentType: "Full Time",
                    status: "Active"
                }
            });

            employee = await findEmployeeById(newEmp.id);
        }

        return res.status(200).json({
            success: true,
            employee: formatEmployeeResponse(employee)
        });
    } catch (error) {
        console.error("GET MY PROFILE ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to get profile",
            error: error.message
        });
    }
};

// =====================================================
// 7. UPDATE MY PROFILE
// =====================================================
export const updateMyProfile = async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        let employee = await findEmployeeByUserId(userId);

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee profile not found"
            });
        }

        const updates = {};
        if (req.body.firstName) updates.first_name = req.body.firstName.trim();
        if (req.body.lastName !== undefined) updates.last_name = req.body.lastName.trim();
        if (req.body.phone !== undefined) updates.phone = String(req.body.phone).trim();
        if (req.body.workLocation !== undefined) {
            updates.work_location = String(req.body.workLocation).trim();
        }
        if (req.body.employment?.workLocation !== undefined) {
            updates.employment = {
                ...(employee.employment || {}),
                workLocation: String(req.body.employment.workLocation).trim()
            };
        }
        if (req.body.profilePhoto) updates.profile_photo = req.body.profilePhoto;
        if (req.body.personal) updates.personal = { ...(employee.personal || {}), ...req.body.personal };
        if (req.body.address) updates.address = { ...(employee.address || {}), ...req.body.address };
        if (req.body.emergencyContact) updates.emergency_contact = { ...(employee.emergency_contact || {}), ...req.body.emergencyContact };
        if (req.body.skills) updates.skills = req.body.skills;
        if (req.body.certifications) updates.certifications = req.body.certifications;
        if (req.body.awards) updates.awards = req.body.awards;

        const updated = await updateEmployeeRecord(employee.id, updates);
        const formatted = formatEmployeeResponse(await findEmployeeById(updated.id));

        return res.status(200).json({
            success: true,
            message: "Profile updated successfully",
            employee: formatted
        });
    } catch (error) {
        console.error("UPDATE MY PROFILE ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to update profile",
            error: error.message
        });
    }
};

// =====================================================
// 8. UPLOAD MY PROFILE PHOTO
// =====================================================
export const uploadMyProfilePhoto = async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Please select a profile picture"
            });
        }

        let employee = await findEmployeeByUserId(userId);
        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee profile not found"
            });
        }

        const profilePhoto = `/uploads/profile-pictures/${req.file.filename}`;
        await updateEmployeeRecord(employee.id, { profile_photo: profilePhoto });
        const updated = await findEmployeeById(employee.id);

        return res.status(200).json({
            success: true,
            message: "Profile picture uploaded successfully",
            profilePhoto,
            employee: formatEmployeeResponse(updated)
        });
    } catch (error) {
        console.error("UPLOAD PROFILE PHOTO ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to upload profile picture",
            error: error.message
        });
    }
};

export const uploadEmployeeProfilePhoto = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Please select a profile picture"
            });
        }

        const { id } = req.params;
        const employee = !isNaN(id)
            ? await findEmployeeById(Number(id))
            : await findEmployeeByCode(id);
        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            });
        }

        const profilePhoto = `/uploads/profile-pictures/${req.file.filename}`;
        await updateEmployeeRecord(employee.id, { profile_photo: profilePhoto });
        const updated = await findEmployeeById(employee.id);

        return res.status(200).json({
            success: true,
            message: "Employee profile picture uploaded successfully",
            profilePhoto,
            employee: formatEmployeeResponse(updated)
        });
    } catch (error) {
        console.error("UPLOAD EMPLOYEE PROFILE PHOTO ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to upload employee profile picture",
            error: error.message
        });
    }
};

// =====================================================
// 9. DELETE MY PROFILE PHOTO
// =====================================================
export const deleteMyProfilePhoto = async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        const employee = await findEmployeeByUserId(userId);

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee profile not found"
            });
        }

        await updateEmployeeRecord(employee.id, { profile_photo: "" });
        const updated = await findEmployeeById(employee.id);

        return res.status(200).json({
            success: true,
            message: "Profile picture deleted successfully",
            employee: formatEmployeeResponse(updated)
        });
    } catch (error) {
        console.error("DELETE PROFILE PHOTO ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to delete profile picture",
            error: error.message
        });
    }
};
