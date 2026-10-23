import pool from './config/db.js';
import jwt from 'jsonwebtoken';
import http from 'http';
import generateJwt from './utils/generateJwt.js';

async function main() {
  console.log('--- DB & USER ROLES CHECK ---');
  const roles = await pool.query('SELECT DISTINCT role, COUNT(*) FROM users GROUP BY role;');
  console.log('Roles:', roles.rows);

  const users = await pool.query('SELECT id, email, role FROM users LIMIT 15;');
  console.log('Users sample:', users.rows);

  const jwtSecret = process.env.JWT_SECRET || 'secret';
  console.log('JWT_SECRET available:', !!jwtSecret);

  let hrUser = users.rows.find(u => u.role.toLowerCase() === 'hr');
  if (!hrUser) {
    hrUser = { id: 3, email: 'hr@company.com', role: 'hr' };
  }
  console.log('Using test identity:', hrUser);

  const token = generateJwt(hrUser.id, hrUser.role);
  console.log('Generated authentic JWT token');

  console.log('Generated test token for live API verification');

  // Helper for HTTP requests
  function testEndpoint(path, method = 'GET', body = null) {
    return new Promise((resolve) => {
      const payload = body ? JSON.stringify(body) : null;
      const req = http.request({
        hostname: 'localhost',
        port: 5005,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({ path, status: res.statusCode, data: JSON.parse(data) });
          } catch(e) {
            resolve({ path, status: res.statusCode, raw: data.substring(0, 100) });
          }
        });
      });
      req.on('error', err => resolve({ path, error: err.message }));
      if (payload) req.write(payload);
      req.end();
    });
  }

  console.log('\n--- VERIFYING ENDPOINTS FOR ALL 8 HRMS OBJECTIVES ---');

  // Objective 1: Single source of truth (Employees & Departments)
  const emp = await testEndpoint('/api/v1/employees');
  console.log('1. Single Source of Truth (/api/v1/employees):', emp.status, emp.data ? `Found ${emp.data?.data?.length ?? (Array.isArray(emp.data) ? emp.data.length : 'OK')}` : emp.raw);
  const dept = await testEndpoint('/api/v1/departments');
  console.log('   Departments (/api/v1/departments):', dept.status);

  // Objective 1b: Employee History Tracking (EMP-009)
  const history = await testEndpoint('/api/v1/employees/13/history');
  console.log('   Employee 13 History (/api/v1/employees/13/history):', history.status, history.data?.data ? `Found ${history.data.data.length} records` : history.raw || history.data);

  // Objective 2 & 3: Standardize employee lifecycle workflows and approvals
  const leaves = await testEndpoint('/api/v1/leaves');
  console.log('2 & 3. Workflows - Leaves (/api/v1/leaves):', leaves.status);
  const clearances = await testEndpoint('/api/v1/clearances');
  console.log('   Workflows - Clearances (/api/v1/clearances):', clearances.status);
  const resignations = await testEndpoint('/api/v1/resignations');
  console.log('   Workflows - Resignations (/api/v1/resignations):', resignations.status);
  const tickets = await testEndpoint('/api/v1/tickets');
  console.log('   Workflows - Helpdesk Tickets (/api/v1/tickets):', tickets.status);

  // Objective 4: Recruitment, BGV & One-Click Onboarding
  const candidates = await testEndpoint('/api/v1/candidates');
  console.log('4. Recruitment & BGV (/api/v1/candidates):', candidates.status, candidates.data?.data ? `${candidates.data.data.length} candidates` : '');
  
  // Create a candidate to test lifecycle
  const newCand = await testEndpoint('/api/v1/candidates', 'POST', {
    name: 'Integration Test Candidate',
    email: `cand_test_${Date.now()}@example.com`,
    role: 'Full Stack Engineer',
    department: 'Engineering',
    stage: 'Offer Accepted',
    bgv_status: 'In Progress',
    experience: '4 years',
    skills: ['React', 'Node.js', 'PostgreSQL']
  });
  console.log('   Create Candidate:', newCand.status, newCand.data?.data?.name);

  if (newCand.data?.data?.id) {
    const candId = newCand.data.data.id;
    // Test BGV update
    const bgvUpdate = await testEndpoint(`/api/v1/candidates/${candId}/bgv`, 'PATCH', {
      bgv_status: 'Clear',
      notes: 'Automated verification check passed'
    });
    console.log('   BGV Update to Clear:', bgvUpdate.status, bgvUpdate.data?.message);

    // Test 1-Click Onboard to Employee
    const onboard = await testEndpoint(`/api/v1/candidates/${candId}/onboard`, 'POST', {
      department: 'Engineering',
      designation: 'Senior Full Stack Developer'
    });
    console.log('   1-Click Onboard to Employee:', onboard.status, onboard.data?.message, onboard.data?.data?.employee?.employeeCode);
  }

  // Objective 5: Role-based access control
  const hrOnlyCheck = await testEndpoint('/api/v1/manager/team');
  console.log('5. Role-based Access (/api/v1/manager/team):', hrOnlyCheck.status);

  // Objective 6: Staff-Augmentation Client/Project Allocation & Client Master
  const allocs = await testEndpoint('/api/v1/allocations');
  console.log('6. Project Allocations (/api/v1/allocations):', allocs.status, allocs.data?.data ? `${allocs.data.data.length} active allocations` : '');
  
  const clientsCheck = await testEndpoint('/api/v1/client-master/clients');
  console.log('   Client Master (/api/v1/client-master/clients):', clientsCheck.status, clientsCheck.data?.data ? `Found ${clientsCheck.data.data.length} clients` : '');

  const projectsCheck = await testEndpoint('/api/v1/client-master/projects');
  console.log('   Project / SOW Master (/api/v1/client-master/projects):', projectsCheck.status, projectsCheck.data?.data ? `Found ${projectsCheck.data.data.length} project SOWs` : '');

  const ratesCheck = await testEndpoint('/api/v1/client-master/rate-cards');
  console.log('   Commercial Rate-Cards (/api/v1/client-master/rate-cards):', ratesCheck.status, ratesCheck.data?.data ? `Found ${ratesCheck.data.data.length} rate cards (Commercial clearance: ${ratesCheck.data.canManageCommercials})` : '');

  const transitionsCheck = await testEndpoint('/api/v1/client-master/transitions');
  console.log('   Transitions / Replacement Tracker (/api/v1/client-master/transitions):', transitionsCheck.status, transitionsCheck.data?.data ? `Found ${transitionsCheck.data.data.length} active transitions` : '');

  // Objective 7: Audit-Ready Records & Dashboards
  const audits = await testEndpoint('/api/v1/audit');
  console.log('7. Audit-Ready Records (/api/v1/audit):', audits.status, audits.data?.data ? `${audits.data.data.length} audit logs recorded` : '');

  // Objective 8: Payroll, Attendance, & SSE Live Sync Integrations
  const payroll = await testEndpoint('/api/v1/payroll');
  console.log('8. Payroll Integration (/api/v1/payroll):', payroll.status);
  const attendance = await testEndpoint('/api/v1/attendance/today');
  console.log('   Attendance API (/api/v1/attendance/today):', attendance.status);

  process.exit(0);
}

main().catch(err => {
  console.error('Error running test script:', err);
  process.exit(1);
});
