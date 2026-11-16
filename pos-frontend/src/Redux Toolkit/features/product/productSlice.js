import { createSlice } from '@reduxjs/toolkit';
import {
  createProduct,
  getProductById,
  updateProduct,
  deleteProduct,
  getProductsByStore,
  getProductsByStorePaged,
  searchProducts
} from './productThunks';
import { normalizePageResponse } from '@/utils/paginationUtils';

const createEmptyProductPage = () => normalizePageResponse(null);

const initialState = {
  products: [],
  pagedProducts: createEmptyProductPage(),
  pagedLoading: false,
  product: null,
  searchResults: [],
  loading: false,
  error: null,
};

const productSlice = createSlice({
  name: 'product',
  initialState,
  reducers: {
    clearProductState: (state) => {
      state.product = null;
      state.products = [];
      state.pagedProducts = createEmptyProductPage();
      state.searchResults = [];
      state.error = null;
    },
    clearSearchResults: (state) => {
      state.searchResults = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createProduct.pending, (state) => {
        state.loading = true;
      })
      .addCase(createProduct.fulfilled, (state, action) => {
        state.loading = false;
        state.products.push(action.payload);
      })
      .addCase(createProduct.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      .addCase(getProductById.fulfilled, (state, action) => {
        state.product = action.payload;
      })

      .addCase(updateProduct.fulfilled, (state, action) => {
        const index = state.products.findIndex((p) => p.id === action.payload.id);
        if (index !== -1) {
          state.products[index] = action.payload;
        }
        const pagedIdx = state.pagedProducts.content.findIndex(
          (p) => p.id === action.payload.id
        );
        if (pagedIdx !== -1) {
          state.pagedProducts.content[pagedIdx] = action.payload;
        }
      })

      .addCase(deleteProduct.fulfilled, (state, action) => {
        const deletedId = Number(action.payload);
        state.products = (state.products || []).filter((p) => Number(p?.id) !== deletedId);
        const beforeLen = state.pagedProducts.content.length;
        state.pagedProducts.content = (state.pagedProducts.content || []).filter(
          (p) => Number(p?.id) !== deletedId
        );
        if (state.pagedProducts.content.length < beforeLen) {
          state.pagedProducts.totalElements = Math.max(
            0,
            state.pagedProducts.totalElements - 1
          );
        }
        state.searchResults = (state.searchResults || []).filter((p) => Number(p?.id) !== deletedId);
        if (state.product && Number(state.product.id) === deletedId) {
          state.product = null;
        }
      })

      .addCase(getProductsByStore.fulfilled, (state, action) => {
        state.products = action.payload;
      })

      .addCase(getProductsByStorePaged.pending, (state) => {
        state.pagedLoading = true;
        state.error = null;
      })
      .addCase(getProductsByStorePaged.fulfilled, (state, action) => {
        state.pagedLoading = false;
        state.pagedProducts = normalizePageResponse(action.payload);
      })
      .addCase(getProductsByStorePaged.rejected, (state, action) => {
        state.pagedLoading = false;
        state.error = action.payload;
      })

      .addCase(searchProducts.pending, (state) => {
        state.loading = true;
      })
      .addCase(searchProducts.fulfilled, (state, action) => {
        state.loading = false;
        state.searchResults = action.payload;
      })
      .addCase(searchProducts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      .addMatcher(
        (action) => action.type.startsWith('product/') && action.type.endsWith('/rejected'),
        (state, action) => {
          state.error = action.payload;
        }
      );
  },
});

export const { clearProductState, clearSearchResults } = productSlice.actions;
export default productSlice.reducer;
