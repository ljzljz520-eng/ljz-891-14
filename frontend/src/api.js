import axios from 'axios';

// 统一的后台请求实例：自动携带登录 token
const api = axios.create();

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error.response?.status;
    if (status === 401) {
      // 登录失效：清理本地凭证（页面会自动回到登录界面）
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      // 非登录接口才提示，避免登录失败时重复弹错
      if (!error.config?.url?.includes('/api/auth/login')) {
        window.dispatchEvent(new Event('auth:unauthorized'));
      }
    }
    return Promise.reject(error);
  }
);

export default api;
