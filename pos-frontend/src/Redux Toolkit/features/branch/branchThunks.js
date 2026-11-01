import { createAsyncThunk } from '@reduxjs/toolkit';
import api from '@/utils/api';

// 🔹 Create Branch
const buildAuthHeader = (token) => {
  const effective = token || localStorage.getItem("jwt");
  return effective ? { Authorization: `Bearer ${effective}` } : {};
};

export const createBranch = createAsyncThunk('branch/create', async ({ dto, jwt }, { rejectWithValue }) => {
  try {
    const res = await api.post('/api/branches', dto, {
      headers: buildAuthHeader(jwt),
    });
    console.log('Create branch success:', res.data);
    return res.data;
  } catch (err) {
    console.error('Create branch error:', err);
    return rejectWithValue(err.response?.data?.message || 'Create branch failed');
  }
});

// 🔹 Get Branch by ID
export const getBranchById = createAsyncThunk('branch/getById', async ({ id, jwt }, { rejectWithValue }) => {
  try {
    const res = await api.get(`/api/branches/${id}`, {
      headers: buildAuthHeader(jwt),
    });
    console.log('Get branch by ID success:', res.data);
    return res.data;
  } catch (err) {
    console.error('Get branch by ID error:', err);
    return rejectWithValue(err.response?.data?.message || 'Branch not found');
  }
});

// 🔹 Get All Branches by Store
export const getAllBranchesByStore = createAsyncThunk('branch/getAllByStore', async ({ storeId, jwt }, { rejectWithValue }) => {
  try {
    const res = await api.get(`/api/branches/store/${storeId}`, {
      headers: buildAuthHeader(jwt),
    });
    console.log('Get all branches by store success:', res.data);
    return res.data;
  } catch (err) {
    console.error('Get all branches by store error:', err);
    return rejectWithValue(err.response?.data?.message || 'Failed to fetch branches');
  }
});

// 🔹 Update Branch
export const updateBranch = createAsyncThunk('branch/update', async ({ id, dto, jwt }, { rejectWithValue }) => {
  try {
    const res = await api.put(`/api/branches/${id}`, dto, {
      headers: buildAuthHeader(jwt),
    });
    console.log('Update branch success:', res.data);
    return res.data;
  } catch (err) {
    console.error('Update branch error:', err);
    return rejectWithValue(err.response?.data?.message || 'Update failed');
  }
});

// 🔹 Delete Branch
export const deleteBranch = createAsyncThunk('branch/delete', async ({ id, jwt }, { rejectWithValue }) => {
  try {
    await api.delete(`/api/branches/${id}`, {
      headers: buildAuthHeader(jwt),
    });
    console.log('Delete branch success:', id);
    return id;
  } catch (err) {
    console.error('Delete branch error:', err);
    return rejectWithValue(err.response?.data?.message || 'Delete failed');
  }
});

