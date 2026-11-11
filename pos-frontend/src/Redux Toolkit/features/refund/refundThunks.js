import { createAsyncThunk } from "@reduxjs/toolkit";
import api from "@/utils/api";

// Helper function to get JWT token
const getAuthToken = () => {
  const token = localStorage.getItem("jwt");
  if (!token) {
    throw new Error("No JWT token found");
  }
  return token;
};

// Helper function to set auth headers
const getAuthHeaders = () => {
  const token = getAuthToken();
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
};

// 🔹 Create Refund
export const createRefund = createAsyncThunk(
  "refund/create",
  async (refundDTO, { rejectWithValue }) => {
    try {
      console.log("🔄 Creating refund...", { refundDTO });

      const headers = getAuthHeaders();
      const res = await api.post("/api/refunds", refundDTO, { headers });

      console.log("✅ Refund created successfully:", {
        refundId: res.data.id,
        orderId: res.data.orderId,
        amount: res.data.amount,
        reason: res.data.reason,
        response: res.data,
      });

      return res.data;
    } catch (err) {
      console.error("❌ Failed to create refund:", {
        error: err.response?.data || err.message,
        status: err.response?.status,
        statusText: err.response?.statusText,
        requestData: refundDTO,
      });

      return rejectWithValue(
        err.response?.data?.message || "Failed to create refund",
      );
    }
  },
);

// 🔹 Get All Refunds
export const getAllRefunds = createAsyncThunk(
  "refund/getAll",
  async (_, { rejectWithValue }) => {
    try {
      console.log("🔄 Fetching all refunds...");

      const headers = getAuthHeaders();
      const res = await api.get("/api/refunds", { headers });

      console.log("✅ All refunds fetched successfully:", {
        refundCount: res.data.length,
        totalAmount: res.data.reduce(
          (sum, refund) => sum + (refund.amount || 0),
          0,
        ),
        refunds: res.data.map((refund) => ({
          id: refund.id,
          orderId: refund.orderId,
          amount: refund.amount,
          reason: refund.reason,
          createdAt: refund.createdAt,
        })),
      });

      return res.data;
    } catch (err) {
      console.error("❌ Failed to fetch all refunds:", {
        error: err.response?.data || err.message,
        status: err.response?.status,
        statusText: err.response?.statusText,
      });

      return rejectWithValue(
        err.response?.data?.message || "Failed to fetch refunds",
      );
    }
  },
);

// 🔹 Get Refunds by Cashier
export const getRefundsByCashier = createAsyncThunk(
  "refund/getByCashier",
  async (cashierId, { rejectWithValue }) => {
    try {
      console.log("🔄 Fetching refunds by cashier...", { cashierId });

      const headers = getAuthHeaders();
      const res = await api.get(`/api/refunds/cashier/${cashierId}`, {
        headers,
      });

      console.log("✅ Refunds by cashier fetched successfully:", {
        cashierId,
        refundCount: res.data.length,
        totalAmount: res.data.reduce(
          (sum, refund) => sum + (refund.amount || 0),
          0,
        ),
        refunds: res.data.map((refund) => ({
          id: refund.id,
          orderId: refund.orderId,
          amount: refund.amount,
          reason: refund.reason,
          createdAt: refund.createdAt,
        })),
      });

      return res.data;
    } catch (err) {
      console.error("❌ Failed to fetch refunds by cashier:", {
        cashierId,
        error: err.response?.data || err.message,
        status: err.response?.status,
        statusText: err.response?.statusText,
      });

      return rejectWithValue(
        err.response?.data?.message || "Failed to fetch refunds by cashier",
      );
    }
  },
);

// 🔹 Get Refunds by Branch
export const getRefundsByBranch = createAsyncThunk(
  "refund/getByBranch",
  async (branchId, { rejectWithValue }) => {
    try {
      console.log("🔄 Fetching refunds by branch...", { branchId });

      const headers = getAuthHeaders();
      const res = await api.get(`/api/refunds/branch/${branchId}`, { headers });

      console.log("✅ Refunds by branch fetched successfully:", {
        branchId,
        refundCount: res.data.length,
        totalAmount: res.data.reduce(
          (sum, refund) => sum + (refund.amount || 0),
          0,
        ),
        refunds: res.data.map((refund) => ({
          id: refund.id,
          orderId: refund.orderId,
          amount: refund.amount,
          reason: refund.reason,
          createdAt: refund.createdAt,
        })),
      });

      return res.data;
    } catch (err) {
      console.error("❌ Failed to fetch refunds by branch:", {
        branchId,
        error: err.response?.data || err.message,
        status: err.response?.status,
        statusText: err.response?.statusText,
      });

      return rejectWithValue(
        err.response?.data?.message || "Failed to fetch refunds by branch",
      );
    }
  },
);

