const fs = require('fs');
let code = fs.readFileSync('c:\\Users\\Admin\\Desktop\\HRMS\\Back-End\\HRMSBackend\\app.js', 'utf8');
code = code.replace("app.get(\"/health\", (req, res) => {\n  res.status(200).json({ success: true, message: \"HRMS API is healthy\" });\n});\n});", "app.get(\"/health\", (req, res) => {\n  res.status(200).json({ success: true, message: \"HRMS API is healthy\" });\n});");
fs.writeFileSync('c:\\Users\\Admin\\Desktop\\HRMS\\Back-End\\HRMSBackend\\app.js', code);
