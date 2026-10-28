import { apiRequest } from "./apiClient";
import { getAllEmployees } from "./employeeService";
import { broadcastDataChange } from "../utils/syncManager";

export const ALLOCATION_STORAGE_KEY = "hrms_resource_allocation_matrix";

export const DUMMY_EMP_IDS = new Set(["EMP-101", "EMP-102", "EMP-103", "EMP-104"]);

export const DEFAULT_PROJECT_CODES = new Set([
  "PRJ-TITAN-01",
  "PRJ-PHOENIX-02",
  "PRJ-APOLLO-03",
]);

export const DEFAULT_PROJECT_NAMES = new Set([
  "Project Titan",
  "Project Phoenix",
  "Project Apollo",
  "Project Nexus",
  "Project Horizon",
  "Project Cyber",
  "Project Titan (Cloud Transformation)",
  "Project Phoenix (Core Banking Migration)",
  "Project Apollo (AI Automation Engine)",
]);

const EXCLUDED_SYSTEM_NAMES = new Set([
  "systemadmin", "system admin", "adminuser", "admin user", "admindemo", "admin demo",
  "hrmanager", "hr manager", "teammanager", "team manager", "johnmanager", "john manager",
  "hradmin", "hr admin", "employeedemo", "employee demo", "testemployeeuser", "test employee user",
  "sarahsmith", "sarah smith", "saikumarr", "sai kumarr",
]);

const EXCLUDED_SYSTEM_EMAILS = new Set([
  "admin@company.com", "admin@example.com", "admin@hrms.com", "hr@company.com",
  "hr@hrms.com", "manager@company.com", "manager@hrms.com", "employee@hrms.com",
  "sarah.smith@company.com", "saikumarr@gmail.com",
]);

const EXCLUDED_SYSTEM_CODES = new Set([
  "EMP0003", "EMP009", "EMP010", "EMP011", "EMP013", "EMP014",
  "EMP015", "EMP016", "EMP017", "EMP018", "EMP019", "EMP020",
]);

export const isSystemOrDummyEmployee = (emp) => {
  if (!emp) return true;
  const code = String(emp.employeeCode || emp.employee_code || emp.code || emp.id || "").trim().toUpperCase();
  if (code.startsWith("QSI-") || EXCLUDED_SYSTEM_CODES.has(code)) return true;
  const fullName =
    `${emp.firstName || emp.first_name || ""} ${emp.lastName || emp.last_name || ""}`.trim().toLowerCase() ||
    String(emp.name || "").trim().toLowerCase();
  const cleanName = fullName.replace(/[^a-z0-9]/g, "");
  if (fullName.includes("arvind swaminathan") || cleanName.includes("arvindswaminathan")) return true;
  if (EXCLUDED_SYSTEM_NAMES.has(fullName) || EXCLUDED_SYSTEM_NAMES.has(cleanName)) return true;
  const email = String(emp.email || "").trim().toLowerCase();
  if (EXCLUDED_SYSTEM_EMAILS.has(email) || (email.startsWith("emp_") && email.endsWith("@hrms.com"))) return true;
  return false;
};

export async function getAllAllocations() {
  const res = await apiRequest("/allocation");
  return Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
}

export async function getEmployeeAllocation(empId) {
  const res = await apiRequest(`/allocation/employee/${empId}`);
  return res?.data || res;
}

export async function upsertAllocation(allocationData) {
  const res = await apiRequest("/allocation", {
    method: "POST",
    body: JSON.stringify(allocationData),
  });
  broadcastDataChange("allocations", { action: "upsert", timestamp: Date.now() });
  return res?.data || res;
}

