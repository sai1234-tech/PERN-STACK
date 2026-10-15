import test from "node:test";
import assert from "node:assert/strict";
import pool from "../config/db.js";
import {
    resolveManagerEmployee,
    isCircularReporting,
    findEmployeeById,
    findEmployeeByUserId,
    createEmployeeRecord,
    updateEmployeeRecord
} from "../repositories/employeeRepository.js";
import { provisionEmployeeForUser } from "../controllers/authController.js";
import { findLeavesByEmployee, findAllLeaves, findAllLeaveTypes } from "../repositories/leaveRepository.js";
import { updateEmployee } from "../controllers/employeeController.js";
import { getMyLeaves, getLeaveBalance } from "../controllers/leaveController.js";

// Helper to mock express req / res
const createMockRes = () => {
    const res = {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(data) {
            this.body = data;
            return this;
        }
    };
    return res;
};

test("Manager Hierarchy & Validation Suite", async (t) => {
    await t.test("resolveManagerEmployee resolves by employee id", async () => {
        const { rows } = await pool.query("SELECT * FROM employees WHERE employment->>'status' = 'Active' LIMIT 1;");
        if (rows.length > 0) {
            const emp = rows[0];
            const resolved = await resolveManagerEmployee(emp.id);
            assert.ok(resolved, "Should resolve by employee id");
            assert.equal(resolved.id, emp.id);
        }
    });

    await t.test("resolveManagerEmployee returns null for non-existent manager", async () => {
        const resolved = await resolveManagerEmployee(99999999);
        assert.equal(resolved, null, "Should return null for non-existent manager ID");
    });

    await t.test("isCircularReporting detects immediate self-assignment", async () => {
        const isCircular = await isCircularReporting(15, 15);
        assert.equal(isCircular, true, "Self reporting must be detected as circular");
    });

    await t.test("isCircularReporting detects multi-level circular reporting", async () => {
        const testCodeA = "TEST_CIRC_A";
        const testCodeB = "TEST_CIRC_B";

        await pool.query("DELETE FROM employees WHERE employee_code IN ($1, $2)", [testCodeA, testCodeB]);

        const empA = await createEmployeeRecord({
            employeeCode: testCodeA,
            firstName: "Circular",
            lastName: "A",
            email: "circ_a@test.com",
            employment: { status: "Active" }
        });

        const empB = await createEmployeeRecord({
            employeeCode: testCodeB,
            firstName: "Circular",
            lastName: "B",
            email: "circ_b@test.com",
            reportsTo: empA.id,
            employment: { status: "Active", reportsTo: empA.id }
        });

        const isCirc = await isCircularReporting(empA.id, empB.id);
        assert.equal(isCirc, true, "A -> B -> A must be detected as circular");

        await pool.query("DELETE FROM employees WHERE employee_code IN ($1, $2)", [testCodeA, testCodeB]);
    });
});

