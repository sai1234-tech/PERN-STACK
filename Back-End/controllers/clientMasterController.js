import {
    findAllClients,
    findClientById,
    createClientRecord,
    updateClientRecord,
    deleteClientRecord,
    findAllClientProjects,
    createClientProjectRecord,
    updateClientProjectRecord,
    deleteClientProjectRecord,
    findAllRateCards,
    createRateCardRecord,
    deleteRateCardRecord,
    findAllTransitions,
    createTransitionRecord,
    updateTransitionRecord
} from "../repositories/clientMasterRepository.js";

/* -------------------------------------------------------------
   CLIENTS
------------------------------------------------------------- */
export const getClients = async (_req, res) => {
    try {
        const clients = await findAllClients();
        return res.status(200).json({ success: true, data: clients });
    } catch (err) {
        console.error("Error fetching clients:", err);
        return res.status(500).json({ success: false, message: "Failed to fetch clients." });
    }
};

export const createClient = async (req, res) => {
    try {
        const {
            clientCode,
            clientName,
            accountOwnerId,
            accountOwnerName,
            clientManagerName,
            clientManagerEmail,
            status,
            msaReference
        } = req.body;

        if (!clientCode || !clientName) {
            return res.status(400).json({ success: false, message: "Client Code and Client Name are required." });
        }

        const client = await createClientRecord({
            clientCode: String(clientCode).trim(),
            clientName: String(clientName).trim(),
            accountOwnerId,
            accountOwnerName,
            clientManagerName,
            clientManagerEmail,
            status,
            msaReference
        });

        return res.status(201).json({
            success: true,
            message: "Client created successfully.",
            data: client
        });
    } catch (err) {
        console.error("Error creating client:", err);
        return res.status(500).json({ success: false, message: err.message || "Failed to create client." });
    }
};

export const updateClient = async (req, res) => {
    try {
        const { id } = req.params;
        const updated = await updateClientRecord(id, req.body);
        return res.status(200).json({
            success: true,
            message: "Client updated successfully.",
            data: updated
        });
    } catch (err) {
        console.error("Error updating client:", err);
        return res.status(500).json({ success: false, message: "Failed to update client." });
    }
};

export const deleteClient = async (req, res) => {
    try {
        const { id } = req.params;
        await deleteClientRecord(id);
        return res.status(200).json({ success: true, message: "Client deleted successfully." });
    } catch (err) {
        console.error("Error deleting client:", err);
        return res.status(500).json({ success: false, message: "Failed to delete client." });
    }
};

/* -------------------------------------------------------------
   CLIENT PROJECTS & SOWs
------------------------------------------------------------- */
export const getClientProjects = async (_req, res) => {
    try {
        const projects = await findAllClientProjects();
        return res.status(200).json({ success: true, data: projects });
    } catch (err) {
        console.error("Error fetching client projects:", err);
        return res.status(500).json({ success: false, message: "Failed to fetch client projects." });
    }
};

export const createClientProject = async (req, res) => {
    try {
        const {
            projectCode,
            clientId,
            clientName,
            projectName,
            sowNumber,
            billingType,
            startDate,
            endDate,
            deliveryManagerId,
            deliveryManagerName,
            budgetedHours,
            status
        } = req.body;

        if (!projectCode || !projectName || !sowNumber) {
            return res.status(400).json({
                success: false,
                message: "Project Code, Project Name, and SOW Number are required."
            });
        }

        const project = await createClientProjectRecord({
            projectCode: String(projectCode).trim(),
            clientId,
            clientName: clientName || "Enterprise Client",
            projectName: String(projectName).trim(),
            sowNumber: String(sowNumber).trim(),
            billingType: billingType || "T&M",
            startDate: startDate || new Date().toISOString().slice(0, 10),
            endDate: endDate || new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10),
            deliveryManagerId,
            deliveryManagerName,
            budgetedHours: Number(budgetedHours) || 0,
            status: status || "Active"
        });

        return res.status(201).json({
            success: true,
            message: "Project SOW created successfully.",
            data: project
        });
    } catch (err) {
        console.error("Error creating project:", err);
        return res.status(500).json({ success: false, message: err.message || "Failed to create project." });
    }
};

export const updateClientProject = async (req, res) => {
    try {
        const { id } = req.params;
        const updated = await updateClientProjectRecord(id, req.body);
        return res.status(200).json({
            success: true,
            message: "Project updated successfully.",
            data: updated
        });
    } catch (err) {
        console.error("Error updating project:", err);
        return res.status(500).json({ success: false, message: "Failed to update project." });
    }
};

export const deleteClientProject = async (req, res) => {
    try {
        const { id } = req.params;
        await deleteClientProjectRecord(id);
        return res.status(200).json({ success: true, message: "Project deleted successfully." });
    } catch (err) {
        console.error("Error deleting project:", err);
        return res.status(500).json({ success: false, message: "Failed to delete project." });
    }
};

/* -------------------------------------------------------------
   RESTRICTED RATE-CARDS (RBAC PROTECTED)
------------------------------------------------------------- */
const COMMERCIAL_PRIVILEGED_ROLES = ["admin", "super_admin", "finance", "payroll", "leadership", "hr"];

