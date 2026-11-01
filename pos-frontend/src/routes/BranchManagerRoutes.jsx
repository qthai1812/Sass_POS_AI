import React from "react";
import { Routes, Route } from "react-router";

// Import Branch Manager Dashboard Layout
import BranchManagerDashboard from "../pages/Branch Manager/Dashboard/BranchManagerDashboard";

// Import Branch Manager pages
import {
  Dashboard,
  Orders,
  Transactions,
  Inventory,
  // Employees,
  Customers,
  Reports,
  Settings
} from "../pages/Branch Manager";
import { BranchEmployees } from "../pages/Branch Manager/Employees";
import Refunds from "../pages/Branch Manager/Refunds/Refunds";
import FeatureGate from "../components/FeatureGate";

const BranchManagerRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<BranchManagerDashboard />}>
        <Route index element={<Dashboard />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="orders" element={<Orders />} />
        <Route path="refunds" element={<Refunds />} />
        <Route path="transactions" element={<Transactions />} />
        <Route
          path="inventory"
          element={
            <FeatureGate feature="inventory" title="Inventory System">
              <Inventory />
            </FeatureGate>
          }
        />
        <Route path="employees" element={<BranchEmployees />} />
        <Route path="customers" element={<Customers />} />
        <Route
          path="reports"
          element={
            <FeatureGate feature="advancedReports" title="Advanced Reports">
              <Reports />
            </FeatureGate>
          }
        />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
};

export default BranchManagerRoutes;