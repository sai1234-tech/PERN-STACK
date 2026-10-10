const fs = require('fs');
let code = fs.readFileSync('routes/document.routes.js', 'utf8');
if (code.indexOf('router.get("/:id"') < code.indexOf('router.get("/:id/download"')) {
  const downloadMatch = code.match(/router\.get\(\s*"\/:id\/download"[\s\S]*?\);/);
  if (downloadMatch) {
    code = code.replace(downloadMatch[0], '');
    code = code.replace(/router\.get\(\s*"\/:id"[\s\S]*?\);/, downloadMatch[0] + '\n\n$&');
    fs.writeFileSync('routes/document.routes.js', code);
    console.log('Fixed document routes order');
  }
}
