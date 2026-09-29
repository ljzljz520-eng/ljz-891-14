import React from 'react'
import ReactDOM from 'react-dom/client'
import axios from 'axios'
import App from './App.jsx'
import './index.css'

// 统一携带登录 Token
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 统一处理鉴权失败：401 清登录态；403 提示权限不足（由各页面补充提示）
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && localStorage.getItem('auth_token')) {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
      // 跳转登录态（后台页通过 storage 事件/轮询感知，这里直接刷新最稳妥）
      if (window.location.pathname === '/admin') {
        window.location.reload()
      }
    }
    return Promise.reject(error)
  }
)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
