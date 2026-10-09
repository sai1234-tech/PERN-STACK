import jwt from "jsonwebtoken";

export const verifyToken = (req, res, next) => {
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

        const decoded = jwt.verify(token, process.env.JWT_SECRET || "default_jwt_secret");
        
        req.user = decoded; // Contains userId and role
        next();
    } catch (error) {
        return res.status(401).json({ message: "Invalid or expired token." });
    }
};
