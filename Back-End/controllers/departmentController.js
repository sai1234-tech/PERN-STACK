import {
    createMultipleDepartmentRecords,
    findAllDepartments,
    findDepartmentById,
    findDepartmentByCode,
    updateDepartmentRecord,
    deleteDepartmentRecord,
} from "../repositories/departmentRepository.js";

export const createMultipleDepartments = async (req, res, next) => {
    try {
        const departmentsData = req.body;

        if (!Array.isArray(departmentsData) || departmentsData.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Please provide an array of department details",
            });
        }

        const validationErrors = [];
        departmentsData.forEach((data, index) => {
            if (!data.departmentCode) {
                validationErrors.push(`Department ${index + 1}: Department code is required`);
            }
            if (!data.departmentName) {
                validationErrors.push(`Department ${index + 1}: Department name is required`);
            }
        });

        if (validationErrors.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Validation error",
                errors: validationErrors,
            });
        }

        const createdDepartments = await createMultipleDepartmentRecords(departmentsData);

        return res.status(201).json({
            success: true,
            message: `${createdDepartments.length} departments created successfully`,
            departments: createdDepartments,
        });
    } catch (error) {
        if (error.code === "23505") {
            return res.status(400).json({
                success: false,
                message: "Department code already exists",
            });
        }
        next(error);
    }
};

export const getDepartments = async (req, res, next) => {
    try {
        const search = req.query.search || "";
        const departments = await findAllDepartments(search);

        return res.status(200).json({
            success: true,
            message: "Departments fetched successfully",
            departments,
            search,
        });
    } catch (error) {
        next(error);
    }
};

export const getSingleDepartment = async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        if (!id || Number.isNaN(id)) {
            return res.status(400).json({ success: false, message: "Invalid department ID" });
        }

        const department = await findDepartmentById(id);
        if (!department) {
            return res.status(404).json({
                success: false,
                message: "Department not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Department fetched successfully",
            department,
        });
    } catch (error) {
        next(error);
    }
};

export const updateDepartment = async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        if (!id || Number.isNaN(id)) {
            return res.status(400).json({ success: false, message: "Invalid department ID" });
        }

        const department = await findDepartmentById(id);
        if (!department) {
            return res.status(404).json({
                success: false,
                message: "Department not found",
            });
        }

        const data = req.body || {};
        if (!data.departmentCode) {
            return res.status(400).json({
                success: false,
                message: "Department code is required",
            });
        }

        if (!data.departmentName) {
            return res.status(400).json({
                success: false,
                message: "Department name is required",
            });
        }

        const updated = await updateDepartmentRecord(id, data);

        return res.status(200).json({
            success: true,
            message: "Department updated successfully",
            department: updated,
        });
    } catch (error) {
        if (error.code === "23505") {
            return res.status(400).json({
                success: false,
                message: "Department code already exists",
            });
        }
        next(error);
    }
};

export const deleteDepartment = async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        if (!id || Number.isNaN(id)) {
            return res.status(400).json({ success: false, message: "Invalid department ID" });
        }

        const department = await deleteDepartmentRecord(id);
        if (!department) {
            return res.status(404).json({
                success: false,
                message: "Department not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Department deleted successfully",
        });
    } catch (error) {
        next(error);
    }
};
