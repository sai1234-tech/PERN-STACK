-- 1.Check All Employees (employees table)
SELECT 
    id, 
    employee_code, 
    first_name, 
    last_name, 
    email, 
    phone, 
    employment->>'department' AS department, 
    employment->>'designation' AS designation, 
    personal->>'bloodGroup' AS blood_group, 
    skills, 
    created_at, 
    updated_at 
FROM employees 
ORDER BY id DESC;

-- 2. Check Employees Joined with User Accounts
SELECT 
    e.id AS employee_id,
    e.employee_code,
    e.first_name,
    e.last_name,
    e.email AS work_email,
    u.id AS user_id,
    u.name AS user_name,
    u.role AS user_role,
    u.is_active,
    e.employment->>'department' AS department,
    e.employment->>'designation' AS designation,
    e.skills
FROM employees e
LEFT JOIN users u ON e.user_id = u.id
ORDER BY e.id DESC;

-- 3. View Full Raw JSONB Data of Employees
SELECT id, employee_code, first_name, email, personal, employment, address, skills 
FROM employees;




