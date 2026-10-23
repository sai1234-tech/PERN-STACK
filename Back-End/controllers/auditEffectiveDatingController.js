import crypto from "crypto";
import pool from "../config/db.js";

// Helper: generate unique sequential code
const generateCode = (prefix) => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${dateStr}-${rand}`;
};

// Helper: extract requester metadata
const extractClientMeta = (req) => {
  const ip = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "127.0.0.1";
  const userAgent = req.headers["user-agent"] || "PERN HRMS Enterprise Client";
  const channel = req.headers["x-client-channel"] || (req.body?.source_channel || "WEB_PORTAL");
  return { ip, userAgent, channel };
};

// =========================================================================
// 1. CRITICAL DATA CHANGE LOGGING
// =========================================================================

export const logCriticalDataChange = async (req, res, next) => {
  try {
    const {
      entity_type,
      entity_id,
      entity_name = "",
      action_type = "UPDATE",
      old_values = {},
      new_values = {},
      changed_fields = [],
      business_justification = "System data modification",
      criticality = "CRITICAL"
    } = req.body;

    if (!entity_type || !entity_id) {
      return res.status(400).json({
        success: false,
        message: "entity_type and entity_id are required"
      });
    }

    const { ip, userAgent, channel } = extractClientMeta(req);
    const userId = req.user?.userId || req.user?.id || req.body.user_id || null;
    const userName = req.user?.first_name 
      ? `${req.user.first_name} ${req.user.last_name || ""}`.trim()
      : (req.user?.name || req.body.user_name || "Enterprise Admin");
    const userEmail = req.user?.email || req.body.user_email || "admin@hrms.com";
    const userRole = req.user?.role || req.body.user_role || "super_admin";

    const changeCode = generateCode("CHG");

    const query = `
      INSERT INTO critical_data_change_logs (
        change_code, entity_type, entity_id, entity_name, action_type,
        user_id, user_name, user_email, user_role, source_ip, source_channel, source_user_agent,
        old_values, new_values, changed_fields, business_justification, criticality
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *;
    `;

    const values = [
      changeCode,
      entity_type,
      String(entity_id),
      entity_name,
      action_type,
      userId,
      userName,
      userEmail,
      userRole,
      ip,
      channel,
      userAgent,
      JSON.stringify(old_values),
      JSON.stringify(new_values),
      JSON.stringify(changed_fields),
      business_justification,
      criticality
    ];

    const { rows } = await pool.query(query, values);

    // Cryptographically chain this into immutable_audit_trail if table exists
    try {
      const prevBlock = await pool.query("SELECT sequence_number, curr_hash FROM immutable_audit_trail ORDER BY sequence_number DESC LIMIT 1");
      const prevSeq = prevBlock.rows.length ? Number(prevBlock.rows[0].sequence_number) : 0;
      const prevHash = prevBlock.rows.length ? prevBlock.rows[0].curr_hash : "0000000000000000000000000000000000000000000000000000000000000000";
      const newSeq = prevSeq + 1;
      const payloadString = `${newSeq}|${prevHash}|${action_type}|${entity_type}|${entity_id}|${business_justification}|${Date.now()}`;
      const currHash = crypto.createHash("sha256").update(payloadString).digest("hex");

      await pool.query(`
        INSERT INTO immutable_audit_trail (
          sequence_number, prev_hash, curr_hash, action, entity_type, entity_id,
          actor_id, actor_name, actor_role, details, before_state, after_state, ip_address, user_agent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `, [
        newSeq, prevHash, currHash, `CRITICAL_CHANGE_${action_type}`, entity_type, String(entity_id),
        userId, userName, userRole, `[${changeCode}] ${business_justification}`,
        JSON.stringify(old_values), JSON.stringify(new_values), ip, userAgent
      ]);
    } catch (chainErr) {
      console.warn("Audit chain append warning:", chainErr.message);
    }

    return res.status(201).json({
      success: true,
      message: "Critical data change successfully logged and cryptographically anchored",
      data: rows[0]
    });
  } catch (error) {
    return next(error);
  }
};

export const getCriticalDataChanges = async (req, res, next) => {
  try {
    const { entity_type, entity_id, criticality, search, limit = 50, offset = 0 } = req.query;

    let conditions = [];
    let params = [];
    let idx = 1;

    if (entity_type) {
      conditions.push(`entity_type = $${idx++}`);
      params.push(entity_type);
    }
    if (entity_id) {
      conditions.push(`entity_id = $${idx++}`);
      params.push(String(entity_id));
    }
    if (criticality) {
      conditions.push(`criticality = $${idx++}`);
      params.push(criticality);
    }
    if (search) {
      conditions.push(`(entity_name ILIKE $${idx} OR user_name ILIKE $${idx} OR business_justification ILIKE $${idx} OR change_code ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const countRes = await pool.query(`SELECT count(*) FROM critical_data_change_logs ${whereClause}`, params);
    const totalCount = parseInt(countRes.rows[0].count, 10);

    const query = `
      SELECT * FROM critical_data_change_logs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${idx++} OFFSET $${idx++};
    `;
    params.push(Number(limit), Number(offset));

    const { rows } = await pool.query(query, params);

    return res.status(200).json({
      success: true,
      total: totalCount,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    return next(error);
  }
};

// =========================================================================
// 2. IMMUTABLE APPROVAL DECISION HISTORY
// =========================================================================

export const recordApprovalDecision = async (req, res, next) => {
  try {
    const {
      workflow_type,
      entity_id,
      entity_title = "",
      requester_id = null,
      requester_name = "",
      step_number = 1,
      step_name = "Manager Approval",
      decision,
      comments,
      delegated_to_id = null,
      delegated_to_name = "",
      previous_status = "PENDING",
      resulting_status
    } = req.body;

    if (!workflow_type || !entity_id || !decision) {
      return res.status(400).json({
        success: false,
        message: "workflow_type, entity_id and decision are required"
      });
    }

    if (!comments || !comments.trim()) {
      return res.status(400).json({
        success: false,
        message: "Approval/Rejection comments are mandatory for regulatory audit compliance"
      });
    }

    const finalResultingStatus = resulting_status || (
      decision === "APPROVED" ? "APPROVED" :
      decision === "REJECTED" ? "REJECTED" :
      decision === "SENT_BACK" ? "NEEDS_REVISION" : "IN_PROGRESS"
    );

    const { ip, channel } = extractClientMeta(req);
    const approverId = req.user?.userId || req.user?.id || req.body.approver_id || null;
    const approverName = req.user?.first_name 
      ? `${req.user.first_name} ${req.user.last_name || ""}`.trim()
      : (req.user?.name || req.body.approver_name || "Authorized Approver");
    const approverEmail = req.user?.email || req.body.approver_email || "approver@hrms.com";
    const approverRole = req.user?.role || req.body.approver_role || "manager";

    const decisionCode = generateCode("DEC");

    const query = `
      INSERT INTO approval_decision_history (
        decision_code, workflow_type, entity_id, entity_title,
        requester_id, requester_name, step_number, step_name, decision,
        approver_id, approver_name, approver_email, approver_role, comments,
        delegated_to_id, delegated_to_name, previous_status, resulting_status,
        ip_address, source_channel
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING *;
    `;

    const values = [
      decisionCode,
      workflow_type,
      String(entity_id),
      entity_title,
      requester_id,
      requester_name,
      Number(step_number),
      step_name,
      decision,
      approverId,
      approverName,
      approverEmail,
      approverRole,
      comments.trim(),
      delegated_to_id,
      delegated_to_name,
      previous_status,
      finalResultingStatus,
      ip,
      channel
    ];

    const { rows } = await pool.query(query, values);

    // Also update approvals table if matching entry exists
    try {
      await pool.query(`
        UPDATE approvals
        SET status = $1, comments = $2, action_date = CURRENT_TIMESTAMP
        WHERE entity_id = $3 OR approval_code = $4
      `, [finalResultingStatus.toLowerCase(), comments, Number(entity_id) || 0, String(entity_id)]);
    } catch (ignore) {
      // approvals sync is best effort
    }

    return res.status(201).json({
      success: true,
      message: "Approval decision permanently recorded in audit ledger",
      data: rows[0]
    });
  } catch (error) {
    return next(error);
  }
};

export const getApprovalDecisions = async (req, res, next) => {
  try {
    const { workflow_type, entity_id, decision, search, limit = 50, offset = 0 } = req.query;

    let conditions = [];
    let params = [];
    let idx = 1;

    if (workflow_type) {
      conditions.push(`workflow_type = $${idx++}`);
      params.push(workflow_type);
    }
    if (entity_id) {
      conditions.push(`entity_id = $${idx++}`);
      params.push(String(entity_id));
    }
    if (decision) {
      conditions.push(`decision = $${idx++}`);
      params.push(decision);
    }
    if (search) {
      conditions.push(`(entity_title ILIKE $${idx} OR requester_name ILIKE $${idx} OR approver_name ILIKE $${idx} OR comments ILIKE $${idx} OR decision_code ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const countRes = await pool.query(`SELECT count(*) FROM approval_decision_history ${whereClause}`, params);
    const totalCount = parseInt(countRes.rows[0].count, 10);

    const query = `
      SELECT * FROM approval_decision_history
      ${whereClause}
      ORDER BY decided_at DESC
      LIMIT $${idx++} OFFSET $${idx++};
    `;
    params.push(Number(limit), Number(offset));

    const { rows } = await pool.query(query, params);

    return res.status(200).json({
      success: true,
      total: totalCount,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    return next(error);
  }
};

export const getApprovalChainByEntity = async (req, res, next) => {
  try {
    const { entityId } = req.params;
    const query = `
      SELECT * FROM approval_decision_history
      WHERE entity_id = $1
      ORDER BY step_number ASC, decided_at ASC;
    `;
    const { rows } = await pool.query(query, [String(entityId)]);

    return res.status(200).json({
      success: true,
      entity_id: entityId,
      chain_length: rows.length,
      data: rows
    });
  } catch (error) {
    return next(error);
  }
};

// =========================================================================
// 3. EFFECTIVE-DATED HISTORY LEDGER (TEMPORAL NON-OVERWRITING)
// =========================================================================

export const createEffectiveDatedRevision = async (req, res, next) => {
  try {
    const {
      entity_type,
      entity_id,
      entity_name = "",
      effective_from,
      change_reason,
      record_payload,
      diff_summary = {}
    } = req.body;

    if (!entity_type || !entity_id || !effective_from || !change_reason || !record_payload) {
      return res.status(400).json({
        success: false,
        message: "entity_type, entity_id, effective_from, change_reason, and record_payload are required"
      });
    }

    const userId = req.user?.userId || req.user?.id || null;
    const userName = req.user?.first_name 
      ? `${req.user.first_name} ${req.user.last_name || ""}`.trim()
      : (req.user?.name || req.body.created_by_name || "HR Operations Admin");

    // Begin database transaction for atomic version advancement
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // 1. Find currently active version for this entity
      const curQuery = `
        SELECT id, version_number, effective_from, record_payload
        FROM effective_dated_history
        WHERE entity_type = $1 AND entity_id = $2 AND is_current = TRUE
        ORDER BY version_number DESC
        LIMIT 1
        FOR UPDATE;
      `;
      const curRes = await client.query(curQuery, [entity_type, String(entity_id)]);

      let nextVersion = 1;
      let previousPayload = {};

      if (curRes.rows.length > 0) {
        const curRow = curRes.rows[0];
        nextVersion = Number(curRow.version_number) + 1;
        previousPayload = curRow.record_payload;

        // Close the previous record: effective_to = effective_from - 1 day, is_current = FALSE
        const closeQuery = `
          UPDATE effective_dated_history
          SET effective_to = ($1::date - INTERVAL '1 day')::date,
              is_current = FALSE
          WHERE id = $2;
        `;
        await client.query(closeQuery, [effective_from, curRow.id]);
      }

      // 2. Insert new version with effective_to = '9999-12-31' and is_current = TRUE
      const insertQuery = `
        INSERT INTO effective_dated_history (
          entity_type, entity_id, entity_name, version_number,
          effective_from, effective_to, is_current, change_reason,
          record_payload, diff_summary, created_by_id, created_by_name
        ) VALUES ($1, $2, $3, $4, $5, '9999-12-31', TRUE, $6, $7, $8, $9, $10)
        RETURNING *;
      `;
      const insertValues = [
        entity_type,
        String(entity_id),
        entity_name,
        nextVersion,
        effective_from,
        change_reason,
        JSON.stringify(record_payload),
        JSON.stringify(diff_summary),
        userId,
        userName
      ];
      const { rows } = await client.query(insertQuery, insertValues);

      // 3. Log into critical_data_change_logs to maintain seamless unified audit
      const changeCode = generateCode("CHG-REV");
      await client.query(`
        INSERT INTO critical_data_change_logs (
          change_code, entity_type, entity_id, entity_name, action_type,
          user_id, user_name, user_email, user_role, source_ip, source_channel, source_user_agent,
          old_values, new_values, changed_fields, business_justification, criticality
        ) VALUES ($1, $2, $3, $4, 'EFFECTIVE_DATED_REVISION', $5, $6, $7, $8, '127.0.0.1', 'WEB_PORTAL', 'PERN Temporal Engine', $9, $10, $11, $12, 'CRITICAL')
      `, [
        changeCode, entity_type, String(entity_id), entity_name,
        userId, userName, req.user?.email || "admin@hrms.com", req.user?.role || "admin",
        JSON.stringify(previousPayload), JSON.stringify(record_payload),
        JSON.stringify(Object.keys(record_payload)), `Effective-dated Version ${nextVersion} creation: ${change_reason}`
      ]);

      await client.query("COMMIT");

      return res.status(201).json({
        success: true,
        message: `Version ${nextVersion} successfully created without overwriting historical records. Effective from ${effective_from}.`,
        data: rows[0]
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    return next(error);
  }
};

export const getEffectiveDatedHistory = async (req, res, next) => {
  try {
    const { entity_type, entity_id, is_current } = req.query;

    let conditions = [];
    let params = [];
    let idx = 1;

    if (entity_type) {
      conditions.push(`entity_type = $${idx++}`);
      params.push(entity_type);
    }
    if (entity_id) {
      conditions.push(`entity_id = $${idx++}`);
      params.push(String(entity_id));
    }
    if (is_current !== undefined) {
      conditions.push(`is_current = $${idx++}`);
      params.push(is_current === "true" || is_current === true);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const query = `
      SELECT * FROM effective_dated_history
      ${whereClause}
      ORDER BY entity_type ASC, entity_id ASC, effective_from DESC, version_number DESC;
    `;

    const { rows } = await pool.query(query, params);

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    return next(error);
  }
};

// Temporal Point-in-time "As-Of Date" Query
export const getAsOfDateRecord = async (req, res, next) => {
  try {
    const { entity_type, entity_id, as_of_date } = req.query;

    if (!entity_type || !entity_id || !as_of_date) {
      return res.status(400).json({
        success: false,
        message: "entity_type, entity_id, and as_of_date (YYYY-MM-DD) are required for point-in-time query"
      });
    }

    const query = `
      SELECT * FROM effective_dated_history
      WHERE entity_type = $1
        AND entity_id = $2
        AND effective_from <= $3::date
        AND (effective_to >= $3::date OR effective_to IS NULL)
      ORDER BY version_number DESC
      LIMIT 1;
    `;

    const { rows } = await pool.query(query, [entity_type, String(entity_id), as_of_date]);

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: `No active revision found for entity ${entity_type}:${entity_id} as of date ${as_of_date}`
      });
    }

    return res.status(200).json({
      success: true,
      as_of_date,
      data: rows[0]
    });
  } catch (error) {
    return next(error);
  }
};

// =========================================================================
// 4. SENSITIVE EXPORT & ADMINISTRATIVE ACTION LOGS
// =========================================================================

export const logSensitiveExport = async (req, res, next) => {
  try {
    const {
      export_type,
      export_format = "CSV",
      record_count = 1,
      sensitivity_level = "FINANCIAL_CONFIDENTIAL",
      filter_criteria = {},
      file_checksum_sha256,
      export_purpose = "Authorized Disbursal / Audit Export"
    } = req.body;

    if (!export_type) {
      return res.status(400).json({
        success: false,
        message: "export_type is required"
      });
    }

    const { ip, userAgent } = extractClientMeta(req);
    const userId = req.user?.userId || req.user?.id || req.body.user_id || null;
    const userName = req.user?.first_name 
      ? `${req.user.first_name} ${req.user.last_name || ""}`.trim()
      : (req.user?.name || req.body.user_name || "Executive User");
    const userEmail = req.user?.email || req.body.user_email || "admin@hrms.com";
    const userRole = req.user?.role || req.body.user_role || "super_admin";

    const exportCode = generateCode("EXP");
    const checksum = file_checksum_sha256 || crypto.createHash("sha256")
      .update(`${exportCode}|${export_type}|${record_count}|${Date.now()}`)
      .digest("hex");

    const query = `
      INSERT INTO sensitive_export_logs (
        export_code, export_type, export_format, record_count, sensitivity_level,
        filter_criteria, file_checksum_sha256, user_id, user_name, user_email,
        user_role, ip_address, user_agent, export_purpose
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *;
    `;

    const values = [
      exportCode,
      export_type,
      export_format,
      Number(record_count),
      sensitivity_level,
      JSON.stringify(filter_criteria),
      checksum,
      userId,
      userName,
      userEmail,
      userRole,
      ip,
      userAgent,
      export_purpose
    ];

    const { rows } = await pool.query(query, values);

    return res.status(201).json({
      success: true,
      message: "Sensitive export event permanently captured in compliance audit trail",
      data: rows[0]
    });
  } catch (error) {
    return next(error);
  }
};

export const getSensitiveExports = async (req, res, next) => {
  try {
    const { export_type, sensitivity_level, limit = 50, offset = 0 } = req.query;

    let conditions = [];
    let params = [];
    let idx = 1;

    if (export_type) {
      conditions.push(`export_type = $${idx++}`);
      params.push(export_type);
    }
    if (sensitivity_level) {
      conditions.push(`sensitivity_level = $${idx++}`);
      params.push(sensitivity_level);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const countRes = await pool.query(`SELECT count(*) FROM sensitive_export_logs ${whereClause}`, params);
    const totalCount = parseInt(countRes.rows[0].count, 10);

    const query = `
      SELECT * FROM sensitive_export_logs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${idx++} OFFSET $${idx++};
    `;
    params.push(Number(limit), Number(offset));

    const { rows } = await pool.query(query, params);

    return res.status(200).json({
      success: true,
      total: totalCount,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    return next(error);
  }
};

export const logAdministrativeAction = async (req, res, next) => {
  try {
    const {
      action_category,
      target_entity_type,
      target_entity_id,
      action_details,
      before_state = {},
      after_state = {},
      status = "SUCCESS"
    } = req.body;

    if (!action_category || !target_entity_type || !action_details) {
      return res.status(400).json({
        success: false,
        message: "action_category, target_entity_type and action_details are required"
      });
    }

    const { ip, userAgent } = extractClientMeta(req);
    const adminId = req.user?.userId || req.user?.id || req.body.admin_id || null;
    const adminName = req.user?.first_name 
      ? `${req.user.first_name} ${req.user.last_name || ""}`.trim()
      : (req.user?.name || req.body.admin_name || "System Admin");
    const adminEmail = req.user?.email || req.body.admin_email || "admin@hrms.com";
    const adminRole = req.user?.role || req.body.admin_role || "super_admin";

    const actionCode = generateCode("ADM");

    const query = `
      INSERT INTO administrative_action_logs (
        action_code, admin_id, admin_name, admin_email, admin_role,
        action_category, target_entity_type, target_entity_id,
        action_details, before_state, after_state, status, ip_address, user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *;
    `;

    const values = [
      actionCode,
      adminId,
      adminName,
      adminEmail,
      adminRole,
      action_category,
      target_entity_type,
      String(target_entity_id || ""),
      action_details,
      JSON.stringify(before_state),
      JSON.stringify(after_state),
      status,
      ip,
      userAgent
    ];

    const { rows } = await pool.query(query, values);

    return res.status(201).json({
      success: true,
      message: "Administrative action logged in governance audit register",
      data: rows[0]
    });
  } catch (error) {
    return next(error);
  }
};

export const getAdministrativeActions = async (req, res, next) => {
  try {
    const { action_category, limit = 50, offset = 0 } = req.query;

    let conditions = [];
    let params = [];
    let idx = 1;

    if (action_category) {
      conditions.push(`action_category = $${idx++}`);
      params.push(action_category);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const countRes = await pool.query(`SELECT count(*) FROM administrative_action_logs ${whereClause}`, params);
    const totalCount = parseInt(countRes.rows[0].count, 10);

    const query = `
      SELECT * FROM administrative_action_logs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${idx++} OFFSET $${idx++};
    `;
    params.push(Number(limit), Number(offset));

    const { rows } = await pool.query(query, params);

    return res.status(200).json({
      success: true,
      total: totalCount,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    return next(error);
  }
};

// =========================================================================
// 5. DOCUMENT PREVIEW / DOWNLOAD GOVERNANCE & WATERMARKING
// =========================================================================

export const getDocumentPolicies = async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT * FROM document_governance_policies
      ORDER BY category_label ASC;
    `);

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    return next(error);
  }
};

export const updateDocumentPolicy = async (req, res, next) => {
  try {
    const { categoryCode } = req.params;
    const {
      can_preview_roles,
      can_download_roles,
      can_delete_roles,
      allow_owner_preview,
      allow_owner_download,
      requires_watermark,
      watermark_pattern,
      requires_mfa_stepup_download,
      max_downloads_per_day
    } = req.body;

    const query = `
      UPDATE document_governance_policies
      SET can_preview_roles = COALESCE($1, can_preview_roles),
          can_download_roles = COALESCE($2, can_download_roles),
          can_delete_roles = COALESCE($3, can_delete_roles),
          allow_owner_preview = COALESCE($4, allow_owner_preview),
          allow_owner_download = COALESCE($5, allow_owner_download),
          requires_watermark = COALESCE($6, requires_watermark),
          watermark_pattern = COALESCE($7, watermark_pattern),
          requires_mfa_stepup_download = COALESCE($8, requires_mfa_stepup_download),
          max_downloads_per_day = COALESCE($9, max_downloads_per_day)
      WHERE category_code = $10
      RETURNING *;
    `;

    const values = [
      can_preview_roles ? JSON.stringify(can_preview_roles) : null,
      can_download_roles ? JSON.stringify(can_download_roles) : null,
      can_delete_roles ? JSON.stringify(can_delete_roles) : null,
      allow_owner_preview,
      allow_owner_download,
      requires_watermark,
      watermark_pattern,
      requires_mfa_stepup_download,
      max_downloads_per_day,
      categoryCode
    ];

    const { rows } = await pool.query(query, values);

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Document policy category not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: `Document governance policy for ${categoryCode} updated successfully`,
      data: rows[0]
    });
  } catch (error) {
    return next(error);
  }
};

export const evaluateDocumentAccess = async (req, res, next) => {
  try {
    const {
      document_id,
      category_code,
      action_type = "PREVIEW", // PREVIEW or DOWNLOAD
      target_role,
      target_user_id,
      target_user_email,
      document_owner_employee_id
    } = req.body;

    const { ip } = extractClientMeta(req);
    const userRole = target_role || req.user?.role || "employee";
    const userId = target_user_id || req.user?.userId || req.user?.id || null;
    const userEmail = target_user_email || req.user?.email || "viewer@company.com";
    const userName = req.user?.first_name 
      ? `${req.user.first_name} ${req.user.last_name || ""}`.trim()
      : (req.user?.name || "Verified Viewer");

    // Retrieve document info if document_id provided
    let docName = "Document";
    let effectiveCategory = category_code || "COMPANY_POLICIES_PUBLIC";
    let docOwnerEmpId = document_owner_employee_id || null;

    if (document_id) {
      const docRes = await pool.query(`
        SELECT id, document_name, document_type, employee_id
        FROM employee_documents
        WHERE id = $1
      `, [Number(document_id)]);

      if (docRes.rows.length) {
        const d = docRes.rows[0];
        docName = d.document_name || `Doc-#${d.id}`;
        docOwnerEmpId = d.employee_id;
        // Map document_type to category_code if not explicitly passed
        if (!category_code) {
          const typeLower = (d.document_type || "").toLowerCase();
          if (typeLower.includes("aadhaar") || typeLower.includes("pan") || typeLower.includes("passport")) {
            effectiveCategory = "GOVERNMENT_IDS_AADHAAR_PAN";
          } else if (typeLower.includes("salary") || typeLower.includes("increment") || typeLower.includes("offer")) {
            effectiveCategory = "COMPENSATION_LETTERS";
          } else if (typeLower.includes("bgv") || typeLower.includes("verification")) {
            effectiveCategory = "BGV_INVESTIGATION_REPORTS";
          } else if (typeLower.includes("medical") || typeLower.includes("fitness")) {
            effectiveCategory = "MEDICAL_RECORDS";
          } else if (typeLower.includes("exit") || typeLower.includes("clearance") || typeLower.includes("settlement")) {
            effectiveCategory = "SEPARATION_FULL_FINAL";
          } else {
            effectiveCategory = "COMPANY_POLICIES_PUBLIC";
          }
        }
      }
    }

    // Retrieve category policy
    const policyRes = await pool.query(`
      SELECT * FROM document_governance_policies
      WHERE category_code = $1
    `, [effectiveCategory]);

    if (!policyRes.rows.length) {
      return res.status(404).json({
        success: false,
        message: `Policy for category '${effectiveCategory}' not found`
      });
    }

    const policy = policyRes.rows[0];
    const previewRoles = typeof policy.can_preview_roles === 'string' ? JSON.parse(policy.can_preview_roles) : policy.can_preview_roles;
    const downloadRoles = typeof policy.can_download_roles === 'string' ? JSON.parse(policy.can_download_roles) : policy.can_download_roles;

    // Check if requester is owner
    let isOwner = false;
    if (docOwnerEmpId && userId) {
      const empRes = await pool.query("SELECT id FROM employees WHERE user_id = $1 OR id = $2", [userId, docOwnerEmpId]);
      if (empRes.rows.length && Number(empRes.rows[0].id) === Number(docOwnerEmpId)) {
        isOwner = true;
      }
    }

    let accessGranted = false;
    let denialReason = "";
    const isDownload = action_type.toUpperCase() === "DOWNLOAD";

    if (isDownload) {
      if (downloadRoles.includes(userRole)) {
        accessGranted = true;
      } else if (isOwner && policy.allow_owner_download) {
        accessGranted = true;
      } else {
        accessGranted = false;
        denialReason = `Role '${userRole}' is not authorized to download files in category '${policy.category_label}'. Only ${downloadRoles.join(", ")} may download.`;
      }

      // Check daily download quota
      if (accessGranted && policy.max_downloads_per_day > 0) {
        const countRes = await pool.query(`
          SELECT count(*) FROM document_governance_audit
          WHERE user_id = $1 AND action_type = 'DOWNLOAD_REQUESTED' AND access_granted = TRUE
            AND created_at >= CURRENT_DATE
        `, [userId || 0]);
        const downloadsToday = parseInt(countRes.rows[0].count, 10);
        if (downloadsToday >= policy.max_downloads_per_day) {
          accessGranted = false;
          denialReason = `Daily download quota exceeded (${downloadsToday}/${policy.max_downloads_per_day} downloads today). Contact Compliance to request an quota elevation.`;
        }
      }
    } else {
      // PREVIEW check
      if (previewRoles.includes(userRole)) {
        accessGranted = true;
      } else if (isOwner && policy.allow_owner_preview) {
        accessGranted = true;
      } else {
        accessGranted = false;
        denialReason = `Role '${userRole}' is not authorized to preview documents in category '${policy.category_label}'.`;
      }
    }

    // Dynamic Watermark Generation
    const timestampStr = new Date().toISOString().replace("T", " ").slice(0, 19);
    let dynamicWatermark = "";
    if (policy.requires_watermark) {
      dynamicWatermark = (policy.watermark_pattern || "CONFIDENTIAL - {{user_email}} - IP:{{ip}} - {{timestamp}}")
        .replace("{{user_email}}", userEmail)
        .replace("{{ip}}", ip)
        .replace("{{timestamp}}", timestampStr);
    }

    // Log the access request into audit ledger
    await pool.query(`
      INSERT INTO document_governance_audit (
        document_id, document_name, document_category, employee_id,
        user_id, user_name, user_role, action_type, access_granted,
        denial_reason, watermark_applied, ip_address
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [
      document_id ? Number(document_id) : null,
      docName,
      effectiveCategory,
      docOwnerEmpId ? Number(docOwnerEmpId) : null,
      userId,
      userName,
      userRole,
      isDownload ? "DOWNLOAD_REQUESTED" : "PREVIEW_REQUESTED",
      accessGranted,
      denialReason,
      accessGranted ? dynamicWatermark : "",
      ip
    ]);

    // Also mirror to document_access_logs if document_id exists
    if (document_id) {
      try {
        await pool.query(`
          INSERT INTO document_access_logs (
            document_id, document_name, document_type, employee_id, employee_name,
            actor_id, actor_name, actor_role, action_type, ip_address
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
          Number(document_id), docName, effectiveCategory, docOwnerEmpId,
          `Employee #${docOwnerEmpId || 'N/A'}`, userId, userName, userRole,
          accessGranted ? (isDownload ? "DOWNLOAD" : "VIEW") : "ACCESS_DENIED",
          ip
        ]);
      } catch (logErr) {
        // non-blocking
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        document_id: document_id || null,
        document_name: docName,
        category_code: effectiveCategory,
        category_label: policy.category_label,
        action_type: isDownload ? "DOWNLOAD" : "PREVIEW",
        access_granted: accessGranted,
        denial_reason: denialReason,
        requires_mfa: isDownload && Boolean(policy.requires_mfa_stepup_download),
        watermark_applied: policy.requires_watermark,
        watermark_text: accessGranted && policy.requires_watermark ? dynamicWatermark : null,
        user_evaluated: {
          id: userId,
          name: userName,
          email: userEmail,
          role: userRole,
          is_owner: isOwner
        },
        policy_rules: {
          preview_roles: previewRoles,
          download_roles: downloadRoles,
          allow_owner_preview: policy.allow_owner_preview,
          allow_owner_download: policy.allow_owner_download,
          max_downloads_per_day: policy.max_downloads_per_day
        }
      }
    });
  } catch (error) {
    return next(error);
  }
};

export const getDocumentGovernanceAudits = async (req, res, next) => {
  try {
    const { action_type, access_granted, limit = 50, offset = 0 } = req.query;

    let conditions = [];
    let params = [];
    let idx = 1;

    if (action_type) {
      conditions.push(`action_type = $${idx++}`);
      params.push(action_type);
    }
    if (access_granted !== undefined) {
      conditions.push(`access_granted = $${idx++}`);
      params.push(access_granted === "true" || access_granted === true);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const countRes = await pool.query(`SELECT count(*) FROM document_governance_audit ${whereClause}`, params);
    const totalCount = parseInt(countRes.rows[0].count, 10);

    const query = `
      SELECT * FROM document_governance_audit
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${idx++} OFFSET $${idx++};
    `;
    params.push(Number(limit), Number(offset));

    const { rows } = await pool.query(query, params);

    return res.status(200).json({
      success: true,
      total: totalCount,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    return next(error);
  }
};

// =========================================================================
// 6. EXECUTIVE OVERVIEW KPIS ACROSS ALL 5 PILLARS
// =========================================================================

export const getGovernanceOverview = async (req, res, next) => {
  try {
    const [
      changeStats,
      approvalStats,
      effStats,
      exportStats,
      adminStats,
      docPolicyStats,
      docAuditStats
    ] = await Promise.all([
      pool.query(`
        SELECT 
          count(*) as total_changes,
          count(*) FILTER (WHERE criticality = 'CRITICAL') as critical_changes,
          count(*) FILTER (WHERE criticality = 'HIGH') as high_changes,
          count(*) FILTER (WHERE action_type = 'UPDATE') as updates,
          count(*) FILTER (WHERE action_type = 'INSERT') as inserts
        FROM critical_data_change_logs;
      `),
      pool.query(`
        SELECT 
          count(*) as total_decisions,
          count(*) FILTER (WHERE decision = 'APPROVED') as approved,
          count(*) FILTER (WHERE decision = 'REJECTED') as rejected,
          count(*) FILTER (WHERE decision = 'SENT_BACK') as sent_back,
          count(DISTINCT workflow_type) as active_workflows
        FROM approval_decision_history;
      `),
      pool.query(`
        SELECT 
          count(*) as total_records,
          count(*) FILTER (WHERE is_current = TRUE) as current_versions,
          count(*) FILTER (WHERE is_current = FALSE) as historical_versions,
          count(DISTINCT entity_type) as tracked_entities
        FROM effective_dated_history;
      `),
      pool.query(`
        SELECT 
          count(*) as total_exports,
          COALESCE(sum(record_count), 0) as total_records_extracted,
          count(*) FILTER (WHERE sensitivity_level = 'FINANCIAL_CONFIDENTIAL') as financial_exports,
          count(*) FILTER (WHERE sensitivity_level = 'RESTRICTED_PII') as pii_exports
        FROM sensitive_export_logs;
      `),
      pool.query(`
        SELECT 
          count(*) as total_admin_actions,
          count(*) FILTER (WHERE status = 'SUCCESS') as successful_actions,
          count(*) FILTER (WHERE status = 'BLOCKED') as blocked_actions
        FROM administrative_action_logs;
      `),
      pool.query(`
        SELECT count(*) as total_policies FROM document_governance_policies;
      `),
      pool.query(`
        SELECT 
          count(*) as total_access_attempts,
          count(*) FILTER (WHERE access_granted = TRUE) as granted_attempts,
          count(*) FILTER (WHERE access_granted = FALSE) as denied_attempts,
          count(*) FILTER (WHERE action_type = 'DOWNLOAD_REQUESTED') as download_attempts
        FROM document_governance_audit;
      `)
    ]);

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      kpis: {
        critical_changes: {
          total: parseInt(changeStats.rows[0].total_changes, 10),
          critical: parseInt(changeStats.rows[0].critical_changes, 10),
          high: parseInt(changeStats.rows[0].high_changes, 10),
          updates: parseInt(changeStats.rows[0].updates, 10),
          inserts: parseInt(changeStats.rows[0].inserts, 10)
        },
        approvals: {
          total: parseInt(approvalStats.rows[0].total_decisions, 10),
          approved: parseInt(approvalStats.rows[0].approved, 10),
          rejected: parseInt(approvalStats.rows[0].rejected, 10),
          sent_back: parseInt(approvalStats.rows[0].sent_back, 10),
          active_workflows: parseInt(approvalStats.rows[0].active_workflows, 10)
        },
        effective_dating: {
          total_revisions: parseInt(effStats.rows[0].total_records, 10),
          current_versions: parseInt(effStats.rows[0].current_versions, 10),
          historical_versions: parseInt(effStats.rows[0].historical_versions, 10),
          tracked_entity_types: parseInt(effStats.rows[0].tracked_entities, 10)
        },
        sensitive_exports: {
          total_exports: parseInt(exportStats.rows[0].total_exports, 10),
          records_extracted: parseInt(exportStats.rows[0].total_records_extracted, 10),
          financial_exports: parseInt(exportStats.rows[0].financial_exports, 10),
          pii_exports: parseInt(exportStats.rows[0].pii_exports, 10)
        },
        admin_actions: {
          total: parseInt(adminStats.rows[0].total_admin_actions, 10),
          successful: parseInt(adminStats.rows[0].successful_actions, 10),
          blocked: parseInt(adminStats.rows[0].blocked_actions, 10)
        },
        document_governance: {
          total_policies: parseInt(docPolicyStats.rows[0].total_policies, 10),
          total_access_attempts: parseInt(docAuditStats.rows[0].total_access_attempts, 10),
          granted: parseInt(docAuditStats.rows[0].granted_attempts, 10),
          denied: parseInt(docAuditStats.rows[0].denied_attempts, 10),
          download_attempts: parseInt(docAuditStats.rows[0].download_attempts, 10)
        }
      }
    });
  } catch (error) {
    return next(error);
  }
};
