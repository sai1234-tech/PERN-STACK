import pool from '../config/db.js';

async function seed() {
  console.log("=== SEEDING EXACT & REALISTIC ENTERPRISE DATA ===");

  // 1. SEED DEPARTMENTS
  const depts = [
    { code: 'ENG', name: 'Engineering & Cloud Architecture', manager: 'Vikas Guru', email: 'manager@hrms.com', location: 'Bangalore HQ - Block 3', desc: 'Core platform engineering, cloud infrastructure, AI models, and frontend client apps.' },
    { code: 'PROD', name: 'Product Strategy & Design', manager: 'Ananya Varma', email: 'ananyavarma.hr@company.com', location: 'Bangalore HQ - Block 2', desc: 'Enterprise product management, UX/UI research, roadmaps, and client analytics.' },
    { code: 'HR', name: 'Human Resources & People Ops', manager: 'Ananya Sharma', email: 'hr@hrms.com', location: 'Bangalore HQ - Executive Wing', desc: 'Employee lifecycle, benefits, compliance, HR helpdesk, and exit clearance.' },
    { code: 'FIN', name: 'Finance, Accounts & Payroll', manager: 'Pooja Hegde', email: 'payroll@hrms.com', location: 'Bangalore HQ - Finance Floor', desc: 'Statutory compliance, monthly payroll disbursement, tax computations, and F&F settlement.' },
    { code: 'TA', name: 'Talent Acquisition & Global Staffing', manager: 'Rohan Verma', email: 'recruiter@hrms.com', location: 'Hyderabad Technology Center', desc: 'Technical sourcing, candidate pipelines, interview panels, and offer generation.' },
    { code: 'IT', name: 'IT Infrastructure & Cyber Security', manager: 'Kiran Kumar', email: 'itadmin@hrms.com', location: 'Pune Digital Delivery Hub', desc: 'Hardware asset provisioning, corporate SSO, network infrastructure, and access revocation.' }
  ];

  for (const d of depts) {
    await pool.query(`
      INSERT INTO departments (department_code, department_name, manager_name, manager_email, location, description, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'Active')
      ON CONFLICT (department_code) DO UPDATE SET
        department_name = EXCLUDED.department_name,
        manager_name = EXCLUDED.manager_name,
        manager_email = EXCLUDED.manager_email,
        location = EXCLUDED.location,
        description = EXCLUDED.description;
    `, [d.code, d.name, d.manager, d.email, d.location, d.desc]);
  }
  console.log("✓ Departments seeded:", depts.length);

  // 2. ENRICH DEMO EMPLOYEES
  const employeeUpdates = [
    {
      email: 'employee@hrms.com',
      code: 'EMP-2014',
      first: 'Arjun',
      last: 'Reddy',
      dept: 'Engineering',
      desig: 'Senior Full Stack Engineer',
      salary: 1450000,
      joiningDate: '2023-03-15',
      phone: '+91 98765 43210',
      address: '14B Koramangala 4th Block, Bangalore - 560034',
      bankName: 'HDFC Bank',
      accNo: '50100492819201',
      ifsc: 'HDFC0000240',
      pan: 'ABCDE1234F',
      uan: '101928471920',
      reportsTo: 194 // Vikas Guru
    },
    {
      email: 'manager@hrms.com',
      code: 'EMP-2013',
      first: 'Vikas',
      last: 'Guru',
      dept: 'Engineering',
      desig: 'Engineering Delivery Manager',
      salary: 2600000,
      joiningDate: '2021-06-01',
      phone: '+91 98450 11223',
      address: 'Penthouse 8, Indiranagar, Bangalore - 560038',
      bankName: 'ICICI Bank',
      accNo: '000201948271',
      ifsc: 'ICIC0000002',
      pan: 'GURUV9821K',
      uan: '100827364819',
      reportsTo: 15 // CEO
    },
    {
      email: 'hr@hrms.com',
      code: 'EMP-2012',
      first: 'Ananya',
      last: 'Sharma',
      dept: 'Human Resources',
      desig: 'Senior HR Business Partner & People Operations',
      salary: 1600000,
      joiningDate: '2022-01-10',
      phone: '+91 99887 66554',
      address: 'Block C, Whitefield, Bangalore - 560066',
      bankName: 'HDFC Bank',
      accNo: '50100234912384',
      ifsc: 'HDFC0001234',
      pan: 'ANANY4829P',
      uan: '101234567890',
      reportsTo: 15
    },
    {
      email: 'admin@hrms.com',
      code: 'EMP-2011',
      first: 'System',
      last: 'Administrator',
      dept: 'Executive Leadership',
      desig: 'Chief Systems Administrator & Compliance Lead',
      salary: 2800000,
      joiningDate: '2020-01-01',
      phone: '+91 97654 32109',
      address: 'Outer Ring Road, Bangalore - 560103',
      bankName: 'State Bank of India',
      accNo: '309284719284',
      ifsc: 'SBIN0004032',
      pan: 'ADMIN9823M',
      uan: '100293847561',
      reportsTo: 15
    },
    {
      email: 'recruiter@hrms.com',
      code: 'EMP-2049',
      first: 'Rohan',
      last: 'Verma',
      dept: 'Talent Acquisition',
      desig: 'Lead Technical Recruiter',
      salary: 1200000,
      joiningDate: '2023-05-10',
      phone: '+91 98112 33445',
      address: 'Madhapur, Hyderabad - 500081',
      bankName: 'Axis Bank',
      accNo: '91802004829182',
      ifsc: 'UTIB0000123',
      pan: 'ROHAN1294F',
      uan: '101928374650',
      reportsTo: 192
    },
    {
      email: 'payroll@hrms.com',
      code: 'EMP-2050',
      first: 'Pooja',
      last: 'Hegde',
      dept: 'Finance & Accounts',
      desig: 'Payroll & Statutory Compensation Lead',
      salary: 1500000,
      joiningDate: '2022-09-01',
      phone: '+91 98223 44556',
      address: 'Jayanagar 4th T Block, Bangalore - 560041',
      bankName: 'Kotak Mahindra Bank',
      accNo: '7829102948',
      ifsc: 'KKBK0000421',
      pan: 'POOJA9281H',
      uan: '101827364519',
      reportsTo: 15
    },
    {
      email: 'itadmin@hrms.com',
      code: 'EMP-2051',
      first: 'Kiran',
      last: 'Kumar',
      dept: 'IT Infrastructure',
      desig: 'Senior IT Systems & Cloud Assets Lead',
      salary: 1350000,
      joiningDate: '2022-11-15',
      phone: '+91 98334 55667',
      address: 'Kalyani Nagar, Pune - 411006',
      bankName: 'HDFC Bank',
      accNo: '50100982718291',
      ifsc: 'HDFC0000142',
      pan: 'KIRAN4821L',
      uan: '101728394018',
      reportsTo: 200
    },
    {
      email: 'leadership@hrms.com',
      code: 'EMP-2052',
      first: 'Meera',
      last: 'Nair',
      dept: 'Executive Board',
      desig: 'VP Strategic Operations & Global Delivery',
      salary: 4200000,
      joiningDate: '2020-03-01',
      phone: '+91 98445 66778',
      address: 'Sadashivanagar, Bangalore - 560080',
      bankName: 'Standard Chartered',
      accNo: '48291029384',
      ifsc: 'SCBL0036001',
      pan: 'MEERA8291N',
      uan: '100192837465',
      reportsTo: 15
    },
    {
      email: 'auditor@hrms.com',
      code: 'EMP-2053',
      first: 'Suresh',
      last: 'Iyer',
      dept: 'Compliance & Risk',
      desig: 'Statutory Auditor & Chief Compliance Officer',
      salary: 2400000,
      joiningDate: '2021-04-15',
      phone: '+91 98556 77889',
      address: 'Malleshwaram, Bangalore - 560003',
      bankName: 'Canara Bank',
      accNo: '109284719283',
      ifsc: 'CNRB0000124',
      pan: 'SURES7281I',
      uan: '100829103847',
      reportsTo: 15
    }
  ];

  for (const emp of employeeUpdates) {
    const employment = {
      salary: emp.salary,
      status: 'Active',
      reportsTo: emp.reportsTo,
      dateOfExit: null,
      department: emp.dept,
      designation: emp.desig,
      joiningDate: emp.joiningDate,
      employmentType: 'Full Time'
    };

    const personal = {
      phone: emp.phone,
      address: emp.address,
      dob: '1992-05-14',
      bloodGroup: 'B+'
    };

    const banking = {
      bankName: emp.bankName,
      accountNumber: emp.accNo,
      ifsc: emp.ifsc,
      pan: emp.pan,
      uan: emp.uan
    };

    await pool.query(`
      UPDATE employees SET
        first_name = $1,
        last_name = $2,
        employee_code = $3,
        phone = $4,
        pan = $5,
        uan = $6,
        employment = $7,
        personal = $8,
        banking = $9,
        updated_at = CURRENT_TIMESTAMP
      WHERE email = $10;
    `, [emp.first, emp.last, emp.code, emp.phone, emp.pan, emp.uan, JSON.stringify(employment), JSON.stringify(personal), JSON.stringify(banking), emp.email]);
  }
  console.log("✓ Demo employees enriched with complete employment & banking profiles.");

  // 3. SEED REALISTIC RESIGNATIONS
  const arjun = await pool.query("SELECT id FROM employees WHERE email = 'employee@hrms.com'");
  const saikiran = await pool.query("SELECT id FROM employees WHERE email = 'skushangala@quadratics.com'");
  const aisha = await pool.query("SELECT id FROM employees WHERE email = 'aisha.sharma@example.com'");

  const arjunId = arjun.rows[0]?.id;
  const saikiranId = saikiran.rows[0]?.id;
  const aishaId = aisha.rows[0]?.id;

  // Clear old resignations to ensure exact sync
  await pool.query("DELETE FROM clearances;");
  await pool.query("DELETE FROM resignations;");

  let arjunResId = null;
  let saikiranResId = null;

  if (arjunId) {
    const res = await pool.query(`
      INSERT INTO resignations (
        employee_id, resignation_date, notice_period_days, requested_last_working_day, approved_last_working_day,
        reason_category, reason_details, status, hr_review_comment, manager_review_comment
      ) VALUES (
        $1, '2026-09-15', 90, '2026-12-15', '2026-12-15',
        'better-opportunity', 'Pursuing a Principal Cloud Architect position. Ensuring seamless knowledge transfer of billing microservices to team.',
        'approved', 'Official HR approval granted. 90-day notice period active until Dec 15, 2026. Departmental clearance matrix initialized.',
        'Recommended for approval. Thorough KT plan prepared.'
      ) RETURNING id;
    `, [arjunId]);
    arjunResId = res.rows[0].id;
  }

  if (saikiranId) {
    const res = await pool.query(`
      INSERT INTO resignations (
        employee_id, resignation_date, notice_period_days, requested_last_working_day, approved_last_working_day,
        reason_category, reason_details, status, hr_review_comment, manager_review_comment
      ) VALUES (
        $1, '2026-08-01', 90, '2026-10-31', '2026-10-31',
        'higher-studies', 'Admitted to Master of Science program in Artificial Intelligence.',
        'approved', 'Approved. All departmental clearances completed. Relieving documentation generated.',
        'Approved. All deliverables transitioned.'
      ) RETURNING id;
    `, [saikiranId]);
    saikiranResId = res.rows[0].id;
  }

  if (aishaId) {
    await pool.query(`
      INSERT INTO resignations (
        employee_id, resignation_date, notice_period_days, requested_last_working_day, approved_last_working_day,
        reason_category, reason_details, status, hr_review_comment, manager_review_comment
      ) VALUES (
        $1, '2026-10-01', 90, '2026-12-30', NULL,
        'personal-reasons', 'Family relocation to another state.',
        'manager_approved', '', 'Forwarded to HR with recommendation for notice buyout review.'
      );
    `, [aishaId]);
  }
  console.log("✓ Resignations seeded: 3 records (Arjun Reddy, Kushangala SaiKiran, Aisha Sharma).");

  // 4. SEED MATCHING CLEARANCES
  if (arjunId && arjunResId) {
    await pool.query(`
      INSERT INTO clearances (
        employee_id, resignation_id, assets, it_access, finance, leave_attendance, documents, final_settlement, relieving_letter
      ) VALUES (
        $1, $2,
        '{"status": "cleared", "comments": "MacBook Pro 16-inch M2 Max (Serial #MBP-8921) & Dell 4K display surrendered.", "clearedAt": "2026-10-18T14:30:00Z"}'::jsonb,
        '{"status": "in_progress", "comments": "AWS IAM rights & corporate Google Workspace scheduled for Dec 15 cutoff.", "clearedAt": null}'::jsonb,
        '{"status": "cleared", "comments": "Corporate credit card surrendered. No travel reimbursement advances outstanding.", "clearedAt": "2026-10-19T11:15:00Z"}'::jsonb,
        '{"status": "cleared", "comments": "Final month attendance verified. 12 days unavailed paid leaves audited for encashment.", "clearedAt": "2026-10-20T10:00:00Z"}'::jsonb,
        '{"status": "cleared", "comments": "Non-Disclosure & IP Agreement compliance signed. Exit interview completed.", "clearedAt": "2026-10-20T09:45:00Z"}'::jsonb,
        '{"status": "ready_for_neft", "grossEarned": 120833, "leaveEncashment": 58000, "gratuity": 0, "deductions": 16500, "netPayable": 162333, "processedAt": "2026-10-21T10:00:00Z"}'::jsonb,
        '{"issued": true, "issuedAt": "2026-10-21T11:00:00Z", "documentUrl": "/documents/relieving-EMP-2014.pdf"}'::jsonb
      );
    `, [arjunId, arjunResId]);
  }

  if (saikiranId && saikiranResId) {
    await pool.query(`
      INSERT INTO clearances (
        employee_id, resignation_id, assets, it_access, finance, leave_attendance, documents, final_settlement, relieving_letter
      ) VALUES (
        $1, $2,
        '{"status": "cleared", "comments": "ThinkPad X1 Carbon (Serial #TP-4412) & access badge surrendered to IT.", "clearedAt": "2026-10-15T10:00:00Z"}'::jsonb,
        '{"status": "cleared", "comments": "SSO credentials and GitHub repo contributor access deactivated.", "clearedAt": "2026-10-16T12:00:00Z"}'::jsonb,
        '{"status": "cleared", "comments": "Accounts verified zero pending dues or travel advances.", "clearedAt": "2026-10-17T14:00:00Z"}'::jsonb,
        '{"status": "cleared", "comments": "8 days leave encashed in final payroll run.", "clearedAt": "2026-10-18T15:00:00Z"}'::jsonb,
        '{"status": "cleared", "comments": "Formal exit interview conducted by Lead HR.", "clearedAt": "2026-10-19T16:00:00Z"}'::jsonb,
        '{"status": "disbursed", "grossEarned": 75000, "leaveEncashment": 24000, "gratuity": 0, "deductions": 9000, "netPayable": 90000, "processedAt": "2026-10-20T10:00:00Z"}'::jsonb,
        '{"issued": true, "issuedAt": "2026-10-20T10:30:00Z", "documentUrl": "/documents/relieving-EMP175.pdf"}'::jsonb
      );
    `, [saikiranId, saikiranResId]);
  }
  console.log("✓ Clearances seeded with full itemized status, F&F settlement and relieving letter records.");

  // 5. SEED REALISTIC LEAVES & ATTENDANCE PUNCHES
  if (arjunId) {
    await pool.query(`
      INSERT INTO leaves (employee_id, leave_type_id, start_date, end_date, number_of_days, reason, status)
      VALUES 
        ($1, 1, '2026-10-14', '2026-10-15', 2, 'Personal family function in Chennai', 'Approved'),
        ($1, 2, '2026-11-05', '2026-11-06', 2, 'Attending Cloud Architecture Summit', 'Pending Manager')
      ON CONFLICT DO NOTHING;
    `, [arjunId]);

    // Ensure recent attendance punches for Arjun Reddy (user_id: 14)
    await pool.query(`
      INSERT INTO attendance (employee_id, date, check_in, check_out, working_hours, status)
      VALUES 
        (14, '2026-10-21', '2026-10-21 09:05:00', '2026-10-21 18:15:00', 8.5, 'present'),
        (14, '2026-10-22', '2026-10-22 08:58:00', NULL, 0, 'present')
      ON CONFLICT (employee_id, date) DO UPDATE SET
        check_in = EXCLUDED.check_in,
        check_out = EXCLUDED.check_out,
        working_hours = EXCLUDED.working_hours,
        status = EXCLUDED.status;
    `);
  }
  console.log("✓ Leaves and attendance verified for Arjun Reddy.");

  console.log("=== SEEDING COMPLETED SUCCESSFULLY ===");
  process.exit(0);
}

seed().catch(err => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
