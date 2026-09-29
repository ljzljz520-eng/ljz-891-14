import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Lock, User, Plus, Trash2, Search, Sliders, Users, Shield, KeyRound, Ban, CheckCircle2, ScrollText, X } from 'lucide-react';
import Modal from '../components/Modal';

export default function AdminPage() {
  const [token, setToken] = useState(localStorage.getItem('auth_token'));
  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('auth_user') || 'null'); } catch { return null; }
  });
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const isSuperAdmin = currentUser?.role === 'super_admin';

  // Dashboard State
  const [licenses, setLicenses] = useState([]);
  const [filteredLicenses, setFilteredLicenses] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  const [newLicense, setNewLicense] = useState({
    qq: '', owner_name: '', product_name: '', upline: '官方', expiration_date: ''
  });

  // Modal State
  const [deleteId, setDeleteId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Tabs: license（所有管理员）| admin（超管）| logs（超管）
  const [activeTab, setActiveTab] = useState('license');
  const [admins, setAdmins] = useState([]);
  const [newAdmin, setNewAdmin] = useState({ username: '', password: '' });
  const [logs, setLogs] = useState([]);

  // 重置密码弹窗
  const [resetTarget, setResetTarget] = useState(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');

  useEffect(() => {
    if (token) {
      fetchLicenses();
      if (isSuperAdmin) {
        fetchAdmins();
      }
    }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab === 'logs' && isSuperAdmin) {
      fetchLogs();
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

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
      const res = await axios.post('/api/auth/login', { username, password });
      localStorage.setItem('auth_token', res.data.token);
      localStorage.setItem('auth_user', JSON.stringify({
        username: res.data.user,
        role: res.data.role,
      }));
      setToken(res.data.token);
      setCurrentUser({ username: res.data.user, role: res.data.role });
      toast.success(res.data.role === 'super_admin' ? '欢迎回来，超级管理员' : '欢迎回来，管理员');
    } catch (err) {
      toast.error('登录失败: ' + (err.response?.data?.message || '用户名或密码错误'));
    }
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    setToken(null);
    setCurrentUser(null);
    setActiveTab('license');
  };

  const fetchLicenses = useCallback(async () => {
    try {
      const res = await axios.get('/api/license/list');
      setLicenses(res.data);
    } catch (err) {
      handleApiError(err, '获取授权列表失败');
    }
  }, []);

  const fetchAdmins = async () => {
    try {
      const res = await axios.get('/api/auth/list');
      setAdmins(res.data);
    } catch (err) {
      handleApiError(err, '获取管理员列表失败');
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await axios.get('/api/auth/logs?limit=200');
      setLogs(res.data);
    } catch (err) {
      handleApiError(err, '获取登录日志失败');
    }
  };

  const handleApiError = (err, fallback) => {
    const status = err.response?.status;
    const msg = err.response?.data?.message;
    if (status === 403) {
      toast.error(msg || '权限不足，该操作仅超级管理员可执行');
    } else if (status === 401) {
      toast.error(msg || '登录已失效，请重新登录');
    } else {
      toast.error(msg || fallback);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      if (activeTab === 'license') {
        await axios.post('/api/license/create', newLicense);
        toast.success('授权添加成功');
        setNewLicense({ qq: '', owner_name: '', product_name: '', upline: '官方', expiration_date: '' });
        fetchLicenses();
      } else {
        // 新增管理员仅超管可见，后端同样强制校验
        await axios.post('/api/auth/create', newAdmin);
        toast.success('管理员添加成功');
        setNewAdmin({ username: '', password: '' });
        fetchAdmins();
      }
    } catch (err) {
      handleApiError(err, '添加失败');
    }
  };

  const confirmDelete = (id) => {
    setDeleteId(id);
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await axios.post('/api/license/delete', { id: deleteId });
      toast.success('已删除该授权');
      fetchLicenses();
    } catch (err) {
      handleApiError(err, '删除失败');
    }
  };

  const openReset = (admin) => {
    setResetTarget(admin);
    setResetPasswordValue('');
  };

  const submitResetPassword = async () => {
    if (!resetPasswordValue) { toast.error('请输入新密码'); return; }
    if (resetPasswordValue.length < 6) { toast.error('新密码长度不能少于 6 位'); return; }
    try {
      await axios.post('/api/auth/reset-password', {
        id: resetTarget.id,
        password: resetPasswordValue,
      });
      toast.success(`已重置 ${resetTarget.username} 的密码`);
      setResetTarget(null);
      setResetPasswordValue('');
    } catch (err) {
      handleApiError(err, '重置密码失败');
    }
  };

  const toggleActive = async (admin) => {
    const nextActive = admin.is_active ? 0 : 1;
    try {
      await axios.post('/api/auth/set-active', { id: admin.id, is_active: nextActive });
      toast.success(nextActive ? `已启用 ${admin.username}` : `已停用 ${admin.username}`);
      fetchAdmins();
    } catch (err) {
      handleApiError(err, '操作失败');
    }
  };

  if (!token) {
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
                 <input type="text" value={username} onChange={e=>setUsername(e.target.value)} className="glass-input w-full pl-10 h-11" placeholder="Administrator" />
                 <User className="absolute left-3 top-3.5 w-4 h-4 text-white/30 group-focus-within:text-sky-400 transition" />
               </div>
             </div>
             <div>
               <label className="block text-xs font-semibold text-white/50 mb-2 uppercase tracking-wider">密码</label>
               <div className="relative group">
                 <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="glass-input w-full pl-10 h-11" placeholder="••••••••" />
                 <Lock className="absolute left-3 top-3.5 w-4 h-4 text-white/30 group-focus-within:text-sky-400 transition" />
               </div>
             </div>
             <button type="submit" className="tech-button w-full mt-2 !py-3 !text-sm tracking-widest">登录</button>
           </form>
        </div>
      </div>
    );
  }

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
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${
              isSuperAdmin
                ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                : 'bg-sky-500/10 text-sky-300 border-sky-500/30'
            }`}>
              <Shield size={11} />
              {isSuperAdmin ? '超级管理员' : '普通管理员'}
            </span>
            <span className="text-white/30">{currentUser?.username}</span>
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
           <button onClick={logout} className="px-4 py-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-white/60 hover:text-red-400 transition border border-white/5 hover:border-red-500/30">
             退出登录
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar: Add Form（管理员新增仅超管可见） */}
        {activeTab !== 'logs' && (activeTab !== 'admin' || isSuperAdmin) && (
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
                            <input required minLength={3} maxLength={50} className="glass-input w-full" placeholder="输入新管理员账号" value={newAdmin.username} onChange={e=>setNewAdmin({...newAdmin, username:e.target.value})} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-white/40">初始密码（至少6位）</label>
                            <input required minLength={6} type="text" className="glass-input w-full" placeholder="设置初始密码" value={newAdmin.password} onChange={e=>setNewAdmin({...newAdmin, password:e.target.value})} />
                        </div>
                        <p className="text-[11px] text-white/30 leading-relaxed">新建账号为<b className="text-white/50">普通管理员</b>，仅可维护授权记录。</p>
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
        {activeTab === 'logs' && <div className="lg:col-span-1 hidden lg:block" />}

        {/* Main */}
        <div className={activeTab === 'logs' ? 'lg:col-span-3' : 'lg:col-span-3'}>
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
                        onClick={() => setActiveTab('license')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'license' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/5'}`}
                    >
                        <Users className="inline-block w-4 h-4 mr-2" /> 授权管理
                    </button>
                    {isSuperAdmin && (
                    <button
                        onClick={() => setActiveTab('admin')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'admin' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/5'}`}
                    >
                        <Shield className="inline-block w-4 h-4 mr-2" /> 管理员管理
                    </button>
                    )}
                    {isSuperAdmin && (
                    <button
                        onClick={() => setActiveTab('logs')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'logs' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/5'}`}
                    >
                        <ScrollText className="inline-block w-4 h-4 mr-2" /> 登录日志
                    </button>
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
                              onClick={() => confirmDelete(item.id)}
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

               {/* ========== 管理员列表（仅超管） ========== */}
               {activeTab === 'admin' && isSuperAdmin && (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-xs font-semibold text-white/40 uppercase tracking-wider bg-black/20">
                      <th className="p-4">ID</th>
                      <th className="p-4">管理员账号</th>
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
                      const isSelf = item.id === currentUser?.id || item.username === currentUser?.username;
                      const superRow = item.role === 'super_admin';
                      return (
                        <tr key={item.id} className="hover:bg-white/[0.02] transition">
                          <td className="p-4 text-white/30 font-mono text-xs">#{item.id}</td>
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${superRow ? 'bg-amber-500/20 text-amber-300' : 'bg-white/10 text-white/50'}`}>
                                {superRow ? <Shield size={14} /> : <User size={14} />}
                              </div>
                              <span className="text-white font-medium">
                                {item.username}
                                {isSelf && <span className="ml-2 text-[10px] text-sky-400">(当前账号)</span>}
                              </span>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                              superRow ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                                       : 'bg-white/5 text-white/60 border-white/10'
                            }`}>
                              {superRow ? '超级管理员' : '普通管理员'}
                            </span>
                          </td>
                          <td className="p-4">
                            {item.is_active ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                                <CheckCircle2 size={12} /> 启用
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                                <Ban size={12} /> 停用
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-xs text-white/40 font-mono">
                            {item.created_at ? new Date(item.created_at).toLocaleString() : '-'}
                          </td>
                          <td className="p-4 text-right whitespace-nowrap">
                            {/* 超管账号（非自己）不允许重置/停用；自己不允许停用自己 */}
                            <button
                              onClick={() => openReset(item)}
                              disabled={superRow && !isSelf}
                              className="text-white/40 hover:text-sky-400 p-2 rounded-lg hover:bg-sky-500/10 transition disabled:opacity-20 disabled:cursor-not-allowed"
                              title={superRow && !isSelf ? '超级管理员不可被操作' : '重置密码'}
                            >
                              <KeyRound className="w-4 h-4" />
                            </button>
                            {!superRow && (
                              <button
                                onClick={() => toggleActive(item)}
                                className={`p-2 rounded-lg transition ${
                                  item.is_active
                                    ? 'text-white/40 hover:text-red-400 hover:bg-red-500/10'
                                    : 'text-white/40 hover:text-green-400 hover:bg-green-500/10'
                                }`}
                                title={item.is_active ? '停用账号' : '启用账号'}
                              >
                                {item.is_active ? <Ban className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                              </button>
                            )}
                            {superRow && isSelf && (
                              <span className="text-[10px] text-white/20 ml-1">最高权限</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
               )}

               {/* ========== 登录日志（仅超管） ========== */}
               {activeTab === 'logs' && isSuperAdmin && (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-xs font-semibold text-white/40 uppercase tracking-wider bg-black/20">
                      <th className="p-4">账号</th>
                      <th className="p-4">IP</th>
                      <th className="p-4">结果</th>
                      <th className="p-4">时间</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {logs.length === 0 ? (
                       <tr><td colSpan="4" className="p-12 text-center text-white/30">暂无登录记录</td></tr>
                    ) : logs.map(log => (
                      <tr key={log.id} className="hover:bg-white/[0.02] transition">
                        <td className="p-4">
                          <span className="inline-flex items-center gap-2 text-white font-medium">
                            <User size={13} className="text-white/40" />
                            {log.username || '(空)'}
                          </span>
                        </td>
                        <td className="p-4 font-mono text-xs text-sky-300">{log.ip || '-'}</td>
                        <td className="p-4">
                          {Number(log.success) === 1 ? (
                            <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">成功</span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20" title={log.fail_reason || ''}>
                              失败{log.fail_reason ? `：${log.fail_reason}` : ''}
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-xs text-white/40 font-mono">
                          {log.created_at ? new Date(log.created_at).toLocaleString() : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
               )}
             </div>

             <div className="p-4 border-t border-white/5 text-xs text-white/30 text-center">
              {activeTab === 'logs' ? '最近 200 条登录记录' : 'End of List'}
             </div>
           </div>
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleDelete}
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
                重置密码 · {resetTarget.username}
              </h3>
              <button onClick={() => setResetTarget(null)} className="text-white/40 hover:text-white transition"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-3">
              <p className="text-white/60 text-sm">为该账号设置新密码，重置后对方需使用新密码登录。</p>
              <input
                type="text"
                autoFocus
                minLength={6}
                value={resetPasswordValue}
                onChange={e => setResetPasswordValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitResetPassword()}
                className="glass-input w-full"
                placeholder="输入新密码（至少 6 位）"
              />
            </div>
            <div className="flex gap-3 justify-end p-5 bg-white/5">
              <button onClick={() => setResetTarget(null)} className="px-4 py-2 rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition">取消</button>
              <button onClick={submitResetPassword} className="px-4 py-2 rounded-lg text-sm font-medium bg-sky-500 hover:bg-sky-600 text-white shadow-lg shadow-sky-500/20">确认重置</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
