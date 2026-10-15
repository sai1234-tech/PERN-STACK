import jwt from "jsonwebtoken";
import { findUserById } from "../repositories/userRepository.js";

export const verifyToken = async (req, res, next) => {
    let decoded;
    try {
        let token = null;
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith("Bearer ")) {
            token = authHeader.split(" ")[1];
        } else if (req.query?.token) {
            token = req.query.token;
        } else if (req.query?.accessToken) {
            token = req.query.accessToken;
        }

        if (!token) {
            return res.status(401).json({ message: "Access denied. No token provided." });
        }

        decoded = jwt.verify(token, process.env.JWT_SECRET || "default_jwt_secret");
    } catch (error) {
        return res.status(401).json({ message: "Invalid or expired token." });
    }

    try {
        const user = await findUserById(decoded.userId);
        if (!user) {
            return res.status(401).json({ message: "Account no longer exists." });
        }
        if (user.is_active === false) {
            return res.status(403).json({ message: "Account is inactive." });
        }

        req.user = { ...decoded, userId: user.id, role: user.role };
        return next();
    } catch (error) {
        console.error("Token account lookup error:", error);
        return res.status(500).json({ message: "Unable to verify account access." });
    }
};
