import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
    try {
        console.log("Applying 024_data_migration_and_ingestion.sql...");
        const sqlPath = path.join(__dirname, '../migrations/024_data_migration_and_ingestion.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        await pool.query(sql);
        console.log("✓ Migration 024 applied successfully!");

        const tables = [
            'migration_sources',
            'migration_field_mappings',
            'migration_jobs',
            'migration_deduplication_logs',
            'migration_validation_errors',
            'migration_reconciliation_reports',
            'migration_signoffs'
        ];

        for (const t of tables) {
            const res = await pool.query(`SELECT COUNT(*) FROM ${t}`);
            console.log(`  Table ${t}: ready (current rows: ${res.rows[0].count})`);
        }

        process.exit(0);
    } catch (err) {
        console.error("Migration 024 failed:", err);
        process.exit(1);
    }
}

runMigration();
