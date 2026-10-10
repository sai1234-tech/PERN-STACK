const fs = require('fs');
const path = require('path');
const walkSync = (dir, callback) => {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filepath = path.join(dir, file);
    if (fs.statSync(filepath).isDirectory()) walkSync(filepath, callback);
    else if (filepath.endsWith('.js') || filepath.endsWith('.jsx')) callback(filepath);
  });
};
walkSync('.', (filepath) => {
  if(filepath.includes('node_modules')) return;
  let content = fs.readFileSync(filepath, 'utf8');
  let original = content;
  content = content.replace(/import\.meta\.env\.VITE_API_URL/g, 'String(import.meta.env.VITE_API_URL || "").replace("localhost", "127.0.0.1")');
  if (content !== original) {
    fs.writeFileSync(filepath, content, 'utf8');
    console.log('Updated env usage', filepath);
  }
});
