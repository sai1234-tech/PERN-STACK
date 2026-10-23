import "dotenv/config";
import generateJwt from '../utils/generateJwt.js';
import http from 'http';

function makeRequest(path, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5005,
      path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function testHrEndpoints() {
  const hrToken = generateJwt(12, 'hr');
  const endpoints = [
    '/api/employees',
    '/api/attendance',
    '/api/leaves',
    '/api/timesheets/all',
    '/api/candidates',
    '/api/tickets',
    '/api/resignations/all',
    '/api/clearances/all',
    '/api/allocations',
    '/api/payroll',
    '/api/v1/performance/all',
    '/api/audit?limit=25'
  ];

  console.log("=== TESTING HR API ENDPOINTS FOR 9-DOMAIN KPI DASHBOARD ===");
  for (const ep of endpoints) {
    try {
      const res = await makeRequest(ep, hrToken);
      const dataArr = res.body.data || res.body.records || res.body.employees || res.body.allocations || res.body.tickets || res.body.candidates || (Array.isArray(res.body) ? res.body : null);
      console.log(`Endpoint ${ep.padEnd(28)} -> Status: ${res.status}, Count: ${Array.isArray(dataArr) ? dataArr.length : (res.body.count || 'Object/Success')}`);
    } catch (err) {
      console.log(`Endpoint ${ep.padEnd(28)} -> ERROR: ${err.message}`);
    }
  }
  process.exit(0);
}

testHrEndpoints();
