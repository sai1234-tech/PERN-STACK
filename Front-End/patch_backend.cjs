const fs = require('fs');
const path = require('path');

const backendDir = 'c:\\Users\\Admin\\Desktop\\HRMS\\Back-End\\HRMSBackend';

// 1. Fix app.js
const appJsPath = path.join(backendDir, 'app.js');
let appCode = fs.readFileSync(appJsPath, 'utf8');

const corsReplacement = `const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(\`CORS origin not allowed: \${origin}\`));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);`;
appCode = appCode.replace(/app\.use\([\s\S]*?cors\(\{[\s\S]*?credentials: true,[\s\S]*?\}\)[\s\S]*?\);/, corsReplacement);

if (!appCode.includes('/health')) {
  appCode = appCode.replace(
    /app\.get\("\/api\/v1",[\s\S]*?\}\);/,
    `app.get("/api/v1", (req, res) => {
  res.status(200).json({ success: true, message: "HRMS API v1 is running" });
});

app.get("/health", (req, res) => {
  res.status(200).json({ success: true, message: "HRMS API is healthy" });
});`
  );
}

appCode = appCode.replace(/app\.use\("\/auth", authRoutes\);\n?/g, '');
appCode = appCode.replace(/app\.use\("\/api\/v1\/auth", authRoutes\);\n?/g, '');
appCode = appCode.replace(/app\.use\("\/api\/v1\/employees", employeeRoutes\);\n?/g, '');
appCode = appCode.replace(/app\.use\("\/api\/v1\/employee\/me", myProfileRoutes\);\n?/g, '');
appCode = appCode.replace(/app\.use\("\/api\/v1\/departments", departmentRoutes\);\n?/g, '');
appCode = appCode.replace(/app\.use\("\/api\/v1\/attendance", attendanceRoutes\);\n?/g, '');
appCode = appCode.replace(/app\.use\("\/api\/v1\/leaves", leaveRoutes\);\n?/g, '');
appCode = appCode.replace(/app\.use\("\/api\/v1\/timesheets", timesheetRoutes\);\n?/g, '');
appCode = appCode.replace(/app\.use\("\/api\/v1\/payroll", payrollRoutes\);\n?/g, '');
appCode = appCode.replace(/app\.use\("\/api\/v1\/documents", documentRoutes\);\n?/g, '');

const routesMounting = `app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/employees", employeeRoutes);
app.use("/api/v1/employee/me", myProfileRoutes);
app.use("/api/v1/departments", departmentRoutes);
app.use("/api/v1/attendance", attendanceRoutes);
app.use("/api/v1/leaves", leaveRoutes);
app.use("/api/v1/timesheets", timesheetRoutes);
app.use("/api/v1/payroll", payrollRoutes);
app.use("/api/v1/documents", documentRoutes);
`;
appCode = appCode.replace('app.use(errorHandler);', routesMounting + '\napp.use(errorHandler);');
fs.writeFileSync(appJsPath, appCode);

// 2. Fix server.js
const serverJsPath = path.join(backendDir, 'server.js');
let serverCode = fs.readFileSync(serverJsPath, 'utf8');
serverCode = serverCode.replace(/app\.listen\(PORT, \(\) => \{[\s\S]*?\}\);/, `app.listen(PORT, "127.0.0.1", () => {\n  console.log(\`HRMS API running at http://127.0.0.1:\${PORT}\`);\n});`);
fs.writeFileSync(serverJsPath, serverCode);

// 3. Fix documentRoutes.js
const docRoutesPath = path.join(backendDir, 'routes', 'documentRoutes.js');
if (fs.existsSync(docRoutesPath)) {
  let docCode = fs.readFileSync(docRoutesPath, 'utf8');
  if (docCode.indexOf('router.get("/:id"') < docCode.indexOf('router.get("/:id/download"')) {
    const downloadRouteMatch = docCode.match(/router\.get\(\n?\s*"\/:id\/download",[\s\S]*?downloadDocument\n?\s*\);/);
    if (downloadRouteMatch) {
      docCode = docCode.replace(downloadRouteMatch[0], '');
      docCode = docCode.replace(/router\.get\(\n?\s*"\/:id",[\s\S]*?getDocument\n?\s*\);/, downloadRouteMatch[0] + '\n\n$&');
      fs.writeFileSync(docRoutesPath, docCode);
    } else {
       const dlSingle = docCode.match(/router\.get\("\/:id\/download",[\s\S]*?downloadDocument\);/);
       if (dlSingle) {
         docCode = docCode.replace(dlSingle[0], '');
         docCode = docCode.replace(/router\.get\("\/:id",[\s\S]*?getDocument\);/, dlSingle[0] + '\n\n$&');
         fs.writeFileSync(docRoutesPath, docCode);
       }
    }
  }
}
console.log("Backend patched successfully!");
