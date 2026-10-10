import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

// Prevent pg from converting DATE columns (type 1082) into UTC JS Date objects
pg.types.setTypeParser(1082, (val) => val);

const pool = new pg.Pool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "postgres",
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
    password: process.env.DB_PASSWORD || "199898",
    database: process.env.DB_NAME || "hrms_db"
});

export default pool;

