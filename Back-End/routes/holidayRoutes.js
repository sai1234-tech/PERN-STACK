import express from "express";
import {
    getAllHolidays,
    createHoliday,
    updateHoliday,
    deleteHoliday,
    seedHolidays,
    getGoogleCalendarHolidays,
    syncGoogleHolidays,
} from "../controllers/holidayController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

// Seeder route (for easy setup)
router.post("/seed", seedHolidays);

// Dynamic live Google Calendar public feed (accessible without or with token)
router.get("/google-live", getGoogleCalendarHolidays);

router.use(verifyToken);

// Employee route (view holidays)
router.get("/", getAllHolidays);

// Sync live Google Calendar holidays to database (accessible to all authenticated users or HR/Admin)
router.post("/sync-google", syncGoogleHolidays);

// HR/Admin routes (manage holidays: create, edit, delete)
router.post("/", authorizeRoles("hr", "admin"), createHoliday);
router.put("/:id", authorizeRoles("hr", "admin"), updateHoliday);
router.delete("/:id", authorizeRoles("hr", "admin"), deleteHoliday);

export default router;

