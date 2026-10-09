import express from "express";
import { getMyEvents, createEvent, deleteEvent } from "../controllers/eventController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(verifyToken);

router.get("/my", getMyEvents);
router.post("/", createEvent);
router.delete("/:id", deleteEvent);

export default router;
