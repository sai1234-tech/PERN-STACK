import express from "express";
import {
  getConnectors,
  getIntegrationSummary,
  getConnectorDetail,
  triggerConnectorSync,
  updateConnector
} from "../controllers/integrationController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

import jwt from "jsonwebtoken";
import { findUserById } from "../repositories/userRepository.js";

// Optional Auth middleware allowing dashboard overview with public context or verified user
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    let token = null;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else if (req.query?.token) {
      token = req.query.token;
    }

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "default_jwt_secret");
      const user = await findUserById(decoded.userId);
      if (user && user.is_active !== false) {
        req.user = { ...decoded, userId: user.id, role: user.role };
      }
    }
  } catch (err) {
    // Stale/expired token: ignore error for optional endpoints so dashboard telemetry loads
    req.user = null;
  }
  next();
};

// 1. Integration Connectors Overview & Summary
router.get("/", optionalAuth, getConnectors);
router.get("/summary", optionalAuth, getIntegrationSummary);

// 2. Specific Connector Detail & Telemetry
router.get("/:connectorKey", optionalAuth, getConnectorDetail);

// 3. Trigger Instant On-Demand Real-Time Sync
router.post("/:connectorKey/sync", optionalAuth, triggerConnectorSync);

// 4. Update Connector Settings & Protocols
router.put("/:connectorKey", optionalAuth, updateConnector);

export default router;
