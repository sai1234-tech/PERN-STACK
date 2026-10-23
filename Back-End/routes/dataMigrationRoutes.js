import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import {
    getSources,
    getFieldMappings,
    getSampleData,
    triggerTrialMigration,
    getJobs,
    getJobDetails,
    submitSignoff,
    triggerFinalMigration
} from "../controllers/dataMigrationController.js";

const router = express.Router();
router.use(verifyToken);

// Permitted roles: admin, hr, leadership
const MIGRATION_ROLES = ["admin", "super_admin", "hr", "hr_admin", "leadership"];

// 1. Identify legacy sources and security status
router.get("/sources", authorizeRoles(...MIGRATION_ROLES), getSources);

// 2. Field mappings registry
router.get("/field-mappings", authorizeRoles(...MIGRATION_ROLES), getFieldMappings);

// 3. Raw vs Cleaned sample preview
router.get("/sample-preview", authorizeRoles(...MIGRATION_ROLES), getSampleData);

// 4. Trigger trial migration & reconciliation
router.post("/trial-run", authorizeRoles(...MIGRATION_ROLES), triggerTrialMigration);

// 5. Jobs list & details
router.get("/jobs", authorizeRoles(...MIGRATION_ROLES), getJobs);
router.get("/jobs/:jobCode", authorizeRoles(...MIGRATION_ROLES), getJobDetails);

// 6. Record HR & Business Sign-Off
router.post("/signoff", authorizeRoles(...MIGRATION_ROLES), submitSignoff);

// 7. Execute final production migration
router.post("/final-run", authorizeRoles(...MIGRATION_ROLES), triggerFinalMigration);

export default router;
