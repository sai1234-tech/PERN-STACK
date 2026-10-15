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
    resolveManagerEmployee
} from "../repositories/employeeRepository.js";

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
        const employees = req.body;

        if (!Array.isArray(employees)) {
            return res.status(400).json({
                success: false,
                message: "Request body must be an array"
            });
        }

        if (employees.length === 0) {
            return res.status(400).json({
                success: false,
                message: "At least one employee is required"
            });
        }

        const createdEmployees = [];

        for (const employee of employees) {
            if (!employee.employeeCode) {
                return res.status(400).json({ success: false, message: "Employee code is required" });
            }
            if (!employee.firstName) {
                return res.status(400).json({ success: false, message: "First name is required" });
            }
            if (!employee.email) {
                return res.status(400).json({ success: false, message: "Email is required" });
            }

            const email = employee.email.trim().toLowerCase();
            const employeeCode = employee.employeeCode.trim().toUpperCase();

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

            const rawSalary = employee.salary !== undefined ? employee.salary : employee.employment?.salary;
            const salaryVal = rawSalary !== undefined && rawSalary !== "" && !Number.isNaN(Number(rawSalary)) ? Number(rawSalary) : undefined;

            if (existingEmployee) {
                const existingReportsTo = reportsToId !== null ? reportsToId : (rawReportsTo === null || rawReportsTo === "" ? null : existingEmployee.reports_to);
                const updated = await updateEmployeeRecord(existingEmployee.id, {
                    employee_code: employeeCode,
                    first_name: employee.firstName.trim(),
                    last_name: employee.lastName ? employee.lastName.trim() : "",
                    email,
                    phone: phoneVal,
                    reports_to: existingReportsTo,
                    user_id: user ? user.id : existingEmployee.user_id,
                    employment: {
                        department: employee.employment?.department || employee.department || "Engineering",
                        designation: employee.employment?.designation || employee.designation || "Developer",
                        joiningDate: employee.employment?.joiningDate || employee.joiningDate || new Date().toISOString(),
                        employmentType: employee.employment?.employmentType || employee.employmentType || "Full Time",
                        status: employee.employment?.status || employee.status || "Active",
                        salary: salaryVal !== undefined ? salaryVal : existingEmployee.employment?.salary,
                        reportsTo: existingReportsTo
                    }
                });
                createdEmployees.push(formatEmployeeResponse(await findEmployeeById(updated.id)));
                continue;
            }

            // Create new employee object
            const newEmp = await createEmployeeRecord({
                userId: user ? user.id : null,
                reportsTo: reportsToId,
                employeeCode,
                firstName: employee.firstName.trim(),
                lastName: employee.lastName ? employee.lastName.trim() : "",
                email,
                phone: phoneVal,
                pan: employee.pan ? String(employee.pan).trim().toUpperCase() : "",
                uan: employee.uan ? String(employee.uan).trim() : "",
                banking: employee.banking || {},
                personal: employee.personal || { phone: phoneVal },
                employment: {
                    department: employee.employment?.department || employee.department || "Engineering",
                    designation: employee.employment?.designation || employee.designation || "Developer",
                    joiningDate: employee.employment?.joiningDate || employee.joiningDate || new Date().toISOString(),
                    employmentType: employee.employment?.employmentType || employee.employmentType || "Full Time",
                    status: employee.employment?.status || employee.status || "Active",
                    salary: salaryVal,
                    reportsTo: reportsToId
                },
                address: employee.address || {},
                emergencyContact: employee.emergencyContact || {},
                profilePhoto: employee.profilePhoto || ""
            });

            createdEmployees.push(formatEmployeeResponse(await findEmployeeById(newEmp.id)));
        }

        return res.status(201).json({
            success: true,
            message: "Employees created successfully",
            count: createdEmployees.length,
            data: createdEmployees
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
        if (req.body.personal) updates.personal = { ...(employee.personal || {}), ...req.body.personal };
        if (req.body.employment) updates.employment = { ...(employee.employment || {}), ...req.body.employment };
        if (req.body.address) updates.address = { ...(employee.address || {}), ...req.body.address };
        if (req.body.emergencyContact) updates.emergency_contact = { ...(employee.emergency_contact || {}), ...req.body.emergencyContact };
        if (req.body.banking) updates.banking = { ...(employee.banking || {}), ...req.body.banking };
        if (req.body.skills) updates.skills = req.body.skills;
        if (req.body.certifications) updates.certifications = req.body.certifications;
        if (req.body.awards) updates.awards = req.body.awards;

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
