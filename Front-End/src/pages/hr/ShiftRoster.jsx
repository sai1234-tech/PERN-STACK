import React, { useState, useEffect, useMemo } from "react";
import EmployeeHeader from "../../components/employee/EmployeeHeader";
import Loader from "../../components/common/Loader";
import { getAllEmployees } from "../../services/employeeService";
import "./ShiftRoster.css";

const SHIFT_TYPES = [
  { id: "Morning", label: "Morning Shift", time: "06:00 - 14:00", icon: "🌅", theme: "morning" },
  { id: "Evening", label: "Evening Shift", time: "14:00 - 22:00", icon: "🌇", theme: "evening" },
  { id: "Night", label: "Night Shift", time: "22:00 - 06:00", icon: "🌙", theme: "night" },
  { id: "General", label: "General / Off", time: "09:00 - 18:00", icon: "☕", theme: "general" },
];

const LOCAL_STORAGE_KEY = "hrms_shift_roster_assignments";

export default function ShiftRoster() {
  const [employees, setEmployees] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [selectedShiftFilter, setSelectedShiftFilter] = useState("ALL");
  const [selectedEmpIds, setSelectedEmpIds] = useState([]);
  const [batchTargetShift, setBatchTargetShift] = useState("Morning");
  const [notice, setNotice] = useState("");
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [modalEmpId, setModalEmpId] = useState("");
  const [modalShift, setModalShift] = useState("Morning");

  // Fetch employees and load saved shifts
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const res = await getAllEmployees();
        const empList = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        setEmployees(empList);

        // Load stored shift assignments
        const savedShifts = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (savedShifts) {
          try {
            setAssignments(JSON.parse(savedShifts));
          } catch {
            // fallback
          }
        } else {
          // Initialize default shift rotation for loaded employees
          const initial = {};
          empList.forEach((e, idx) => {
            const empId = e._id || e.id;
            if (idx % 3 === 0) initial[empId] = "Morning";
            else if (idx % 3 === 1) initial[empId] = "Evening";
            else initial[empId] = "Night";
          });
          setAssignments(initial);
        }
      } catch (err) {
        console.error("Failed to load roster employees:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Save single shift update
  const saveShift = (empId, shift) => {
    const updated = { ...assignments, [empId]: shift };
    setAssignments(updated);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    setNotice("Shift updated successfully.");
    setTimeout(() => setNotice(""), 3000);
  };

  // Batch assign selected employees
  const handleBatchAssign = () => {
    if (selectedEmpIds.length === 0) return;
    const updated = { ...assignments };
    selectedEmpIds.forEach(id => {
      updated[id] = batchTargetShift;
    });
    setAssignments(updated);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    setSelectedEmpIds([]);
    setNotice(`Assigned ${selectedEmpIds.length} employee(s) to ${batchTargetShift} shift.`);
    setTimeout(() => setNotice(""), 3000);
  };

  // Toggle selection checkbox
  const toggleSelect = (id) => {
    setSelectedEmpIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Extract unique departments
  const departments = useMemo(() => {
    const set = new Set();
    employees.forEach(e => {
      const d = e.employment?.department || e.department;
      if (d) set.add(d);
    });
    return ["ALL", ...Array.from(set)];
  }, [employees]);

  // Filtered employee list
  const filteredEmployees = useMemo(() => {
    return employees.filter(e => {
      const empId = e._id || e.id;
      const name = `${e.firstName || ""} ${e.lastName || ""}`.trim() || e.name || e.email || "";
      const code = e.employeeCode || e.employeeId || "";
      const dept = e.employment?.department || e.department || "";
      const currentShift = assignments[empId] || "Morning";

      const matchesSearch = name.toLowerCase().includes(search.toLowerCase()) || code.toLowerCase().includes(search.toLowerCase()) || dept.toLowerCase().includes(search.toLowerCase());
      const matchesDept = deptFilter === "ALL" || dept.toLowerCase() === deptFilter.toLowerCase();
      const matchesShift = selectedShiftFilter === "ALL" || currentShift === selectedShiftFilter;

      return matchesSearch && matchesDept && matchesShift;
    });
  }, [employees, search, deptFilter, selectedShiftFilter, assignments]);

  // Counts per shift
  const shiftCounts = useMemo(() => {
    const counts = { Morning: 0, Evening: 0, Night: 0, General: 0 };
    employees.forEach(e => {
      const empId = e._id || e.id;
      const shift = assignments[empId] || "Morning";
      if (counts[shift] !== undefined) counts[shift]++;
    });
    return counts;
  }, [employees, assignments]);

  const handleModalSubmit = (e) => {
    e.preventDefault();
    if (!modalEmpId) return;
    saveShift(modalEmpId, modalShift);
    setShowAssignModal(false);
    setModalEmpId("");
  };

  return (
    <>
      <EmployeeHeader />
      <main className="roster-hub-page">
        {/* Banner */}
        <header className="roster-banner">
          <div>
            <span className="roster-kicker">24/7 Workforce Operations</span>
            <h1>Shift & Roster Management</h1>
            <p>Assign shifts, manage coverage schedules, and filter specific employees for roster assignments.</p>
          </div>
          <button 
            type="button" 
            className="roster-btn primary"
            onClick={() => setShowAssignModal(true)}
          >
            ➕ Assign Employee Shift
          </button>
        </header>

        {/* Metrics Bar */}
        <section className="roster-kpi-bar">
          <div className="roster-kpi-card">
            <span>Total Staff</span>
            <strong>{employees.length}</strong>
            <small>Active Roster</small>
          </div>
          <div className="roster-kpi-card morning">
            <span>🌅 Morning Shift</span>
            <strong>{shiftCounts.Morning}</strong>
            <small>06:00 - 14:00</small>
          </div>
          <div className="roster-kpi-card evening">
            <span>🌇 Evening Shift</span>
            <strong>{shiftCounts.Evening}</strong>
            <small>14:00 - 22:00</small>
          </div>
          <div className="roster-kpi-card night">
            <span>🌙 Night Shift</span>
            <strong>{shiftCounts.Night}</strong>
            <small>22:00 - 06:00</small>
          </div>
        </section>

        {/* Notice alert */}
        {notice && <div className="roster-notice">✓ {notice}</div>}

        {/* Filters & Control Toolbar */}
        <section className="roster-toolbar">
          <div className="toolbar-group">
            <input 
              type="text" 
              placeholder="Search by employee name, ID, or role..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="roster-search-input"
            />
            
            <select 
              value={deptFilter} 
              onChange={(e) => setDeptFilter(e.target.value)}
              className="roster-filter-select"
            >
              <option value="ALL">All Departments</option>
              {departments.filter(d => d !== "ALL").map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>

            <select 
              value={selectedShiftFilter} 
              onChange={(e) => setSelectedShiftFilter(e.target.value)}
              className="roster-filter-select"
            >
              <option value="ALL">All Shifts</option>
              {SHIFT_TYPES.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Batch Assignment Actions */}
          {selectedEmpIds.length > 0 && (
            <div className="batch-action-bar">
              <span>Selected <strong>{selectedEmpIds.length}</strong> employee(s)</span>
              <select 
                value={batchTargetShift}
                onChange={(e) => setBatchTargetShift(e.target.value)}
                className="roster-filter-select"
              >
                {SHIFT_TYPES.map(s => (
                  <option key={s.id} value={s.id}>{s.label} ({s.time})</option>
                ))}
              </select>
              <button 
                type="button" 
                className="roster-btn secondary"
                onClick={handleBatchAssign}
              >
                Apply Batch Shift
              </button>
              <button 
                type="button" 
                className="roster-btn text-btn"
                onClick={() => setSelectedEmpIds([])}
              >
                Clear
              </button>
            </div>
          )}
        </section>

        {/* Main Shift Columns */}
        {loading ? (
          <Loader />
        ) : (
          <div className="roster-columns-grid">
            {SHIFT_TYPES.map(shiftType => {
              const shiftEmps = filteredEmployees.filter(e => {
                const empId = e._id || e.id;
                return (assignments[empId] || "Morning") === shiftType.id;
              });

              return (
                <div key={shiftType.id} className={`roster-shift-column ${shiftType.theme}`}>
                  <div className="shift-column-header">
                    <div className="shift-header-title">
                      <span className="shift-icon">{shiftType.icon}</span>
                      <div>
                        <h3>{shiftType.label}</h3>
                        <span className="shift-time-pill">{shiftType.time}</span>
                      </div>
                    </div>
                    <span className="shift-count-badge">{shiftEmps.length} staff</span>
                  </div>

                  <div className="shift-cards-container">
                    {shiftEmps.length > 0 ? (
                      shiftEmps.map(emp => {
                        const empId = emp._id || emp.id;
                        const empName = `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || emp.name || emp.email || "Employee";
                        const empCode = emp.employeeCode || emp.employeeId || "-";
                        const dept = emp.employment?.department || emp.department || "Operations";
                        const designation = emp.employment?.designation || emp.designation || emp.role || "Team Member";
                        const isChecked = selectedEmpIds.includes(empId);

                        return (
                          <div key={empId} className={`roster-employee-card ${isChecked ? "is-selected" : ""}`}>
                            <div className="card-top-row">
                              <label className="checkbox-wrap">
                                <input 
                                  type="checkbox" 
                                  checked={isChecked}
                                  onChange={() => toggleSelect(empId)}
                                />
                              </label>
                              <div className="emp-avatar-badge">
                                {empName.charAt(0).toUpperCase()}
                              </div>
                              <div className="emp-meta-block">
                                <strong className="emp-name">{empName}</strong>
                                <small className="emp-code-dept">{empCode} • {dept}</small>
                                <span className="emp-designation">{designation}</span>
                              </div>
                            </div>

                            <div className="card-bottom-row">
                              <span className="shift-label-tag">Assigned Shift:</span>
                              <select
                                value={assignments[empId] || shiftType.id}
                                onChange={(e) => saveShift(empId, e.target.value)}
                                className="shift-dropdown-select"
                              >
                                {SHIFT_TYPES.map(s => (
                                  <option key={s.id} value={s.id}>
                                    {s.icon} {s.id} ({s.time})
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="shift-empty-state">
                        <span>📭 No employees assigned to {shiftType.label}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Assign Modal */}
        {showAssignModal && (
          <div className="roster-modal-backdrop" onClick={() => setShowAssignModal(false)}>
            <form className="roster-modal" onSubmit={handleModalSubmit} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <span className="roster-kicker">Assign Shift</span>
                  <h2>Select Employee & Shift</h2>
                </div>
                <button type="button" className="close-btn" onClick={() => setShowAssignModal(false)}>×</button>
              </div>

              <div className="modal-body">
                <label className="form-field">
                  <span>Select Employee *</span>
                  <select 
                    value={modalEmpId} 
                    onChange={(e) => setModalEmpId(e.target.value)}
                    required
                  >
                    <option value="">-- Choose employee --</option>
                    {employees.map(e => {
                      const id = e._id || e.id;
                      const name = `${e.firstName || ""} ${e.lastName || ""}`.trim() || e.name || e.email;
                      const code = e.employeeCode || e.employeeId || "";
                      return (
                        <option key={id} value={id}>
                          {name} ({code})
                        </option>
                      );
                    })}
                  </select>
                </label>

                <label className="form-field">
                  <span>Select Target Shift *</span>
                  <select 
                    value={modalShift} 
                    onChange={(e) => setModalShift(e.target.value)}
                    required
                  >
                    {SHIFT_TYPES.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.icon} {s.label} ({s.time})
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="modal-footer">
                <button type="submit" className="roster-btn primary">Save Assignment</button>
                <button type="button" className="roster-btn secondary" onClick={() => setShowAssignModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        )}
      </main>
    </>
  );
}
