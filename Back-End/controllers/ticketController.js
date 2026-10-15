import { findEmployeeByUserId } from "../repositories/employeeRepository.js";
import {
    createTicketRecord,
    findAllTickets,
    resolveTicketRecord,
    findMyTickets,
    findTicketByTicketId,
} from "../repositories/ticketRepository.js";

export const createTicket = async (req, res, next) => {
    try {
        let { empId, query } = req.body || {};

        if (!query || !query.trim()) {
            return res.status(400).json({ success: false, message: "Ticket query is required" });
        }

        if (!empId) {
            const userId = req.user?.userId || req.user?.id;
            const employee = userId ? await findEmployeeByUserId(userId) : null;
            empId = employee?.employee_code || req.user?.email || `USER-${userId || "ANON"}`;
        }

        const ticketId = `TICK-${Math.floor(Math.random() * 90000) + 10000}`;

        const newTicket = await createTicketRecord({
            ticketId,
            empId,
            query: query.trim(),
            status: "Open",
        });

        res.status(201).json({
            success: true,
            ticket: newTicket,
        });
    } catch (error) {
        next(error);
    }
};

export const getAllTickets = async (req, res, next) => {
    try {
        const tickets = await findAllTickets();
        res.status(200).json({
            success: true,
            count: tickets.length,
            tickets,
        });
    } catch (error) {
        next(error);
    }
};

export const resolveTicket = async (req, res, next) => {
    try {
        const { resolution } = req.body || {};

        const ticket = await resolveTicketRecord(req.params.id, resolution);

        if (!ticket) {
            return res.status(404).json({
                success: false,
                message: `No ticket found with id of ${req.params.id}`,
            });
        }

        res.status(200).json({
            success: true,
            ticket,
        });
    } catch (error) {
        next(error);
    }
};

export const getTicketById = async (req, res, next) => {
    try {
        const ticket = await findTicketByTicketId(req.params.id);
        if (!ticket) {
            return res.status(404).json({
                success: false,
                message: "Ticket not found or access denied",
            });
        }

        const role = String(req.user?.role || "").toLowerCase();
        const isPrivileged = ["admin", "hr"].includes(role);
        if (!isPrivileged) {
            const employee = await findEmployeeByUserId(req.user.userId || req.user.id);
            const employeeName = [employee?.first_name, employee?.last_name]
                .filter(Boolean)
                .join(" ")
                .trim()
                .toLowerCase();
            const employeeCode = String(employee?.employee_code || "").toLowerCase();
            const storedOwner = String(ticket.empId || "").toLowerCase();
            const ownerCode = storedOwner.match(/\b[a-z]{2,}-?\d{2,}\b/i)?.[0]?.toLowerCase() || "";
            const ownsTicket =
                storedOwner === String(req.user.userId || req.user.id).toLowerCase() ||
                Boolean(req.user.email && storedOwner.includes(String(req.user.email).toLowerCase())) ||
                Boolean(employeeName && storedOwner.includes(employeeName)) ||
                Boolean(employeeCode && ownerCode === employeeCode);

            if (!ownsTicket) {
                return res.status(404).json({
                    success: false,
                    message: "Ticket not found or access denied",
                });
            }
        }

        return res.status(200).json({ success: true, ticket });
    } catch (error) {
        next(error);
    }
};

export const getMyTickets = async (req, res, next) => {
    try {
        const employee = await findEmployeeByUserId(req.user.userId || req.user.id);

        const searchTerms = [String(req.user.userId || req.user.id)];
        if (req.user.name) searchTerms.push(req.user.name);
        if (req.user.email) searchTerms.push(req.user.email);

        if (employee) {
            if (employee.employee_code || employee.employeeCode) searchTerms.push(employee.employee_code || employee.employeeCode);
            const fullName = [employee.first_name || employee.firstName, employee.last_name || employee.lastName]
                .filter(Boolean)
                .join(" ")
                .trim();
            if (fullName) searchTerms.push(fullName);
        }

        const tickets = await findMyTickets(searchTerms);

        res.status(200).json({
            success: true,
            count: tickets.length,
            tickets,
        });
    } catch (error) {
        next(error);
    }
};
