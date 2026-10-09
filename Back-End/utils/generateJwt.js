import jwt from "jsonwebtoken";

const generateJwt = (userId, role) => {
    return jwt.sign(
        { userId, role },
        process.env.JWT_SECRET || "default_jwt_secret",
        { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
    );
};

export default generateJwt;
