import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pool from "../config/db.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const sql = fs.readFileSync(path.join(dir, "../migrations/022_delivery_roadmap_and_ai_layer.sql"), "utf-8");
await pool.query(sql);
for (const t of ["delivery_phases", "delivery_deliverables", "ai_policy_documents", "ai_guardrail_rules"]) {
  const { rows } = await pool.query(`SELECT count(*) FROM ${t}`);
  console.log(`${t}: ${rows[0].count} rows`);
}
await pool.end();
