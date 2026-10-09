import bcrypt from "bcryptjs";
import { createUser, findUserByEmail, findUserById } from "../repositories/userRepository.js";
import generateJwt from "../utils/generateJwt.js";


// Allowed Roles
const ALLOWED_ROLES = ["admin", "hr", "manager", "employee"];

// @desc    Register a new user
// @route   POST /api/auth/signup
export const signup = async (req, res) => {
    try {
        const { name, email, password, role = "employee" } = req.body;

        // Validation
        if (!name || !email || !password) {
            return res.status(400).json({ message: "Name, email, and password are required." });
        }

        const trimmedName = name.trim();
        if (trimmedName.length < 3 || trimmedName.length > 30) {
            return res.status(400).json({ message: "Name must be between 3 and 30 characters." });
        }

        if (password.length < 6) {
            return res.status(400).json({ message: "Password must be at least 6 characters." });
        }

        if (role && !ALLOWED_ROLES.includes(role)) {
            return res.status(400).json({ message: `Role must be one of: ${ALLOWED_ROLES.join(", ")}` });
        }

        // Check if user already exists
        const existingUser = await findUserByEmail(email);
        if (existingUser) {
            return res.status(400).json({ message: "User with this email already exists." });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Save user to database
        const user = await createUser({
            name: trimmedName,
            email,
            password: passwordHash,
            role,
            isActive: true
        });

        // Generate JWT token
        const token = generateJwt(user.id, user.role);

        res.status(201).json({
            message: "User registered successfully",
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                isActive: user.is_active,
                created_at: user.created_at
            }
        });
    } catch (error) {
        console.error("Signup error:", error);
        res.status(500).json({ message: "Server error during registration", error: error.message });
    }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required." });
        }

        // Check user existence
        const user = await findUserByEmail(email);
        if (!user) {
            return res.status(401).json({ message: "Invalid email or password." });
        }

        // Check account active status
        if (user.is_active === false) {
            return res.status(403).json({ message: "Account is inactive. Please contact your administrator." });
        }

        // Verify password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid email or password." });
        }

        // Generate JWT token
        const token = generateJwt(user.id, user.role);

        res.status(200).json({
            message: "Login successful",
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                isActive: user.is_active,
                created_at: user.created_at
            }
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ message: "Server error during login", error: error.message });
    }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
export const getMe = async (req, res) => {
    try {
        const user = await findUserById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }
        res.status(200).json({ user });
    } catch (error) {
        console.error("Get profile error:", error);
        res.status(500).json({ message: "Server error retrieving profile", error: error.message });
    }
};
