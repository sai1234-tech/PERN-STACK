import express from "express";
import {
    getClients,
    createClient,
    updateClient,
    deleteClient,
    getClientProjects,
    createClientProject,
    updateClientProject,
    deleteClientProject,
    getRateCards,
    createRateCard,
    deleteRateCard,
    getTransitions,
    createTransition,
    updateTransition
} from "../controllers/clientMasterController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

// Apply auth to all routes
router.use(verifyToken);

// 1. Clients
router.get("/clients", authorizeRoles("admin", "super_admin", "hr", "manager", "employee", "leadership"), getClients);
router.post("/clients", authorizeRoles("admin", "super_admin", "hr", "manager", "leadership"), createClient);
router.patch("/clients/:id", authorizeRoles("admin", "super_admin", "hr", "manager", "leadership"), updateClient);
router.delete("/clients/:id", authorizeRoles("admin", "super_admin", "hr"), deleteClient);

// 2. Projects & SOWs
router.get("/projects", authorizeRoles("admin", "super_admin", "hr", "manager", "employee", "leadership"), getClientProjects);
router.post("/projects", authorizeRoles("admin", "super_admin", "hr", "manager", "leadership"), createClientProject);
router.patch("/projects/:id", authorizeRoles("admin", "super_admin", "hr", "manager", "leadership"), updateClientProject);
router.delete("/projects/:id", authorizeRoles("admin", "super_admin", "hr"), deleteClientProject);

// 3. Commercial Rate Cards (Strict RBAC Protection)
router.get("/rate-cards", authorizeRoles("admin", "super_admin", "finance", "payroll", "leadership", "manager", "hr"), getRateCards);
router.post("/rate-cards", authorizeRoles("admin", "super_admin", "finance", "leadership"), createRateCard);
router.delete("/rate-cards/:id", authorizeRoles("admin", "super_admin", "finance"), deleteRateCard);

// 4. Transitions & Replacements
router.get("/transitions", authorizeRoles("admin", "super_admin", "hr", "manager", "leadership"), getTransitions);
router.post("/transitions", authorizeRoles("admin", "super_admin", "hr", "manager", "leadership"), createTransition);
router.patch("/transitions/:id", authorizeRoles("admin", "super_admin", "hr", "manager", "leadership"), updateTransition);

export default router;