export async function updateAllocationStatus(id, status, projectName) {
  const res = await apiRequest(`/allocation/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, projectName }),
  });
  broadcastDataChange("allocations", { action: "statusChange", status, timestamp: Date.now() });
  return res?.data || res;
}

export async function deleteAllocation(id) {
  const res = await apiRequest(`/allocation/${id}`, {
    method: "DELETE",
  });
  broadcastDataChange("allocations", { action: "delete", id, timestamp: Date.now() });
  return res?.data || res;
}

/**
 * Shared single-source-of-truth loader for HR Resource Allocation, Manager Resource Matrix,
 * Manager Dashboard, and Manager Active Projects so HR and Manager always display identical data.
 */
export async function loadUnifiedResourceMatrix() {
  const [empRes, overviewRes, mgrProjRes, allocRes] = await Promise.allSettled([
    getAllEmployees(),
    apiRequest("/manager/overview"),
    apiRequest("/manager/projects"),
    getAllAllocations(),
  ]);

  const rawOverview =
    overviewRes.status === "fulfilled" &&
    overviewRes.value?.success &&
    overviewRes.value.data &&
    typeof overviewRes.value.data === "object" &&
    !Array.isArray(overviewRes.value.data)
      ? overviewRes.value.data
      : null;

  const rawMgrProjects =
    mgrProjRes.status === "fulfilled" && Array.isArray(mgrProjRes.value?.data)
      ? mgrProjRes.value.data
      : [];

  const rawEmpData =
    empRes.status === "fulfilled"
      ? Array.isArray(empRes.value?.data)
        ? empRes.value.data
        : Array.isArray(empRes.value?.employees)
        ? empRes.value.employees
        : Array.isArray(empRes.value)
        ? empRes.value
        : []
      : [];

  let localCustomEmps = [];
  try {
    const stored = localStorage.getItem("hrms_custom_employees");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) localCustomEmps = parsed;
    }
  } catch (_) {}

  const apiEmployees = [...rawEmpData, ...localCustomEmps];
  const mappedTeamMembers = Array.isArray(rawOverview?.teamMembers) ? rawOverview.teamMembers : [];

  const combinedSource = [
    ...apiEmployees.filter((e) => !isSystemOrDummyEmployee(e)),
    ...mappedTeamMembers.filter((e) => !isSystemOrDummyEmployee(e)),
  ];
  const mergedList = [];
  const existingIds = new Set();
  const existingCodes = new Set();

  combinedSource.forEach((emp) => {
    const rawId = emp.id ?? emp._id;
    if (rawId === undefined || rawId === null) return;
    const empId = String(rawId);
    const code = String(emp.employeeCode || emp.employee_code || emp.employeeId || emp.code || "EMP").trim();
    if (existingIds.has(empId) || (code !== "EMP" && existingCodes.has(code.toUpperCase()))) return;

    existingIds.add(empId);
    if (code !== "EMP") existingCodes.add(code.toUpperCase());

    const firstName = emp.firstName || emp.first_name || String(emp.name || "").split(" ")[0] || "Employee";
    const lastName = emp.lastName || emp.last_name || String(emp.name || "").split(" ").slice(1).join(" ") || "";
    const name = `${firstName} ${lastName}`.trim() || emp.name || emp.email || "Employee";
    const dept = emp.employment?.department || emp.department || "Engineering";
    const role = emp.employment?.designation || emp.designation || emp.role || "Engineer";

    mergedList.push({
      _id: emp.id ?? emp._id,
      id: empId,
      firstName,
      lastName,
      name,
      code,
      employeeCode: code,
      email: emp.email || "",
      profilePhoto: emp.profilePhoto || emp.profile_photo || "",
      department: dept,
      role,
      defaultStatus: "Bench",
      defaultProject: null,
      employment: {
        ...(emp.employment || {}),
        department: dept,
        designation: role,
      },
    });
  });

  const allocMap = {};

  // 1. Read saved allocations from localStorage
  try {
    const savedLocal = localStorage.getItem(ALLOCATION_STORAGE_KEY);
    if (savedLocal) {
      const parsedLocal = JSON.parse(savedLocal);
      if (parsedLocal && typeof parsedLocal === "object") {
        Object.entries(parsedLocal).forEach(([k, val]) => {
          if (!val || DUMMY_EMP_IDS.has(String(k))) return;
          const rawProj = String(val.project || "").trim();
          const isLegacyDefaultProj = !rawProj || DEFAULT_PROJECT_NAMES.has(rawProj);

          let matchedLocalEmp = mergedList.find(
            (e) =>
              String(e.id) === String(k) ||
              (val.code && String(e.code).toUpperCase() === String(val.code).toUpperCase()) ||
              String(e.code).toUpperCase() === String(k).toUpperCase()
          );

          if (!matchedLocalEmp && val.name && val.name !== "Employee") {
            const parts = String(val.name).trim().split(" ");
            matchedLocalEmp = {
              _id: String(k),
              id: String(k),
              firstName: parts[0] || "Employee",
              lastName: parts.slice(1).join(" ") || "",
              name: val.name,
              code: val.code || String(k),
              employeeCode: val.code || String(k),
              email: "",
              profilePhoto: "",
              department: val.department || "Engineering",
              role: val.role || "Engineer",
              defaultStatus: "Bench",
              defaultProject: null,
              employment: {
                department: val.department || "Engineering",
                designation: val.role || "Engineer",
              },
            };
            mergedList.push(matchedLocalEmp);
          }

          const resolvedKey = matchedLocalEmp ? String(matchedLocalEmp.id) : String(k);
          const safeName = (matchedLocalEmp?.name && matchedLocalEmp.name !== "Employee")
            ? matchedLocalEmp.name
            : (val.name && val.name !== "Employee")
            ? val.name
            : "Employee";

          let sowNum = val.sowNumber || "";
          if (
            (!sowNum || sowNum === "SOW" || sowNum === "SOW to project") &&
            (rawProj === "HMRS" || String(val.code || "").toUpperCase() === "EMP175" || safeName.includes("Kushangala"))
          ) {
            sowNum = "SOW-2026-AI-003";
          }
          if (val.status === "Allocated" && !isLegacyDefaultProj) {
            allocMap[resolvedKey] = {
              status: "Allocated",
              project: rawProj,
              sowNumber: sowNum,
              name: safeName,
              code: val.code || matchedLocalEmp?.code || "",
              department: val.department || matchedLocalEmp?.department || "Engineering",
              role: val.role || matchedLocalEmp?.role || "Engineer",
              releasedToBench: false,
            };
          } else if (val.releasedToBench) {
            allocMap[resolvedKey] = {
              status: "Bench",
              project: null,
              sowNumber: "",
              name: safeName,
              code: val.code || matchedLocalEmp?.code || "",
              department: val.department || matchedLocalEmp?.department || "Engineering",
              role: val.role || matchedLocalEmp?.role || "Engineer",
              releasedToBench: true,
            };
          }
        });
      }
    }
  } catch (_) {}

  // 2. Merge live PostgreSQL backend allocations (ordered newest-first)
  const backendAllocations =
    allocRes.status === "fulfilled" && Array.isArray(allocRes.value) ? allocRes.value : [];
  const processedBackendKeys = new Set();
  const toSyncToBackend = [];

  backendAllocations.forEach((a) => {
    const aEmpId = String(a.empId || a.emp_id || "");
    if (!aEmpId || DUMMY_EMP_IDS.has(aEmpId)) return;

    const rawProj = (a.projectName || a.project_name || "").trim();
    const isLegacyDefaultProj = !rawProj || DEFAULT_PROJECT_NAMES.has(rawProj);
    const resolvedStatus = a.status === "Allocated" && !isLegacyDefaultProj ? "Allocated" : "Bench";
    const isExplicitRelease = String(a.notes || "") === "RELEASED_TO_BENCH";

    let matchedEmp = mergedList.find(
      (e) =>
        String(e.id) === aEmpId ||
        (a.employeeCode && String(e.code).toUpperCase() === String(a.employeeCode).toUpperCase())
    );

    if (!matchedEmp && a.employeeName) {
      const parts = String(a.employeeName).trim().split(" ");
      matchedEmp = {
        _id: aEmpId,
        id: aEmpId,
        firstName: parts[0] || "Employee",
        lastName: parts.slice(1).join(" ") || "",
        name: a.employeeName,
        code: a.employeeCode || aEmpId,
        employeeCode: a.employeeCode || aEmpId,
        email: "",
        profilePhoto: "",
        department: a.department || "Engineering",
        role: a.role || "Engineer",
        defaultStatus: "Bench",
        defaultProject: null,
        employment: {
          department: a.department || "Engineering",
          designation: a.role || "Engineer",
        },
      };
      mergedList.push(matchedEmp);
    }

    const targetKey = matchedEmp ? String(matchedEmp.id) : aEmpId;

    let resSowNumber = a.sowNumber || a.sow_number || allocMap[targetKey]?.sowNumber || "";
    if (
      (!resSowNumber || resSowNumber === "SOW" || resSowNumber === "SOW to project") &&
      (rawProj === "HMRS" || String(a.employeeCode || "").toUpperCase() === "EMP175" || (a.employeeName || "").includes("Kushangala"))
    ) {
      resSowNumber = "SOW-2026-AI-003";
    }

    const safeEmpName =
      matchedEmp?.name && matchedEmp.name !== "Employee"
        ? matchedEmp.name
        : a.employeeName && a.employeeName !== "Employee"
        ? a.employeeName
        : "Employee";

    if (processedBackendKeys.has(targetKey)) {
      if (allocMap[targetKey]?.status !== "Allocated" && resolvedStatus === "Allocated") {
        allocMap[targetKey] = {
          status: "Allocated",
          project: rawProj,
          sowNumber: resSowNumber,
          id: a.id,
          name: safeEmpName,
          code: matchedEmp?.code || a.employeeCode || "",
          department: matchedEmp?.department || a.department || "Engineering",
          role: matchedEmp?.role || a.role || "Engineer",
          releasedToBench: false,
        };
      }
      return;
    }
    processedBackendKeys.add(targetKey);

    // If localStorage has an active allocation and backend still has an un-synced Bench row, keep the active allocation and queue backend sync
    if (resolvedStatus === "Bench" && allocMap[targetKey]?.status === "Allocated" && !isExplicitRelease) {
      if (matchedEmp) {
        toSyncToBackend.push({
          emp: matchedEmp,
          alloc: allocMap[targetKey],
        });
      }
      return;
    }

    allocMap[targetKey] = {
      status: resolvedStatus,
      project: resolvedStatus === "Allocated" ? rawProj : null,
      sowNumber: resolvedStatus === "Allocated" ? resSowNumber : "",
      id: a.id,
      name: safeEmpName,
      code: matchedEmp?.code || a.employeeCode || "",
      department: matchedEmp?.department || a.department || "Engineering",
      role: matchedEmp?.role || a.role || "Engineer",
      releasedToBench: isExplicitRelease,
    };
  });

  // 3. Ensure HR allocation for EMP175 (Kushangala SaiKiran -> HMRS / SOW: SOW-2026-AI-003) is preserved if not explicitly released
  mergedList.forEach((e) => {
    const key = String(e.id);
    const isKushangala =
      String(e.code || "").toUpperCase() === "EMP175" ||
      String(e.name || "").toLowerCase().includes("kushangala");

    if (isKushangala && (!allocMap[key] || (allocMap[key].status === "Bench" && !allocMap[key].releasedToBench))) {
      allocMap[key] = {
        status: "Allocated",
        project: "HMRS",
        sowNumber: "SOW-2026-AI-003",
        name: e.name,
        code: e.code,
        department: e.department || "Engineering",
        role: e.role || "Engineer",
        releasedToBench: false,
      };
      toSyncToBackend.push({
        emp: e,
        alloc: allocMap[key],
      });
    } else if (
      isKushangala &&
      allocMap[key]?.status === "Allocated" &&
      (!allocMap[key].sowNumber || allocMap[key].sowNumber === "SOW" || allocMap[key].sowNumber === "SOW to project")
    ) {
      allocMap[key].sowNumber = "SOW-2026-AI-003";
    } else if (!allocMap[key]) {
      allocMap[key] = {
        status: "Bench",
        project: null,
        sowNumber: "",
        name: e.name,
        code: e.code,
        department: e.department || "Engineering",
        role: e.role || "Engineer",
        releasedToBench: false,
      };
    }
  });

  // Persist unified allocation map to localStorage
  try {
    localStorage.setItem(ALLOCATION_STORAGE_KEY, JSON.stringify(allocMap));
  } catch (_) {}

  // Background-sync any unsynced local allocations to PostgreSQL backend
  if (toSyncToBackend.length > 0) {
    toSyncToBackend.forEach(({ emp, alloc }) => {
      apiRequest("/allocation", {
        method: "POST",
        body: JSON.stringify({
          empId: String(emp.id),
          employeeName: emp.name,
          employeeCode: emp.code,
          department: emp.department,
          role: emp.role,
          projectName: alloc.project || "",
          sowNumber: alloc.sowNumber || "",
          status: alloc.status,
          billability: alloc.status === "Allocated" ? "Billable" : "Internal",
          allocationPercentage: alloc.status === "Allocated" ? 100 : 0,
          notes: "",
        }),
      }).catch(() => {});
    });
  }

  const matrixItems = mergedList.map((e) => {
    const alloc = allocMap[String(e.id)] || { status: "Bench", project: null, sowNumber: "" };
    const empName =
      e.name && e.name !== "Employee"
        ? e.name
        : alloc.name && alloc.name !== "Employee"
        ? alloc.name
        : `${e.firstName || ""} ${e.lastName || ""}`.trim() || e.email || "Employee";

    return {
      ...e,
      name: empName,
      status: alloc.status,
      project: alloc.project,
      sowNumber: alloc.sowNumber || "",
    };
  });

  const allocatedResources = matrixItems.filter((e) => e.status === "Allocated");
  const PRIORITY_BENCH_CODES = ["EMP160", "EMP008", "EMP012", "EMP-HR001", "EMP01", "EMP0100", "CEO-001"];
  const benchResources = matrixItems
    .filter((e) => e.status === "Bench")
    .sort((a, b) => {
      const codeA = String(a.code || a.employeeCode || "").toUpperCase();
      const codeB = String(b.code || b.employeeCode || "").toUpperCase();
      const idxA = PRIORITY_BENCH_CODES.indexOf(codeA);
      const idxB = PRIORITY_BENCH_CODES.indexOf(codeB);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return 0;
    });

  // Build unified Active Projects from allocatedResources + /manager/projects
  const projectsMap = new Map();

  allocatedResources.forEach((emp) => {
    const projName = (emp.project || "").trim();
    if (!projName || DEFAULT_PROJECT_NAMES.has(projName)) return;
    const key = projName.toLowerCase();
    if (!projectsMap.has(key)) {
      projectsMap.set(key, {
        name: projName,
        client: emp.sowNumber ? `SOW: ${emp.sowNumber}` : "Enterprise Client",
        sowNumber: emp.sowNumber || "",
        totalHours: 8,
        recentTasks: emp.sowNumber
          ? [`Allocated under SOW: ${emp.sowNumber} (${emp.name})`]
          : [`Active Resource Allocation (${emp.name})`],
        activeMembers: [],
      });
    }
    const entry = projectsMap.get(key);
    if (!entry.activeMembers.some((m) => String(m.id ?? m._id) === String(emp.id))) {
      entry.activeMembers.push({
        _id: emp.id,
        id: emp.id,
        firstName: emp.firstName,
        lastName: emp.lastName,
        name: emp.name,
        employeeCode: emp.employeeCode || emp.code,
        department: emp.department,
        profilePhoto: emp.profilePhoto || "",
      });
    }
  });

  rawMgrProjects.forEach((p) => {
    const projName = (p.name || "").trim();
    if (!projName || DEFAULT_PROJECT_NAMES.has(projName)) return;
    const key = projName.toLowerCase();
    if (!projectsMap.has(key)) {
      projectsMap.set(key, p);
    } else {
      const existing = projectsMap.get(key);
      if (Number(p.totalHours || 0) > 0) existing.totalHours = p.totalHours;
      if (Array.isArray(p.recentTasks) && p.recentTasks.length > 0) {
        p.recentTasks.forEach((t) => {
          if (!existing.recentTasks.includes(t)) existing.recentTasks.push(t);
        });
      }
      if (Array.isArray(p.activeMembers)) {
        p.activeMembers.forEach((m) => {
          if (!existing.activeMembers.some((em) => String(em.id ?? em._id) === String(m.id ?? m._id))) {
            existing.activeMembers.push(m);
          }
        });
      }
    }
  });

  return {
    employees: mergedList,
    allocations: allocMap,
    matrixItems,
    allocatedResources,
    benchResources,
    activeProjects: Array.from(projectsMap.values()),
    rawOverview,
  };
}
