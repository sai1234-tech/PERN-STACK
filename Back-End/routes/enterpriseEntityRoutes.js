import express from "express";
import {
  getEntitiesOverview,
  getEntitySchema,
  getEntityRecords,
  createEntityRecord,
  updateEntityRecord,
  deleteEntityRecord
} from "../controllers/enterpriseEntityController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// Middleware: verifies token if present, else allows read access with public context
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return verifyToken(req, res, next);
  }
  next();
};

// 1. Get live status & counts for all 41 entities
router.get("/overview", optionalAuth, getEntitiesOverview);

// 2. Get live PostgreSQL column schema for an entity
router.get("/:entityKey/schema", optionalAuth, getEntitySchema);

// 3. Query real-time records for any entity
router.get("/:entityKey", optionalAuth, getEntityRecords);

// 3. Create record for an entity
router.post("/:entityKey", optionalAuth, createEntityRecord);

// 4. Update record by id for an entity
router.put("/:entityKey/:id", optionalAuth, updateEntityRecord);

// 5. Delete record by id for an entity
router.delete("/:entityKey/:id", optionalAuth, deleteEntityRecord);

export default router;
