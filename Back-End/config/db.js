import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const pool = new Pool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "postgres",
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
    password: process.env.DB_PASSWORD || "199898",
    database: process.env.DB_NAME || "hrms_db"
});


export default pool;
