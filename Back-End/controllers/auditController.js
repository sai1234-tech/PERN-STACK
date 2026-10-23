import { findAllAuditLogs, logAuditRecord } from "../repositories/auditRepository.js";

export const getAuditLogs = async (req, res) => {
    try {
        const limit = Number(req.query.limit) || 100;
        const logs = await findAllAuditLogs(limit);
        return res.status(200).json({
            success: true,
            data: logs,
            count: logs.length
        });
    } catch (err) {
        console.error("Error fetching audit logs:", err);
        return res.status(500).json({ success: false, message: "Failed to fetch audit logs." });
    }
};

export const createAuditLog = async (req, res) => {
    try {
        const { action, entityType, entityId, details } = req.body;
        if (!action) {
            return res.status(400).json({ success: false, message: "Action name is required." });
        }

        const log = await logAuditRecord({
            action,
            entityType: entityType || "General",
            entityId: entityId || "",
            details: details || "",
            userName: req.user?.name || "HR Admin",
            userRole: req.user?.role || "hr",
            ipAddress: req.ip || ""
        });

        return res.status(201).json({
            success: true,
            data: log
        });
    } catch (err) {
        console.error("Error recording audit log:", err);
        return res.status(500).json({ success: false, message: "Failed to record audit log." });
    }
};
