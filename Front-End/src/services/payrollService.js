import { apiRequest, apiDownload } from "./apiClient";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export function payrollPeriod(month, year) {
  if (!month || !year) return "";
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function getMySalary(month, year) {
  const period = payrollPeriod(month, year);
  return apiRequest(
    `/payroll/my/salary${period ? `?month=${period}` : ""}`
  );
}

export function unwrapPayrollData(response, keys = []) {
  let payload = response?.data ?? response;
  if (payload?.data && typeof payload.data === "object" && !Array.isArray(payload.data)) payload = payload.data;
  for (const key of keys) if (payload?.[key] !== undefined) return payload[key];
  return payload;
}

export function normalizePayslip(response) {
  const record = unwrapPayrollData(response, ["payslip", "payroll", "record"]) || {};
  const deductions = record.deductions || {};
  const earnings = record.earnings || {};
  const basicSalary = Number(record.basicSalary ?? earnings.basicSalary ?? record.baseSalary ?? 0);
  const allowances = Number(record.allowances ?? earnings.allowances ?? 0);
  const bonus = Number(record.bonus ?? earnings.bonus ?? 0);
  const tax = Number(record.tax ?? deductions.tax ?? 0);
  const pf = Number(record.pf ?? deductions.pf ?? 0);
  const otherDeductions = Number(record.deduction ?? record.otherDeductions ?? deductions.otherDeductions ?? 0);
  const totalDeductions = Number(record.totalDeductions ?? record.deductionsTotal ?? tax + pf + otherDeductions);
  const grossSalary = Number(record.grossSalary ?? record.grossPay ?? basicSalary + allowances + bonus);
  const netSalary = Number(record.netSalary ?? record.netPay ?? grossSalary - totalDeductions);
  return { ...record, basicSalary, allowances, bonus, tax, pf, otherDeductions, totalDeductions, grossSalary, netSalary, status: record.status || "Generated", generatedAt: record.generatedAt || null };
}

export function getMyPayslip(month, year) {
  const period = payrollPeriod(month, year);
  const params = new URLSearchParams(period ? { month: period } : {});

  return apiRequest(
    `/payroll/my/payslip${params.toString() ? `?${params}` : ""}`
  );
}

export async function downloadMyPayslip(month, year) {
  const params = new URLSearchParams();

  if (month && year) {
    const formattedMonth = `${year}-${String(month).padStart(2, "0")}`;
    params.set("month", formattedMonth);
  }

  const filename = `payslip-${year}-${String(month).padStart(2, "0")}.pdf`;
  return apiDownload(`/payroll/my/payslip/download${params.toString() ? `?${params}` : ""}`, filename);
}

export function generatePayroll(data) {
  return apiRequest("/payroll/generate", { method: "POST", body: JSON.stringify(data) });
}

export function getPayroll(filters = {}) {
  const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== "" && value !== undefined));
  return apiRequest(`/payroll${params.toString() ? `?${params}` : ""}`);
}

export function updateEmployeeSalary(employeeId, data) {
  return apiRequest(`/payroll/employees/${employeeId}/salary`, { method: "PATCH", body: JSON.stringify(data) });
}

export async function downloadRenderedPayslip(element, period) {
  if (!element) {
    throw new Error("The payslip preview is not ready to export.");
  }

  const canvas = await html2canvas(element, {
    backgroundColor: "#ffffff",
    scale: Math.min(window.devicePixelRatio || 1, 2),
    useCORS: true,
    logging: false,
  });

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 10;
  const pageWidth = 210;
  const pageHeight = 297;
  const contentWidth = pageWidth - margin * 2;
  const contentHeight = pageHeight - margin * 2;
  const imageHeight = (canvas.height * contentWidth) / canvas.width;
  const imageData = canvas.toDataURL("image/png", 1);

  let offset = 0;
  let page = 0;
  while (offset < imageHeight) {
    if (page > 0) pdf.addPage();
    pdf.addImage(imageData, "PNG", margin, margin - offset, contentWidth, imageHeight, undefined, "FAST");
    offset += contentHeight;
    page += 1;
  }

  pdf.save(`Quadratic-Systems-Inc-Payslip-${period}.pdf`);
}