// 🔹 Get Refunds by Order
export const getRefundsByOrder = createAsyncThunk(
  "refund/getByOrder",
  async (orderId, { rejectWithValue }) => {
    try {
      const headers = getAuthHeaders();
      const res = await api.get(`/api/refunds/order/${orderId}`, { headers });
      return { orderId, refunds: res.data || [] };
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to fetch refunds by order",
      );
    }
  },
);

// 🔹 Get Refunds by Shift Report
export const getRefundsByShift = createAsyncThunk(
  "refund/getByShift",
  async (shiftReportId, { rejectWithValue }) => {
    try {
      console.log("🔄 Fetching refunds by shift...", { shiftReportId });

      const headers = getAuthHeaders();
      const res = await api.get(`/api/refunds/shift/${shiftReportId}`, {
        headers,
      });

      console.log("✅ Refunds by shift fetched successfully:", {
        shiftReportId,
        refundCount: res.data.length,
        totalAmount: res.data.reduce(
          (sum, refund) => sum + (refund.amount || 0),
          0,
        ),
        refunds: res.data.map((refund) => ({
          id: refund.id,
          orderId: refund.orderId,
          amount: refund.amount,
          reason: refund.reason,
          createdAt: refund.createdAt,
        })),
      });

      return res.data;
    } catch (err) {
      console.error("❌ Failed to fetch refunds by shift:", {
        shiftReportId,
        error: err.response?.data || err.message,
        status: err.response?.status,
        statusText: err.response?.statusText,
      });

      return rejectWithValue(
        err.response?.data?.message || "Failed to fetch refunds by shift",
      );
    }
  },
);

const toIsoLocalDateTime = (val, isEndOfDay = false) => {
  if (!val) return "";
  if (val instanceof Date) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${val.getFullYear()}-${pad(val.getMonth() + 1)}-${pad(val.getDate())}T${pad(val.getHours())}:${pad(val.getMinutes())}:${pad(val.getSeconds())}`;
  }
  const str = String(val).trim().replace(/Z$/i, "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return `${str}T${isEndOfDay ? "23:59:59" : "00:00:00"}`;
  }
  return str;
};

// 🔹 Get Refunds by Cashier and Date Range
export const getRefundsByCashierAndDateRange = createAsyncThunk(
  "refund/getByCashierAndDateRange",
  async ({ cashierId, from, to }, { rejectWithValue }) => {
    try {
      const headers = getAuthHeaders();
      const formattedFrom = encodeURIComponent(toIsoLocalDateTime(from, false));
      const formattedTo = encodeURIComponent(toIsoLocalDateTime(to, true));
      const res = await api.get(
        `/api/refunds/cashier/${cashierId}/range?startDate=${formattedFrom}&endDate=${formattedTo}`,
        { headers },
      );
      return res.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to fetch refunds by date range",
      );
    }
  },
);

// 🔹 Get Refund by ID
export const getRefundById = createAsyncThunk(
  "refund/getById",
  async (id, { rejectWithValue }) => {
    try {
      console.log("🔄 Fetching refund by ID...", { refundId: id });

      const headers = getAuthHeaders();
      const res = await api.get(`/api/refunds/${id}`, { headers });

      console.log("✅ Refund by ID fetched successfully:", {
        refundId: res.data.id,
        orderId: res.data.orderId,
        amount: res.data.amount,
        reason: res.data.reason,
        createdAt: res.data.createdAt,
        response: res.data,
      });

      return res.data;
    } catch (err) {
      console.error("❌ Failed to fetch refund by ID:", {
        refundId: id,
        error: err.response?.data || err.message,
        status: err.response?.status,
        statusText: err.response?.statusText,
      });

      return rejectWithValue(err.response?.data?.message || "Refund not found");
    }
  },
);

// 🔹 Delete Refund
export const deleteRefund = createAsyncThunk(
  "refund/delete",
  async (id, { rejectWithValue }) => {
    try {
      console.log("🔄 Deleting refund...", { refundId: id });

      const headers = getAuthHeaders();
      await api.delete(`/api/refunds/${id}`, { headers });

      console.log("✅ Refund deleted successfully:", { refundId: id });

      return id;
    } catch (err) {
      console.error("❌ Failed to delete refund:", {
        refundId: id,
        error: err.response?.data || err.message,
        status: err.response?.status,
        statusText: err.response?.statusText,
      });

      return rejectWithValue(
        err.response?.data?.message || "Failed to delete refund",
      );
    }
  },
);
