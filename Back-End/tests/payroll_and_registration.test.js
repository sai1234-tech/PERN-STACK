import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { updatePayrollRecord, viewMySalary } from "../controllers/payrollController.js";
import { createMultipleEmployees, updateEmployee } from "../controllers/employeeController.js";
import pool from "../config/db.js";

describe("HR Payroll & Employee Salary Suite", () => {
    it("updatePayrollRecord allows HR to update all payroll components", async () => {
        // Setup employee in db
        const empCode = `TESTPAY${Date.now().toString().slice(-4)}`;
        const insEmp = await pool.query(
            `INSERT INTO employees (employee_code, first_name, last_name, email, employment)
             VALUES ($1, 'Payroll', 'Tester', $2, '{"salary": 600000, "status": "Active"}'::jsonb)
             RETURNING id`,
            [empCode, `${empCode.toLowerCase()}@test.com`]
        );
        const employeeId = insEmp.rows[0].id;

        const mockReq = {
            user: { userId: 1, role: "hr" },
            params: {},
            body: {
                employeeId,
                month: "2026-10",
                basicSalary: 30000,
                allowances: 15000,
                bonus: 5000,
                tax: 1500,
                pf: 3600,
                deduction: 900,
                status: "paid",
                updateBaseSalary: true,
            },
        };

        let responseData = null;
        let responseCode = null;
        const mockRes = {
            status: (code) => {
                responseCode = code;
                return {
                    json: (data) => {
                        responseData = data;
                        return data;
                    },
                };
            },
        };

        await updatePayrollRecord(mockReq, mockRes, (err) => {
            if (err) throw err;
        });

        assert.equal(responseCode, 200);
        assert.equal(responseData.success, true);
        assert.equal(responseData.data.basicSalary, 30000);
        assert.equal(responseData.data.allowances, 15000);
        assert.equal(responseData.data.bonus, 5000);
        assert.equal(responseData.data.tax, 1500);
        assert.equal(responseData.data.pf, 3600);
        assert.equal(responseData.data.deduction, 900);
        assert.equal(responseData.data.grossSalary, 50000); // 30k + 15k + 5k
        assert.equal(responseData.data.totalDeductions, 6000); // 1.5k + 3.6k + 0.9k
        assert.equal(responseData.data.netSalary, 44000); // 50k - 6k
        assert.equal(responseData.data.status, "paid");

        // Cleanup
        await pool.query("DELETE FROM payrolls WHERE employee_id = $1", [employeeId]);
        await pool.query("DELETE FROM employees WHERE id = $1", [employeeId]);
    });

    it("createMultipleEmployees saves salary in employment object", async () => {
        const empCode = `TESTREG${Date.now().toString().slice(-4)}`;
        const req = {
            body: [
                {
                    employeeCode: empCode,
                    firstName: "Jane",
                    lastName: "Doe",
                    email: `${empCode.toLowerCase()}@test.com`,
                    salary: 720000,
                    employment: {
                        department: "Product",
                        designation: "UI/UX Designer",
                        employmentType: "Full Time",
                        status: "Active",
                        salary: 720000,
                    },
                },
            ],
        };

        let resStatus = null;
        let resData = null;
        const res = {
            status: (code) => {
                resStatus = code;
                return {
                    json: (data) => {
                        resData = data;
                        return data;
                    },
                };
            },
        };

        await createMultipleEmployees(req, res);
        assert.equal(resStatus, 201);
        assert.equal(resData.success, true);
        assert.equal(resData.data[0].employment.salary, 720000);

        // Cleanup
        await pool.query("DELETE FROM employees WHERE employee_code = $1", [empCode]);
    });

    it("updateEmployeeSalary updates salary and syncs payroll record", async () => {
        const empCode = `TESTSAL${Date.now().toString().slice(-4)}`;
        const insEmp = await pool.query(
            `INSERT INTO employees (employee_code, first_name, last_name, email, employment)
             VALUES ($1, 'Salary', 'Tester', $2, '{"salary": 600000, "status": "Active"}'::jsonb)
             RETURNING id`,
            [empCode, `${empCode.toLowerCase()}@test.com`]
        );
        const employeeId = insEmp.rows[0].id;

        const { updateEmployeeSalary } = await import("../controllers/payrollController.js");
        const req = {
            params: { employeeId: String(employeeId) },
            body: { salary: 55000, month: "2026-10" },
            user: { userId: 1, role: "hr" },
        };

        let resStatus = null;
        let resData = null;
        const res = {
            status: (code) => {
                resStatus = code;
                return {
                    json: (data) => {
                        resData = data;
                        return data;
                    },
                };
            },
        };

        await updateEmployeeSalary(req, res, (err) => {
            if (err) throw err;
        });

        assert.equal(resStatus, 200);
        assert.equal(resData.success, true);
        assert.equal(resData.data.employment.salary, 660000); // 55000 * 12

        const checkPayroll = await pool.query(
            "SELECT * FROM payrolls WHERE employee_id = $1 AND month = '2026-10-01'",
            [employeeId]
        );
        assert.equal(checkPayroll.rows.length, 1);
        assert.equal(Number(checkPayroll.rows[0].gross_salary), 55000);

        // Cleanup
        await pool.query("DELETE FROM payrolls WHERE employee_id = $1", [employeeId]);
        await pool.query("DELETE FROM employees WHERE id = $1", [employeeId]);
    });
});