export const getRateCards = async (req, res) => {
    try {
        const userRole = String(req.user?.role || "").toLowerCase().trim();
        const canViewCommercials = COMMERCIAL_PRIVILEGED_ROLES.includes(userRole);

        const rows = await findAllRateCards();
        const rateCards = rows.map(r => {
            if (!canViewCommercials) {
                return {
                    ...r,
                    hourly_billing_rate: "••••••",
                    monthly_billing_rate: "••••••",
                    isRestricted: true
                };
            }
            return {
                ...r,
                isRestricted: false
            };
        });

        return res.status(200).json({
            success: true,
            data: rateCards,
            canManageCommercials: canViewCommercials
        });
    } catch (err) {
        console.error("Error fetching rate cards:", err);
        return res.status(500).json({ success: false, message: "Failed to fetch rate cards." });
    }
};

export const createRateCard = async (req, res) => {
    try {
        const userRole = String(req.user?.role || "").toLowerCase().trim();
        if (!COMMERCIAL_PRIVILEGED_ROLES.includes(userRole)) {
            return res.status(403).json({ success: false, message: "Access denied. Rate-card management is restricted to Finance/Leadership/HR." });
        }

        const {
            clientId,
            projectId,
            clientName,
            projectName,
            sowNumber,
            roleTitle,
            hourlyBillingRate,
            monthlyBillingRate,
            currency,
            effectiveDate
        } = req.body;

        if (!roleTitle || !hourlyBillingRate) {
            return res.status(400).json({ success: false, message: "Role Title and Hourly Billing Rate are required." });
        }

        const parsedClientId = clientId && !isNaN(Number(clientId)) ? Number(clientId) : null;
        const parsedProjectId = projectId && !isNaN(Number(projectId)) ? Number(projectId) : null;
        const rateVal = Number(hourlyBillingRate);
        if (isNaN(rateVal) || rateVal <= 0) {
            return res.status(400).json({ success: false, message: "Hourly Billing Rate must be a valid positive number." });
        }

        const resolvedProjectName = projectName?.trim() || (sowNumber ? `SOW Deliverable (${sowNumber})` : "Client Engagement");

        const rateCard = await createRateCardRecord({
            clientId: parsedClientId,
            projectId: parsedProjectId,
            clientName: clientName?.trim() || "Enterprise Client",
            projectName: resolvedProjectName,
            sowNumber: sowNumber ? String(sowNumber).trim() : "",
            roleTitle: String(roleTitle).trim(),
            hourlyBillingRate: rateVal,
            monthlyBillingRate: Number(monthlyBillingRate) || rateVal * 160,
            currency: currency || "USD",
            effectiveDate: effectiveDate || new Date()
        });

        return res.status(201).json({
            success: true,
            message: "Rate card entry created successfully.",
            data: rateCard
        });
    } catch (err) {
        console.error("Error creating rate card:", err);
        return res.status(500).json({ success: false, message: err.message || "Failed to create rate card." });
    }
};

export const deleteRateCard = async (req, res) => {
    try {
        const userRole = String(req.user?.role || "").toLowerCase().trim();
        if (!COMMERCIAL_PRIVILEGED_ROLES.includes(userRole)) {
            return res.status(403).json({ success: false, message: "Access denied." });
        }

        const { id } = req.params;
        await deleteRateCardRecord(id);
        return res.status(200).json({ success: true, message: "Rate card entry deleted." });
    } catch (err) {
        console.error("Error deleting rate card:", err);
        return res.status(500).json({ success: false, message: "Failed to delete rate card." });
    }
};

/* -------------------------------------------------------------
   TRANSITIONS & REPLACEMENTS
------------------------------------------------------------- */
export const getTransitions = async (_req, res) => {
    try {
        const transitions = await findAllTransitions();
        return res.status(200).json({ success: true, data: transitions });
    } catch (err) {
        console.error("Error fetching transitions:", err);
        return res.status(500).json({ success: false, message: "Failed to fetch transitions." });
    }
};

export const createTransition = async (req, res) => {
    try {
        const {
            allocationId,
            empId,
            employeeName,
            clientName,
            projectName,
            sowNumber,
            transitionType,
            replacementEmpId,
            replacementEmpName,
            ktStartDate,
            ktEndDate,
            ktStatus,
            clientApprovalStatus,
            notes
        } = req.body;

        if (!empId || !employeeName) {
            return res.status(400).json({ success: false, message: "Employee ID and Name are required." });
        }

        const transition = await createTransitionRecord({
            allocationId,
            empId: String(empId).trim(),
            employeeName: String(employeeName).trim(),
            clientName: clientName || "Enterprise Client",
            projectName: projectName || "Active Engagement",
            sowNumber,
            transitionType: transitionType || "Roll-off",
            replacementEmpId: replacementEmpId || "",
            replacementEmpName: replacementEmpName || "",
            ktStartDate: ktStartDate || null,
            ktEndDate: ktEndDate || null,
            ktStatus: ktStatus || "In Progress",
            clientApprovalStatus: clientApprovalStatus || "Pending",
            notes: notes || ""
        });

        return res.status(201).json({
            success: true,
            message: "Transition workflow initiated successfully.",
            data: transition
        });
    } catch (err) {
        console.error("Error creating transition:", err);
        return res.status(500).json({ success: false, message: "Failed to initiate transition." });
    }
};

export const updateTransition = async (req, res) => {
    try {
        const { id } = req.params;
        const updated = await updateTransitionRecord(id, req.body);
        return res.status(200).json({
            success: true,
            message: "Transition record updated.",
            data: updated
        });
    } catch (err) {
        console.error("Error updating transition:", err);
        return res.status(500).json({ success: false, message: "Failed to update transition." });
    }
};
