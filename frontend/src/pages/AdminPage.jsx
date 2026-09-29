import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import {
  Lock, User, Plus, Trash2, Search, Sliders, Shield, ScrollText,
  KeyRound, Power, X, ShieldCheck
} from 'lucide-react';
import Modal from '../components/Modal';
import api from '../api';

export default function AdminPage() {
  const [token, setToken] = useState(localStorage.getItem('auth_token'));
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('auth_user') || 'null'); }
    catch { return null; }
  });
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const isSuper = user?.role === 'super';

  // Dashboard State
  const [licenses, setLicenses] = useState([]);
  const [filteredLicenses, setFilteredLicenses] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  const [newLicense, setNewLicense] = useState({
    qq: '', owner_name: '', product_name: '', upline: '官方', expiration_date: ''
  });

  // License 删除确认
  const [deleteId, setDeleteId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 管理员 / 日志
  const [activeTab, setActiveTab] = useState('license'); // 'license' | 'admin' | 'logs'
  const [admins, setAdmins] = useState([]);
  const [logs, setLogs] = useState([]);
  const [newAdmin, setNewAdmin] = useState({ username: '', password: '' });

  // 重置密码弹窗
  const [resetTarget, setResetTarget] = useState(null); // {id, username}
  const [resetPwd, setResetPwd] = useState('');

  // token 失效（401）时统一回到登录页
  useEffect(() => {
    const onUnauthorized = () => {
      setToken(null);
      setUser(null);
      toast.error('登录已失效，请重新登录');
    };
    window.addEventListener('auth:unauthorized', onUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', onUnauthorized);
  }, []);

  // 已有 token 但本地缺角色信息时向后端补取（顺带验证 token 是否有效）
  useEffect(() => {
    if (token && !user) {
      api.get('/api/auth/me')
        .then(res => {
          setUser(res.data);
          localStorage.setItem('auth_user', JSON.stringify(res.data));
        })
        .catch(() => { /* 401 拦截器已清理 */ });
    }
  }, [token, user]);

  const fetchLicenses = useCallback(async () => {
    try {
      const res = await api.get('/api/license/list');
      setLicenses(res.data);
    } catch (err) {
      if (err.response?.status === 403) toast.error(err.response.data?.message || '权限不足');
    }
  }, []);

  const fetchAdmins = useCallback(async () => {
    if (!isSuper) return;
    try {
      const res = await api.get('/api/auth/list');
      setAdmins(res.data);
    } catch (err) {
      if (err.response?.status === 403) toast.error(err.response.data?.message || '权限不足');
    }
  }, [isSuper]);

  const fetchLogs = useCallback(async () => {
    if (!isSuper) return;
    try {
      const res = await api.get('/api/auth/login-logs?limit=200');
      setLogs(res.data);
    } catch (err) {
      if (err.response?.status === 403) toast.error(err.response.data?.message || '权限不足');
    }
  }, [isSuper]);

  useEffect(() => {
    if (token && user) {
      fetchLicenses();
      if (isSuper) { fetchAdmins(); fetchLogs(); }
    }
  }, [token, user, isSuper, fetchLicenses, fetchAdmins, fetchLogs]);

  useEffect(() => {
    if (!searchTerm) {
      setFilteredLicenses(licenses);
    } else {
      const lower = searchTerm.toLowerCase();
      setFilteredLicenses(licenses.filter(l =>
        l.qq.includes(lower) ||
        l.owner_name.toLowerCase().includes(lower) ||
        l.product_name.toLowerCase().includes(lower)
      ));
    }
  }, [searchTerm, licenses]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/api/auth/login', { username, password });
      localStorage.setItem('auth_token', res.data.token);
      localStorage.setItem('auth_user', JSON.stringify(res.data.user));
      setToken(res.data.token);
      setUser(res.data.user);
      setUsername(''); setPassword('');
      toast.success(`欢迎回来，${res.data.user.username}`);
    } catch (err) {
      toast.error('登录失败: ' + (err.response?.data?.message || '网络错误'));
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    setToken(null);
    setUser(null);
    setActiveTab('license');
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      if (activeTab === 'license') {
        await api.post('/api/license/create', newLicense);
        toast.success('授权添加成功');
        setNewLicense({ qq: '', owner_name: '', product_name: '', upline: '官方', expiration_date: '' });
        fetchLicenses();
      } else {
        await api.post('/api/auth/create', newAdmin);
        toast.success('管理员添加成功（普通管理员）');
        setNewAdmin({ username: '', password: '' });
        fetchAdmins();
      }
    } catch (err) {
      toast.error('添加失败：' + (err.response?.data?.message || '网络错误'));
    }
  };

  const handleToggleActive = async (admin) => {
    const next = admin.is_active ? 0 : 1;
    if (next === 0 && admin.id === user?.id) {
      toast.error('不能停用当前登录的超级管理员账号');
      return;
    }
    try {
      const res = await api.post('/api/auth/set-active', { id: admin.id, is_active: next });
      toast.success(res.data.message || (next ? '已启用' : '已停用'));
      fetchAdmins();
    } catch (err) {
      toast.error(err.response?.data?.message || '操作失败');
    }
  };

  const openReset = (admin) => {
    setResetTarget(admin);
    setResetPwd('');
  };

  const submitReset = async () => {
    if (resetPwd.length < 6) { toast.error('新密码长度至少6位'); return; }
    try {
      const res = await api.post('/api/auth/reset-password', { id: resetTarget.id, password: resetPwd });
      toast.success(res.data.message || '密码已重置');
      setResetTarget(null);
      setResetPwd('');
    } catch (err) {
      toast.error(err.response?.data?.message || '操作失败');
    }
  };

  const confirmDeleteLicense = (id) => {
    setDeleteId(id);
    setIsModalOpen(true);
  };

  const handleDeleteLicense = async () => {
    if (!deleteId) return;
    try {
      await api.post('/api/license/delete', { id: deleteId });
      toast.success('已删除该授权');
      fetchLicenses();
    } catch (err) {
      toast.error(err.response?.data?.message || '删除失败');
    }
  };

  const switchTab = (tab) => {
    setActiveTab(tab);
    if (tab === 'admin') fetchAdmins();
    if (tab === 'logs') fetchLogs();
  };

  // ---------------- 登录页 ----------------
  if (!token || !user) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="w-full max-w-md glass-card p-10 animate-fade-in-up">
           <div className="text-center mb-8">
             <div className="w-16 h-16 bg-sky-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-sky-400">
               <Lock size={32} />
             </div>
             <h2 className="text-2xl font-bold text-white">管理员登录</h2>
             <p className="text-white/40 mt-2 text-sm">请输入您的管理凭证以继续</p>
           </div>

           <form onSubmit={handleLogin} className="space-y-5">
             <div>
               <label className="block text-xs font-semibold text-white/50 mb-2 uppercase tracking-wider">账号</label>
               <div className="relative group">
                 <input type="text" value={username} onChange={e=>setUsername(e.target.value)} autoComplete="username" className="glass-input w-full pl-10 h-11" placeholder="Administrator" />
                 <User className="absolute left-3 top-3.5 w-4 h-4 text-white/30 group-focus-within:text-sky-400 transition" />
               </div>
             </div>
             <div>
               <label className="block text-xs font-semibold text-white/50 mb-2 uppercase tracking-wider">密码</label>
               <div className="relative group">
                 <input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" className="glass-input w-full pl-10 h-11" placeholder="••••••••" />
                 <Lock className="absolute left-3 top-3.5 w-4 h-4 text-white/30 group-focus-within:text-sky-400 transition" />
               </div>
             </div>
             <button type="submit" className="tech-button w-full mt-2 !py-3 !text-sm tracking-widest">登录</button>
           </form>
        </div>
      </div>
    );
  }

  const showSidebarForm = activeTab === 'license' || activeTab === 'admin';

  // ---------------- 后台 ----------------
  return (
    <div className="max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-end md:items-center mb-10 gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-sky-300">
            授权管理中心
          </h1>
          <p className="text-white/40 mt-1 flex items-center gap-2">
            System Administration Dashboard
          </p>
        </div>
        <div className="flex items-center gap-4">
           {activeTab === 'license' && (
             <div className="relative">
               <input
                  type="text"
                  placeholder="搜索QQ、主人或产品..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="glass-input pl-10 pr-4 py-2 w-64 text-sm"
               />
               <Search className="absolute left-3 top-2.5 w-4 h-4 text-white/30" />
             </div>
           )}
           <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/5 text-sm">
             {isSuper
               ? <ShieldCheck size={16} className="text-amber-400" />
               : <User size={16} className="text-sky-400" />}
             <span className="text-white/80">{user.username}</span>
             <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${isSuper ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' : 'bg-sky-500/15 text-sky-400 border border-sky-500/20'}`}>
               {isSuper ? '超级管理员' : '普通管理员'}
             </span>
           </div>
           <button onClick={handleLogout} className="px-4 py-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-white/60 hover:text-red-400 transition border border-white/5 hover:border-red-500/30">
             退出登录
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar: Add Form（仅 license / admin 两个超管可建的页签显示） */}
        {showSidebarForm && (
        <div className="lg:col-span-1">
          <div className="glass-card p-6 sticky top-6">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-white">
                <div className="p-1.5 bg-sky-500/20 rounded-lg text-sky-400">
                  <Plus className="w-4 h-4"/>
                </div>
                {activeTab === 'license' ? '新增授权' : '新增管理员'}
              </h3>
              <form onSubmit={handleCreate} className="space-y-4">
                 {activeTab === 'license' ? (
                     <>
                        <div className="space-y-1">
                            <label className="text-xs text-white/40">授权QQ</label>
                            <input required className="glass-input w-full" placeholder="输入QQ号" value={newLicense.qq} onChange={e=>setNewLicense({...newLicense, qq:e.target.value})} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-white/40">授权主人</label>
                            <input required className="glass-input w-full" placeholder="输入名称" value={newLicense.owner_name} onChange={e=>setNewLicense({...newLicense, owner_name:e.target.value})} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-white/40">所属产品</label>
                            <input required className="glass-input w-full" placeholder="例如：授权平台" value={newLicense.product_name} onChange={e=>setNewLicense({...newLicense, product_name:e.target.value})} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-white/40">授权上级</label>
                            <input required className="glass-input w-full" placeholder="默认：官方" value={newLicense.upline} onChange={e=>setNewLicense({...newLicense, upline:e.target.value})} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-white/40">过期时间</label>
                            <input required type="datetime-local" className="glass-input w-full" value={newLicense.expiration_date} onChange={e=>setNewLicense({...newLicense, expiration_date:e.target.value})} />
                        </div>
                     </>
                 ) : (
                     <>
                        <div className="space-y-1">
                            <label className="text-xs text-white/40">用户名</label>
                            <input required minLength={3} className="glass-input w-full" placeholder="3-50位字母/数字/下划线" value={newAdmin.username} onChange={e=>setNewAdmin({...newAdmin, username:e.target.value})} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-white/40">初始密码</label>
                            <input required type="password" minLength={6} className="glass-input w-full" placeholder="至少6位" value={newAdmin.password} onChange={e=>setNewAdmin({...newAdmin, password:e.target.value})} />
                        </div>
                        <p className="text-[11px] text-white/30 leading-relaxed">新账号为<b className="text-white/50">普通管理员</b>，仅能维护授权记录，无法管理其他管理员。</p>
                     </>
                 )}
                 <div className="pt-2">
                    <button type="submit" className="tech-button w-full flex justify-center items-center gap-2">
                      <Plus size={16} /> {activeTab === 'license' ? '立即授权' : '添加管理员'}
                    </button>
                 </div>
              </form>
          </div>
        </div>
        )}

        {/* Main */}
        <div className={showSidebarForm ? 'lg:col-span-3' : 'lg:col-span-4'}>
           <div className="glass-card overflow-hidden flex flex-col min-h-[600px]">
             <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5 flex-wrap gap-3">
                 <h3 className="font-bold flex items-center gap-2">
                    {activeTab === 'license' && <Sliders size={18} className="text-sky-400"/>}
                    {activeTab === 'admin' && <Shield size={18} className="text-sky-400"/>}
                    {activeTab === 'logs' && <ScrollText size={18} className="text-sky-400"/>}
                    {activeTab === 'license' && '授权列表'}
                    {activeTab === 'admin' && '管理员列表'}
                    {activeTab === 'logs' && '登录日志'}
                    <span className="px-2 py-0.5 rounded-full bg-white/10 text-xs text-white/60">
                        {activeTab === 'license' ? filteredLicenses.length : activeTab === 'admin' ? admins.length : logs.length}
                    </span>
                 </h3>
                 <div className="flex space-x-2">
                    <button
                        onClick={() => switchTab('license')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'license' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/5'}`}
                    >
                        <Sliders className="inline-block w-4 h-4 mr-2" /> 授权管理
                    </button>
                    {/* 管理员管理 / 登录日志 仅超级管理员可见 —— 后端接口同样强制校验 */}
                    {isSuper && (
                      <>
                        <button
                            onClick={() => switchTab('admin')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'admin' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/5'}`}
                        >
                            <Shield className="inline-block w-4 h-4 mr-2" /> 管理员管理
                        </button>
                        <button
                            onClick={() => switchTab('logs')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'logs' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/5'}`}
                        >
                            <ScrollText className="inline-block w-4 h-4 mr-2" /> 登录日志
                        </button>
                      </>
                    )}
                 </div>
             </div>

             <div className="overflow-x-auto flex-1">
               {/* ========== 授权列表 ========== */}
               {activeTab === 'license' && (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-xs font-semibold text-white/40 uppercase tracking-wider bg-black/20">
                      <th className="p-4">ID</th>
                      <th className="p-4">授权QQ</th>
                      <th className="p-4">授权信息</th>
                      <th className="p-4">产品/上级</th>
                      <th className="p-4">状态/时间</th>
                      <th className="p-4 text-right">管理</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredLicenses.length === 0 ? (
                       <tr><td colSpan="6" className="p-12 text-center text-white/30">暂无数据</td></tr>
                    ) : filteredLicenses.map(item => (
                        <tr key={item.id} className="hover:bg-white/[0.02] transition group">
                          <td className="p-4 text-white/30 font-mono text-xs">#{item.id}</td>
                          <td className="p-4">
                              <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xs font-bold">
                                  {item.qq.slice(0, 2)}
                              </div>
                              <span className="text-sky-300 font-medium font-mono">{item.qq}</span>
                              </div>
                          </td>
                          <td className="p-4"><div className="text-sm font-medium">{item.owner_name}</div></td>
                          <td className="p-4">
                              <div className="text-sm">{item.product_name}</div>
                              <div className="text-xs text-white/40 mt-0.5">{item.upline}</div>
                          </td>
                          <td className="p-4">
                              <div className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20 mb-1">正常</div>
                              <div className="text-xs text-white/40 font-mono">{new Date(item.expiration_date).toLocaleDateString()}</div>
                          </td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => confirmDeleteLicense(item.id)}
                              className="text-white/20 hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 transition opacity-0 group-hover:opacity-100"
                              title="删除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                    ))}
                  </tbody>
                </table>
               )}

               {/* ========== 管理员列表（超管） ========== */}
               {activeTab === 'admin' && isSuper && (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-xs font-semibold text-white/40 uppercase tracking-wider bg-black/20">
                      <th className="p-4">ID</th>
                      <th className="p-4">账号</th>
                      <th className="p-4">角色</th>
                      <th className="p-4">状态</th>
                      <th className="p-4">创建时间</th>
                      <th className="p-4 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {admins.length === 0 ? (
                       <tr><td colSpan="6" className="p-12 text-center text-white/30">暂无数据</td></tr>
                    ) : admins.map(item => {
                       const active = Number(item.is_active) === 1;
                       const isSelf = item.id === user?.id;
                       return (
                        <tr key={item.id} className="hover:bg-white/[0.02] transition">
                          <td className="p-4 text-white/30 font-mono text-xs">#{item.id}</td>
                          <td className="p-4">
                              <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${item.role === 'super' ? 'bg-amber-500/20 text-amber-400' : 'bg-white/10 text-white/50'}`}>
                                      {item.role === 'super' ? <ShieldCheck size={14} /> : <User size={14} />}
                                  </div>
                                  <span className="text-white font-medium">{item.username}</span>
                                  {isSelf && <span className="text-[10px] text-sky-400/70">(当前账号)</span>}
                              </div>
                          </td>
                          <td className="p-4">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${item.role === 'super' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-white/5 text-white/60 border-white/10'}`}>
                                  {item.role === 'super' ? '超级管理员' : '普通管理员'}
                              </span>
                          </td>
                          <td className="p-4">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${active ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                                  {active ? '启用中' : '已停用'}
                              </span>
                          </td>
                          <td className="p-4 text-xs text-white/40 font-mono">{item.created_at ? new Date(item.created_at).toLocaleString() : '-'}</td>
                          <td className="p-4 text-right whitespace-nowrap">
                              <button
                                  onClick={() => openReset(item)}
                                  className="text-white/30 hover:text-sky-400 p-2 rounded-lg hover:bg-sky-500/10 transition"
                                  title="重置密码"
                              >
                                  <KeyRound className="w-4 h-4" />
                              </button>
                              <button
                                  onClick={() => handleToggleActive(item)}
                                  disabled={isSelf && active}
                                  className={`p-2 rounded-lg transition ${isSelf && active ? 'text-white/10 cursor-not-allowed' : active ? 'text-white/30 hover:text-red-400 hover:bg-red-500/10' : 'text-white/30 hover:text-green-400 hover:bg-green-500/10'}`}
                                  title={isSelf && active ? '不能停用当前登录账号' : active ? '停用账号' : '启用账号'}
                              >
                                  <Power className="w-4 h-4" />
                              </button>
                          </td>
                        </tr>
                       );
                    })}
                  </tbody>
                </table>
               )}

               {/* ========== 登录日志（超管） ========== */}
               {activeTab === 'logs' && isSuper && (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-xs font-semibold text-white/40 uppercase tracking-wider bg-black/20">
                      <th className="p-4">时间</th>
                      <th className="p-4">账号</th>
                      <th className="p-4">结果</th>
                      <th className="p-4">IP 地址</th>
                      <th className="p-4">客户端</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {logs.length === 0 ? (
                       <tr><td colSpan="5" className="p-12 text-center text-white/30">暂无日志</td></tr>
                    ) : logs.map(l => (
                        <tr key={l.id} className="hover:bg-white/[0.02] transition">
                          <td className="p-4 text-xs text-white/50 font-mono whitespace-nowrap">{l.created_at ? new Date(l.created_at).toLocaleString() : '-'}</td>
                          <td className="p-4 text-sm text-white/80">{l.username}</td>
                          <td className="p-4">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${Number(l.success) === 1 ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                                  {Number(l.success) === 1 ? '登录成功' : '登录失败'}
                              </span>
                          </td>
                          <td className="p-4 text-xs text-sky-300/80 font-mono">{l.ip}</td>
                          <td className="p-4 text-xs text-white/30 max-w-[280px] truncate" title={l.user_agent || ''}>{l.user_agent || '-'}</td>
                        </tr>
                    ))}
                  </tbody>
                </table>
               )}
             </div>

             <div className="p-4 border-t border-white/5 text-xs text-white/30 text-center">
               End of List
             </div>
           </div>
        </div>
      </div>

      {/* 删除授权确认 */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleDeleteLicense}
        title="确认删除授权"
        type="danger"
        content="您确定要删除此授权吗？删除后该用户将无法查询到授权信息，此操作不可恢复。"
      />

      {/* 重置密码弹窗 */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setResetTarget(null)}></div>
          <div className="relative w-full max-w-md bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up">
            <div className="flex justify-between items-center p-5 border-b border-white/5">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <KeyRound className="text-sky-400 w-5 h-5" />
                重置「{resetTarget.username}」的密码
              </h3>
              <button onClick={() => setResetTarget(null)} className="text-white/40 hover:text-white transition"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-3">
              <label className="block text-xs text-white/40">新密码（至少6位）</label>
              <input
                type="text"
                autoFocus
                value={resetPwd}
                onChange={e => setResetPwd(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') submitReset(); }}
                className="glass-input w-full"
                placeholder="输入新密码"
              />
              <p className="text-[11px] text-white/30">重置后该账号下次登录需使用新密码；如需立即强制其下线，请直接停用该账号。</p>
            </div>
            <div className="flex gap-3 justify-end p-5 bg-white/5">
              <button onClick={() => setResetTarget(null)} className="px-4 py-2 rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition">取消</button>
              <button onClick={submitReset} className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-sky-500 hover:bg-sky-600 shadow-sky-500/20">确认重置</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
