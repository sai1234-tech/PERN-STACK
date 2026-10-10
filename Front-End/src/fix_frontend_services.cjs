const fs = require('fs');
const path = require('path');

const servicesDir = path.join(__dirname, 'services');

const rules = [
  { file: 'attendanceService.js', replacements: [
    { from: '/v1/attendance/my', to: '/attendance/my' },
    { from: '/v1/attendance/today', to: '/attendance/today' },
    { from: '/v1/attendance/check-in', to: '/attendance/check-in' },
    { from: '/v1/attendance/check-out', to: '/attendance/check-out' },
    { from: '/v1/attendance', to: '/attendance' }
  ]},
  { file: 'leaveService.js', replacements: [
    { from: '/v1/leaves', to: '/leaves' },
  ]},
  { file: 'payrollService.js', replacements: [
    { from: '/v1/payroll', to: '/payroll' }
  ]},
  { file: 'timesheetService.js', replacements: [
    { from: '/v1/timesheets', to: '/timesheets' }
  ]},
  { file: 'documentService.js', replacements: [
    { from: '/v1/documents', to: '/documents' }
  ]},
  { file: 'employeeService.js', replacements: [
    { from: '/../employees', to: '/employees' },
    { from: '/../employee', to: '/employee' }
  ]},
  { file: 'departmentService.js', replacements: [
    { from: '/../departments', to: '/departments' }
  ]},
  { file: 'hrService.js', replacements: [
    { from: '/../employees', to: '/employees' },
    { from: '/v1/attendance', to: '/attendance' },
    { from: '/v1/leaves', to: '/leaves' }
  ]},
];

rules.forEach(rule => {
  const filepath = path.join(servicesDir, rule.file);
  if (fs.existsSync(filepath)) {
    let content = fs.readFileSync(filepath, 'utf8');
    let original = content;
    
    // Global replacements via string split/join
    rule.replacements.forEach(rep => {
      content = content.split(rep.from).join(rep.to);
    });
    
    if (content !== original) {
      fs.writeFileSync(filepath, content, 'utf8');
      console.log('Fixed paths in', rule.file);
    }
  }
});
