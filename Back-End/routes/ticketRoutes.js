import express from "express";
import {
    createTicket,
    getAllTickets,
    resolveTicket,
    getMyTickets,
} from "../controllers/ticketController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

// All ticket routes require authentication
router.use(verifyToken);

// GET /api/tickets/my — Get tickets for the logged in employee
router.get("/my", getMyTickets);

// POST /api/tickets — Create ticket
// GET /api/tickets — Get all tickets (HR/Admin)
router.route("/")
    .post(createTicket)
    .get(authorizeRoles("hr", "admin"), getAllTickets);

// PUT /api/tickets/:id/resolve — Resolve ticket (HR/Admin only)
router.put("/:id/resolve", authorizeRoles("hr", "admin"), resolveTicket);

export default router;
