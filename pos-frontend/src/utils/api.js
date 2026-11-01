import axios from 'axios';

const PUBLIC_AUTH_PATHS = [
  '/auth/login',
  '/auth/signup',
  '/auth/forgot-password',
  '/auth/reset-password',
];

const isPublicAuthRequest = (url = '') =>
  PUBLIC_AUTH_PATHS.some((path) => url.includes(path));

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// ✅ Auto-attach JWT token to protected requests
api.interceptors.request.use(
  (config) => {
    if (!isPublicAuthRequest(config.url)) {
      const token = localStorage.getItem('jwt');
      if (token && !config.headers['Authorization']) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ✅ Global response error handler — logout on expired/invalid session 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const reqUrl = error.config?.url || '';
    const onAuthRoute =
      typeof window !== 'undefined' &&
      window.location.pathname.startsWith('/auth/');

    if (
      error.response?.status === 401 &&
      !isPublicAuthRequest(reqUrl) &&
      !reqUrl.includes('/api/users/change-password') &&
      !onAuthRoute
    ) {
      localStorage.removeItem('jwt');
      localStorage.removeItem('token');
      window.location.href = '/auth/login';
    }
    return Promise.reject(error);
  }
);

export default api;
