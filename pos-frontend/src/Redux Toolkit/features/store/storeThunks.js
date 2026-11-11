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

// 🔹 Create store
export const createStore = createAsyncThunk(
  "store/create",
  async (storeData, { rejectWithValue }) => {
    try {
      console.log("🔄 Creating store...", { storeData });

      const headers = getAuthHeaders();
      const res = await api.post("/api/stores", storeData, { headers });

      console.log("✅ Store created successfully:", {
        storeId: res.data.id,
        brand: res.data.brand,
        storeType: res.data.storeType,
        response: res.data,
      });

      return res.data;
    } catch (err) {
      console.error("❌ Failed to create store:", {
        error: err.response?.data || err.message,
        status: err.response?.status,
        statusText: err.response?.statusText,
        requestData: storeData,
      });

      return rejectWithValue(
        err.response?.data?.message || "Failed to create store",
      );
    }
  },
);

// 🔹 Get store by ID
export const getStoreById = createAsyncThunk(
  "store/getById",
  async (id, { rejectWithValue }) => {
    try {
      console.log("🔄 Fetching store by ID...", { storeId: id });

      const headers = getAuthHeaders();
      const res = await api.get(`/api/stores/${id}`, { headers });

      console.log("✅ Store fetched successfully:", {
        storeId: res.data.id,
        brand: res.data.brand,
        storeType: res.data.storeType,
        response: res.data,
      });

      return res.data;
    } catch (err) {
      console.error("❌ Failed to fetch store by ID:", {
        storeId: id,
        error: err.response?.data || err.message,
        status: err.response?.status,
        statusText: err.response?.statusText,
      });

      return rejectWithValue(err.response?.data?.message || "Store not found");
    }
  },
);

// 🔹 Get all stores
export const getAllStores = createAsyncThunk(
  "store/getAll",
  async (status, { rejectWithValue }) => {
    try {
      console.log("🔄 Fetching all stores...");

      const headers = getAuthHeaders();
      const res = await api.get("/api/stores", {
        headers,
        params: status ? { status } : undefined,
      });

      console.log("✅ All stores fetched successfully:", {
        storeCount: res.data.length,
        response: res.data,
      });

      return res.data;
    } catch (err) {
      console.error("❌ Failed to fetch all stores:", {
        error: err.response?.data || err.message,
        status: err.response?.status,
        statusText: err.response?.statusText,
      });

      return rejectWithValue(
        err.response?.data?.message || "Failed to fetch stores",
      );
    }
  },
);

// 🔹 Update store
export const updateStore = createAsyncThunk(
  "store/update",
  async ({ id, storeData }, { rejectWithValue }) => {
    try {
      console.log("🔄 Updating store...", { storeId: id, storeData });

      const headers = getAuthHeaders();
      const res = await api.put(`/api/stores/${id}`, storeData, { headers });

      console.log("✅ Store updated successfully:", {
        storeId: res.data.id,
        brand: res.data.brand,
        storeType: res.data.storeType,
        response: res.data,
      });

      return res.data;
    } catch (err) {
      console.error("❌ Failed to update store:", {
        storeId: id,
        error: err.response?.data || err.message,
        status: err.response?.status,
        statusText: err.response?.statusText,
        requestData: storeData,
      });

      return rejectWithValue(
        err.response?.data?.message || "Failed to update store",
      );
    }
  },
);

// 🔹 Delete store (supports optional store ID for DELETE /api/stores/{id} or own store via DELETE /api/stores)
export const deleteStore = createAsyncThunk(
  "store/delete",
  async (id, { rejectWithValue }) => {
    try {
      console.log("🔄 Deleting store...", { storeId: id });

      const headers = getAuthHeaders();
      const endpoint = id ? `/api/stores/${id}` : "/api/stores";
      const res = await api.delete(endpoint, { headers });

      console.log("✅ Store deleted successfully:", { storeId: id, response: res.data });

      return { id, data: res.data };
    } catch (err) {
      console.error("❌ Failed to delete store:", {
        storeId: id,
        error: err.response?.data || err.message,
        status: err.response?.status,
        statusText: err.response?.statusText,
      });

      return rejectWithValue(
        err.response?.data?.message || "Failed to delete store",
      );
    }
  },
);

