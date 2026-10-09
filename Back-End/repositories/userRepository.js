import pool from "../config/db.js";

export const initUserTable = async () => {
    const queryText = `
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            name VARCHAR(30) NOT NULL CHECK (char_length(name) >= 3),
            email VARCHAR(255) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            role VARCHAR(50) DEFAULT 'employee' CHECK (role IN ('admin', 'hr', 'manager', 'employee')),
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `;
    await pool.query(queryText);
};

export const createUser = async ({ name, email, password, role = "employee", isActive = true }) => {
    const queryText = `
        INSERT INTO users (name, email, password, role, is_active)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, name, email, role, is_active, created_at, updated_at;
    `;
    const values = [name.trim(), email.toLowerCase().trim(), password, role, isActive];
    const { rows } = await pool.query(queryText, values);
    return rows[0];
};

export const findUserByEmail = async (email) => {
    const queryText = `SELECT * FROM users WHERE LOWER(email) = LOWER($1);`;
    const { rows } = await pool.query(queryText, [email]);
    return rows[0];
};

export const findUserById = async (id) => {
    const queryText = `SELECT id, name, email, role, is_active, created_at, updated_at FROM users WHERE id = $1;`;
    const { rows } = await pool.query(queryText, [id]);
    return rows[0];
};

export const updateUserStatus = async (id, isActive) => {
    const queryText = `
        UPDATE users 
        SET is_active = $1, updated_at = CURRENT_TIMESTAMP 
        WHERE id = $2 
        RETURNING id, name, email, role, is_active, updated_at;
    `;
    const { rows } = await pool.query(queryText, [isActive, id]);
    return rows[0];
};