test("Employee Controller Reporting Manager Validation & Update Suite", async (t) => {
    const codeEmp = "TEST_MGR_VAL_EMP";
    const codeMgr = "TEST_MGR_VAL_MGR";
    let empRecord = null;
    let mgrRecord = null;

    t.before(async () => {
        await pool.query("DELETE FROM employees WHERE employee_code IN ($1, $2)", [codeEmp, codeMgr]);

        mgrRecord = await createEmployeeRecord({
            employeeCode: codeMgr,
            firstName: "Senior",
            lastName: "Manager",
            email: "senior_mgr@test.com",
            employment: { status: "Active", designation: "Engineering Manager" }
        });

        empRecord = await createEmployeeRecord({
            employeeCode: codeEmp,
            firstName: "Junior",
            lastName: "Dev",
            email: "junior_dev@test.com",
            employment: { status: "Active", designation: "Software Engineer" }
        });
    });

    t.after(async () => {
        await pool.query("DELETE FROM employees WHERE employee_code IN ($1, $2)", [codeEmp, codeMgr]);
    });

    await t.test("Rejects self-reporting with 400", async () => {
        const req = {
            params: { id: empRecord.id },
            body: { reportsTo: empRecord.id }
        };
        const res = createMockRes();
        await updateEmployee(req, res);

        assert.equal(res.statusCode, 400);
        assert.equal(res.body.success, false);
        assert.match(res.body.message, /own reporting manager/i);
    });

    await t.test("Rejects non-existent manager ID with 400", async () => {
        const req = {
            params: { id: empRecord.id },
            body: { reportsTo: 98765432 }
        };
        const res = createMockRes();
        await updateEmployee(req, res);

        assert.equal(res.statusCode, 400);
        assert.equal(res.body.success, false);
        assert.match(res.body.message, /Selected reporting manager does not exist/i);
    });

    await t.test("Successfully assigns valid manager and returns manager display name", async () => {
        const req = {
            params: { id: empRecord.id },
            body: { reportsTo: mgrRecord.id }
        };
        const res = createMockRes();
        await updateEmployee(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.success, true);
        assert.ok(res.body.data.reportsTo, "Must return reportsTo object or identifier");
        assert.equal(res.body.data.reportsTo.id, mgrRecord.id);
        assert.equal(res.body.data.reportsTo.name, "Senior Manager");

        // Verify database persistence in column and JSON
        const refreshed = await findEmployeeById(empRecord.id);
        assert.equal(refreshed.reports_to, mgrRecord.id);
        assert.equal(refreshed.employment.reportsTo, mgrRecord.id);
    });

    await t.test("Rejects circular hierarchy when manager attempts to report back to direct report", async () => {
        const req = {
            params: { id: mgrRecord.id },
            body: { reportsTo: empRecord.id }
        };
        const res = createMockRes();
        await updateEmployee(req, res);

        assert.equal(res.statusCode, 400);
        assert.equal(res.body.success, false);
        assert.match(res.body.message, /circular reporting/i);
    });

    await t.test("Successfully unassigns/clears manager when null or empty is passed", async () => {
        const req = {
            params: { id: empRecord.id },
            body: { reportsTo: null }
        };
        const res = createMockRes();
        await updateEmployee(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.data.reportsTo, null);

        const refreshed = await findEmployeeById(empRecord.id);
        assert.equal(refreshed.reports_to, null);
    });
});

test("New User Auto-Provisioning & Leave Balance Suite", async (t) => {
    const testEmail = `test_new_user_${Date.now()}@example.com`;
    let createdUserId = null;
    let provisionedEmp = null;

    t.after(async () => {
        if (provisionedEmp?.id) {
            await pool.query("DELETE FROM leaves WHERE employee_id = $1", [provisionedEmp.id]);
            await pool.query("DELETE FROM employees WHERE id = $1", [provisionedEmp.id]);
        }
        if (createdUserId) {
            await pool.query("DELETE FROM users WHERE id = $1", [createdUserId]);
        }
    });

    await t.test("provisionEmployeeForUser creates an active employee profile", async () => {
        const userRes = await pool.query(
            `INSERT INTO users (name, email, password, role, is_active)
             VALUES ('Test New User', $1, 'hashedpass123', 'employee', true)
             RETURNING id, name, email, role, is_active;`,
            [testEmail]
        );
        createdUserId = userRes.rows[0].id;

        provisionedEmp = await provisionEmployeeForUser(userRes.rows[0]);
        assert.ok(provisionedEmp, "Employee profile must be provisioned");
        assert.equal(provisionedEmp.user_id, createdUserId);
        assert.equal(provisionedEmp.employment?.status, "Active", "Must have status Active in employment JSON");
    });

    await t.test("provisionEmployeeForUser is idempotent", async () => {
        const recheck = await provisionEmployeeForUser({ id: createdUserId, email: testEmail, name: "Test New User" });
        assert.equal(recheck.id, provisionedEmp.id, "Repeated call must return same employee without duplicating");
    });

    await t.test("getMyLeaves returns 200 with empty list for new user", async () => {
        const req = { user: { userId: createdUserId, id: createdUserId, role: "employee" } };
        const res = createMockRes();
        await getMyLeaves(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.success, true);
        assert.equal(res.body.count, 0);
        assert.deepEqual(res.body.data, []);
    });

    await t.test("getLeaveBalance returns all leave types with zero used and full allocation", async () => {
        const req = { user: { userId: createdUserId, id: createdUserId, role: "employee" }, query: {} };
        const res = createMockRes();
        await getLeaveBalance(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.success, true);
        assert.ok(Array.isArray(res.body.data));
        assert.ok(res.body.data.length > 0, "Leave types must be returned");

        for (const item of res.body.data) {
            assert.equal(item.used, 0, "New user used leaves must be 0");
            assert.equal(item.pending, 0, "New user pending leaves must be 0");
            assert.equal(item.available, item.annualAllocation, "Available must equal annualAllocation for new user");
        }
    });
});

test.after(async () => {
    await pool.end();
});
