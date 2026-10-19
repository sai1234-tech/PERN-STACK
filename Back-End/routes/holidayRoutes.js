import express from "express";
import {
    getAllHolidays,
    createHoliday,
    deleteHoliday,
    seedHolidays,
} from "../controllers/holidayController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

// Seeder route (for easy setup)
router.post("/seed", seedHolidays);

router.use(verifyToken);

// Employee route (view holidays)
router.get("/", getAllHolidays);

// HR/Admin routes (manage holidays)
router.post("/", authorizeRoles("hr", "admin"), createHoliday);
router.delete("/:id", authorizeRoles("hr", "admin"), deleteHoliday);

export default router;

