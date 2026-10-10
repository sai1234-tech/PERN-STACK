import { useState, useCallback, useEffect } from "react";

const INITIAL_EMPLOYEES = [
  { id: "EMP-101", name: "Aisha Sharma", role: "Frontend Developer", status: "Allocated", project: "Project Titan", shift: "Morning", rating: 4 },
  { id: "EMP-102", name: "Rohan Das", role: "Backend Developer", status: "Bench", project: null, shift: "Morning", rating: 3 },
  { id: "EMP-103", name: "Sneha Patel", role: "UX Designer", status: "Allocated", project: "Project Phoenix", shift: "Evening", rating: 5 },
  { id: "EMP-104", name: "Karan Singh", role: "DevOps Engineer", status: "Bench", project: null, shift: "Night", rating: 4 },
];

const INITIAL_OKRS = [
  { id: 1, objective: "Reduce application load time by 30%", result: "Pending Review", score: 0 },
  { id: 2, objective: "Ship Recruitment Module", result: "Completed", score: 5 },
];

import { createTicket, getAllTickets, resolveTicket as resolveTicketApi } from "../services/ticketService";

export const useEnterpriseOps = () => {
  const [pulseAnswered, setPulseAnswered] = useState(false);
  const [pulseScore, setPulseScore] = useState(null);
  
  const [resourcePool, setResourcePool] = useState(INITIAL_EMPLOYEES);
  const [okrs, setOkrs] = useState(INITIAL_OKRS);
  const [tickets, setTickets] = useState([]);

  const fetchTickets = useCallback(async () => {
    try {
      const response = await getAllTickets();
      if (response.success) {
        setTickets(response.tickets);
      }
    } catch (error) {
      console.error("Failed to fetch tickets", error);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
    
    // Listen for custom events to sync across components in the same tab
    const handleTicketUpdate = () => fetchTickets();
    window.addEventListener("hrms_tickets_updated", handleTicketUpdate);
    
    // Listen for storage events to sync across different tabs/windows
    const handleStorageUpdate = (e) => {
      if (e.key === "hrms_tickets_sync") {
        fetchTickets();
      }
    };
    window.addEventListener("storage", handleStorageUpdate);
    
    return () => {
      window.removeEventListener("hrms_tickets_updated", handleTicketUpdate);
      window.removeEventListener("storage", handleStorageUpdate);
    };
  }, [fetchTickets]);

  // --- 1. Pulse Tracker ---
  const submitPulse = useCallback((score) => {
    setPulseScore(score);
    setPulseAnswered(true);
  }, []);

  // --- 2. Bench & Allocation ---
  const allocateResource = useCallback((empId, projectName) => {
    setResourcePool(prev => prev.map(emp => 
      emp.id === empId ? { ...emp, status: "Allocated", project: projectName } : emp
    ));
  }, []);

  const moveToBench = useCallback((empId) => {
    setResourcePool(prev => prev.map(emp => 
      emp.id === empId ? { ...emp, status: "Bench", project: null } : emp
    ));
  }, []);

  // --- 3. Shift Rostering ---
  const updateShift = useCallback((empId, newShift) => {
    setResourcePool(prev => prev.map(emp => 
      emp.id === empId ? { ...emp, shift: newShift } : emp
    ));
  }, []);

  // --- 4. OKRs ---
  const addOkr = useCallback((objective) => {
    setOkrs(prev => [...prev, { id: Date.now(), objective, result: "Pending Review", score: 0 }]);
  }, []);

  const rateOkr = useCallback((okrId, score) => {
    setOkrs(prev => prev.map(o => 
      o.id === okrId ? { ...o, result: "Reviewed", score } : o
    ));
  }, []);

  return {
    pulseAnswered,
    pulseScore,
    submitPulse,
    
    resourcePool,
    allocateResource,
    moveToBench,
    
    updateShift,
    
    okrs,
    addOkr,
    rateOkr,
    
    tickets,
    addTicket: async (empId, query) => {
      try {
        const response = await createTicket(empId || "Employee", query);
        if (response.success) {
          window.dispatchEvent(new Event("hrms_tickets_updated"));
          localStorage.setItem("hrms_tickets_sync", Date.now().toString());
          return response.ticket.id;
        }
      } catch (error) {
        console.error("Failed to create ticket", error);
      }
      return null;
    },
    resolveTicket: async (ticketId, resolution) => {
      try {
        const response = await resolveTicketApi(ticketId, resolution);
        if (response.success) {
          window.dispatchEvent(new Event("hrms_tickets_updated"));
          localStorage.setItem("hrms_tickets_sync", Date.now().toString());
        }
      } catch (error) {
        console.error("Failed to resolve ticket", error);
      }
    }
  };
};
