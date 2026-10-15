import test from "node:test";
import assert from "node:assert/strict";
import pool from "../config/db.js";
import { viewMySalary, getMyPayslip, downloadMyPayslip } from "../controllers/payrollController.js";
import { findUserByEmail } from "../repositories/userRepository.js";

import { Writable } from "node:stream";

const mockRes = () => {
    const stream = new Writable({
        write(chunk, encoding, callback) {
            this.chunks.push(chunk);
            callback();
        }
    });
    stream.statusCode = 200;
    stream.headers = {};
    stream.jsonData = null;
    stream.chunks = [];
    stream.status = function(code) {
        this.statusCode = code;
        return this;
    };
    stream.json = function(data) {
        this.jsonData = data;
        return this;
    };
    stream.setHeader = function(name, value) {
        this.headers[name] = value;
        return this;
    };
    return stream;
};

test("Payroll For Every User Verification Suite", async (t) => {
    await t.test("Kushangala SaiKiran (user 18) gets complete salary and payslip", async () => {
        const user = await findUserByEmail("skushangala@quadratics.com");
        assert.ok(user, "User should exist");

        const reqSalary = { user: { userId: user.id, email: user.email }, query: { month: "2026-10" } };
        const resSalary = mockRes();
        await viewMySalary(reqSalary, resSalary);

        assert.equal(resSalary.statusCode, 200);
        assert.equal(resSalary.jsonData?.success, true);
        assert.ok(resSalary.jsonData?.data?.grossSalary > 0, "Gross salary must be > 0");
        assert.ok(resSalary.jsonData?.data?.netSalary > 0, "Net salary must be > 0");
        assert.ok(resSalary.jsonData?.data?.basicSalary > 0, "Basic salary must be > 0");
        assert.ok(resSalary.jsonData?.data?.annualSalary > 0, "Annual salary must be > 0");

        const reqPayslip = { user: { userId: user.id, email: user.email }, query: { month: "2026-10" } };
        const resPayslip = mockRes();
        await getMyPayslip(reqPayslip, resPayslip, (err) => { if (err) throw err; });

        assert.equal(resPayslip.statusCode, 200);
        assert.equal(resPayslip.jsonData?.success, true);
        assert.ok(resPayslip.jsonData?.data?.grossSalary > 0, "Payslip gross must be > 0");
        assert.ok(resPayslip.jsonData?.data?.netSalary > 0, "Payslip net must be > 0");
    });

    await t.test("Sandhya Rani (user 21) gets complete salary and payslip matching HR edit", async () => {
        const user = await findUserByEmail("sandhyakushangala@quadratics.com");
        assert.ok(user, "User should exist");

        const reqSalary = { user: { userId: user.id, email: user.email }, query: { month: "2026-10" } };
        const resSalary = mockRes();
        await viewMySalary(reqSalary, resSalary);

        assert.equal(resSalary.statusCode, 200);
        assert.equal(resSalary.jsonData?.success, true);
        assert.equal(resSalary.jsonData?.data?.grossSalary, 65000);
        assert.equal(resSalary.jsonData?.data?.netSalary, 56000);
        assert.equal(resSalary.jsonData?.data?.basicSalary, 32500);

        const reqPayslip = { user: { userId: user.id, email: user.email }, query: { month: "2026-10" } };
        const resPayslip = mockRes();
        await getMyPayslip(reqPayslip, resPayslip, (err) => { if (err) throw err; });

        assert.equal(resPayslip.statusCode, 200);
        assert.equal(resPayslip.jsonData?.success, true);
        assert.equal(resPayslip.jsonData?.data?.grossSalary, 65000);
        assert.equal(resPayslip.jsonData?.data?.netSalary, 56000);
    });

    await t.test("Works for historical month (2026-09) without empty stubs or missing data", async () => {
        const user = await findUserByEmail("sandhyakushangala@quadratics.com");
        assert.ok(user);

        const reqSalary = { user: { userId: user.id, email: user.email }, query: { month: "2026-09" } };
        const resSalary = mockRes();
        await viewMySalary(reqSalary, resSalary);

        assert.equal(resSalary.statusCode, 200);
        assert.equal(resSalary.jsonData?.success, true);
        assert.ok(resSalary.jsonData?.data?.grossSalary > 0, "Gross salary must be populated for past period");
        assert.ok(resSalary.jsonData?.data?.basicSalary > 0, "Basic salary must be populated for past period");
        assert.ok(resSalary.jsonData?.data?.netSalary > 0, "Net salary must be populated for past period");

        const reqPayslip = { user: { userId: user.id, email: user.email }, query: { month: "2026-09" } };
        const resPayslip = mockRes();
        await getMyPayslip(reqPayslip, resPayslip, (err) => { if (err) throw err; });

        assert.equal(resPayslip.statusCode, 200);
        assert.equal(resPayslip.jsonData?.success, true);
        assert.ok(resPayslip.jsonData?.data?.grossSalary > 0, "Payslip gross must be populated for past period");
    });

    await t.test("Works for future month (2026-11) auto-generating payroll record", async () => {
        const user = await findUserByEmail("skushangala@quadratics.com");
        assert.ok(user);

        const reqSalary = { user: { userId: user.id, email: user.email }, query: { month: "2026-11" } };
        const resSalary = mockRes();
        await viewMySalary(reqSalary, resSalary);

        assert.equal(resSalary.statusCode, 200);
        assert.equal(resSalary.jsonData?.success, true);
        assert.ok(resSalary.jsonData?.data?.grossSalary > 0);
        assert.ok(resSalary.jsonData?.data?.netSalary > 0);
    });

    await t.test("Download PDF payslip succeeds for any month and sets PDF headers", async () => {
        const user = await findUserByEmail("sandhyakushangala@quadratics.com");
        assert.ok(user);

        const reqPdf = { user: { userId: user.id, email: user.email }, query: { month: "2026-10" } };
        const resPdf = mockRes();
        await downloadMyPayslip(reqPdf, resPdf, (err) => { if (err) throw err; });

        assert.equal(resPdf.headers["Content-Type"], "application/pdf");
        assert.ok(resPdf.headers["Content-Disposition"].includes("payslip-2026-10.pdf"));
    });
});