export const getStoreByAdmin = createAsyncThunk(
  "store/getByAdmin",
  async (_, { rejectWithValue }) => {
    try {
      const headers = getAuthHeaders();
      const res = await api.get("/api/stores/admin", { headers });
      return res.data || null;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Not authorized");
    }
  },
);

export const getStoreByEmployee = createAsyncThunk(
  "store/getByEmployee",
  async (_, { rejectWithValue }) => {
    try {
      const headers = getAuthHeaders();
      const res = await api.get("/api/stores/employee", { headers });
      return res.data || null;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Not authorized");
    }
  },
);

// 🔹 Get employee list by store
export const getStoreEmployees = createAsyncThunk(
  "store/getEmployees",
  async (storeId, { rejectWithValue }) => {
    try {
      console.log("🔄 Fetching store employees...", { storeId });

      const headers = getAuthHeaders();
      // ✅ Fixed: was using /api/stores/${storeId}/employee/list (doesn't exist)
      // Correct endpoint: /api/employees/store/{id}
      const res = await api.get(`/api/employees/store/${storeId}`, {
        headers,
      });

      console.log("✅ Store employees fetched successfully:", {
        storeId,
        employeeCount: res.data.length,
        employees: res.data.map((employee) => ({
          id: employee.id,
          name: employee.name,
          role: employee.role,
        })),
      });

      return res.data;
    } catch (err) {
      console.error("❌ Failed to fetch store employees:", {
        storeId,
        error: err.response?.data || err.message,
        status: err.response?.status,
        statusText: err.response?.statusText,
      });

      return rejectWithValue(
        err.response?.data?.message || "Failed to get employees",
      );
    }
  },
);

// 🔹 Add employee
export const addEmployee = createAsyncThunk(
  "store/addEmployee",
  async (employeeData, { rejectWithValue }) => {
    try {
      console.log("🔄 Adding employee to store...", { employeeData });

      const headers = getAuthHeaders();
      // ✅ Fixed: was using /api/stores/add/employee (doesn't exist)
      // Correct endpoint: /api/employees/store/{storeId} or /api/employees/branch/{branchId}
      const endpoint = employeeData.branchId
        ? `/api/employees/branch/${employeeData.branchId}`
        : `/api/employees/store/${employeeData.storeId}`;
      const res = await api.post(endpoint, employeeData, {
        headers,
      });

      console.log("✅ Employee added successfully:", {
        employeeId: res.data.id,
        name: res.data.name,
        role: res.data.role,
        response: res.data,
      });

      return res.data;
    } catch (err) {
      console.error("❌ Failed to add employee:", {
        error: err.response?.data || err.message,
        status: err.response?.status,
        statusText: err.response?.statusText,
        requestData: employeeData,
      });

      return rejectWithValue(
        err.response?.data?.message || "Failed to add employee",
      );
    }
  },
);

// 🔹 Moderate store (approve/block/reject)
export const moderateStore = createAsyncThunk(
  "store/moderateStore",
  async ({ storeId, action, reason }, { rejectWithValue }) => {
    try {
      console.log("🔄 Moderating store...", { storeId, action, reason });
      const headers = getAuthHeaders();
      const params = { status: action };
      if (reason && String(reason).trim()) {
        params.reason = String(reason).trim();
      }
      const res = await api.put(`/api/stores/${storeId}/moderate`, null, {
        headers,
        params,
      });
      console.log("✅ Store moderated successfully:", {
        storeId: res.data.id,
        status: res.data.status,
        response: res.data,
      });
      return res.data;
    } catch (err) {
      console.error("❌ Failed to moderate store:", {
        storeId,
        action,
        error: err.response?.data || err.message,
        status: err.response?.status,
        statusText: err.response?.statusText,
      });
      return rejectWithValue(
        err.response?.data?.message || "Failed to moderate store",
      );
    }
  },
);
