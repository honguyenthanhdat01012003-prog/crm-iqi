import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  LayoutDashboard, Users, Building2, Megaphone, Trophy, UserCog, IdCard, FileEdit,
  FileText, Calendar, Settings, LogOut, Search, Save, RefreshCw, Pencil, Trash2,
  Plus, Eye, EyeOff, Bell, Menu, Smartphone, Mail, User, Send, Clock, Check, X,
  Ban, Hourglass, Lock, Key, Lightbulb, Star, Sparkles, ArrowLeftRight, CalendarCheck,
  CheckCircle, ThumbsDown, Banknote, PhoneOff, PhoneIncoming, XCircle, ShieldOff,
  Phone, Skull, Snowflake, CloudSun, Flame, BarChart3, Target, Timer, Building,
  BookOpen, Pin, Folder, CircleDot, Bot, Hand, Minus, ChevronLeft, ChevronRight,
  Camera, Share2, Shuffle, Link, ClipboardList, Pause, Play, ChevronDown, Info,
  AlertCircle, MessageSquare, Hash, CircleOff, BadgePlus, Zap, Filter, MoreHorizontal,
  ExternalLink, Shield, Globe, Layers, TrendingUp, Activity
} from "lucide-react";

const API = "/api";

/* ===== Toast + Confirm global helpers ===== */
let _toastFn = null;
let _confirmFn = null;
function showToast(msg, type = "info") { _toastFn && _toastFn(msg, type); }
function showConfirm(msg) { return new Promise(resolve => { _confirmFn ? _confirmFn(msg, resolve) : resolve(window.confirm(msg)); }); }

function ToastContainer() {
  const [toasts, setToasts] = useState([]);
  useEffect(() => {
    _toastFn = (msg, type) => {
      const id = Date.now() + Math.random();
      setToasts(p => [...p, { id, msg, type }]);
      setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000);
    };
    return () => { _toastFn = null; };
  }, []);
  if (!toasts.length) return null;
  const colors = { success: { bg: "#dcfce7", border: "#22c55e", color: "#15803d" }, error: { bg: "#fee2e2", border: "#ef4444", color: "#b91c1c" }, info: { bg: "#f0faf1", border: "#1a3c20", color: "#1a3c20" }, warning: { bg: "#fef3c7", border: "#f59e0b", color: "#92400e" } };
  return (
    <div style={{ position: "fixed", top: 20, right: 20, zIndex: 100000, display: "flex", flexDirection: "column", gap: 8, maxWidth: 400 }}>
      {toasts.map(t => {
        const c = colors[t.type] || colors.info;
        return (
          <div key={t.id} style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.color, padding: "14px 22px", borderRadius: 12, fontSize: 14, fontWeight: 500, boxShadow: "0 4px 16px rgba(0,0,0,.12), 0 0 0 1px rgba(0,0,0,.04)", animation: "slideIn .3s ease", backdropFilter: "blur(8px)" }}>
            {t.msg}
          </div>
        );
      })}
    </div>
  );
}

function ConfirmModal_() {
  const [state, setState] = useState(null);
  useEffect(() => {
    _confirmFn = (msg, resolve) => setState({ msg, resolve });
    return () => { _confirmFn = null; };
  }, []);
  if (!state) return null;
  const answer = (v) => { state.resolve(v); setState(null); };
  return (
    <div onClick={() => answer(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", zIndex: 100001, display: "flex", alignItems: "center", justifyContent: "center", animation: "fadeIn .2s ease" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 18, padding: "30px 34px", maxWidth: 420, width: "90%", boxShadow: "0 25px 50px rgba(0,0,0,.2), 0 0 0 1px rgba(0,0,0,.05)" }}>
        <div style={{ fontSize: 15, lineHeight: 1.6, whiteSpace: "pre-wrap", color: "#1f2937", marginBottom: 24 }}>{state.msg}</div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={() => answer(false)} style={{ padding: "10px 24px", border: "1px solid #d1d5db", borderRadius: 10, background: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 600, color: "#374151" }}>Huỷ</button>
          <button onClick={() => answer(true)} style={{ padding: "10px 24px", border: "none", borderRadius: 10, background: "linear-gradient(135deg, #e88a2e, #d97706)", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 600, boxShadow: "0 2px 8px rgba(232,138,46,.4)" }}>OK</button>
        </div>
      </div>
    </div>
  );
}

/* ===== Mobile detection hook ===== */
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth <= breakpoint);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= breakpoint);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [breakpoint]);
  return isMobile;
}

const STATUS_LABELS = {
  new: "Chưa feedback",
  called: "Đã gọi",
  interested: "Quan tâm",
  low_interest: "Quan tâm hời hợt",
  other_project: "Quan tâm DA khác",
  appointment: "Hẹn xem",
  booked: "Giữ chỗ",
  closed: "Chốt",
  not_interested: "Không quan tâm",
  spam: "Phá/rác",
  weak_finance: "Tài chính yếu",
  unreachable: "Chưa liên lạc được",
  callback: "Liên lạc lại sau",
  wrong_number: "Thuê bao/Sai số",
  blocked: "Chặn",
  has_sale: "Có sale khác chăm",
  lost: "Mất",
};

const STATUS_COLORS = {
  new: "#f59e0b",
  called: "#4ade80",
  interested: "#22c55e",
  low_interest: "#38bdf8",
  other_project: "#92400e",
  appointment: "#8b5cf6",
  booked: "#10b981",
  closed: "#059669",
  not_interested: "#ef4444",
  spam: "#eab308",
  weak_finance: "#f97316",
  unreachable: "#6b7280",
  callback: "#e88a2e",
  wrong_number: "#9ca3af",
  blocked: "#1f2937",
  has_sale: "#0284c7",
  lost: "#dc2626",
};

function formatVND(n) {
  if (!n && n !== 0) return "0 ₫";
  return Number(n).toLocaleString("vi-VN") + " ₫";
}

function getLeadTemp(createdAt) {
  const d = parseLeadDate(createdAt);
  if (!d) return { label: "Lạnh", bg: "#f0f9ff", color: "#64748b", icon: "cold" };
  const hours = (Date.now() - d.getTime()) / (1000 * 60 * 60);
  if (hours <= 24) return { label: "Cực nóng", bg: "#fef2f2", color: "#dc2626", icon: "very_hot" };
  if (hours <= 72) return { label: "Nóng", bg: "#fff7ed", color: "#ea580c", icon: "hot" };
  if (hours <= 168) return { label: "Ấm", bg: "#fffbeb", color: "#d97706", icon: "warm" };
  return { label: "Lạnh", bg: "#f0f9ff", color: "#64748b", icon: "cold" };
}

function authHeaders() {
  const token = localStorage.getItem("crm_token");
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}

async function apiFetch(url, opts = {}) {
  const res = await fetch(url, { ...opts, headers: { ...authHeaders(), ...opts.headers } });
  if (res.status === 401) {
    localStorage.removeItem("crm_token");
    localStorage.removeItem("crm_user");
    window.location.reload();
    throw new Error("Unauthorized");
  }
  return res;
}

function parseLeadDate(str) {
  if (!str || str === "-") return null;
  const m = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4] || 0), Number(m[5] || 0), Number(m[6] || 0));
  const iso = new Date(str);
  return isNaN(iso.getTime()) ? null : iso;
}

export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("crm_user")); } catch { return null; }
  });
  const [token, setToken] = useState(() => localStorage.getItem("crm_token") || "");

  const updateUser = (u, t) => {
    setUser(u);
    if (t) { setToken(t); localStorage.setItem("crm_token", t); }
    localStorage.setItem("crm_user", JSON.stringify(u));
  };

  if (!user || !token) {
    return <LoginPage onLogin={(u, t) => { setUser(u); setToken(t); }} />;
  }

  if (user.mustChangePassword) {
    return <ForceChangePasswordPage user={user} onChanged={(u, t) => updateUser(u, t)} onLogout={() => {
      localStorage.removeItem("crm_token");
      localStorage.removeItem("crm_user");
      setUser(null);
      setToken("");
    }} />;
  }

  return <CRMApp user={user} updateUser={updateUser} onLogout={() => {
    apiFetch(`${API}/logout`, { method: "POST" }).catch(() => {});
    localStorage.removeItem("crm_token");
    localStorage.removeItem("crm_user");
    setUser(null);
    setToken("");
  }} />;
}

function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Đăng nhập thất bại"); return; }
      localStorage.setItem("crm_token", data.token);
      localStorage.setItem("crm_user", JSON.stringify(data.user));
      onLogin(data.user, data.token);
    } catch (err) {
      setError("Lỗi kết nối server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg, #1a3c20 0%, #0d2b12 50%, #0a1f0e 100%)",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      padding: 16,
    }}>
      <form onSubmit={handleSubmit} style={{
        background: "#fff", borderRadius: 16, padding: "32px 24px", width: 380, maxWidth: "100%",
        boxShadow: "0 20px 60px rgba(0,0,0,.3)",
      }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}><img src="/logo-iqi.svg" alt="LUX IQI" style={{ width: 72, height: 72, objectFit: "contain" }} /></div>
          <h2 style={{ margin: 0, color: "#1a3c20" }}>LUX IQI</h2>
          <p style={{ color: "#6b7280", fontSize: 13, margin: "4px 0 0" }}>Đăng nhập để tiếp tục</p>
        </div>
        {error && <div style={{ background: "#fef2f2", color: "#dc2626", padding: "8px 12px", borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <label style={{ ...labelStyle, marginTop: 0 }}>Tên đăng nhập</label>
        <input style={inputStyle} value={username} onChange={(e) => setUsername(e.target.value)} autoFocus placeholder="admin" />
        <label style={labelStyle}>Mật khẩu</label>
        <div style={{ position: "relative" }}>
          <input style={{ ...inputStyle, paddingRight: 40 }} type={showPwd ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" />
          <button type="button" onClick={() => setShowPwd(!showPwd)} style={{
            position: "absolute", right: 8, top: 8, background: "none", border: "none",
            cursor: "pointer", fontSize: 16, color: "#6b7280", padding: 2,
          }}>{showPwd ? <EyeOff size={16} /> : <Eye size={16} />}</button>
        </div>
        <button type="submit" disabled={loading} style={{
          ...btnPrimary, width: "100%", marginTop: 16, padding: "10px 20px", fontSize: 15,
          opacity: loading ? 0.6 : 1,
        }}>
          {loading ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>
      </form>
    </div>
  );
}

function ForceChangePasswordPage({ user, onChanged, onLogout }) {
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const pwdValid = {
    length: newPwd.length >= 8,
    upper: /[A-Z]/.test(newPwd),
    lower: /[a-z]/.test(newPwd),
    digit: /\d/.test(newPwd),
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPwd),
  };
  const allValid = Object.values(pwdValid).every(Boolean);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!allValid) { setError("Mật khẩu chưa đạt yêu cầu"); return; }
    if (newPwd !== confirmPwd) { setError("Mật khẩu xác nhận không khớp"); return; }
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(`${API}/change-password`, {
        method: "PUT",
        body: JSON.stringify({ newPassword: newPwd }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Lỗi đổi mật khẩu"); return; }
      onChanged(data.user, data.token);
    } catch {
      setError("Lỗi kết nối server");
    } finally {
      setLoading(false);
    }
  };

  const PwdRule = ({ ok, text }) => (
    <div style={{ fontSize: 12, color: ok ? "#16a34a" : "#dc2626", display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
      <span>{ok ? <Check size={14} style={{ color: "#16a34a" }} /> : <X size={14} style={{ color: "#dc2626" }} />}</span> {text}
    </div>
  );

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg, #1a3c20 0%, #0d2b12 50%, #0a1f0e 100%)",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      padding: 16,
    }}>
      <form onSubmit={handleSubmit} style={{
        background: "#fff", borderRadius: 16, padding: "32px 24px", width: 420, maxWidth: "100%",
        boxShadow: "0 20px 60px rgba(0,0,0,.3)",
      }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 40, marginBottom: 8, display: "flex", justifyContent: "center" }}><Lock size={40} /></div>
          <h2 style={{ margin: 0, color: "#1a3c20" }}>Đổi mật khẩu</h2>
          <p style={{ color: "#6b7280", fontSize: 13, margin: "4px 0 0" }}>
            Xin chào <strong>{user.displayName}</strong>, đây là lần đăng nhập đầu tiên.<br />
            Vui lòng đổi mật khẩu để tiếp tục sử dụng.
          </p>
        </div>
        {error && <div style={{ background: "#fef2f2", color: "#dc2626", padding: "8px 12px", borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{error}</div>}

        <label style={{ ...labelStyle, marginTop: 0 }}>Mật khẩu mới</label>
        <div style={{ position: "relative" }}>
          <input style={{ ...inputStyle, paddingRight: 40 }} type={showNew ? "text" : "password"} value={newPwd}
            onChange={(e) => setNewPwd(e.target.value)} placeholder="Nhập mật khẩu mới" autoFocus />
          <button type="button" onClick={() => setShowNew(!showNew)} style={{
            position: "absolute", right: 8, top: 8, background: "none", border: "none",
            cursor: "pointer", fontSize: 16, color: "#6b7280", padding: 2,
          }}>{showNew ? <EyeOff size={16} /> : <Eye size={16} />}</button>
        </div>

        <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 12px", marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Yêu cầu mật khẩu:</div>
          <PwdRule ok={pwdValid.length} text="Ít nhất 8 ký tự" />
          <PwdRule ok={pwdValid.upper} text="Ít nhất 1 chữ hoa (A-Z)" />
          <PwdRule ok={pwdValid.lower} text="Ít nhất 1 chữ thường (a-z)" />
          <PwdRule ok={pwdValid.digit} text="Ít nhất 1 số (0-9)" />
          <PwdRule ok={pwdValid.special} text="Ít nhất 1 ký tự đặc biệt (!@#$%...)" />
        </div>

        <label style={labelStyle}>Xác nhận mật khẩu</label>
        <div style={{ position: "relative" }}>
          <input style={{ ...inputStyle, paddingRight: 40 }} type={showConfirm ? "text" : "password"} value={confirmPwd}
            onChange={(e) => setConfirmPwd(e.target.value)} placeholder="Nhập lại mật khẩu mới" />
          <button type="button" onClick={() => setShowConfirm(!showConfirm)} style={{
            position: "absolute", right: 8, top: 8, background: "none", border: "none",
            cursor: "pointer", fontSize: 16, color: "#6b7280", padding: 2,
          }}>{showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}</button>
        </div>
        {confirmPwd && newPwd !== confirmPwd && (
          <div style={{ fontSize: 12, color: "#dc2626", marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}><X size={14} /> Mật khẩu xác nhận không khớp</div>
        )}

        <button type="submit" disabled={loading || !allValid || newPwd !== confirmPwd} style={{
          ...btnPrimary, width: "100%", marginTop: 12, padding: "10px 20px", fontSize: 15,
          opacity: (loading || !allValid || newPwd !== confirmPwd) ? 0.6 : 1,
        }}>
          {loading ? "Đang xử lý..." : "Đổi mật khẩu & Tiếp tục"}
        </button>
        <button type="button" onClick={onLogout} style={{
          width: "100%", marginTop: 8, padding: "8px 20px", fontSize: 13,
          background: "none", border: "1px solid #d1d5db", borderRadius: 8, cursor: "pointer", color: "#6b7280",
        }}>
          Đăng xuất
        </button>
      </form>
    </div>
  );
}

function CRMApp({ user, updateUser, onLogout }) {
  const isAdmin = user.role === "admin";
  const isMobile = useIsMobile();
  const adminPages = ["dashboard", "leads", "projects", "campaigns", "sales", "users", "posts", "calendar", "sheet_config", "profile"];
  const salePages = ["leads", "profile"];
  const [page, setPage] = useState(() => {
    try {
      const saved = localStorage.getItem("crm_page");
      const allowed = isAdmin ? adminPages : salePages;
      if (saved && allowed.includes(saved)) return saved;
    } catch {}
    return isAdmin ? "dashboard" : "leads";
  });
  useEffect(() => { localStorage.setItem("crm_page", page); }, [page]);
  const [leads, setLeads] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [projects, setProjects] = useState([]);
  const [lastSync, setLastSync] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [selectedProject, setSelectedProject] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Project modal state
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [draftProject, setDraftProject] = useState({ name: "", leadUrl: "", costUrl: "" });

  // Notification state
  const [notifications, setNotifications] = useState([]);
  const [showNotif, setShowNotif] = useState(false);
  const [highlightLeadId, setHighlightLeadId] = useState(null);
  const [syncCountdown, setSyncCountdown] = useState(30);
  const [seenLeadKeys, setSeenLeadKeys] = useState(() => {
    try { const s = localStorage.getItem("crm_seen_keys"); return s ? new Set(JSON.parse(s)) : new Set(); } catch { return new Set(); }
  });

  const applyApiData = useCallback((data) => {
    if (data.leads) {
      setLeads((prev) => {
        // Use name+phone as stable key (IDs change every sync)
        const prevKeys = new Set(prev.map(l => `${l.name}||${l.phone}`));
        const newLeads = data.leads.filter(l => {
          const key = `${l.name}||${l.phone}`;
          return !prevKeys.has(key) && !seenLeadKeys.has(key);
        });
        if (newLeads.length > 0 && prev.length > 0) {
          setNotifications(n => {
            const existing = new Set(n.map(x => `${x.name}||${x.phone}`));
            const fresh = newLeads.filter(l => !existing.has(`${l.name}||${l.phone}`));
            return [...fresh.map(l => ({ ...l, notifTime: Date.now() })), ...n].slice(0, 50);
          });
        }
        return data.leads;
      });
    }
    if (data.campaigns) setCampaigns(data.campaigns);
    if (data.projects) setProjects(data.projects);
    if (data.lastSync) setLastSync(data.lastSync);
  }, [seenLeadKeys]);

  // Mark notifications as seen
  const markAllSeen = useCallback(() => {
    setSeenLeadKeys(prev => {
      const next = new Set(prev);
      notifications.forEach(n => next.add(`${n.name}||${n.phone}`));
      localStorage.setItem("crm_seen_keys", JSON.stringify([...next]));
      return next;
    });
    setNotifications([]);
    setShowNotif(false);
  }, [notifications]);

  useEffect(() => {
    apiFetch(`${API}/data`)
      .then((r) => r.json())
      .then((data) => {
        // First load: mark all current leads as seen so they don't trigger notifications
        if (data.leads) {
          setSeenLeadKeys(prev => {
            if (prev.size === 0) {
              const keys = new Set(data.leads.map(l => `${l.name}||${l.phone}`));
              localStorage.setItem("crm_seen_keys", JSON.stringify([...keys]));
              return keys;
            }
            return prev;
          });
        }
        applyApiData(data);
      })
      .catch(console.error);
  }, [applyApiData]);

  // Auto-sync from Google Sheets every 30 seconds + countdown
  useEffect(() => {
    setSyncCountdown(30);
    const tick = setInterval(() => setSyncCountdown(c => c <= 1 ? 30 : c - 1), 1000);
    const interval = setInterval(() => {
      const endpoint = isAdmin ? `${API}/sync` : `${API}/data`;
      const opts = isAdmin ? { method: "POST" } : {};
      apiFetch(endpoint, opts)
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(applyApiData)
        .catch(() => apiFetch(`${API}/data`).then(r => r.json()).then(applyApiData).catch(() => {}));
      setSyncCountdown(30);
    }, 30000);
    return () => { clearInterval(interval); clearInterval(tick); };
  }, [applyApiData, isAdmin]);

  // Heartbeat - cập nhật trạng thái online mỗi 60 giây
  useEffect(() => {
    const beat = () => apiFetch(`${API}/heartbeat`, { method: "POST" }).catch(() => {});
    beat();
    const iv = setInterval(beat, 60000);
    return () => clearInterval(iv);
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const r = await apiFetch(`${API}/sync`, { method: "POST" });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        showToast("Đồng bộ thất bại: " + (err.error || r.statusText), "error");
        return;
      }
      const data = await r.json();
      applyApiData(data);
      if (data.syncErrors && data.syncErrors.length) {
        showToast("Đồng bộ hoàn tất nhưng có lỗi: " + data.syncErrors.join(", "), "warning");
      }
    } catch (e) {
      console.error("Sync failed", e);
      showToast("Đồng bộ thất bại: " + e.message, "error");
    } finally {
      setSyncing(false);
    }
  };

  // --- Project CRUD ---
  const openNewProject = () => {
    setEditingProject(null);
    setDraftProject({ name: "", leadUrl: "", costUrl: "" });
    setShowProjectModal(true);
  };

  const openEditProject = (p) => {
    setEditingProject(p);
    setDraftProject({ name: p.name, leadUrl: p.leadUrl || "", costUrl: p.costUrl || "" });
    setShowProjectModal(true);
  };

  const [savingProject, setSavingProject] = useState(false);
  const [projectProgress, setProjectProgress] = useState("");

  const saveProject = async () => {
    if (savingProject) return;
    setSavingProject(true);
    setProjectProgress("Đang lưu dự án...");
    const body = draftProject;
    const url = editingProject ? `${API}/projects/${editingProject.id}` : `${API}/projects`;
    const method = editingProject ? "PUT" : "POST";
    try {
      const r = await apiFetch(url, { method, body: JSON.stringify(body) });
      if (!r.ok) {
        const err = await r.json();
        showToast(err.error || "Lỗi khi lưu dự án", "error");
        setSavingProject(false);
        setProjectProgress("");
        return;
      }
      const data = await r.json();
      applyApiData(data);
      setShowProjectModal(false);

      const projectId = data.newProjectId || (editingProject && editingProject.id);
      if (projectId) {
        setProjectProgress("Đang đồng bộ dữ liệu...");
        setSyncing(true);
        try {
          const sr = await apiFetch(`${API}/projects/${projectId}/sync`, { method: "POST" });
          if (sr.ok) {
            const syncData = await sr.json();
            applyApiData(syncData);
          }
        } catch { /* sync error is not critical */ }
        setSyncing(false);
      }
    } catch (e) {
      console.error("Save project failed", e);
      showToast("Lỗi khi lưu dự án", "error");
    } finally {
      setSavingProject(false);
      setProjectProgress("");
    }
  };

  const deleteProject = async (id) => {
    if (!(await showConfirm("Xóa dự án này?"))) return;
    try {
      const r = await apiFetch(`${API}/projects/${id}`, { method: "DELETE" });
      const data = await r.json();
      applyApiData(data);
    } catch (e) {
      console.error("Delete project failed", e);
    }
  };

  // --- Filtered leads ---
  const filteredLeads = useMemo(() => {
    let list = leads;
    if (selectedProject !== "all") {
      list = list.filter((l) => l.projectId === Number(selectedProject));
    }
    if (statusFilter !== "all") {
      list = list.filter((l) => l.status === statusFilter);
    }
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      list = list.filter(
        (l) =>
          (l.name || "").toLowerCase().includes(q) ||
          (l.phone || "").includes(q) ||
          (l.campaign || "").toLowerCase().includes(q) ||
          (l.saleName || "").toLowerCase().includes(q)
      );
    }
    // Date range filter based on createdAt (col R)
    if (dateFrom) {
      const from = new Date(dateFrom);
      from.setHours(0, 0, 0, 0);
      list = list.filter((l) => {
        const d = parseLeadDate(l.createdAt);
        return d && d >= from;
      });
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      list = list.filter((l) => {
        const d = parseLeadDate(l.createdAt);
        return d && d <= to;
      });
    }
    return list;
  }, [leads, selectedProject, statusFilter, searchText, dateFrom, dateTo]);

  // --- Cost data ---
  const projectCostMap = useMemo(() => {
    const map = {};
    projects.forEach((p) => { map[p.id] = p.costData || {}; });
    return map;
  }, [projects]);

  const totalProjectCost = useMemo(() => {
    const result = { totalSpent: 0, totalLeads: 0, totalBooking: 0 };
    projects.forEach((p) => {
      const c = p.costData || {};
      result.totalSpent += c.totalSpent || 0;
      result.totalLeads += c.totalLeads || 0;
      result.totalBooking += c.totalBooking || 0;
    });
    result.cpLead = result.totalLeads > 0 ? Math.round(result.totalSpent / result.totalLeads) : 0;
    return result;
  }, [projects]);

  const activeCost = selectedProject === "all" ? totalProjectCost : projectCostMap[selectedProject] || {};

  // --- Stats ---
  const stats = useMemo(() => {
    const statusCounts = {};
    Object.keys(STATUS_LABELS).forEach((s) => (statusCounts[s] = 0));
    filteredLeads.forEach((l) => {
      const key = l.status || "new";
      statusCounts[key] = (statusCounts[key] || 0) + 1;
    });
    return { total: filteredLeads.length, ...statusCounts };
  }, [filteredLeads]);

  // --- Sale ranking ---
  const saleRanking = useMemo(() => {
    const map = {};
    const statusKeys = Object.keys(STATUS_LABELS);
    filteredLeads.forEach((l) => {
      const sale = l.saleName || "Chưa chia";
      if (!map[sale]) {
        map[sale] = { name: sale, total: 0 };
        statusKeys.forEach(k => map[sale][k] = 0);
      }
      map[sale].total++;
      const st = l.status || "new";
      if (map[sale][st] !== undefined) map[sale][st]++;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [filteredLeads]);

  // --- Campaigns list ---
  const filteredCampaigns = useMemo(() => {
    if (selectedProject === "all") return campaigns;
    return campaigns.filter((c) => c.projectId === Number(selectedProject));
  }, [campaigns, selectedProject]);

  // --- Pages ---
  const NAV = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, adminOnly: true },
    { key: "leads", label: "Khách hàng", icon: Users, adminOnly: false },
    { key: "projects", label: "Dự án", icon: Building2, adminOnly: true },
    { key: "campaigns", label: "Chiến dịch", icon: Megaphone, adminOnly: true },
    { key: "sales", label: "Sale", icon: Trophy, adminOnly: true },
    { key: "users", label: "Quản lý tài khoản", icon: UserCog, adminOnly: true },
    { key: "profile", label: "Hồ sơ cá nhân", icon: IdCard, adminOnly: false },
    { key: "post_mgmt", label: "Quản lý bài đăng", icon: FileEdit, adminOnly: true, children: [
      { key: "posts", label: "Tất cả bài", icon: FileText },
      { key: "calendar", label: "Lịch đăng bài", icon: Calendar },
      { key: "sheet_config", label: "Cấu hình Sheet", icon: Settings },
    ]},
  ];

  const [openSubmenu, setOpenSubmenu] = useState("post_mgmt");

  const [hoverSubmenu, setHoverSubmenu] = useState(null);

  const visibleNav = NAV.filter((n) => !n.adminOnly || isAdmin);

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", background: "#f0f2f5" }}>
      {/* Mobile overlay backdrop */}
      {isMobile && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 998,
          animation: "fadeIn .2s ease",
        }} />
      )}

      {/* Sidebar */}
      <aside
        style={{
          width: isMobile ? 280 : (sidebarOpen ? 230 : 60),
          background: "linear-gradient(180deg, #1a3c20 0%, #0f2d15 50%, #0a1f0e 100%)",
          color: "#fff",
          transition: isMobile ? "transform .25s ease" : "width .2s ease",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          ...(isMobile ? {
            position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 999,
            transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
            boxShadow: sidebarOpen ? "4px 0 24px rgba(0,0,0,.35)" : "none",
          } : {}),
        }}
      >
        <div
          style={{ padding: "12px 12px", cursor: "pointer", fontWeight: 700, fontSize: 18, whiteSpace: "nowrap", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <img src="/logo-iqi.svg" alt="LUX IQI" style={{ width: 32, height: 32, objectFit: "contain" }} />
            {(isMobile || sidebarOpen) && <span style={{ fontSize: 16, letterSpacing: 1 }}>LUX IQI</span>}
          </div>
          {isMobile && sidebarOpen && <span style={{ padding: 4, display: "flex", alignItems: "center" }}><X size={20} /></span>}
        </div>

        {/* Project selector */}
        {(isMobile || sidebarOpen) && (
          <div style={{ padding: "0 12px 12px" }}>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              style={{ width: "100%", padding: "8px", borderRadius: 6, border: "none", fontSize: 14 }}
            >
              <option value="all">Tất cả dự án</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}

        <nav style={{ flex: 1, overflowY: "auto" }}>
          {visibleNav.map((n) => {
            if (n.children) {
              const isOpen = openSubmenu === n.key;
              const isChildActive = n.children.some(c => c.key === page);
              const isCollapsed = !isMobile && !sidebarOpen;
              return (
                <div key={n.key}
                  onMouseEnter={() => isCollapsed && setHoverSubmenu(n.key)}
                  onMouseLeave={() => isCollapsed && setHoverSubmenu(null)}
                  style={{ position: "relative" }}
                >
                  <div
                    onClick={() => {
                      if (isCollapsed) {
                        // On collapsed click, open sidebar
                        setSidebarOpen(true);
                        setOpenSubmenu(n.key);
                      } else {
                        setOpenSubmenu(isOpen ? null : n.key);
                      }
                    }}
                    style={{
                      padding: isMobile ? "14px 16px" : "12px 16px",
                      cursor: "pointer",
                      background: isChildActive ? "rgba(255,255,255,.08)" : "transparent",
                      borderLeft: isChildActive ? "3px solid #e88a2e" : "3px solid transparent",
                      whiteSpace: "nowrap",
                      fontSize: isMobile ? 15 : 14,
                      transition: "background .15s",
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {React.createElement(n.icon, { size: 18 })}
                      {(isMobile || sidebarOpen) && <span>{n.label}</span>}
                    </span>
                    {(isMobile || sidebarOpen) && (
                      <ChevronDown size={14} style={{ opacity: 0.6, transition: "transform .2s", transform: isOpen ? "rotate(180deg)" : "rotate(0)" }} />
                    )}
                  </div>
                  {/* Collapsed hover popup */}
                  {isCollapsed && hoverSubmenu === n.key && (
                    <div style={{
                      position: "absolute", left: 60, top: 0, zIndex: 1050,
                      background: "linear-gradient(180deg, #1a3c20 0%, #0d2b12 100%)",
                      borderRadius: "0 8px 8px 0", minWidth: 180,
                      boxShadow: "4px 4px 16px rgba(0,0,0,.3)",
                      padding: "6px 0",
                    }}>
                      <div style={{ padding: "6px 14px 8px", fontSize: 11, color: "rgba(255,255,255,.5)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{n.label}</div>
                      {n.children.map(c => (
                        <div
                          key={c.key}
                          onClick={(e) => { e.stopPropagation(); setPage(c.key); setHoverSubmenu(null); }}
                          style={{
                            padding: "9px 14px", cursor: "pointer",
                            background: page === c.key ? "rgba(255,255,255,.15)" : "transparent",
                            borderLeft: page === c.key ? "3px solid #e88a2e" : "3px solid transparent",
                            fontSize: 13, color: "#fff", transition: "background .15s",
                            display: "flex", alignItems: "center", gap: 8,
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,.1)"}
                          onMouseLeave={(e) => e.currentTarget.style.background = page === c.key ? "rgba(255,255,255,.15)" : "transparent"}
                        >
                          {c.icon && React.createElement(c.icon, { size: 14 })}
                          {c.label}
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Expanded submenu items */}
                  {isOpen && (isMobile || sidebarOpen) && n.children.map(c => (
                    <div
                      key={c.key}
                      onClick={() => { setPage(c.key); if (isMobile) setSidebarOpen(false); }}
                      style={{
                        padding: isMobile ? "10px 16px 10px 36px" : "8px 16px 8px 36px",
                        cursor: "pointer",
                        background: page === c.key ? "rgba(255,255,255,.15)" : "transparent",
                        borderLeft: page === c.key ? "3px solid #e88a2e" : "3px solid transparent",
                        whiteSpace: "nowrap",
                        fontSize: isMobile ? 13 : 12,
                        transition: "background .15s",
                        opacity: 0.9,
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {c.icon && React.createElement(c.icon, { size: 14 })}
                        {c.label}
                      </span>
                    </div>
                  ))}
                </div>
              );
            }
            return (
              <div
                key={n.key}
                onClick={() => { setPage(n.key); if (isMobile) setSidebarOpen(false); }}
                title={!isMobile && !sidebarOpen ? n.label : undefined}
                style={{
                  padding: isMobile ? "14px 16px" : "12px 16px",
                  cursor: "pointer",
                  background: page === n.key ? "rgba(255,255,255,.12)" : "transparent",
                  borderLeft: page === n.key ? "3px solid #e88a2e" : "3px solid transparent",
                  whiteSpace: "nowrap",
                  fontSize: isMobile ? 15 : 14,
                  transition: "background .15s",
                  position: "relative",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {React.createElement(n.icon, { size: 18 })}
                  {(isMobile || sidebarOpen) && <span>{n.label}</span>}
                </span>
              </div>
            );
          })}
        </nav>

        {(isMobile || sidebarOpen) && (
          <div style={{ padding: "12px", borderTop: "1px solid rgba(255,255,255,.1)" }}>
            <div style={{ fontSize: 13, marginBottom: 6, opacity: 0.9 }}>
              {user.displayName} <span style={{
                fontSize: 10, padding: "1px 6px", borderRadius: 8,
                background: user.role === "admin" ? "#e88a2e" : "#7ab648", color: "#fff",
              }}>{user.role === "admin" ? "Admin" : "Sale"}</span>
            </div>
            <button
              onClick={onLogout}
              style={{
                width: "100%", padding: "8px", background: "rgba(255,255,255,.1)",
                border: "1px solid rgba(255,255,255,.2)", borderRadius: 6,
                color: "#fff", cursor: "pointer", fontSize: 13,
              }}
            >
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><LogOut size={16} /> Đăng xuất</span>
            </button>
            <div style={{ fontSize: 10, opacity: 0.5, marginTop: 6 }}>
              {lastSync ? `Sync: ${new Date(lastSync).toLocaleString("vi-VN")}` : "Chưa sync"}
            </div>
          </div>
        )}
      </aside>

      {/* Main */}
      <main style={{ flex: 1, overflow: "auto", minWidth: 0, background: "#f8fafb", display: "flex", flexDirection: "column" }}>
        {/* Top bar - sticky */}
        <div style={{
          position: "sticky", top: 0, zIndex: 100, background: "#f8fafb",
          padding: isMobile ? "10px 14px" : "16px 28px",
          borderBottom: "1px solid #e5e7eb",
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
          backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            {isMobile && (
              <button onClick={() => setSidebarOpen(true)} style={{
                background: "#1a3c20", color: "#fff", border: "none", borderRadius: 8,
                width: 40, height: 40, fontSize: 18, cursor: "pointer", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <Menu size={20} />
              </button>
            )}
            <h2 style={{ margin: 0, color: "#1a3c20", fontSize: isMobile ? 17 : 22, fontWeight: 700, letterSpacing: "-0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: 10 }}>
              {(() => { const nav = visibleNav.find((n) => n.key === page) || (visibleNav.find(n => n.children)?.children || []).find(c => c.key === page); return nav ? <><span style={{ display: "flex", alignItems: "center" }}>{nav.icon && React.createElement(nav.icon, { size: 20 })}</span> {nav.label}</> : "Dashboard"; })()}
            </h2>
          </div>
          {isAdmin && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* Notification bell + countdown */}
              <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <button onClick={() => setShowNotif(!showNotif)} style={{
                  background: notifications.length > 0 ? "#fef3c7" : "#f3f4f6", border: "1px solid #e5e7eb",
                  borderRadius: 10, width: 40, height: 40, fontSize: 18, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
                  transition: "background .2s, border-color .2s",
                }}>
                  <Bell size={18} style={{ color: notifications.length > 0 ? "#d97706" : "#6b7280" }} />
                  {notifications.length > 0 && (
                    <span style={{
                      position: "absolute", top: -5, right: -5, background: "linear-gradient(135deg, #ef4444, #dc2626)", color: "#fff",
                      borderRadius: 10, padding: "0 5px", fontSize: 10, fontWeight: 700, minWidth: 18,
                      textAlign: "center", lineHeight: "18px", animation: "pulse 2s ease infinite",
                      boxShadow: "0 2px 6px rgba(239,68,68,.4)",
                    }}>{notifications.length}</span>
                  )}
                </button>
                {showNotif && (
                  <>
                    <div onClick={() => setShowNotif(false)} style={{ position: "fixed", inset: 0, zIndex: 998 }} />
                    <div style={{
                      position: isMobile ? "fixed" : "absolute",
                      ...(isMobile
                        ? { top: 60, left: 12, right: 12, width: "auto" }
                        : { top: 44, right: 0, width: 360 }),
                      maxHeight: isMobile ? "calc(100vh - 80px)" : 400, overflowY: "auto", background: "#fff", borderRadius: 12,
                      boxShadow: "0 8px 30px rgba(0,0,0,.18)", border: "1px solid #e5e7eb", zIndex: 999,
                    }}>
                      <div style={{ padding: "12px 16px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <b style={{ fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}><Bell size={16} /> Thông báo</b>
                        {notifications.length > 0 && (
                          <button onClick={markAllSeen} style={{ background: "none", border: "none", color: "#e88a2e", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                            Đánh dấu đã đọc
                          </button>
                        )}
                      </div>
                      {notifications.length === 0 ? (
                        <div style={{ padding: 24, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>Không có thông báo mới</div>
                      ) : (
                        <div style={{ padding: 8 }}>
                          {notifications.map((n) => {
                            const proj = projects.find(p => p.id === n.projectId);
                            return (
                              <div key={n.id} style={{
                                padding: "10px 12px", borderRadius: 8, marginBottom: 4, cursor: "pointer",
                                background: "#f0faf1", border: "1px solid #e8f5e9", transition: "background .15s",
                              }} onClick={() => { setHighlightLeadId(n.id); setPage("leads"); setShowNotif(false); }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                                  <span style={{ background: "#10b981", color: "#fff", padding: "1px 8px", borderRadius: 8, fontSize: 10, fontWeight: 700, animation: "fadeIn .5s ease" }}>MỚI</span>
                                  <span style={{ fontWeight: 700, fontSize: 13 }}>{n.name}</span>
                                </div>
                                <div style={{ fontSize: 11, color: "#6b7280", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                                  <span style={{ display: "flex", alignItems: "center", gap: 2 }}><Smartphone size={12} /> {n.phone || "-"}</span>
                                  {proj && <span style={{ display: "flex", alignItems: "center", gap: 2 }}><Building2 size={12} /> {proj.name}</span>}
                                  <span style={{ display: "flex", alignItems: "center", gap: 2 }}><Calendar size={12} /> {n.createdAt || "-"}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
              <button
                onClick={handleSync}
                disabled={syncing}
                title={syncing ? "Đang đồng bộ..." : `Đồng bộ (${syncCountdown}s)`}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: syncing ? "not-allowed" : "pointer",
                  display: "flex", flexDirection: "column", alignItems: "center",
                  padding: "2px 6px", minWidth: 44, flexShrink: 0,
                }}
              >
                <span style={{
                  fontSize: 22, lineHeight: 1,
                  display: "inline-block",
                  animation: syncing ? "spin 1s linear infinite" : (syncCountdown <= 5 ? "pulse 1s ease-in-out infinite" : "none"),
                }}><RefreshCw size={22} /></span>
                <span style={{
                  fontSize: 10, fontWeight: 700, marginTop: 1,
                  color: syncing ? "#e88a2e" : (syncCountdown <= 5 ? "#ef4444" : "#6b7280"),
                  fontVariantNumeric: "tabular-nums",
                }}>{syncing ? "..." : `${syncCountdown}s`}</span>
              </button>
            </div>
          )}
        </div>

        <div style={{ flex: 1, padding: isMobile ? 14 : 28, paddingTop: isMobile ? 10 : 20 }}>
        {page === "dashboard" && (
          <DashboardPage stats={stats} cost={activeCost} saleRanking={saleRanking} leads={filteredLeads} />
        )}
        {page === "leads" && (
          <LeadsPage
            leads={filteredLeads}
            searchText={searchText}
            setSearchText={setSearchText}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            dateFrom={dateFrom}
            setDateFrom={setDateFrom}
            dateTo={dateTo}
            setDateTo={setDateTo}
            projects={projects}
            user={user}
            applyApiData={applyApiData}
            onLogout={onLogout}
            highlightLeadId={highlightLeadId}
            setHighlightLeadId={setHighlightLeadId}
          />
        )}
        {page === "projects" && isAdmin && (
          <ProjectsPage
            projects={projects}
            openNewProject={openNewProject}
            openEditProject={openEditProject}
            deleteProject={deleteProject}
            apiFetch={apiFetch}
            applyApiData={applyApiData}
          />
        )}
        {page === "campaigns" && isAdmin && <CampaignsPage leads={leads} projects={projects} />}
        {page === "sales" && isAdmin && <SalesPage ranking={saleRanking} leads={filteredLeads} apiFetch={apiFetch} applyApiData={applyApiData} />}
        {page === "users" && isAdmin && <UsersPage projects={projects} leads={leads} />}
        {page === "profile" && <ProfilePage user={user} updateUser={updateUser} />}
        {page === "posts" && isAdmin && <PostsPage projects={projects} />}
        {page === "calendar" && isAdmin && <CalendarPage projects={projects} />}
        {page === "sheet_config" && isAdmin && <SheetConfigPage />}
        </div>
      </main>

      {/* Project Modal */}
      {showProjectModal && (
        <Modal onClose={() => !savingProject && setShowProjectModal(false)} title={editingProject ? "Sửa dự án" : "Thêm dự án"}>
          <label style={labelStyle}>Tên dự án</label>
          <input
            style={inputStyle}
            value={draftProject.name}
            onChange={(e) => setDraftProject({ ...draftProject, name: e.target.value })}
            placeholder="VD: MASTERI COSMO CENTRAL"
          />
          <label style={labelStyle}>Lead URL (Google Sheets CSV)</label>
          <input
            style={inputStyle}
            value={draftProject.leadUrl}
            onChange={(e) => setDraftProject({ ...draftProject, leadUrl: e.target.value })}
            placeholder="https://docs.google.com/spreadsheets/d/e/.../pub?gid=0&single=true&output=csv"
          />
          <label style={labelStyle}>Cost URL (Google Sheets CSV)</label>
          <input
            style={inputStyle}
            value={draftProject.costUrl}
            onChange={(e) => setDraftProject({ ...draftProject, costUrl: e.target.value })}
            placeholder="https://docs.google.com/spreadsheets/d/e/.../pub?gid=...&single=true&output=csv"
          />
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button
              onClick={saveProject}
              disabled={savingProject}
              style={{ ...btnPrimary, flex: 1, opacity: savingProject ? 0.6 : 1, cursor: savingProject ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              {savingProject && <span style={{ display: "inline-block", width: 16, height: 16, border: "2px solid #fff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />}
              {savingProject ? projectProgress : "Lưu"}
            </button>
            <button onClick={() => !savingProject && setShowProjectModal(false)} disabled={savingProject} style={{ ...btnSecondary, flex: 1, opacity: savingProject ? 0.6 : 1 }}>Hủy</button>
          </div>
        </Modal>
      )}
      <ChatSidebar currentUser={user} />
      <ToastContainer />
      <ConfirmModal_ />
    </div>
  );
}

/* ===== Chat Sidebar - Facebook Messenger Style ===== */
function ChatSidebar({ currentUser }) {
  const myId = currentUser.userId || currentUser.id;
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatUsers, setChatUsers] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [totalUnread, setTotalUnread] = useState(0);
  const [sending, setSending] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [notifFlash, setNotifFlash] = useState(false);
  const msgEndRef = useRef(null);
  const inputRef = useRef(null);
  const lastMsgIdRef = useRef(0);
  const prevUnreadRef = useRef(0);

  // Notification sound
  const playNotifSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 880; osc.type = "sine";
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3);
    } catch (e) { /* ignore */ }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const r = await apiFetch(`${API}/chat/users`);
      if (r.ok) {
        const data = await r.json();
        setChatUsers(data);
        const newTotal = data.reduce((s, u) => s + (u.unread || 0), 0);
        if (newTotal > prevUnreadRef.current) {
          playNotifSound();
          setNotifFlash(true);
          setTimeout(() => setNotifFlash(false), 2000);
        }
        prevUnreadRef.current = newTotal;
        setTotalUnread(newTotal);
      }
    } catch (e) { /* ignore */ }
  }, [playNotifSound]);

  const loadMessages = useCallback(async (userId) => {
    try {
      const r = await apiFetch(`${API}/chat/messages/${userId}`);
      if (r.ok) {
        const data = await r.json();
        setMessages(data);
        lastMsgIdRef.current = data.length > 0 ? data[data.length - 1].id : 0;
        setTimeout(() => msgEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      }
    } catch (e) { /* ignore */ }
  }, []);

  // Auto-load users on mount + poll every 10s (always, for notifications)
  useEffect(() => {
    loadUsers();
    const iv = setInterval(loadUsers, 10000);
    return () => clearInterval(iv);
  }, [loadUsers]);

  // Poll new messages every 3s when chatting
  useEffect(() => {
    if (!activeChat) return;
    const iv = setInterval(async () => {
      try {
        const r = await apiFetch(`${API}/chat/new/${activeChat.id}?after=${lastMsgIdRef.current}`);
        if (r.ok) {
          const newMsgs = await r.json();
          if (newMsgs.length > 0) {
            setMessages(prev => [...prev, ...newMsgs]);
            lastMsgIdRef.current = newMsgs[newMsgs.length - 1].id;
            // Sound if incoming message from the other person
            if (newMsgs.some(m => m.senderId !== myId)) playNotifSound();
            setTimeout(() => msgEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
          }
        }
      } catch (e) { /* ignore */ }
      loadUsers();
    }, 3000);
    return () => clearInterval(iv);
  }, [activeChat, loadUsers]);

  const openChat = (chatUser) => {
    setActiveChat(chatUser);
    setMessages([]);
    setDraft("");
    lastMsgIdRef.current = 0;
    loadMessages(chatUser.id);
  };

  const sendMessage = async () => {
    if (!draft.trim() || !activeChat || sending) return;
    const text = draft.trim();
    setSending(true);
    setDraft("");
    try {
      const r = await apiFetch(`${API}/chat/send`, {
        method: "POST",
        body: JSON.stringify({ receiverId: activeChat.id, content: text }),
      });
      if (r.ok) {
        const msg = await r.json();
        setMessages(prev => [...prev, msg]);
        lastMsgIdRef.current = msg.id;
        setTimeout(() => msgEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
        setTimeout(() => inputRef.current?.focus(), 100);
        loadUsers();
      }
    } catch (e) { /* ignore */ }
    setSending(false);
  };

  const isOnline = (u) => u.lastActive && (Date.now() - new Date(u.lastActive).getTime() < 5 * 60 * 1000);
  const onlineStatus = (u) => {
    if (isOnline(u)) return "Đang hoạt động";
    if (!u.lastActive) return "Offline";
    const diff = Math.floor((Date.now() - new Date(u.lastActive).getTime()) / 60000);
    if (diff < 60) return `${diff} phút trước`;
    if (diff < 1440) return `${Math.floor(diff / 60)} giờ trước`;
    return `${Math.floor(diff / 1440)} ngày trước`;
  };
  const formatTime = (ts) => {
    if (!ts) return "";
    const d = new Date(ts);
    const now = new Date();
    const diff = Math.floor((now - d) / 60000);
    if (diff < 1) return "Vừa xong";
    if (diff < 60) return `${diff}p`;
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  };

  const filteredUsers = searchText
    ? chatUsers.filter(u => u.displayName.toLowerCase().includes(searchText.toLowerCase()) || u.username.toLowerCase().includes(searchText.toLowerCase()))
    : chatUsers;

  const sidebarWidth = isMobile ? 300 : 280;

  // Chat popup windows (bottom-right, Facebook-style)
  const [chatWindows, setChatWindows] = useState([]); // [{user, minimized}]

  const openChatWindow = (chatUser) => {
    setActiveChat(chatUser);
    setMessages([]);
    setDraft("");
    lastMsgIdRef.current = 0;
    loadMessages(chatUser.id);
    if (isMobile) setSidebarOpen(false); // Hide contacts sidebar on mobile when opening chat
  };

  return (
    <>
      {/* Toggle button - fixed right */}
      <button
        onClick={() => {
          if (isMobile && activeChat) {
            // On mobile, if chat is open, close chat first
            setActiveChat(null);
            loadUsers();
            setSidebarOpen(true);
          } else {
            setSidebarOpen(!sidebarOpen);
          }
        }}
        style={{
          position: "fixed", top: "50%", right: sidebarOpen ? sidebarWidth : 0,
          transform: "translateY(-50%)", zIndex: 1001,
          width: 28, height: 64, border: "none", cursor: "pointer",
          background: "linear-gradient(180deg, #1a3c20 0%, #0d2b12 100%)",
          color: "#fff", fontSize: 14, borderRadius: "8px 0 0 8px",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "-2px 0 8px rgba(0,0,0,.15)", transition: "right .25s ease",
        }}
        title={sidebarOpen ? "Đóng liên hệ" : "Mở liên hệ"}
      >
        {sidebarOpen ? "›" : "‹"}
        {!sidebarOpen && totalUnread > 0 && (
          <span style={{
            position: "absolute", top: -6, left: -6, minWidth: 18, height: 18,
            borderRadius: 9, background: "#dc2626", color: "#fff", fontSize: 10,
            fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center",
            padding: "0 4px", border: "2px solid #fff",
            animation: notifFlash ? "pulse 0.5s ease 3" : "none",
          }}>{totalUnread > 99 ? "99+" : totalUnread}</span>
        )}
      </button>

      {/* Overlay to close sidebar on click outside */}
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{
          position: "fixed", inset: 0, background: isMobile ? "rgba(0,0,0,.4)" : "transparent", zIndex: 999,
        }} />
      )}

      {/* Right sidebar */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: sidebarWidth,
        background: "#fff", borderLeft: "1px solid #e4e6eb",
        transform: sidebarOpen ? "translateX(0)" : `translateX(${sidebarWidth}px)`,
        transition: "transform .25s ease", zIndex: 1000,
        display: "flex", flexDirection: "column",
        boxShadow: sidebarOpen ? "-4px 0 20px rgba(0,0,0,.08)" : "none",
      }}>
        {/* Header */}
        <div style={{
          padding: "14px 12px 10px", borderBottom: "1px solid #e4e6eb",
          background: "linear-gradient(180deg, #1a3c20 0%, #0d2b12 100%)", color: "#fff",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", gap: 6 }}><Users size={16} /> Liên hệ</span>
            <span style={{ fontSize: 11, opacity: .7 }}>{chatUsers.filter(u => isOnline(u)).length} online</span>
          </div>
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Tìm người dùng..."
            style={{
              width: "100%", padding: "7px 10px", borderRadius: 8, border: "none",
              fontSize: 12, outline: "none", background: "rgba(255,255,255,.15)",
              color: "#fff", boxSizing: "border-box",
            }}
          />
        </div>

        {/* Users list */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {/* Online users first */}
          {filteredUsers.filter(u => isOnline(u)).length > 0 && (
            <div style={{ padding: "8px 12px 4px", fontSize: 11, fontWeight: 600, color: "#22c55e", textTransform: "uppercase", letterSpacing: .5, display: "flex", alignItems: "center", gap: 4 }}>
              <CircleDot size={10} /> Đang online ({filteredUsers.filter(u => isOnline(u)).length})
            </div>
          )}
          {filteredUsers.filter(u => isOnline(u)).map(u => (
            <UserContactRow key={u.id} u={u} isOnline={true} onlineStatus={onlineStatus} formatTime={formatTime} onClick={() => openChatWindow(u)} />
          ))}

          {/* Offline users */}
          {filteredUsers.filter(u => !isOnline(u)).length > 0 && (
            <div style={{ padding: "8px 12px 4px", fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: .5, display: "flex", alignItems: "center", gap: 4 }}>
              <CircleOff size={10} /> Offline ({filteredUsers.filter(u => !isOnline(u)).length})
            </div>
          )}
          {filteredUsers.filter(u => !isOnline(u)).map(u => (
            <UserContactRow key={u.id} u={u} isOnline={false} onlineStatus={onlineStatus} formatTime={formatTime} onClick={() => openChatWindow(u)} />
          ))}

          {filteredUsers.length === 0 && (
            <div style={{ textAlign: "center", color: "#9ca3af", fontSize: 12, padding: 30 }}>
              {searchText ? "Không tìm thấy" : "Không có người dùng"}
            </div>
          )}
        </div>
      </div>

      {/* Chat popup window */}
      {activeChat && (
        <div style={{
          position: "fixed",
          ...(isMobile ? {
            left: 0, right: 0, bottom: 0, width: "100%", height: "65vh",
            borderRadius: "16px 16px 0 0",
          } : {
            bottom: 0, right: sidebarOpen ? sidebarWidth + 8 : 8,
            width: 340, height: 440,
            borderRadius: "12px 12px 0 0",
          }),
          background: "#fff",
          boxShadow: "0 -4px 24px rgba(0,0,0,.18)", zIndex: 1002,
          display: "flex", flexDirection: "column", overflow: "hidden",
          transition: "right .25s ease",
        }}>
          {/* Chat header */}
          <div style={{
            padding: "8px 12px", background: "linear-gradient(135deg, #1a3c20, #0d2b12)", color: "#fff",
            display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: "50%", flexShrink: 0, position: "relative",
              background: activeChat.avatarUrl ? `url(${activeChat.avatarUrl}) center/cover` : "rgba(255,255,255,.25)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#fff",
            }}>
              {!activeChat.avatarUrl && (activeChat.displayName || "?")[0]?.toUpperCase()}
              <div style={{
                position: "absolute", bottom: -1, right: -1, width: 9, height: 9, borderRadius: "50%",
                background: isOnline(activeChat) ? "#44b700" : "#9ca3af", border: "2px solid #1a3c20",
              }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{activeChat.displayName}</div>
              <div style={{ fontSize: 10, opacity: .85 }}>{onlineStatus(activeChat)}</div>
            </div>
            <button onClick={() => { setActiveChat(null); loadUsers(); }} style={{
              background: "rgba(255,255,255,.2)", border: "none", color: "#fff", cursor: "pointer",
              fontSize: 14, padding: "2px 8px", borderRadius: 6,
            }}><X size={14} /></button>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: "auto", padding: "8px 10px", background: "#f0f2f5",
            display: "flex", flexDirection: "column", gap: 3,
          }}>
            {messages.length === 0 && (
              <div style={{ textAlign: "center", color: "#9ca3af", fontSize: 12, marginTop: 40 }}>
                Bắt đầu trò chuyện với {activeChat.displayName} <Hand size={14} style={{ display: "inline" }} />
              </div>
            )}
            {messages.map((msg, i) => {
              const isMine = msg.senderId === myId;
              const showDate = i === 0 || new Date(msg.createdAt).toDateString() !== new Date(messages[i - 1].createdAt).toDateString();
              // Avatar chỉ hiện ở tin nhắn cuối cùng liên tiếp của người kia
              const isLastInGroup = !isMine && (i === messages.length - 1 || messages[i + 1].senderId !== msg.senderId);
              return (
                <React.Fragment key={msg.id}>
                  {showDate && (
                    <div style={{ textAlign: "center", fontSize: 10, color: "#9ca3af", margin: "6px 0 3px" }}>
                      {new Date(msg.createdAt).toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" })}
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: isMine ? "flex-end" : "flex-start", alignItems: "flex-end", gap: 6 }}>
                    {/* Avatar bên trái – chỉ hiện ở tin cuối cùng liên tiếp */}
                    {!isMine && (
                      isLastInGroup ? (
                        <div style={{
                          width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                          background: activeChat.avatarUrl ? `url(${activeChat.avatarUrl}) center/cover` : "linear-gradient(135deg, #e88a2e, #d97706)",
                          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff",
                        }}>
                          {!activeChat.avatarUrl && (activeChat.displayName || "?")[0]?.toUpperCase()}
                        </div>
                      ) : <div style={{ width: 28, flexShrink: 0 }} />
                    )}
                    <div style={{
                      maxWidth: "70%", padding: "7px 11px",
                      borderRadius: isMine ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                      background: isMine ? "#1a3c20" : "#fff",
                      color: isMine ? "#fff" : "#1c1e21",
                      fontSize: 13, lineHeight: 1.35, wordBreak: "break-word",
                      boxShadow: isMine ? "none" : "0 1px 2px rgba(0,0,0,.08)",
                    }}>
                      {msg.content}
                      <div style={{ fontSize: 9, opacity: .55, textAlign: "right", marginTop: 1 }}>
                        {new Date(msg.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
            <div ref={msgEndRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: "7px 10px", borderTop: "1px solid #e4e6eb",
            display: "flex", gap: 6, alignItems: "center", background: "#fff", flexShrink: 0,
          }}>
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage())}
              placeholder="Nhập tin nhắn..."
              style={{
                flex: 1, border: "1px solid #e4e6eb", borderRadius: 20, padding: "7px 12px",
                fontSize: 13, outline: "none", background: "#f0f2f5",
              }}
              autoFocus
            />
            <button
              onClick={sendMessage}
              disabled={!draft.trim() || sending}
              style={{
                width: 32, height: 32, borderRadius: "50%", border: "none",
                background: draft.trim() ? "#1a3c20" : "#e4e6eb", color: draft.trim() ? "#fff" : "#bcc0c4",
                cursor: draft.trim() ? "pointer" : "default", fontSize: 15,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}
            ><Send size={16} /></button>
          </div>
        </div>
      )}
    </>
  );
}

function UserContactRow({ u, isOnline: online, onlineStatus, formatTime, onClick }) {
  const lastMsg = u.lastMessage;
  const lastMsgText = lastMsg ? (typeof lastMsg === "string" ? lastMsg : lastMsg.content || "") : "";
  const lastMsgTime = lastMsg ? (typeof lastMsg === "string" ? null : lastMsg.createdAt) : null;
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
        cursor: "pointer", transition: "background .15s",
        background: u.unread > 0 ? "#fef6ee" : "transparent",
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = "#f3f4f6"}
      onMouseLeave={(e) => e.currentTarget.style.background = u.unread > 0 ? "#fef6ee" : "transparent"}
    >
      <div style={{
        width: 38, height: 38, borderRadius: "50%", flexShrink: 0, position: "relative",
        background: u.avatarUrl ? `url(${u.avatarUrl}) center/cover` : "linear-gradient(135deg, #e88a2e, #d97706)",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, color: "#fff",
      }}>
        {!u.avatarUrl && (u.displayName || "?")[0]?.toUpperCase()}
        <div style={{
          position: "absolute", bottom: 0, right: 0, width: 10, height: 10, borderRadius: "50%",
          background: online ? "#44b700" : "#9ca3af", border: "2px solid #fff",
        }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{
            fontWeight: u.unread > 0 ? 700 : 500, fontSize: 13,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "#1c1e21",
          }}>{u.displayName}</span>
          <span style={{
            fontSize: 9, padding: "1px 5px", borderRadius: 6, flexShrink: 0,
            background: u.role === "admin" ? "#fef2f2" : "#f0faf1",
            color: u.role === "admin" ? "#dc2626" : "#1a3c20", fontWeight: 600,
          }}>{u.role === "admin" ? "Admin" : "Sale"}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{
            fontSize: 11, color: online ? "#22c55e" : "#9ca3af",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1,
          }}>
            {lastMsgText
              ? (lastMsgText.length > 20 ? lastMsgText.slice(0, 20) + "..." : lastMsgText)
              : onlineStatus(u)}
          </span>
          {lastMsgTime && <span style={{ fontSize: 9, color: "#9ca3af", flexShrink: 0 }}>{formatTime(lastMsgTime)}</span>}
        </div>
      </div>
      {u.unread > 0 && (
        <span style={{
          minWidth: 18, height: 18, borderRadius: 9, background: "#e88a2e", color: "#fff",
          fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center",
          padding: "0 4px", flexShrink: 0,
        }}>{u.unread}</span>
      )}
    </div>
  );
}

/* ===== Components ===== */

function Modal({ onClose, title, children }) {
  const isMobile = useIsMobile();
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,.5)",
        backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
        display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", zIndex: 999,
        animation: "fadeIn .2s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: isMobile ? "20px 20px 0 0" : 16,
          padding: isMobile ? "24px 18px 36px" : 28,
          width: isMobile ? "100%" : 480,
          maxWidth: "100%",
          maxHeight: isMobile ? "90vh" : "85vh",
          overflowY: "auto",
          boxShadow: "0 25px 50px rgba(0,0,0,.25), 0 0 0 1px rgba(0,0,0,.05)",
          animation: isMobile ? "slideUp .25s ease" : "fadeIn .2s ease",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: isMobile ? 18 : 17, fontWeight: 700, letterSpacing: "-0.01em" }}>{title}</h3>
          {isMobile && <button onClick={onClose} style={{ background: "#f3f4f6", border: "none", borderRadius: "50%", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", color: "#6b7280", cursor: "pointer" }}><X size={18} /></button>}
        </div>
        {children}
      </div>
    </div>
  );
}

function Card({ title, value, sub, color = "#e88a2e", percent, compact }) {
  const valStr = String(value || "");
  const autoSize = valStr.length > 10 ? (compact ? 14 : 20) : valStr.length > 7 ? (compact ? 16 : 24) : (compact ? 18 : 28);
  return (
    <div
      style={{
        background: "#fff", borderRadius: compact ? 12 : 14, padding: compact ? 14 : 22,
        boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 0 0 1px rgba(0,0,0,.03)",
        borderTop: `3px solid ${color}`,
        transition: "transform .2s, box-shadow .2s",
        overflow: "hidden", minWidth: 0,
      }}
    >
      <div style={{ fontSize: compact ? 11 : 12, color: "#6b7280", marginBottom: 4, fontWeight: 500, letterSpacing: "0.02em", textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
      <div style={{ fontSize: autoSize, fontWeight: 700, color, letterSpacing: "-0.02em", wordBreak: "break-word", lineHeight: 1.2 }}>{value}</div>
      {percent !== undefined && <div style={{ fontSize: compact ? 10 : 12, color: "#9ca3af", marginTop: 1 }}>{percent}%</div>}
      {sub && <div style={{ fontSize: compact ? 10 : 11, color: "#9ca3af", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function DonutChart({ segments, size = 220 }) {
  const cx = size / 2, cy = size / 2, r = size * 0.36, strokeWidth = size * 0.14;
  const total = segments.reduce((s, g) => s + g.value, 0);
  if (!total) return <div style={{ textAlign: "center", color: "#9ca3af", padding: 40 }}>Không có dữ liệu</div>;
  let cumAngle = -90;
  const arcs = segments.filter(s => s.value > 0).map((seg) => {
    const angle = (seg.value / total) * 360;
    const startAngle = cumAngle;
    cumAngle += angle;
    const endAngle = cumAngle;
    const largeArc = angle > 180 ? 1 : 0;
    const toRad = (a) => (a * Math.PI) / 180;
    const x1 = cx + r * Math.cos(toRad(startAngle));
    const y1 = cy + r * Math.sin(toRad(startAngle));
    const x2 = cx + r * Math.cos(toRad(endAngle - 0.1));
    const y2 = cy + r * Math.sin(toRad(endAngle - 0.1));
    return { ...seg, d: `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`, pct: ((seg.value / total) * 100).toFixed(1) };
  });
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: size < 200 ? 16 : 32, justifyContent: "center" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {arcs.map((a, i) => (
          <path key={i} d={a.d} fill="none" stroke={a.color} strokeWidth={strokeWidth} strokeLinecap="round" />
        ))}
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize={size < 200 ? "16" : "22"} fontWeight="700" fill="#1f2937">{total}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize={size < 200 ? "9" : "11"} fill="#6b7280">Tổng lead</text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {arcs.map((a, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: size < 200 ? 11 : 13 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: a.color, display: "inline-block", flexShrink: 0 }} />
            <span style={{ color: "#374151", fontWeight: 500 }}>{a.label}</span>
            <span style={{ color: "#6b7280" }}>{a.value} ({a.pct}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardPage({ stats, cost, saleRanking }) {
  const isMobile = useIsMobile();
  const pct = (v) => stats.total ? ((v / stats.total) * 100).toFixed(1) : "0.0";

  const statusCards = Object.entries(STATUS_LABELS)
    .filter(([key]) => key !== "new")
    .map(([key, label]) => ({ title: label, value: stats[key] || 0, color: STATUS_COLORS[key] }))
    .filter(c => c.value > 0);

  const allCards = [
    { title: "Mới (chưa feedback)", value: stats.new || 0, color: STATUS_COLORS.new },
    ...statusCards,
  ];

  const donutSegments = allCards.map(c => ({ label: c.title, value: c.value, color: c.color }));

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(auto-fill, minmax(160px, 1fr))", gap: isMobile ? 8 : 16, marginBottom: isMobile ? 16 : 24 }}>
        <Card title="Tổng Lead" value={stats.total} color="#1a3c20" compact={isMobile} />
        {allCards.map((c) => (
          <Card key={c.title} title={c.title} value={c.value} color={c.color} percent={pct(c.value)} compact={isMobile} />
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fill, minmax(160px, 1fr))", gap: isMobile ? 8 : 16, marginBottom: isMobile ? 16 : 24 }}>
        <Card title="Chi phí" value={formatVND(cost.totalSpent)} sub={`CPL: ${formatVND(stats.total ? Math.round(cost.totalSpent / stats.total) : 0)}`} color="#8b5cf6" compact={isMobile} />
        <Card title="Booking" value={cost.totalBooking || 0} color="#ec4899" compact={isMobile} />
      </div>

      <div style={{ background: "#fff", borderRadius: 12, padding: isMobile ? 16 : 24, marginBottom: isMobile ? 16 : 24, boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
        <h4 style={{ margin: "0 0 16px", fontSize: isMobile ? 14 : 16, color: "#1f2937", display: "flex", alignItems: "center", gap: 6 }}><BarChart3 size={18} /> Biểu đồ phân bổ trạng thái</h4>
        <DonutChart segments={donutSegments} size={isMobile ? 160 : 220} />
      </div>

      <div style={{ background: "#fff", borderRadius: 12, padding: isMobile ? 12 : 20, boxShadow: "0 1px 3px rgba(0,0,0,.08)", overflowX: "auto" }}>
        <h4 style={{ margin: "0 0 12px", fontSize: isMobile ? 14 : 16, display: "flex", alignItems: "center", gap: 6 }}><Trophy size={18} /> Bảng xếp hạng Sale</h4>
        {isMobile ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {saleRanking.map((s, i) => (
              <div key={s.name} style={{ background: i % 2 ? "#f9fafb" : "#fff", borderRadius: 10, padding: 12, border: "1px solid #e5e7eb" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{i === 0 ? <Trophy size={16} style={{ color: "#FFD700", display: "inline", verticalAlign: "middle" }} /> : i === 1 ? <Trophy size={16} style={{ color: "#C0C0C0", display: "inline", verticalAlign: "middle" }} /> : i === 2 ? <Trophy size={16} style={{ color: "#CD7F32", display: "inline", verticalAlign: "middle" }} /> : `#${i+1}`} {s.name}</span>
                  <span style={{ fontWeight: 700, fontSize: 16, color: "#1a3c20" }}>{s.total} lead</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => {
                    const val = s[k] || 0;
                    if (!val) return null;
                    return <span key={k} style={{ padding: "2px 6px", borderRadius: 8, fontSize: 10, fontWeight: 600, background: (STATUS_COLORS[k] || "#6b7280") + "18", color: STATUS_COLORS[k] }}>{v}: {val}</span>;
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>#</th>
              <th style={thStyle}>Sale</th>
              <th style={thStyle}>Tổng</th>
              <th style={{ ...thStyle, color: "#6b7280", whiteSpace: "nowrap", fontSize: 11 }}>Chưa FB</th>
              {Object.entries(STATUS_LABELS).filter(([k]) => k !== "new").map(([k, v]) => (
                <th key={k} style={{ ...thStyle, color: STATUS_COLORS[k], whiteSpace: "nowrap", fontSize: 11 }}>{v}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {saleRanking.map((s, i) => (
              <tr key={s.name} style={{ background: i % 2 ? "#f9fafb" : "#fff" }}>
                <td style={tdStyle}>{i === 0 ? <Trophy size={14} style={{ color: "#FFD700" }} /> : i === 1 ? <Trophy size={14} style={{ color: "#C0C0C0" }} /> : i === 2 ? <Trophy size={14} style={{ color: "#CD7F32" }} /> : i + 1}</td>
                <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>{s.name}</td>
                <td style={{ ...tdStyle, fontWeight: 700 }}>{s.total}</td>
                <td style={{ ...tdStyle, color: s.new ? "#6b7280" : "#d1d5db" }}>{s.new || 0}</td>
                {Object.keys(STATUS_LABELS).filter(k => k !== "new").map(k => (
                  <td key={k} style={{ ...tdStyle, color: s[k] ? STATUS_COLORS[k] : "#d1d5db" }}>{s[k] || 0}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>
    </>
  );
}

function LeadsPage({ leads, searchText, setSearchText, statusFilter, setStatusFilter, dateFrom, setDateFrom, dateTo, setDateTo, projects, user, applyApiData, onLogout, highlightLeadId, setHighlightLeadId }) {
  const isMobile = useIsMobile();
  const [expandedId, setExpandedId] = useState(null);
  const [activeTab, setActiveTab] = useState("all");
  const [pageSize, setPageSize] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);
  const [shuffleOpen, setShuffleOpen] = useState(false);
  const [shuffleProject, setShuffleProject] = useState("");
  const [shuffleSale, setShuffleSale] = useState("");
  const [shuffleSaleSearch, setShuffleSaleSearch] = useState("");
  const [shuffleStatus, setShuffleStatus] = useState("all");
  const [shufflePickCount, setShufflePickCount] = useState("all");
  const [shuffleSelected, setShuffleSelected] = useState(new Set());
  const [shuffling, setShuffling] = useState(false);
  const [shuffleMsg, setShuffleMsg] = useState("");
  const [shuffleSaleFocused, setShuffleSaleFocused] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const isAdmin = user.role === "admin";

  useEffect(() => {
    if (isAdmin) {
      apiFetch(`${API}/users`).then(r => r.json()).then(setAllUsers).catch(() => {});
    }
  }, [isAdmin]);

  // Show MỚI tag: only for leads not assigned to sale AND within 7 days
  const isRecentLead = useCallback((l) => {
    if (l.saleName) return false;
    const d = parseLeadDate(l.createdAt);
    if (!d) return false;
    return (Date.now() - d.getTime()) < 7 * 24 * 60 * 60 * 1000;
  }, []);

  const projectMap = useMemo(() => {
    const m = {};
    projects.forEach((p) => (m[p.id] = p.name));
    return m;
  }, [projects]);

  // Bitrix-style lead categories
  const LEAD_TABS = useMemo(() => [
    { key: "all", label: "Tất cả", Icon: ClipboardList, filter: () => true },
    { key: "new", label: "Chưa feedback", Icon: BadgePlus, filter: (l) => l.status === "new" || !l.status },
    { key: "interested", label: "Quan tâm", Icon: Star, filter: (l) => l.status === "interested" },
    { key: "low_interest", label: "QT hời hợt", Icon: Sparkles, filter: (l) => l.status === "low_interest" },
    { key: "other_project", label: "QT DA khác", Icon: ArrowLeftRight, filter: (l) => l.status === "other_project" },
    { key: "appointment", label: "Hẹn xem", Icon: CalendarCheck, filter: (l) => l.status === "appointment" },
    { key: "booked", label: "Giữ chỗ", Icon: CheckCircle, filter: (l) => l.status === "booked" },
    { key: "closed", label: "Chốt", Icon: Trophy, filter: (l) => l.status === "closed" },
    { key: "not_interested", label: "Không quan tâm", Icon: ThumbsDown, filter: (l) => l.status === "not_interested" },
    { key: "spam", label: "Phá/rác", Icon: Ban, filter: (l) => l.status === "spam" },
    { key: "weak_finance", label: "Tài chính yếu", Icon: Banknote, filter: (l) => l.status === "weak_finance" },
    { key: "unreachable", label: "Chưa liên lạc được", Icon: PhoneOff, filter: (l) => l.status === "unreachable" },
    { key: "callback", label: "Liên lạc lại sau", Icon: PhoneIncoming, filter: (l) => l.status === "callback" },
    { key: "wrong_number", label: "Thuê bao/Sai số", Icon: XCircle, filter: (l) => l.status === "wrong_number" },
    { key: "blocked", label: "Chặn", Icon: ShieldOff, filter: (l) => l.status === "blocked" },
    { key: "has_sale", label: "Có sale khác", Icon: Users, filter: (l) => l.status === "has_sale" },
    { key: "called", label: "Đã gọi", Icon: Phone, filter: (l) => l.status === "called" },
    { key: "lost", label: "Mất", Icon: Skull, filter: (l) => l.status === "lost" },
  ], []);

  const tabCounts = useMemo(() => {
    const counts = {};
    LEAD_TABS.forEach((t) => { counts[t.key] = leads.filter(t.filter).length; });
    return counts;
  }, [leads, LEAD_TABS]);

  const parseDate = (s) => {
    if (!s || s === "-") return 0;
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +m[6]).getTime();
    const t = new Date(s).getTime();
    return isNaN(t) ? 0 : t;
  };
  const tabFiltered = useMemo(() => {
    const tab = LEAD_TABS.find((t) => t.key === activeTab);
    const filtered = tab ? leads.filter(tab.filter) : [...leads];
    return filtered.sort((a, b) => parseDate(b.createdAt) - parseDate(a.createdAt));
  }, [leads, activeTab, LEAD_TABS]);

  // Navigate to highlighted lead from notification click
  useEffect(() => {
    if (!highlightLeadId) return;
    // Switch to "all" tab so we can find the lead
    setActiveTab("all");
  }, [highlightLeadId]);

  useEffect(() => {
    if (!highlightLeadId || activeTab !== "all") return;
    const idx = tabFiltered.findIndex(l => l.id === highlightLeadId);
    if (idx >= 0) {
      const targetPage = Math.floor(idx / pageSize) + 1;
      setCurrentPage(targetPage);
      setExpandedId(highlightLeadId);
      // Scroll to the lead after render
      setTimeout(() => {
        const el = document.getElementById(`lead-${highlightLeadId}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    }
    setHighlightLeadId(null);
  }, [highlightLeadId, tabFiltered, pageSize]);

  const saleNames = useMemo(() => {
    const names = new Set();
    leads.forEach(l => { if (l.saleName) names.add(l.saleName); });
    return [...names].sort();
  }, [leads]);

  const allSaleUsers = useMemo(() => {
    return allUsers.filter(u => u.role === "sale" && u.displayName).map(u => u.displayName);
  }, [allUsers]);

  const getProjectSaleNames = (projectId) => {
    const merged = new Set([...allSaleUsers, ...saleNames]);
    return [...merged].sort();
  };

  // Get leads filtered for chia lead panel
  const shuffleFilteredLeads = useMemo(() => {
    const pid = Number(shuffleProject);
    if (!pid) return [];
    let list = leads.filter(l => l.projectId === pid);
    if (shuffleStatus !== "all") {
      if (shuffleStatus === "unassigned") list = list.filter(l => !l.saleName || l.saleName === "Chưa chia");
      else list = list.filter(l => l.status === shuffleStatus);
    }
    return list;
  }, [leads, shuffleProject, shuffleStatus]);

  // Auto-select based on pick count
  useEffect(() => {
    if (shufflePickCount === "all") {
      setShuffleSelected(new Set(shuffleFilteredLeads.map(l => l.id)));
    } else if (shufflePickCount === "manual") {
      // keep current selection
    } else {
      const n = Number(shufflePickCount);
      setShuffleSelected(new Set(shuffleFilteredLeads.slice(0, n).map(l => l.id)));
    }
  }, [shufflePickCount, shuffleFilteredLeads]);

  // Reset when project/status changes
  useEffect(() => { setShufflePickCount("all"); }, [shuffleProject, shuffleStatus]);

  const handleShuffleAssign = async () => {
    if (!shuffleSale) return;
    const ids = [...shuffleSelected];
    if (!ids.length) return;
    setShuffling(true);
    setShuffleMsg("");
    try {
      const r = await apiFetch(`${API}/leads/assign-bulk`, {
        method: "POST",
        body: JSON.stringify({ saleName: shuffleSale, leadIds: ids }),
      });
      const data = await r.json();
      if (data.error) { setShuffleMsg("[ERR] " + data.error); }
      else { setShuffleMsg("[OK] " + data.msg); applyApiData(data); setShuffleSelected(new Set()); }
    } catch (e) {
      setShuffleMsg("[ERR] Lỗi: " + e.message);
    } finally {
      setShuffling(false);
    }
  };

  return (
    <>
      {/* Sale header */}
      {!isAdmin && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><Hand size={16} /> Xin chào, {user.displayName}</div>
          <button onClick={onLogout} style={{ padding: "6px 16px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
            <LogOut size={14} /> Đăng xuất
          </button>
        </div>
      )}

      {/* Admin chia lead */}
      {isAdmin && (
        <div style={{ marginBottom: 12 }}>
          <button onClick={() => setShuffleOpen(!shuffleOpen)}
            style={{ ...btnPrimary, padding: "6px 16px", fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
            <Shuffle size={14} /> Chia Lead cho Sale
          </button>
          {shuffleOpen && (
            <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 12, padding: 16, marginTop: 8, fontSize: 13 }}>
              <div style={{ fontWeight: 700, marginBottom: 12, color: "#9a3412", fontSize: 15, display: "flex", alignItems: "center", gap: 6 }}><Shuffle size={18} /> Chia Lead cho Sale</div>

              {/* Row 1: Chọn dự án + Chọn sale */}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                <div style={{ minWidth: 180 }}>
                  <label style={{ fontSize: 11, color: "#6b7280", fontWeight: 600 }}>1. Chọn dự án</label>
                  <select value={shuffleProject} onChange={(e) => { setShuffleProject(e.target.value); setShuffleSelected(new Set()); }}
                    style={{ display: "block", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, marginTop: 4, width: "100%", color: shuffleProject ? "#1f2937" : "#9ca3af" }}>
                    <option value="">-- Chọn dự án --</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div style={{ minWidth: 200, flex: 1, position: "relative" }}>
                  <label style={{ fontSize: 11, color: "#6b7280", fontWeight: 600 }}>2. Chọn Sale</label>
                  <input value={shuffleSaleSearch} onChange={(e) => { setShuffleSaleSearch(e.target.value); setShuffleSale(""); }}
                    onFocus={() => setShuffleSaleFocused(true)}
                    onBlur={() => setTimeout(() => setShuffleSaleFocused(false), 200)}
                    placeholder="Tìm sale..."
                    style={{ ...inputStyle, marginBottom: 0, marginTop: 4, width: "100%", fontSize: 13 }} />
                  {(() => {
                    const q = shuffleSaleSearch.toLowerCase();
                    const userSales = allUsers.filter(u => u.role === "sale" && u.displayName).map(u => u.displayName);
                    const allSales = [...new Set([...userSales, ...saleNames])].sort();
                    const filtered = allSales.filter(s => !q || s.toLowerCase().includes(q));
                    if (!shuffleSale && shuffleSaleFocused) return (
                      <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #d1d5db", borderRadius: 8, maxHeight: 200, overflowY: "auto", zIndex: 50, boxShadow: "0 4px 12px rgba(0,0,0,.1)" }}>
                        {filtered.length > 0 ? filtered.map(s => (
                          <div key={s} onClick={() => { setShuffleSale(s); setShuffleSaleSearch(s); setShuffleSaleFocused(false); }}
                            style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid #f3f4f6", transition: "background .1s" }}
                            onMouseEnter={e => e.currentTarget.style.background = "#f0faf1"}
                            onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
                            <User size={12} /> {s}
                          </div>
                        )) : <div style={{ padding: "8px 12px", color: "#9ca3af", fontSize: 12 }}>Không tìm thấy sale nào</div>}
                      </div>
                    );
                    return null;
                  })()}
                  {shuffleSale && (
                    <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ background: "#e8f5e9", color: "#1a3c20", padding: "2px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}><Check size={12} /> {shuffleSale}</span>
                      <button onClick={() => { setShuffleSale(""); setShuffleSaleSearch(""); }}
                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#ef4444" }}><X size={14} /></button>
                    </div>
                  )}
                </div>
              </div>

              {/* Row 2: Lọc trạng thái + Số lượng */}
              {shuffleProject && shuffleSale && (
                <>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12, alignItems: "flex-end" }}>
                    <div style={{ minWidth: 180 }}>
                      <label style={{ fontSize: 11, color: "#6b7280", fontWeight: 600 }}>3. Lọc theo trạng thái</label>
                      <select value={shuffleStatus} onChange={(e) => setShuffleStatus(e.target.value)}
                        style={{ display: "block", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, marginTop: 4, width: "100%", color: "#1f2937" }}>
                        <option value="all">Tất cả trạng thái</option>
                        <option value="unassigned">Chưa chia (chưa có sale)</option>
                        {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                    <div style={{ minWidth: 150 }}>
                      <label style={{ fontSize: 11, color: "#6b7280", fontWeight: 600 }}>4. Chọn số lượng</label>
                      <select value={shufflePickCount} onChange={(e) => setShufflePickCount(e.target.value)}
                        style={{ display: "block", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, marginTop: 4, width: "100%", color: "#1f2937" }}>
                        <option value="all">Tất cả ({shuffleFilteredLeads.length})</option>
                        <option value="10">10 lead</option>
                        <option value="25">25 lead</option>
                        <option value="50">50 lead</option>
                        <option value="manual">Chọn tay</option>
                      </select>
                    </div>
                  </div>

                  {/* Lead list for manual pick */}
                  <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, maxHeight: 300, overflowY: "auto", marginBottom: 12 }}>
                    <div style={{ padding: "8px 12px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "#f9fafb", zIndex: 1 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>
                        Đã chọn: <span style={{ color: "#1a3c20" }}>{shuffleSelected.size}</span> / {shuffleFilteredLeads.length} lead
                      </span>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => setShuffleSelected(new Set(shuffleFilteredLeads.map(l => l.id)))}
                          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#1a3c20", fontWeight: 600 }}>Chọn tất cả</button>
                        <button onClick={() => setShuffleSelected(new Set())}
                          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#ef4444", fontWeight: 600 }}>Bỏ tất cả</button>
                      </div>
                    </div>
                    {shuffleFilteredLeads.length === 0 && <div style={{ padding: 16, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>Không có lead nào</div>}
                    {shuffleFilteredLeads.map(l => (
                      <label key={l.id} style={{
                        display: "flex", alignItems: "center", gap: 8, padding: "6px 12px",
                        borderBottom: "1px solid #f3f4f6", cursor: "pointer",
                        background: shuffleSelected.has(l.id) ? "#f0faf1" : "#fff",
                        transition: "background .1s",
                      }}>
                        <input type="checkbox" checked={shuffleSelected.has(l.id)}
                          onChange={() => {
                            const next = new Set(shuffleSelected);
                            next.has(l.id) ? next.delete(l.id) : next.add(l.id);
                            setShuffleSelected(next);
                            setShufflePickCount("manual");
                          }}
                          style={{ width: 16, height: 16, accentColor: "#1a3c20" }} />
                        <span style={{ flex: 1, fontSize: 12 }}>
                          <strong>{l.name}</strong>
                          <span style={{ color: "#6b7280", marginLeft: 6 }}>{l.phone || ""}</span>
                        </span>
                        <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 8, background: (STATUS_COLORS[l.status] || "#d1d5db") + "18", color: STATUS_COLORS[l.status] || "#6b7280", fontWeight: 600 }}>
                          {STATUS_LABELS[l.status] || l.status || "Chưa feedback"}
                        </span>
                        <span style={{ fontSize: 10, color: "#9ca3af" }}>{l.saleName || "Chưa chia"}</span>
                      </label>
                    ))}
                  </div>

                  {/* Action button */}
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <button onClick={handleShuffleAssign} disabled={shuffling || !shuffleSelected.size}
                      style={{ ...btnPrimary, padding: "10px 24px", fontSize: 14, opacity: (!shuffleSelected.size || shuffling) ? 0.5 : 1 }}>
                      {shuffling ? "Đang chia..." : <><Share2 size={14} /> Chia {shuffleSelected.size} lead cho {shuffleSale}</>}
                    </button>
                  </div>
                </>
              )}

              {shuffleMsg && <div style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: shuffleMsg.startsWith("[OK]") || shuffleMsg.includes("thành công") ? "#059669" : "#dc2626" }}>{shuffleMsg.replace(/^\[(OK|ERR)\] /, "")}</div>}
            </div>
          )}
        </div>
      )}

      {/* Bitrix-style tabs - horizontal scroll on mobile */}
      <div style={{
        display: "flex", gap: 6, marginBottom: isMobile ? 10 : 16,
        flexWrap: isMobile ? "nowrap" : "wrap",
        overflowX: isMobile ? "auto" : "visible",
        WebkitOverflowScrolling: "touch",
        paddingBottom: isMobile ? 4 : 0,
        msOverflowStyle: "none", scrollbarWidth: "none",
      }}>
        {LEAD_TABS.map((t) => {
          const isActive = activeTab === t.key;
          const count = tabCounts[t.key] || 0;
          return (
            <button key={t.key} onClick={() => { setActiveTab(t.key); setCurrentPage(1); }}
              style={{
                padding: isMobile ? "8px 12px" : "8px 14px", borderRadius: 20,
                border: isActive ? "2px solid #e88a2e" : "1px solid #e5e7eb",
                background: isActive ? "#f0faf1" : "#fff", color: isActive ? "#1a3c20" : "#374151",
                cursor: "pointer", fontSize: 12, fontWeight: isActive ? 700 : 500,
                display: "flex", alignItems: "center", gap: 4, transition: "all .15s",
                whiteSpace: "nowrap", flexShrink: 0,
              }}>
              <span>{t.Icon && <t.Icon size={14} />}</span>
              <span>{t.label}</span>
              <span style={{
                background: isActive ? "#e88a2e" : "#e5e7eb", color: isActive ? "#fff" : "#6b7280",
                borderRadius: 10, padding: "0 6px", fontSize: 11, fontWeight: 700, minWidth: 20, textAlign: "center",
              }}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Search / Date filters */}
      <div style={{ display: "flex", gap: isMobile ? 8 : 12, marginBottom: isMobile ? 10 : 16, flexWrap: "wrap", alignItems: "center" }}>
        <input
          style={{ ...inputStyle, flex: "1 1 100%", marginBottom: 0, minHeight: 44, fontSize: 14 }}
          placeholder="Tìm tên, SĐT, chiến dịch, sale..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, flexWrap: "wrap", width: isMobile ? "100%" : "auto" }}>
          <span style={{ color: "#6b7280" }}>Từ:</span>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, flex: isMobile ? 1 : "none" }} />
          <span style={{ color: "#6b7280", marginLeft: 4 }}>Đến:</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, flex: isMobile ? 1 : "none" }} />
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(""); setDateTo(""); }}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#ef4444" }} title="Xóa lọc ngày"><X size={14} /></button>
          )}
        </div>
      </div>

      <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <span>Hiển thị {Math.min(pageSize, tabFiltered.length)} / {tabFiltered.length} khách hàng</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12 }}>Số dòng:</span>
          <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
            style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 12 }}>
            <option value={5}>5</option>
            <option value={15}>15</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>

      {/* Lead cards - card layout for all on mobile, table for admin desktop */}
      {(!isAdmin || isMobile) ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {tabFiltered.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((l) => {
            const isOpen = expandedId === l.id;
            const histCount = (l.saleHistory || []).length;
            return (
              <div key={l.id} id={`lead-${l.id}`} style={{ background: "#fff", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,.06)", border: isOpen ? "2px solid #e88a2e" : "1px solid #e5e7eb", overflow: "hidden" }}>
                <div onClick={() => setExpandedId(isOpen ? null : l.id)}
                  style={{ padding: isMobile ? "10px 12px" : "12px 16px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                      {isRecentLead(l) && <span style={{ background: "#10b981", color: "#fff", padding: "1px 6px", borderRadius: 8, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>MỚI</span>}
                      <span style={{ fontWeight: 700, fontSize: isMobile ? 13 : 14 }}>{l.name}</span>
                      <span style={{
                        padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                        background: (STATUS_COLORS[l.status] || "#6b7280") + "18",
                        color: STATUS_COLORS[l.status] || "#6b7280",
                      }}>
                        {STATUS_LABELS[l.status] || l.status}
                      </span>
                      {l.isHot && <span style={{ fontSize: 11, display: "flex", alignItems: "center" }}>{(() => { const t = getLeadTemp(l.createdAt); return t.icon === "very_hot" ? <><Flame size={13} /><Flame size={13} /></> : t.icon === "hot" ? <Flame size={13} /> : t.icon === "warm" ? <CloudSun size={13} /> : <Snowflake size={13} />; })()}</span>}
                    </div>
                    <div style={{ display: "flex", gap: isMobile ? 8 : 16, fontSize: 12, color: "#6b7280", flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 2 }}><Smartphone size={12} /> {l.phone || "-"}</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 2 }}><Calendar size={12} /> {l.createdAt || "-"}</span>
                      {histCount > 0 && <span style={{ display: "flex", alignItems: "center", gap: 2 }}><ClipboardList size={12} /> {histCount}</span>}
                      {isAdmin && l.saleName && <span style={{ display: "flex", alignItems: "center", gap: 2 }}><User size={12} /> {l.saleName}</span>}
                      {isAdmin && <span style={{ fontSize: 11 }}>{projectMap[l.projectId] || "-"}</span>}
                    </div>
                  </div>
                  <span style={{ fontSize: 14, color: "#9ca3af", flexShrink: 0 }}>{isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
                </div>
                {isOpen && (
                  <div style={{ borderTop: "1px solid #e5e7eb" }}>
                    <LeadDetail lead={l} projectName={projectMap[l.projectId] || "-"} isAdmin={isAdmin} user={user} applyApiData={applyApiData} saleNames={getProjectSaleNames(l.projectId)} isMobile={isMobile} />
                  </div>
                )}
              </div>
            );
          })}
          {tabFiltered.length === 0 && (
            <div style={{ textAlign: "center", color: "#9ca3af", padding: 32, fontSize: 14 }}>Không có khách hàng nào trong danh sách này</div>
          )}
        </div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 12, overflow: "auto", boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>#</th>
                <th style={thStyle}>Tên</th>
                <th style={thStyle}>SĐT</th>
                <th style={thStyle}>Nhu cầu KH</th>
                <th style={thStyle}>Trạng thái</th>
                <th style={thStyle}>Sale hiện tại</th>
                <th style={thStyle}>Dự án</th>
                <th style={thStyle}>Ngày nhận lead</th>
                <th style={thStyle}>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {tabFiltered.slice((currentPage - 1) * pageSize, currentPage * pageSize).flatMap((l, i) => {
                const isOpen = expandedId === l.id;
                const globalIdx = (currentPage - 1) * pageSize + i;
                const rows = [
                  <tr key={l.id} id={`lead-${l.id}`} onClick={() => setExpandedId(isOpen ? null : l.id)}
                    style={{ background: isOpen ? "#f0faf1" : globalIdx % 2 ? "#f9fafb" : "#fff", cursor: "pointer", transition: "background .15s" }}>
                    <td style={tdStyle}>{globalIdx + 1}</td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{isOpen ? <ChevronDown size={12} style={{ display: "inline", verticalAlign: "middle" }} /> : <ChevronRight size={12} style={{ display: "inline", verticalAlign: "middle" }} />} {isRecentLead(l) && <span style={{ background: "#10b981", color: "#fff", padding: "1px 6px", borderRadius: 8, fontSize: 10, fontWeight: 700, marginRight: 4 }}>MỚI</span>}{l.name}</td>
                    <td style={tdStyle}>{l.phone || "-"}</td>
                    <td style={{ ...tdStyle, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.product || "-"}</td>
                    <td style={tdStyle}>
                      <span style={{
                        padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                        background: (STATUS_COLORS[l.status] || "#6b7280") + "18",
                        color: STATUS_COLORS[l.status] || "#6b7280", whiteSpace: "nowrap",
                      }}>{STATUS_LABELS[l.status] || l.status}</span>
                    </td>
                    <td style={tdStyle}>{l.saleName || "Chưa chia"}</td>
                    <td style={{ ...tdStyle, fontSize: 11 }}>{projectMap[l.projectId] || "-"}</td>
                    <td style={{ ...tdStyle, fontSize: 11, whiteSpace: "nowrap" }}>{l.createdAt || "-"}</td>
                    <td style={tdStyle}>
                      {(() => { const t = getLeadTemp(l.createdAt); return (
                        <span style={{ background: t.bg, color: t.color, padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>{t.label}</span>
                      ); })()}
                    </td>
                  </tr>,
                ];
                if (isOpen) {
                  rows.push(
                    <tr key={`${l.id}-detail`}>
                      <td colSpan={9} style={{ padding: 0, background: "#f8fafc", borderBottom: "2px solid #e88a2e" }}>
                        <LeadDetail lead={l} projectName={projectMap[l.projectId] || "-"} isAdmin={isAdmin} user={user} applyApiData={applyApiData} saleNames={getProjectSaleNames(l.projectId)} isMobile={false} />
                      </td>
                    </tr>
                  );
                }
                return rows;
              })}
              {tabFiltered.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ ...tdStyle, textAlign: "center", color: "#9ca3af" }}>Không có khách hàng nào</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {tabFiltered.length > pageSize && (() => {
        const totalPages = Math.ceil(tabFiltered.length / pageSize);
        const btnStyle = (disabled) => ({
          padding: isMobile ? "10px 14px" : "6px 10px", borderRadius: 8,
          border: "1px solid #d1d5db", background: disabled ? "#f3f4f6" : "#fff",
          cursor: disabled ? "default" : "pointer", fontSize: 14, fontWeight: 600,
          minHeight: isMobile ? 44 : 32, minWidth: isMobile ? 44 : 32,
          display: "flex", alignItems: "center", justifyContent: "center",
        });
        return (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: isMobile ? 6 : 8, marginTop: 16, flexWrap: "wrap" }}>
          <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} style={btnStyle(currentPage === 1)}>«</button>
          <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} style={btnStyle(currentPage === 1)}>‹</button>
          <span style={{ fontSize: 13, color: "#374151", padding: "0 4px" }}>{currentPage} / {totalPages}</span>
          <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} style={btnStyle(currentPage >= totalPages)}>›</button>
          <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage >= totalPages} style={btnStyle(currentPage >= totalPages)}>»</button>
        </div>
        );
      })()}
    </>
  );
}

function LeadDetail({ lead, projectName, isAdmin, user, applyApiData, saleNames = [], isMobile = false }) {
  const history = lead.saleHistory || [];
  const [showForm, setShowForm] = useState(false);
  const [histStatus, setHistStatus] = useState("");
  const [histFeedback, setHistFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const [editStatus, setEditStatus] = useState(lead.status || "new");
  const [savingStatus, setSavingStatus] = useState(false);
  const [editSale, setEditSale] = useState(lead.saleName || "");
  const [savingSale, setSavingSale] = useState(false);

  const handleDeleteHistory = async (histId) => {
    if (!(await showConfirm("Xóa lịch sử liên hệ này?"))) return;
    try {
      const r = await apiFetch(`${API}/leads/${lead.id}/history/${histId}`, { method: "DELETE" });
      if (r.ok) applyApiData(await r.json());
      else showToast("Xóa thất bại", "error");
    } catch (e) { console.error(e); }
  };

  const handleAddHistory = async () => {
    if (!histStatus && !histFeedback) return;
    setSaving(true);
    try {
      const r = await apiFetch(`${API}/leads/${lead.id}/history`, {
        method: "POST",
        body: JSON.stringify({ status: histStatus, feedback: histFeedback }),
      });
      const data = await r.json();
      applyApiData(data);
      setHistStatus("");
      setHistFeedback("");
      setShowForm(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusUpdate = async () => {
    setSavingStatus(true);
    try {
      const r = await apiFetch(`${API}/leads/${lead.id}`, {
        method: "PUT",
        body: JSON.stringify({ status: editStatus }),
      });
      const data = await r.json();
      applyApiData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setSavingStatus(false);
    }
  };

  const handleAssignSale = async () => {
    if (!editSale) return;
    setSavingSale(true);
    try {
      const r = await apiFetch(`${API}/leads/${lead.id}`, {
        method: "PUT",
        body: JSON.stringify({ saleName: editSale }),
      });
      const data = await r.json();
      applyApiData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setSavingSale(false);
    }
  };

  return (
    <div style={{ padding: isMobile ? "12px" : "16px 24px" }}>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fill, minmax(140px, 1fr))", gap: isMobile ? 8 : 16, marginBottom: 12, fontSize: 13 }}>
        <div><span style={{ color: "#6b7280", fontSize: 11 }}>Khách hàng</span><br /><b>{lead.name}</b></div>
        <div><span style={{ color: "#6b7280", fontSize: 11 }}>SĐT</span><br /><b>{lead.phone || "-"}</b></div>
        <div><span style={{ color: "#6b7280", fontSize: 11 }}>Dự án</span><br /><b>{projectName}</b></div>
        <div><span style={{ color: "#6b7280", fontSize: 11 }}>Sản phẩm</span><br /><b>{lead.product || "-"}</b></div>
        <div><span style={{ color: "#6b7280", fontSize: 11 }}>Ngày nhận lead</span><br /><b style={{ fontSize: isMobile ? 11 : 13 }}>{lead.createdAt || "-"}</b></div>
        <div>
          <span style={{ color: "#6b7280", fontSize: 11 }}>Trạng thái lead</span><br />
          {(() => { const t = getLeadTemp(lead.createdAt); return (
            <span style={{ color: t.color, fontWeight: 700 }}>{t.label}</span>
          ); })()}
        </div>
        <div><span style={{ color: "#6b7280", fontSize: 11 }}>Chiến dịch</span><br /><b style={{ fontSize: isMobile ? 11 : 13 }}>{lead.campaign || "-"}</b></div>
        <div><span style={{ color: "#6b7280", fontSize: 11 }}>Nhóm QC</span><br /><b style={{ fontSize: isMobile ? 11 : 13 }}>{lead.adsetName || "-"}</b></div>
        <div><span style={{ color: "#6b7280", fontSize: 11 }}>Content</span><br /><b style={{ fontSize: isMobile ? 11 : 13 }}>{lead.adName || "-"}</b></div>
      </div>

      {/* Admin: Cập nhật trạng thái */}
      {isAdmin && (
        <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8, padding: isMobile ? 14 : 12, marginBottom: 12, fontSize: 13 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <b style={{ fontSize: 12, color: "#9a3412", display: "flex", alignItems: "center", gap: 4 }}><Settings size={14} /> Trạng thái:</b>
            <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600, background: (STATUS_COLORS[lead.status] || STATUS_COLORS.new) + "20", color: STATUS_COLORS[lead.status] || STATUS_COLORS.new }}>
              {STATUS_LABELS[lead.status] || STATUS_LABELS.new}
            </span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)}
              style={{ padding: isMobile ? "10px 12px" : "6px 8px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: isMobile ? 14 : 12, flex: isMobile ? "1 1 100%" : "none", minHeight: isMobile ? 44 : "auto", background: "#fff", color: "#1f2937" }}>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button onClick={handleStatusUpdate} disabled={savingStatus}
              style={{ ...btnPrimary, padding: isMobile ? "10px 16px" : "6px 12px", fontSize: isMobile ? 14 : 12, minHeight: isMobile ? 44 : "auto", width: isMobile ? "100%" : "auto" }}>
              {savingStatus ? "Đang cập nhật..." : <><Check size={14} /> Cập nhật</>}
            </button>
          </div>
        </div>
      )}

      {/* Admin: Chia lead cho Sale */}
      {isAdmin && (
        <div style={{ background: "#f0faf1", border: "1px solid #c5d9c8", borderRadius: 8, padding: isMobile ? 14 : 12, marginBottom: 16, fontSize: 13 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <b style={{ fontSize: 12, color: "#1a3c20", display: "flex", alignItems: "center", gap: 4 }}><Share2 size={14} /> Sale phụ trách:</b>
            {lead.saleName
              ? <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600, background: "#e8f5e9", color: "#1a3c20" }}>{lead.saleName}</span>
              : <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600, background: "#fef2f2", color: "#dc2626" }}>Chưa chia</span>
            }
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <select value={editSale} onChange={(e) => setEditSale(e.target.value)}
              style={{ padding: isMobile ? "10px 12px" : "6px 8px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: isMobile ? 14 : 12, minWidth: 160, flex: isMobile ? "1 1 100%" : "none", minHeight: isMobile ? 44 : "auto", background: "#fff", color: editSale ? "#1f2937" : "#9ca3af" }}>
              <option value="">-- Chọn Sale --</option>
              {saleNames.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={handleAssignSale} disabled={savingSale || !editSale}
              style={{ ...btnPrimary, padding: isMobile ? "10px 16px" : "6px 12px", fontSize: isMobile ? 14 : 12, background: !editSale ? "#c5d9c8" : "linear-gradient(135deg, #e88a2e, #d97706)", minHeight: isMobile ? 44 : "auto", width: isMobile ? "100%" : "auto" }}>
              {savingSale ? "Đang chia..." : <><Share2 size={14} /> Chia lead</>}
            </button>
          </div>
        </div>
      )}

      <h4 style={{ margin: "0 0 12px", fontSize: 14, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><ClipboardList size={16} /> Lịch sử ({history.length})</span>
        <button onClick={() => setShowForm(!showForm)}
          style={{ ...btnPrimary, padding: isMobile ? "8px 14px" : "4px 12px", fontSize: 12 }}>
          {showForm ? "Hủy" : "+ Thêm"}
        </button>
      </h4>

      {/* Add history form */}
      {showForm && (
        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", flexDirection: isMobile ? "column" : "row" }}>
            <div style={{ flex: "1 1 200px", width: isMobile ? "100%" : "auto" }}>
              <label style={{ fontSize: 11, color: "#374151", fontWeight: 600 }}>Trạng thái</label>
              <input value={histStatus} onChange={(e) => setHistStatus(e.target.value)}
                placeholder="VD: Quan tâm, Hẹn xem..."
                style={{ ...inputStyle, marginBottom: 0, marginTop: 4 }} />
            </div>
            <div style={{ flex: "2 1 300px", width: isMobile ? "100%" : "auto" }}>
              <label style={{ fontSize: 11, color: "#374151", fontWeight: 600 }}>Feedback</label>
              <input value={histFeedback} onChange={(e) => setHistFeedback(e.target.value)}
                placeholder="Ghi chú về khách hàng..."
                style={{ ...inputStyle, marginBottom: 0, marginTop: 4 }} />
            </div>
            <button onClick={handleAddHistory} disabled={saving}
              style={{ ...btnPrimary, padding: "10px 16px", whiteSpace: "nowrap", width: isMobile ? "100%" : "auto", minHeight: 44 }}>
              {saving ? "Đang lưu..." : <><Save size={14} /> Lưu</>}
            </button>
          </div>
        </div>
      )}

      {history.length === 0 ? (
        <div style={{ color: "#9ca3af", fontSize: 13, paddingBottom: 8 }}>Chưa có lịch sử liên hệ</div>
      ) : (
        <div style={{ position: "relative", paddingLeft: isMobile ? 20 : 24, paddingBottom: 8 }}>
          <div style={{ position: "absolute", left: isMobile ? 6 : 8, top: 4, bottom: 4, width: 2, background: "#e5e7eb" }} />
          {history.map((h, idx) => {
            const recalled = (h.action || "").toLowerCase().includes("thu h");
            const isUpdate = (h.action || "").toLowerCase().includes("cập nhật") || (h.action || "").toLowerCase().includes("cap nhat");
            const dotColor = recalled ? "#ef4444" : isUpdate ? "#10b981" : "#e88a2e";
            return (
              <div key={idx} style={{ position: "relative", marginBottom: 10, paddingLeft: isMobile ? 12 : 16 }}>
                <div style={{
                  position: "absolute", left: isMobile ? -14 : -16, top: 6, width: 10, height: 10,
                  borderRadius: "50%", background: dotColor,
                  border: "2px solid #fff", boxShadow: `0 0 0 2px ${dotColor}33`,
                }} />
                <div style={{ background: "#fff", borderRadius: 8, padding: isMobile ? 10 : 12, border: "1px solid #e5e7eb" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4, gap: 4, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 600, fontSize: isMobile ? 12 : 13 }}>
                      {idx + 1}. {h.saleName}
                      <span style={{
                        marginLeft: 6, fontSize: 10, padding: "1px 6px", borderRadius: 8,
                        background: recalled ? "#fef2f2" : isUpdate ? "#f0fdf4" : "#f0faf1",
                        color: recalled ? "#dc2626" : isUpdate ? "#059669" : "#1a3c20",
                      }}>{h.action}</span>
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      <span style={{ fontSize: 10, color: "#9ca3af" }}>{h.date || "-"}</span>
                      {isAdmin && h.id && (
                        <button onClick={() => handleDeleteHistory(h.id)}
                          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#dc2626", padding: "2px 4px" }}
                          title="Xóa lịch sử này"><Trash2 size={12} /></button>
                      )}
                    </div>
                  </div>
                  {h.status && <div style={{ fontSize: 12, marginBottom: 2 }}>Trạng thái: <b>{h.status}</b></div>}
                  {h.feedback && <div style={{ fontSize: 12, color: "#6b7280" }}>Feedback: {h.feedback}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProjectsPage({ projects, openNewProject, openEditProject, deleteProject, apiFetch, applyApiData }) {
  const isMobile = useIsMobile();
  const [syncingId, setSyncingId] = React.useState(null);

  const syncOne = async (id) => {
    if (syncingId) return;
    setSyncingId(id);
    try {
      const r = await apiFetch(`${API}/projects/${id}/sync`, { method: "POST" });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        showToast("Đồng bộ thất bại: " + (err.error || r.statusText), "error");
      } else {
        const data = await r.json();
        applyApiData(data);
      }
    } catch (e) {
      showToast("Đồng bộ thất bại: " + e.message, "error");
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 14, color: "#6b7280" }}>{projects.length} dự án</div>
        <button onClick={openNewProject} style={btnPrimary}>+ Thêm dự án</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
        {projects.map((p) => {
          const c = p.costData || {};
          const isSyncing = syncingId === p.id;
          return (
            <div
              key={p.id}
              style={{
                background: "#fff", borderRadius: 12, padding: isMobile ? 16 : 20,
                boxShadow: "0 1px 3px rgba(0,0,0,.08)", borderTop: "3px solid #e88a2e",
              }}
            >
              <h4 style={{ margin: "0 0 12px" }}>{p.name}</h4>
              <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>Chi phí: <b>{formatVND(c.totalSpent)}</b></div>
              <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>Lead: <b>{c.totalLeads || 0}</b> | Booking: <b>{c.totalBooking || 0}</b></div>
              <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>CPL: <b>{formatVND(c.cpLead)}</b></div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => syncOne(p.id)}
                  disabled={!!syncingId}
                  style={{ ...btnPrimary, flex: 1, fontSize: 12, opacity: syncingId ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}
                >
                  {isSyncing && <span style={{ display: "inline-block", width: 12, height: 12, border: "2px solid #fff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />}
                  {isSyncing ? "Đồng bộ..." : <><RefreshCw size={14} /> Sync</>}
                </button>
                <button onClick={() => openEditProject(p)} style={{ ...btnSecondary, flex: 1, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}><Pencil size={12} /> Sửa</button>
                <button onClick={() => deleteProject(p.id)} style={{ ...btnDanger, flex: 1, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}><Trash2 size={12} /> Xóa</button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function CampaignsPage({ leads, projects }) {
  const isMobile = useIsMobile();
  const [tab, setTab] = useState("leads"); // "leads" | "fb_ads" | "settings"
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [expandedCampaigns, setExpandedCampaigns] = React.useState({});
  const [expandedAdsets, setExpandedAdsets] = React.useState({});

  // FB Ads state
  const [adAccounts, setAdAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [fbInsights, setFbInsights] = useState([]);
  const [fbLoading, setFbLoading] = useState(false);
  const [fbError, setFbError] = useState("");
  const [fbLevel, setFbLevel] = useState("campaign");
  const [fbDateFrom, setFbDateFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10); });
  const [fbDateTo, setFbDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  // Ad Account form
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [acctDraft, setAcctDraft] = useState({ name: "", accountId: "", accessToken: "" });
  const [savingAcct, setSavingAcct] = useState(false);

  const loadAdAccounts = async () => {
    try { const r = await apiFetch(`${API}/fb-ad-accounts`); if (r.ok) setAdAccounts(await r.json()); } catch {}
  };
  useEffect(() => { loadAdAccounts(); }, []);

  const loadInsights = async () => {
    if (!selectedAccount) return;
    setFbLoading(true); setFbError("");
    try {
      const r = await apiFetch(`${API}/fb-ads/insights/${selectedAccount}?dateFrom=${fbDateFrom}&dateTo=${fbDateTo}&level=${fbLevel}`);
      const data = await r.json();
      if (!r.ok) { setFbError(data.error || "Lỗi tải dữ liệu"); setFbInsights([]); }
      else setFbInsights(data);
    } catch (e) { setFbError("Lỗi kết nối: " + e.message); setFbInsights([]); }
    setFbLoading(false);
  };

  const handleSaveAccount = async () => {
    if (!acctDraft.accountId) { showToast("Vui lòng nhập Account ID", "warning"); return; }
    setSavingAcct(true);
    try {
      const url = editingAccount ? `${API}/fb-ad-accounts/${editingAccount.id}` : `${API}/fb-ad-accounts`;
      const method = editingAccount ? "PUT" : "POST";
      const r = await apiFetch(url, { method, body: JSON.stringify(acctDraft) });
      if (r.ok) { showToast(editingAccount ? "Đã cập nhật" : "Đã thêm tài khoản", "success"); setShowAccountForm(false); setEditingAccount(null); loadAdAccounts(); }
      else { const d = await r.json(); showToast(d.error || "Lỗi", "error"); }
    } catch (e) { showToast("Lỗi: " + e.message, "error"); }
    setSavingAcct(false);
  };

  const deleteAccount = async (id) => {
    if (!await showConfirm("Xóa tài khoản quảng cáo này?")) return;
    try { await apiFetch(`${API}/fb-ad-accounts/${id}`, { method: "DELETE" }); loadAdAccounts(); showToast("Đã xóa", "success"); } catch {}
  };

  const fmtNum = (n) => n != null ? Number(n).toLocaleString("vi-VN") : "—";
  const fmtMoney = (n) => n != null ? Number(n).toLocaleString("vi-VN", { maximumFractionDigits: 0 }) + " ₫" : "—";
  const fmtPct = (n) => n != null ? Number(n).toFixed(2) + "%" : "—";

  // Totals for FB insights
  const fbTotals = useMemo(() => {
    if (!fbInsights.length) return null;
    const t = { spend: 0, impressions: 0, reach: 0, clicks: 0, leads: 0 };
    fbInsights.forEach(r => {
      t.spend += Number(r.spend || 0);
      t.impressions += Number(r.impressions || 0);
      t.reach += Number(r.reach || 0);
      t.clicks += Number(r.clicks || 0);
      const leadAction = (r.actions || []).find(a => a.action_type === "lead" || a.action_type === "onsite_conversion.messaging_first_reply");
      if (leadAction) t.leads += Number(leadAction.value || 0);
    });
    t.cpm = t.impressions ? (t.spend / t.impressions * 1000) : 0;
    t.cpc = t.clicks ? (t.spend / t.clicks) : 0;
    t.ctr = t.impressions ? (t.clicks / t.impressions * 100) : 0;
    t.cpl = t.leads ? (t.spend / t.leads) : 0;
    return t;
  }, [fbInsights]);

  // Build project → campaign → adset → ad tree
  const projectTree = React.useMemo(() => {
    const map = {};
    (projects || []).forEach(p => { map[p.id] = { name: p.name, leads: [], campaigns: {} }; });
    leads.forEach((l) => {
      const pid = l.projectId || 0;
      if (!map[pid]) map[pid] = { name: "Không xác định", leads: [], campaigns: {} };
      map[pid].leads.push(l);
      const cName = l.campaign || "Khác";
      const asName = l.adsetName || "-";
      const adName = l.adName || "-";
      if (!map[pid].campaigns[cName]) map[pid].campaigns[cName] = { leads: [], adsets: {} };
      map[pid].campaigns[cName].leads.push(l);
      if (!map[pid].campaigns[cName].adsets[asName]) map[pid].campaigns[cName].adsets[asName] = { leads: [], ads: {} };
      map[pid].campaigns[cName].adsets[asName].leads.push(l);
      if (!map[pid].campaigns[cName].adsets[asName].ads[adName]) map[pid].campaigns[cName].adsets[asName].ads[adName] = { leads: [] };
      map[pid].campaigns[cName].adsets[asName].ads[adName].leads.push(l);
    });
    return map;
  }, [leads, projects]);

  const calcStats = (arr) => {
    const total = arr.length;
    if (!total) return { total: 0, newLead: 0, interested: 0, bad: 0, spam: 0, notInterested: 0, remaining: 0, closed: 0, booked: 0, pNewLead: 0, pInterested: 0, pBad: 0, pSpam: 0, pNotInterested: 0, pRemaining: 0, pClosed: 0, pBooked: 0 };
    const newLead = arr.filter(l => l.status === "new").length;
    const interested = arr.filter((l) => l.status === "interested").length;
    const notInterested = arr.filter(l => l.status === "not_interested").length;
    const spam = arr.filter(l => l.status === "spam").length;
    const bad = arr.filter((l) => l.status === "unreachable" || l.status === "not_interested").length;
    const closed = arr.filter((l) => l.status === "closed").length;
    const booked = arr.filter((l) => l.status === "booked").length;
    const remaining = total - newLead - interested - notInterested - spam - bad - closed - booked;
    const pct = (v) => ((v / total) * 100).toFixed(1);
    return {
      total, newLead, interested, notInterested, spam, bad, remaining, closed, booked,
      pNewLead: pct(newLead), pInterested: pct(interested), pNotInterested: pct(notInterested),
      pSpam: pct(spam), pBad: pct(bad), pRemaining: pct(remaining), pClosed: pct(closed), pBooked: pct(booked),
    };
  };

  const toggleCampaign = (name) => setExpandedCampaigns((p) => ({ ...p, [name]: !p[name] }));
  const toggleAdset = (key) => setExpandedAdsets((p) => ({ ...p, [key]: !p[key] }));

  const statCellStyle = { ...tdStyle, textAlign: "center", minWidth: 50 };
  const pctStyle = () => ({ fontSize: 11, color: "#6b7280", fontWeight: 400 });
  const headerBg = "#f0f4ff";
  const adsetBg = "#f9fafb";
  const adBg = "#fff";

  const tabBtn = (key, label, icon) => (
    <button key={key} onClick={() => setTab(key)} style={{
      padding: isMobile ? "8px 14px" : "10px 20px", cursor: "pointer", fontWeight: 600, fontSize: isMobile ? 12 : 13,
      background: tab === key ? "#fff" : "transparent", color: tab === key ? "#1a3c20" : "#6b7280",
      border: tab === key ? "1px solid #e5e7eb" : "1px solid transparent",
      borderBottom: tab === key ? "2px solid #e88a2e" : "2px solid transparent",
      borderRadius: "8px 8px 0 0", display: "flex", alignItems: "center", gap: 6, transition: "all .2s",
    }}>{icon} {label}</button>
  );

  // Tabs
  const tabBar = (
    <div style={{ display: "flex", gap: 4, borderBottom: "1px solid #e5e7eb", marginBottom: 16, flexWrap: "wrap" }}>
      {tabBtn("leads", "Lead theo chiến dịch", <Target size={15} />)}
      {tabBtn("fb_ads", "Hiệu quả quảng cáo FB", <Activity size={15} />)}
      {tabBtn("settings", "Cài đặt tài khoản", <Settings size={15} />)}
    </div>
  );

  // === FB Ads Tab ===
  if (tab === "fb_ads") {
    return (
      <div>
        {tabBar}
        {/* Controls */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16, alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 180px", minWidth: 150 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4, display: "block" }}>Tài khoản QC</label>
            <select value={selectedAccount} onChange={(e) => setSelectedAccount(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }}>
              <option value="">-- Chọn tài khoản --</option>
              {adAccounts.filter(a => a.isActive).map(a => <option key={a.id} value={a.accountId}>{a.name || `act_${a.accountId}`}</option>)}
            </select>
          </div>
          <div style={{ flex: "0 1 140px" }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4, display: "block" }}>Từ ngày</label>
            <input type="date" value={fbDateFrom} onChange={e => setFbDateFrom(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }} />
          </div>
          <div style={{ flex: "0 1 140px" }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4, display: "block" }}>Đến ngày</label>
            <input type="date" value={fbDateTo} onChange={e => setFbDateTo(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }} />
          </div>
          <div style={{ flex: "0 1 140px" }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4, display: "block" }}>Cấp độ</label>
            <select value={fbLevel} onChange={e => setFbLevel(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }}>
              <option value="campaign">Chiến dịch</option>
              <option value="adset">Nhóm QC</option>
              <option value="ad">Quảng cáo</option>
            </select>
          </div>
          <button onClick={loadInsights} disabled={!selectedAccount || fbLoading} style={{ ...btnPrimary, height: 42, display: "flex", alignItems: "center", gap: 6 }}>
            {fbLoading ? <><RefreshCw size={14} className="spin" /> Đang tải...</> : <><RefreshCw size={14} /> Xem báo cáo</>}
          </button>
        </div>

        {!selectedAccount && (
          <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>
            <Activity size={40} style={{ marginBottom: 8, opacity: 0.4 }} />
            <div style={{ fontSize: 14 }}>Chọn tài khoản quảng cáo và bấm "Xem báo cáo" để xem hiệu quả</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Chưa có tài khoản? Vào tab <b>"Cài đặt tài khoản"</b> để thêm</div>
          </div>
        )}

        {fbError && <div style={{ background: "#fef2f2", color: "#dc2626", padding: "10px 14px", borderRadius: 10, marginBottom: 12, fontSize: 13 }}>{fbError}</div>}

        {/* Summary cards */}
        {fbTotals && (
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(auto-fill, minmax(150px, 1fr))", gap: 10, marginBottom: 16 }}>
            <Card title="Tổng chi phí" value={fmtMoney(fbTotals.spend)} color="#8b5cf6" compact />
            <Card title="Impressions" value={fmtNum(fbTotals.impressions)} color="#3b82f6" compact />
            <Card title="Reach" value={fmtNum(fbTotals.reach)} color="#06b6d4" compact />
            <Card title="Clicks" value={fmtNum(fbTotals.clicks)} color="#f59e0b" compact />
            <Card title="CPM" value={fmtMoney(fbTotals.cpm)} color="#ec4899" compact />
            <Card title="CPC" value={fmtMoney(fbTotals.cpc)} color="#e88a2e" compact />
            <Card title="CTR" value={fmtPct(fbTotals.ctr)} color="#10b981" compact />
            {fbTotals.leads > 0 && <Card title="Leads" value={fmtNum(fbTotals.leads)} sub={`CPL: ${fmtMoney(fbTotals.cpl)}`} color="#1a3c20" compact />}
          </div>
        )}

        {/* Insights table */}
        {fbInsights.length > 0 && (
          <div style={{ background: "#fff", borderRadius: 12, overflow: "auto", boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, textAlign: "left", minWidth: 200 }}>
                    {fbLevel === "campaign" ? "Chiến dịch" : fbLevel === "adset" ? "Nhóm QC" : "Quảng cáo"}
                  </th>
                  <th style={{ ...thStyle, textAlign: "center" }}>Trạng thái</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Chi phí</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Impressions</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Reach</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Clicks</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>CPM</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>CPC</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>CTR</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Kết quả</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Chi phí/KQ</th>
                </tr>
              </thead>
              <tbody>
                {fbInsights.map((row, i) => {
                  const name = row.campaign_name || row.adset_name || row.ad_name || "—";
                  const leadAction = (row.actions || []).find(a => a.action_type === "lead" || a.action_type === "onsite_conversion.messaging_first_reply");
                  const resultCount = leadAction ? Number(leadAction.value) : 0;
                  const costPerAction = (row.cost_per_action_type || []).find(a => a.action_type === "lead" || a.action_type === "onsite_conversion.messaging_first_reply");
                  const costPerResult = costPerAction ? Number(costPerAction.value) : (resultCount ? Number(row.spend) / resultCount : 0);
                  const statusLabel = row.status === "ACTIVE" ? "Đang hoạt động" : row.status === "PAUSED" ? "Tạm dừng" : row.status || "—";
                  const statusColor = row.status === "ACTIVE" ? "#16a34a" : row.status === "PAUSED" ? "#d97706" : "#6b7280";
                  return (
                    <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#fafbfc" }}>
                      <td style={{ ...tdStyle, fontWeight: 600, fontSize: 12, maxWidth: 280 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {fbLevel === "campaign" ? <Megaphone size={13} color="#6b7280" /> : fbLevel === "adset" ? <Folder size={13} color="#6b7280" /> : <CircleDot size={11} color="#6b7280" />}
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                        </div>
                      </td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>
                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, fontWeight: 600, color: statusColor, background: statusColor + "15" }}>{statusLabel}</span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600, color: "#8b5cf6" }}>{fmtMoney(row.spend)}</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>{fmtNum(row.impressions)}</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>{fmtNum(row.reach)}</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>{fmtNum(row.clicks)}</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>{fmtMoney(row.cpm)}</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>{fmtMoney(row.cpc)}</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>{fmtPct(row.ctr)}</td>
                      <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600 }}>{resultCount || "—"}</td>
                      <td style={{ ...tdStyle, textAlign: "right", color: "#e88a2e", fontWeight: 600 }}>{resultCount ? fmtMoney(costPerResult) : "—"}</td>
                    </tr>
                  );
                })}
                {/* Totals row */}
                <tr style={{ background: "#f0f4f1", fontWeight: 700 }}>
                  <td style={{ ...tdStyle, fontWeight: 700, fontSize: 13 }}>Tổng ({fbInsights.length})</td>
                  <td style={tdStyle}></td>
                  <td style={{ ...tdStyle, textAlign: "right", color: "#8b5cf6" }}>{fmtMoney(fbTotals.spend)}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{fmtNum(fbTotals.impressions)}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{fmtNum(fbTotals.reach)}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{fmtNum(fbTotals.clicks)}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{fmtMoney(fbTotals.cpm)}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{fmtMoney(fbTotals.cpc)}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{fmtPct(fbTotals.ctr)}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{fmtNum(fbTotals.leads)}</td>
                  <td style={{ ...tdStyle, textAlign: "right", color: "#e88a2e" }}>{fbTotals.leads ? fmtMoney(fbTotals.cpl) : "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {selectedAccount && !fbLoading && fbInsights.length === 0 && !fbError && (
          <div style={{ textAlign: "center", padding: 30, color: "#9ca3af", fontSize: 13 }}>Bấm "Xem báo cáo" để tải dữ liệu từ Facebook</div>
        )}
      </div>
    );
  }

  // === Settings Tab ===
  if (tab === "settings") {
    return (
      <div>
        {tabBar}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 15, display: "flex", alignItems: "center", gap: 6 }}><Settings size={16} /> Tài khoản quảng cáo Facebook</h3>
          <button onClick={() => { setEditingAccount(null); setAcctDraft({ name: "", accountId: "", accessToken: "" }); setShowAccountForm(true); }} style={{ ...btnPrimary, display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={14} /> Thêm tài khoản
          </button>
        </div>

        <details style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#92400e" }}>
          <summary style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 13, userSelect: "none", listStyle: "none" }}>
            <Info size={16} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1 }}>📖 Hướng dẫn cài đặt tài khoản FB Ads (bấm để xem chi tiết)</span>
            <ChevronDown size={14} style={{ flexShrink: 0, opacity: 0.6 }} />
          </summary>
          <div style={{ marginTop: 12, lineHeight: 1.8, fontSize: 12.5 }}>
            <div style={{ background: "#fff", border: "1px solid #fde68a", borderRadius: 8, padding: 14, marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#92400e", marginBottom: 6 }}>🔶 BƯỚC 1: TẠO ỨNG DỤNG FACEBOOK (Chỉ làm 1 lần)</div>
              <div style={{ paddingLeft: 8 }}>
                <div><b>1.</b> Mở trình duyệt → Vào: <b>developers.facebook.com</b></div>
                <div><b>2.</b> Đăng nhập bằng tài khoản Facebook <b>đang quản lý Fanpage/Tài khoản quảng cáo</b></div>
                <div><b>3.</b> Bấm <b>"Ứng dụng của tôi"</b> (My Apps) → <b>"Tạo ứng dụng"</b> (Create App)</div>
                <div><b>4.</b> Chọn loại: <b>"Doanh nghiệp"</b> (Business) hoặc <b>"Không"</b> (None) → Bấm <b>Tiếp</b></div>
                <div><b>5.</b> Đặt tên ứng dụng (VD: <code>CRM Ads Reader</code>) + Email → Bấm <b>"Tạo ứng dụng"</b></div>
                <div style={{ background: "#fef3c7", padding: "4px 8px", borderRadius: 6, marginTop: 4, fontSize: 11 }}>⚠️ Nếu đã tạo ứng dụng rồi thì bỏ qua bước này</div>
              </div>
            </div>

            <div style={{ background: "#fff", border: "1px solid #fde68a", borderRadius: 8, padding: 14, marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#92400e", marginBottom: 6 }}>🔶 BƯỚC 2: CẤU HÌNH QUYỀN CHO ỨNG DỤNG</div>
              <div style={{ paddingLeft: 8 }}>
                <div><b>1.</b> Từ Dashboard ứng dụng → Bấm <b>"Tùy chỉnh trường hợp sử dụng"</b></div>
                <div><b>2.</b> Tìm và bấm <b>"Thêm"</b> (Add) cho các quyền sau:</div>
                <div style={{ background: "#f0fdf4", padding: "6px 10px", borderRadius: 6, margin: "6px 0", fontSize: 11.5 }}>
                  ✅ <code>ads_read</code> — Đọc dữ liệu quảng cáo (chi phí, hiệu quả)<br/>
                  ✅ <code>ads_management</code> — Quản lý quảng cáo (tuỳ chọn)<br/>
                  ✅ <code>pages_show_list</code> — Xem danh sách Page<br/>
                  ✅ <code>business_management</code> — Quản lý tài khoản doanh nghiệp
                </div>
                <div style={{ fontSize: 11, color: "#b45309" }}>💡 Nếu bạn là Admin/Developer của ứng dụng → dùng được ngay mà KHÔNG cần xét duyệt</div>
              </div>
            </div>

            <div style={{ background: "#fff", border: "1px solid #fde68a", borderRadius: 8, padding: 14, marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#92400e", marginBottom: 6 }}>🔶 BƯỚC 3: LẤY AD ACCOUNT ID</div>
              <div style={{ paddingLeft: 8 }}>
                <div><b>1.</b> Mở <b>Facebook Ads Manager</b>: <b>facebook.com/adsmanager</b></div>
                <div><b>2.</b> Nhìn thanh URL trên trình duyệt, tìm dạng: <code>act_<b style={{color:"#dc2626"}}>123456789</b></code></div>
                <div><b>3.</b> Copy <b>phần số</b> phía sau <code>act_</code> (VD: <code>123456789</code>)</div>
                <div><b>4.</b> Hoặc vào <b>Cài đặt tài khoản quảng cáo</b> → Dòng <b>"ID tài khoản quảng cáo"</b></div>
                <div style={{ background: "#fef3c7", padding: "4px 8px", borderRadius: 6, marginTop: 4, fontSize: 11 }}>💡 Mỗi tài khoản quảng cáo có 1 ID riêng. Nhập chỉ phần số, hệ thống tự thêm <code>act_</code></div>
              </div>
            </div>

            <div style={{ background: "#fff", border: "1px solid #fde68a", borderRadius: 8, padding: 14, marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#92400e", marginBottom: 6 }}>🔶 BƯỚC 4: LẤY ACCESS TOKEN (QUAN TRỌNG NHẤT!)</div>
              <div style={{ paddingLeft: 8 }}>
                <div><b>1.</b> Vào <b>Graph API Explorer</b>: <b>developers.facebook.com/tools/explorer/</b></div>
                <div><b>2.</b> Ở dropdown <b>"Facebook App"</b> → <b>Chọn ứng dụng bạn vừa tạo</b></div>
                <div><b>3.</b> Bấm <b>"Add a Permission"</b> → Mở mục <b>"Other"</b> → Tick chọn:</div>
                <div style={{ background: "#f0fdf4", padding: "4px 10px", borderRadius: 6, margin: "4px 0", fontSize: 11.5 }}>
                  ✅ <code>ads_read</code> · ✅ <code>business_management</code>
                </div>
                <div><b>4.</b> Bấm <b>"Generate Access Token"</b> → Đăng nhập → <b>Cho phép tất cả</b></div>
                <div><b>5.</b> Copy chuỗi token dài trong ô Access Token</div>
              </div>
            </div>

            <div style={{ background: "#fff", border: "1px solid #fde68a", borderRadius: 8, padding: 14, marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#92400e", marginBottom: 6 }}>🔶 BƯỚC 5: GIA HẠN TOKEN (RẤT QUAN TRỌNG!)</div>
              <div style={{ paddingLeft: 8 }}>
                <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", padding: "8px 10px", borderRadius: 6, marginBottom: 8, fontSize: 12 }}>
                  <div style={{ fontWeight: 700, color: "#dc2626", marginBottom: 4 }}>⚠️ HIỂU RÕ TRƯỚC KHI LÀM:</div>
                  <div style={{ color: "#991b1b", lineHeight: 1.7 }}>
                    • Token bạn vừa lấy ở Bước 4 là <b>USER Token ngắn hạn</b> — chỉ sống <b>1-2 giờ</b><br/>
                    • FB Ads API cần <b>USER Token</b> (token cá nhân của bạn) — KHÔNG phải Page Token<br/>
                    • <b>KHÔNG cần</b> gọi <code>me/accounts</code> — cái đó là lấy Page Token dùng cho việc <b>đăng bài</b>, hoàn toàn khác!<br/>
                    • Bạn chỉ cần <b>gia hạn USER Token</b> rồi dán thẳng vào CRM là xong
                  </div>
                </div>
                <div style={{ fontWeight: 600, color: "#b45309", marginBottom: 6 }}>Chọn 1 trong 2 cách gia hạn:</div>
                <div style={{ background: "#fef3c7", padding: "10px 12px", borderRadius: 6, marginBottom: 8 }}>
                  <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 12.5 }}>🅰️ Cách nhanh — Token 60 ngày (đơn giản, ai cũng làm được):</div>
                  <div style={{ paddingLeft: 8, fontSize: 11.5, lineHeight: 1.8 }}>
                    <div><b>1.</b> Ở Bước 4 bạn đã có <b>User Token ngắn hạn</b> trong ô Access Token</div>
                    <div><b>2.</b> <b>GIỮ NGUYÊN</b> dropdown <b>"User or Page"</b> ở <b>"User Token"</b> (⚠️ KHÔNG đổi sang tên Page!)</div>
                    <div><b>3.</b> Vào Debug Tool: <b>developers.facebook.com/tools/debug/accesstoken/</b></div>
                    <div><b>4.</b> Dán User Token vào ô → Bấm <b>"Debugging"</b></div>
                    <div><b>5.</b> Kiểm tra dòng <b>"Type"</b> phải ghi <b>"User"</b> (nếu ghi "Page" → sai, quay lại Bước 4)</div>
                    <div><b>6.</b> Kéo xuống dưới cùng → Bấm nút <b>"Extended access code"</b> (nút xanh dương)</div>
                    <div><b>7.</b> Token mới hiện ra → <b>Copy token này</b> → Đây là <b>User Token 60 ngày</b> ✅</div>
                    <div><b>8.</b> <b>Dán thẳng token này vào CRM</b> ở Bước 6 → Xong!</div>
                    <div style={{ background: "#fff7ed", padding: "4px 8px", borderRadius: 4, marginTop: 4, fontSize: 11, color: "#9a3412" }}>📌 Sau 60 ngày hết hạn → Làm lại từ Bước 4 (~2 phút)</div>
                  </div>
                </div>
                <div style={{ background: "#f0fdf4", padding: "10px 12px", borderRadius: 6 }}>
                  <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 12.5 }}>🅱️ Cách nâng cao — Token VĨNH VIỄN (không bao giờ hết hạn):</div>
                  <div style={{ paddingLeft: 8, fontSize: 11.5, lineHeight: 1.8 }}>
                    <div><b>1.</b> Làm theo cách 🅰️ ở trên trước → Bạn đã có <b>Long-lived User Token (60 ngày)</b></div>
                    <div><b>2.</b> Vào <b>Business Settings</b>: <b>business.facebook.com/settings/</b></div>
                    <div><b>3.</b> Ở sidebar trái → Mục <b>"Người dùng"</b> → <b>"Người dùng hệ thống"</b> (System Users)</div>
                    <div><b>4.</b> Bấm <b>"Thêm"</b> → Đặt tên (VD: <code>CRM Bot</code>) → Vai trò: <b>Admin</b> → Tạo</div>
                    <div><b>5.</b> Bấm <b>"Tạo token mới"</b> (Generate New Token) cho System User vừa tạo</div>
                    <div><b>6.</b> Chọn <b>ứng dụng</b> bạn đã tạo ở Bước 1</div>
                    <div><b>7.</b> Tick chọn quyền: <b><code>ads_read</code></b>, <code>business_management</code></div>
                    <div><b>8.</b> Bấm <b>"Generate Token"</b> → Copy token → Đây là token <b>VĨNH VIỄN</b> ✅</div>
                    <div><b>9.</b> Kiểm tra: Vào Debug Tool → dán token → dòng "Expired" = <b>"Never"</b></div>
                  </div>
                  <div style={{ background: "#dcfce7", padding: "6px 10px", borderRadius: 4, marginTop: 6, fontSize: 11, color: "#15803d" }}>
                    ✅ Token System User <b>không bao giờ hết hạn</b>, không cần gia hạn lại. Đây là cách tốt nhất cho production.
                  </div>
                </div>
                <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", padding: "8px 10px", borderRadius: 6, marginTop: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 11.5, color: "#dc2626", marginBottom: 4 }}>❌ SAI LẦM HAY GẶP — ĐỪNG LÀM NHƯ NÀY:</div>
                  <div style={{ fontSize: 11, color: "#991b1b", lineHeight: 1.7 }}>
                    <div>❌ Đổi dropdown sang tên Page rồi copy → Đó là <b>Page Token</b>, dùng cho <b>đăng bài</b>, KHÔNG dùng cho Ads!</div>
                    <div>❌ Gọi <code>me/accounts</code> → Trả về <b>1 danh sách token của các Page</b> — hoàn toàn KHÔNG liên quan đến Ads!</div>
                    <div>❌ Copy Page Token từ <code>me/accounts</code> dán vào đây → Sẽ bị lỗi vì FB Ads API cần <b>User Token</b></div>
                    <div style={{ marginTop: 4 }}>✅ Đúng: Giữ dropdown ở <b>"User Token"</b> → Extend → Dán <b>User Token dài hạn</b> vào CRM</div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ background: "#fff", border: "1px solid #fde68a", borderRadius: 8, padding: 14, marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#92400e", marginBottom: 6 }}>🔶 BƯỚC 6: NHẬP VÀO CRM</div>
              <div style={{ paddingLeft: 8 }}>
                <div><b>1.</b> Bấm nút <b>"Thêm tài khoản"</b> ở trên</div>
                <div><b>2.</b> Điền <b>Tên</b> (tuỳ ý, VD: "BLC Campaign Account")</div>
                <div><b>3.</b> Điền <b>Ad Account ID</b> (phần số, VD: <code>123456789</code>)</div>
                <div><b>4.</b> Dán <b>Access Token</b> (đã gia hạn ở Bước 5)</div>
                <div><b>5.</b> Bấm <b>Lưu</b> → Xong! Chuyển qua tab <b>"Hiệu quả quảng cáo FB"</b> để xem dữ liệu</div>
              </div>
            </div>

            <div style={{ background: "#fff", border: "1px solid #fde68a", borderRadius: 8, padding: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#92400e", marginBottom: 6 }}>❓ XỬ LÝ LỖI THƯỜNG GẶP</div>
              <div style={{ paddingLeft: 8, fontSize: 11.5 }}>
                <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 10px" }}>
                  <div style={{ fontWeight: 600, color: "#b45309" }}>Token hết hạn:</div><div>Lấy token mới (Bước 4-5)</div>
                  <div style={{ fontWeight: 600, color: "#b45309" }}>Không thấy dữ liệu:</div><div>Kiểm tra Ad Account ID đúng chưa + Token có quyền <code>ads_read</code> không</div>
                  <div style={{ fontWeight: 600, color: "#b45309" }}>Lỗi "permissions":</div><div>Vào Dashboard ứng dụng → Thêm quyền <code>ads_read</code> (Bước 2)</div>
                  <div style={{ fontWeight: 600, color: "#b45309" }}>Lỗi "invalid token":</div><div>Copy lại token, đảm bảo copy ĐẦY ĐỦ (không thừa/thiếu ký tự)</div>
                  <div style={{ fontWeight: 600, color: "#b45309" }}>Dán Page Token:</div><div>FB Ads API cần <b>User Token</b>, không phải Page Token. Giữ dropdown ở "User Token" khi copy</div>
                </div>
              </div>
            </div>
          </div>
        </details>

        {adAccounts.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>
            <Settings size={40} style={{ marginBottom: 8, opacity: 0.4 }} />
            <div>Chưa có tài khoản quảng cáo nào</div>
          </div>
        ) : (
          <div style={{ background: "#fff", borderRadius: 12, overflow: "auto", boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, textAlign: "left" }}>Tên</th>
                  <th style={{ ...thStyle, textAlign: "left" }}>Account ID</th>
                  <th style={{ ...thStyle, textAlign: "center" }}>Token</th>
                  <th style={{ ...thStyle, textAlign: "center" }}>Active</th>
                  <th style={{ ...thStyle, textAlign: "center" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {adAccounts.map(a => (
                  <tr key={a.id}>
                    <td style={tdStyle}>{a.name || "—"}</td>
                    <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 12 }}>act_{a.accountId}</td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: a.hasToken ? "#f0fdf4" : "#fef2f2", color: a.hasToken ? "#16a34a" : "#dc2626" }}>
                        {a.hasToken ? "Đã kết nối" : "Chưa có"}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: a.isActive ? "#f0fdf4" : "#f3f4f6", color: a.isActive ? "#16a34a" : "#9ca3af" }}>
                        {a.isActive ? "ON" : "OFF"}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                        <button onClick={() => { setEditingAccount(a); setAcctDraft({ name: a.name || "", accountId: a.accountId, accessToken: "" }); setShowAccountForm(true); }} style={{ ...btnSecondary, padding: "4px 10px", fontSize: 12 }}><Pencil size={12} /></button>
                        <button onClick={() => deleteAccount(a.id)} style={{ ...btnSecondary, padding: "4px 10px", fontSize: 12, color: "#dc2626" }}><Trash2 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {showAccountForm && (
          <Modal onClose={() => { setShowAccountForm(false); setEditingAccount(null); }} title={editingAccount ? "Sửa tài khoản QC" : "Thêm tài khoản QC"}>
            <label style={labelStyle}>Tên (tùy chọn)</label>
            <input style={inputStyle} value={acctDraft.name} onChange={e => setAcctDraft({ ...acctDraft, name: e.target.value })} placeholder="VD: BLC Campaign Account" />
            <label style={labelStyle}>Facebook Ad Account ID</label>
            <input style={inputStyle} value={acctDraft.accountId} onChange={e => setAcctDraft({ ...acctDraft, accountId: e.target.value })} placeholder="VD: 123456789 hoặc act_123456789" />
            <label style={labelStyle}>Access Token (quyền ads_read)</label>
            <input style={inputStyle} value={acctDraft.accessToken} onChange={e => setAcctDraft({ ...acctDraft, accessToken: e.target.value })} placeholder="EAAGm0PX4..." />
            {editingAccount && <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 8 }}>Để trống Access Token nếu không muốn thay đổi</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={handleSaveAccount} disabled={savingAcct} style={{ ...btnPrimary, flex: 1, opacity: savingAcct ? 0.6 : 1 }}>{savingAcct ? "Đang lưu..." : "Lưu"}</button>
              <button onClick={() => { setShowAccountForm(false); setEditingAccount(null); }} style={{ ...btnSecondary, flex: 1 }}>Hủy</button>
            </div>
          </Modal>
        )}
      </div>
    );
  }

  // === Leads Tab (original) ===

  // Project list view
  if (selectedProjectId === null) {
    const projectIds = Object.keys(projectTree).sort((a, b) => projectTree[b].leads.length - projectTree[a].leads.length);
    return (
      <div>
        {tabBar}
        <div style={{ padding: isMobile ? "12px" : "16px 0", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: isMobile ? 14 : 16, display: "flex", alignItems: "center", gap: 6 }}><Building2 size={18} /> Chọn dự án để xem chiến dịch</h3>
          <span style={{ fontSize: isMobile ? 11 : 13, color: "#6b7280" }}>{leads.length} lead · {projectIds.length} dự án</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
          {projectIds.map(pid => {
            const p = projectTree[pid];
            const stats = calcStats(p.leads);
            return (
              <div key={pid} onClick={() => { setSelectedProjectId(Number(pid)); setExpandedCampaigns({}); setExpandedAdsets({}); }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,.12)"; e.currentTarget.style.borderColor = "#e88a2e"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,.08)"; e.currentTarget.style.borderColor = "#e5e7eb"; }}
                style={{
                  background: "#fff", borderRadius: 14, padding: 20, cursor: "pointer",
                  boxShadow: "0 1px 3px rgba(0,0,0,.08)", border: "1px solid #e5e7eb",
                  transition: "all .25s ease", borderTop: "3px solid #e88a2e",
                }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <span style={{ fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", gap: 6 }}><Building2 size={16} /> {p.name}</span>
                  <span style={{ background: "#e88a2e22", color: "#e88a2e", padding: "4px 12px", borderRadius: 8, fontWeight: 700, fontSize: 13 }}>{stats.total} lead</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 12 }}>
                  <span style={{ background: "#f59e0b15", color: "#92400e", padding: "3px 8px", borderRadius: 6 }}>Chưa FB: {stats.newLead}</span>
                  <span style={{ background: "#22c55e15", color: "#15803d", padding: "3px 8px", borderRadius: 6 }}>QT: {stats.interested}</span>
                  <span style={{ background: "#10b98115", color: "#065f46", padding: "3px 8px", borderRadius: 6 }}>GC: {stats.booked}</span>
                  <span style={{ background: "#059669", color: "#fff", padding: "3px 8px", borderRadius: 6 }}>Chốt: {stats.closed}</span>
                  <span style={{ background: "#ef444415", color: "#b91c1c", padding: "3px 8px", borderRadius: 6 }}>KQT: {stats.notInterested}</span>
                  <span style={{ background: "#eab30815", color: "#92400e", padding: "3px 8px", borderRadius: 6 }}>Phá: {stats.spam}</span>
                </div>
                <div style={{ marginTop: 8, fontSize: 11, color: "#9ca3af" }}>{Object.keys(p.campaigns).length} chiến dịch · Click để xem chi tiết →</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Campaign detail view for selected project
  const projData = projectTree[selectedProjectId] || { name: "?", leads: [], campaigns: {} };
  const campaignNames = Object.keys(projData.campaigns).sort((a, b) => projData.campaigns[b].leads.length - projData.campaigns[a].leads.length);
  const tree = projData.campaigns;

  return (
    <div>
    {tabBar}
    <div style={{ background: "#fff", borderRadius: 12, overflow: "auto", boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
      <div style={{ padding: isMobile ? "12px" : "16px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => setSelectedProjectId(null)} style={{
            background: "#f3f4f6", border: "none", borderRadius: 8, padding: "6px 12px",
            cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#374151",
          }}>← Dự án</button>
          <h3 style={{ margin: 0, fontSize: isMobile ? 14 : 16, display: "flex", alignItems: "center", gap: 6 }}><Building2 size={18} /> {projData.name}</h3>
        </div>
        <span style={{ fontSize: isMobile ? 11 : 13, color: "#6b7280" }}>{projData.leads.length} lead · {campaignNames.length} chiến dịch</span>
      </div>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={{ ...thStyle, width: 36 }}></th>
            <th style={{ ...thStyle, textAlign: "left" }}>Tên</th>
            <th style={{ ...thStyle, textAlign: "center" }}>Tổng</th>
            <th style={{ ...thStyle, textAlign: "center" }}>Chưa FB</th>
            <th style={{ ...thStyle, textAlign: "center" }}>Quan tâm</th>
            <th style={{ ...thStyle, textAlign: "center" }}>Giữ chỗ</th>
            <th style={{ ...thStyle, textAlign: "center" }}>Chốt</th>
            <th style={{ ...thStyle, textAlign: "center" }}>KQT</th>
            <th style={{ ...thStyle, textAlign: "center" }}>Phá/rác</th>
            <th style={{ ...thStyle, textAlign: "center" }}>Hủy/KLH</th>
            <th style={{ ...thStyle, textAlign: "center" }}>Còn lại</th>
          </tr>
        </thead>
        <tbody>
          {campaignNames.map((cName) => {
            const cStats = calcStats(tree[cName].leads);
            const isExpanded = expandedCampaigns[cName];
            const adsetNames = Object.keys(tree[cName].adsets).sort((a, b) => tree[cName].adsets[b].leads.length - tree[cName].adsets[a].leads.length);
            return (
              <React.Fragment key={cName}>
                <tr style={{ background: headerBg, cursor: "pointer" }} onClick={() => toggleCampaign(cName)}>
                  <td style={{ ...tdStyle, textAlign: "center", fontSize: 14 }}>{isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                  <td style={{ ...tdStyle, fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}><Megaphone size={14} /> {cName}</td>
                  <td style={statCellStyle}><strong>{cStats.total}</strong></td>
                  <td style={statCellStyle}>{cStats.newLead} <span style={pctStyle()}>({cStats.pNewLead}%)</span></td>
                  <td style={statCellStyle}>{cStats.interested} <span style={pctStyle()}>({cStats.pInterested}%)</span></td>
                  <td style={statCellStyle}>{cStats.booked} <span style={pctStyle()}>({cStats.pBooked}%)</span></td>
                  <td style={statCellStyle}>{cStats.closed} <span style={pctStyle()}>({cStats.pClosed}%)</span></td>
                  <td style={statCellStyle}>{cStats.notInterested} <span style={pctStyle()}>({cStats.pNotInterested}%)</span></td>
                  <td style={statCellStyle}>{cStats.spam} <span style={pctStyle()}>({cStats.pSpam}%)</span></td>
                  <td style={statCellStyle}>{cStats.bad} <span style={pctStyle()}>({cStats.pBad}%)</span></td>
                  <td style={statCellStyle}>{cStats.remaining} <span style={pctStyle()}>({cStats.pRemaining}%)</span></td>
                </tr>
                {isExpanded && adsetNames.map((asName) => {
                  const asKey = cName + "|" + asName;
                  const asStats = calcStats(tree[cName].adsets[asName].leads);
                  const asExpanded = expandedAdsets[asKey];
                  const adNames = Object.keys(tree[cName].adsets[asName].ads).sort((a, b) => tree[cName].adsets[asName].ads[b].leads.length - tree[cName].adsets[asName].ads[a].leads.length);
                  return (
                    <React.Fragment key={asKey}>
                      <tr style={{ background: adsetBg, cursor: "pointer" }} onClick={() => toggleAdset(asKey)}>
                        <td style={{ ...tdStyle, textAlign: "center", fontSize: 12, paddingLeft: 20 }}>{asExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</td>
                        <td style={{ ...tdStyle, paddingLeft: 28, fontWeight: 600, fontSize: 12, color: "#4b5563", display: "flex", alignItems: "center", gap: 4 }}><Folder size={12} /> {asName}</td>
                        <td style={statCellStyle}>{asStats.total}</td>
                        <td style={statCellStyle}>{asStats.newLead}</td>
                        <td style={statCellStyle}>{asStats.interested}</td>
                        <td style={statCellStyle}>{asStats.booked}</td>
                        <td style={statCellStyle}>{asStats.closed}</td>
                        <td style={statCellStyle}>{asStats.notInterested}</td>
                        <td style={statCellStyle}>{asStats.spam}</td>
                        <td style={statCellStyle}>{asStats.bad}</td>
                        <td style={statCellStyle}>{asStats.remaining}</td>
                      </tr>
                      {asExpanded && adNames.map((adN) => {
                        const adStats = calcStats(tree[cName].adsets[asName].ads[adN].leads);
                        return (
                          <tr key={adN} style={{ background: adBg }}>
                            <td style={{ ...tdStyle, textAlign: "center" }}></td>
                            <td style={{ ...tdStyle, paddingLeft: 52, fontSize: 12, color: "#6b7280", display: "flex", alignItems: "center", gap: 4 }}><CircleDot size={10} /> {adN}</td>
                            <td style={statCellStyle}>{adStats.total}</td>
                            <td style={statCellStyle}>{adStats.newLead}</td>
                            <td style={statCellStyle}>{adStats.interested}</td>
                            <td style={statCellStyle}>{adStats.booked}</td>
                            <td style={statCellStyle}>{adStats.closed}</td>
                            <td style={statCellStyle}>{adStats.notInterested}</td>
                            <td style={statCellStyle}>{adStats.spam}</td>
                            <td style={statCellStyle}>{adStats.bad}</td>
                            <td style={statCellStyle}>{adStats.remaining}</td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </React.Fragment>
            );
          })}
          {campaignNames.length === 0 && (
            <tr><td colSpan={11} style={{ ...tdStyle, textAlign: "center", color: "#9ca3af" }}>Không có dữ liệu chiến dịch</td></tr>
          )}
        </tbody>
      </table>
    </div>
    </div>
  );
}

function SalesPage({ ranking, leads, apiFetch, applyApiData }) {
  const isMobile = useIsMobile();
  const [tab, setTab] = useState("kanban");
  const [analytics, setAnalytics] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [dragId, setDragId] = useState(null);

  const PIPELINE_STAGES = [
    { key: "new", label: "Mới", statuses: ["new"], color: "#f59e0b" },
    { key: "contacting", label: "Đang liên hệ", statuses: ["called", "unreachable", "callback"], color: "#e88a2e" },
    { key: "potential", label: "Tiềm năng", statuses: ["interested", "low_interest", "other_project"], color: "#8b5cf6" },
    { key: "site_visit", label: "Hẹn xem", statuses: ["appointment"], color: "#ec4899" },
    { key: "closing", label: "Chốt", statuses: ["booked", "closed"], color: "#10b981" },
    { key: "lost", label: "Mất", statuses: ["not_interested", "spam", "weak_finance", "wrong_number", "blocked", "has_sale", "lost"], color: "#ef4444" },
  ];

  const stageLeads = useMemo(() => {
    const map = {};
    PIPELINE_STAGES.forEach(s => { map[s.key] = []; });
    (leads || []).forEach(l => {
      const st = l.status || "new";
      const stage = PIPELINE_STAGES.find(p => p.statuses.includes(st));
      if (stage) map[stage.key].push(l);
      else map["new"].push(l);
    });
    return map;
  }, [leads]);

  useEffect(() => {
    if (tab === "analytics" && !analytics) {
      setLoadingAnalytics(true);
      apiFetch("/api/sales/analytics").then(r => r.json()).then(d => setAnalytics(d)).catch(() => {}).finally(() => setLoadingAnalytics(false));
    }
  }, [tab]);

  const handleDrop = async (stageKey) => {
    if (!dragId) return;
    const stage = PIPELINE_STAGES.find(s => s.key === stageKey);
    if (!stage) return;
    const newStatus = stage.statuses[0];
    const lead = (leads || []).find(l => l.id === dragId);
    if (!lead || lead.status === newStatus) { setDragId(null); return; }
    try {
      const res = await apiFetch(`/api/leads/${dragId}`, { method: "PUT", body: JSON.stringify({ status: newStatus }) });
      if (res.ok) {
        const r2 = await apiFetch("/api/data");
        if (r2.ok) { const d = await r2.json(); applyApiData(d); }
      }
    } catch {}
    setDragId(null);
  };

  const tabBtnStyle = (active) => ({
    padding: "8px 20px", border: "none", borderBottom: active ? "3px solid #e88a2e" : "3px solid transparent",
    background: "none", fontWeight: active ? 700 : 500, color: active ? "#e88a2e" : "#6b7280",
    cursor: "pointer", fontSize: 14, transition: "all .2s",
  });

  const formatMs = (ms) => {
    if (!ms) return "—";
    const hrs = ms / 3600000;
    if (hrs < 1) return `${Math.round(ms / 60000)}p`;
    if (hrs < 24) return `${hrs.toFixed(1)}h`;
    return `${(hrs / 24).toFixed(1)}d`;
  };

  /* -- KANBAN TAB -- */
  const renderKanban = () => (
    <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 12, minHeight: 400 }}>
      {PIPELINE_STAGES.map(stage => (
        <div key={stage.key}
          onDragOver={e => e.preventDefault()}
          onDrop={() => handleDrop(stage.key)}
          style={{
            minWidth: isMobile ? 220 : 230, flex: 1,
            background: "#fff", borderRadius: 12,
            padding: 0, display: "flex", flexDirection: "column",
            border: `1px solid ${stage.color}33`,
            boxShadow: "0 1px 4px rgba(0,0,0,.05)",
            transition: "border-color .2s, box-shadow .2s",
          }}
          onDragEnter={e => { e.currentTarget.style.borderColor = stage.color; e.currentTarget.style.boxShadow = `0 0 0 2px ${stage.color}33`; }}
          onDragLeave={e => { e.currentTarget.style.borderColor = `${stage.color}33`; e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,.05)"; }}
        >
          {/* Column header */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 12px", borderBottom: `2px solid ${stage.color}`,
            background: stage.color + "08", borderRadius: "12px 12px 0 0",
          }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: stage.color }}>{stage.label}</span>
            <span style={{
              background: stage.color, color: "#fff", fontWeight: 700,
              borderRadius: 12, padding: "2px 10px", fontSize: 12, minWidth: 28, textAlign: "center",
            }}>{stageLeads[stage.key]?.length || 0}</span>
          </div>
          {/* Cards */}
          <div style={{ flex: 1, overflowY: "auto", maxHeight: 520, display: "flex", flexDirection: "column", gap: 6, padding: "8px 8px" }}>
            {(stageLeads[stage.key] || []).slice(0, 50).map(lead => (
              <div key={lead.id} draggable
                onDragStart={() => setDragId(lead.id)}
                onDragEnd={() => setDragId(null)}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 3px 12px rgba(0,0,0,.12)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,.06)"; e.currentTarget.style.transform = "translateY(0)"; }}
                style={{
                  background: "#fff", borderRadius: 10, padding: "10px 12px", cursor: "grab",
                  boxShadow: "0 1px 3px rgba(0,0,0,.06)",
                  borderLeft: `3px solid ${stage.color}`,
                  border: "1px solid #f0f2f5", borderLeftWidth: 3, borderLeftColor: stage.color,
                  opacity: dragId === lead.id ? 0.5 : 1, fontSize: 13,
                  transition: "opacity .2s, box-shadow .2s, transform .15s",
                }}>
                <div style={{ fontWeight: 600, marginBottom: 3, color: "#1f2937" }}>{lead.name || "—"}</div>
                <div style={{ color: "#6b7280", fontSize: 11, marginBottom: 4 }}>{lead.phone || ""}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11 }}>
                  <span style={{ color: "#9ca3af" }}>{lead.saleName || "Chưa chia"}</span>
                  <span style={{
                    background: (STATUS_COLORS[lead.status] || "#888") + "18",
                    color: STATUS_COLORS[lead.status] || "#888",
                    padding: "2px 8px", borderRadius: 6, fontWeight: 600, fontSize: 10,
                  }}>{STATUS_LABELS[lead.status] || lead.status}</span>
                </div>
              </div>
            ))}
            {(stageLeads[stage.key]?.length || 0) > 50 && (
              <div style={{ textAlign: "center", color: "#9ca3af", fontSize: 11, padding: 4 }}>
                +{stageLeads[stage.key].length - 50} khác
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  /* -- ANALYTICS TAB -- */
  const renderAnalytics = () => {
    if (loadingAnalytics) return <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>Đang tải...</div>;
    if (!analytics) return <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>Không có dữ liệu</div>;

    const maxLeads = Math.max(...(analytics.agents || []).map(a => a.totalLeads), 1);

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Pipeline funnel */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}><BarChart3 size={18} /> Pipeline Funnel</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {PIPELINE_STAGES.map(stage => {
              const count = stageLeads[stage.key]?.length || 0;
              const total = (leads || []).length || 1;
              const pct = (count / total * 100).toFixed(1);
              return (
                <div key={stage.key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 100, fontSize: 13, fontWeight: 600, color: stage.color, textAlign: "right" }}>{stage.label}</span>
                  <div style={{ flex: 1, background: "#f3f4f6", borderRadius: 6, height: 28, position: "relative", overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, background: stage.color, height: "100%", borderRadius: 6, minWidth: count ? 2 : 0, transition: "width .5s" }} />
                    <span style={{ position: "absolute", right: 8, top: 4, fontSize: 12, fontWeight: 600 }}>{count} ({pct}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Conversion rates table */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}><Target size={18} /> Tỷ lệ chuyển đổi theo Sale</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Sale</th>
                  <th style={thStyle}>Tổng Lead</th>
                  <th style={thStyle}>Chốt</th>
                  <th style={thStyle}>Tỷ lệ chuyển đổi</th>
                  <th style={thStyle}>Thời gian phản hồi TB</th>
                </tr>
              </thead>
              <tbody>
                {(analytics.agents || []).sort((a, b) => b.conversionRate - a.conversionRate).map((a, i) => (
                  <tr key={a.name} style={{ background: i % 2 ? "#f9fafb" : "#fff" }}>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{a.name}</td>
                    <td style={tdStyle}>{a.totalLeads}</td>
                    <td style={tdStyle}>{a.closed}</td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, background: "#f3f4f6", borderRadius: 4, height: 8, maxWidth: 100 }}>
                          <div style={{ width: `${Math.min(a.conversionRate, 100)}%`, background: a.conversionRate >= 20 ? "#10b981" : a.conversionRate >= 10 ? "#f59e0b" : "#ef4444", height: "100%", borderRadius: 4 }} />
                        </div>
                        <span style={{ fontWeight: 700, color: a.conversionRate >= 20 ? "#059669" : a.conversionRate >= 10 ? "#d97706" : "#dc2626" }}>{a.conversionRate}%</span>
                      </div>
                    </td>
                    <td style={tdStyle}>{formatMs(a.avgResponseMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Avg time in stage */}
        {analytics.avgStageTime && Object.keys(analytics.avgStageTime).length > 0 && (
          <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}><Timer size={18} /> Thời gian trung bình mỗi giai đoạn</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {Object.entries(analytics.avgStageTime).map(([status, ms]) => (
                <div key={status} style={{
                  background: (STATUS_COLORS[status] || "#888") + "15", borderRadius: 10, padding: "12px 16px",
                  minWidth: 140, textAlign: "center",
                }}>
                  <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>{STATUS_LABELS[status] || status}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: STATUS_COLORS[status] || "#333" }}>{formatMs(ms)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  /* -- LEADERBOARD TAB -- */
  const renderLeaderboard = () => {
    const sorted = [...ranking].sort((a, b) => (b.closed || 0) - (a.closed || 0) || b.total - a.total);
    return isMobile ? (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sorted.map((s, i) => (
          <div key={s.name} style={{
            background: i < 3 ? `linear-gradient(135deg, ${i === 0 ? "#fef3c7" : i === 1 ? "#f3f4f6" : "#fef0e1"}, #fff)` : "#fff",
            borderRadius: 10, padding: 14, boxShadow: "0 1px 3px rgba(0,0,0,.06)", border: "1px solid #e5e7eb",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{i === 0 ? <Trophy size={16} style={{ color: "#FFD700", display: "inline", verticalAlign: "middle" }} /> : i === 1 ? <Trophy size={16} style={{ color: "#C0C0C0", display: "inline", verticalAlign: "middle" }} /> : i === 2 ? <Trophy size={16} style={{ color: "#CD7F32", display: "inline", verticalAlign: "middle" }} /> : `#${i+1}`} {s.name}</span>
              <span style={{ fontWeight: 700, fontSize: 18, color: "#059669" }}>{s.closed || 0} chốt</span>
            </div>
            <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#6b7280", alignItems: "center" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 2 }}><ClipboardList size={12} /> {s.total} lead</span>
              <span style={{ display: "flex", alignItems: "center", gap: 2 }}><Star size={12} /> {s.interested || 0}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 2 }}><CheckCircle size={12} /> {s.booked || 0}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 2 }}><BarChart3 size={12} /> {s.total ? ((s.closed || 0) / s.total * 100).toFixed(1) : 0}%</span>
            </div>
          </div>
        ))}
      </div>
    ) : (
      <div style={{ background: "#fff", borderRadius: 12, overflow: "auto", boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>#</th>
              <th style={thStyle}>Sale</th>
              <th style={thStyle}>Tổng Lead</th>
              <th style={thStyle}>Quan tâm</th>
              <th style={thStyle}>Hẹn xem</th>
              <th style={thStyle}>Giữ chỗ</th>
              <th style={thStyle}>Chốt</th>
              <th style={thStyle}>Tỷ lệ chốt</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s, i) => {
              const rate = s.total ? ((s.closed || 0) / s.total * 100).toFixed(1) : 0;
              return (
                <tr key={s.name} style={{
                  background: i === 0 ? "#fef9c3" : i === 1 ? "#f5f5f5" : i === 2 ? "#fef3e2" : i % 2 ? "#f9fafb" : "#fff",
                }}>
                  <td style={tdStyle}>{i === 0 ? <Trophy size={14} style={{ color: "#FFD700" }} /> : i === 1 ? <Trophy size={14} style={{ color: "#C0C0C0" }} /> : i === 2 ? <Trophy size={14} style={{ color: "#CD7F32" }} /> : i + 1}</td>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>{s.name}</td>
                  <td style={tdStyle}>{s.total}</td>
                  <td style={tdStyle}>{s.interested || 0}</td>
                  <td style={tdStyle}>{s.appointment || 0}</td>
                  <td style={tdStyle}>{s.booked || 0}</td>
                  <td style={{ ...tdStyle, fontWeight: 700, color: "#059669" }}>{s.closed || 0}</td>
                  <td style={tdStyle}>
                    <span style={{
                      fontWeight: 700, padding: "2px 8px", borderRadius: 8,
                      background: rate >= 20 ? "#dcfce7" : rate >= 10 ? "#fef3c7" : "#fee2e2",
                      color: rate >= 20 ? "#059669" : rate >= 10 ? "#d97706" : "#dc2626",
                    }}>{rate}%</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #e5e7eb", marginBottom: 16, background: "#fff", borderRadius: "12px 12px 0 0", paddingLeft: 8 }}>
        <button onClick={() => setTab("kanban")} style={tabBtnStyle(tab === "kanban")}><ClipboardList size={14} style={{ display: "inline", verticalAlign: "middle" }} /> Pipeline</button>
        <button onClick={() => setTab("analytics")} style={tabBtnStyle(tab === "analytics")}><BarChart3 size={14} style={{ display: "inline", verticalAlign: "middle" }} /> Phân tích</button>
        <button onClick={() => setTab("leaderboard")} style={tabBtnStyle(tab === "leaderboard")}><Trophy size={14} style={{ display: "inline", verticalAlign: "middle" }} /> Bảng xếp hạng</button>
      </div>
      {tab === "kanban" && renderKanban()}
      {tab === "analytics" && renderAnalytics()}
      {tab === "leaderboard" && renderLeaderboard()}
    </div>
  );
}

/* ===== Profile Page ===== */
/* === Image Lightbox === */
function ImageLightbox({ src, onClose }) {
  if (!src) return null;
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", zIndex: 99999,
      display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
    }}>
      <img src={src} alt="" style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: 12, objectFit: "contain" }} onClick={e => e.stopPropagation()} />
      <button onClick={onClose} style={{
        position: "absolute", top: 20, right: 20, background: "rgba(255,255,255,.2)",
        border: "none", color: "#fff", fontSize: 24, cursor: "pointer", borderRadius: "50%",
        width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center",
      }}><X size={24} /></button>
    </div>
  );
}

/* === Avatar Crop Modal === */
function AvatarCropModal({ imageSrc, onConfirm, onClose }) {
  const canvasRef = useRef(null);
  const cropRef = useRef(null);
  const imgRef = useRef(null);
  const dragRef = useRef({ active: false, lx: 0, ly: 0 });
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const [ready, setReady] = useState(false);
  const [baseScale, setBaseScale] = useState(1);
  const BOX = 260;
  const OUT = 400;

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const bs = Math.max(BOX / img.naturalWidth, BOX / img.naturalHeight);
      setBaseScale(bs);
      setView({ scale: bs, x: (BOX - img.naturalWidth * bs) / 2, y: (BOX - img.naturalHeight * bs) / 2 });
      setReady(true);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  const gp = (e) => e.touches ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };
  const onDown = (e) => { e.preventDefault(); const p = gp(e); dragRef.current = { active: true, lx: p.x, ly: p.y }; };
  const onMove = (e) => {
    if (!dragRef.current.active) return;
    e.preventDefault();
    const p = gp(e);
    const dx = p.x - dragRef.current.lx, dy = p.y - dragRef.current.ly;
    dragRef.current.lx = p.x; dragRef.current.ly = p.y;
    setView(v => ({ ...v, x: v.x + dx, y: v.y + dy }));
  };
  const onUp = () => { dragRef.current.active = false; };

  useEffect(() => {
    const el = cropRef.current;
    if (!el) return;
    const wh = (e) => {
      e.preventDefault();
      setView(v => {
        const d = e.deltaY > 0 ? 0.95 : 1.05;
        const ns = Math.max(baseScale * 0.5, Math.min(baseScale * 5, v.scale * d));
        const cx = BOX / 2, cy = BOX / 2, r = ns / v.scale;
        return { scale: ns, x: cx - (cx - v.x) * r, y: cy - (cy - v.y) * r };
      });
    };
    el.addEventListener("wheel", wh, { passive: false });
    return () => el.removeEventListener("wheel", wh);
  }, [baseScale]);

  const handleZoom = (val) => {
    const ns = baseScale * val / 100;
    setView(v => {
      const cx = BOX / 2, cy = BOX / 2, r = ns / v.scale;
      return { scale: ns, x: cx - (cx - v.x) * r, y: cy - (cy - v.y) * r };
    });
  };

  const handleConfirm = () => {
    const img = imgRef.current;
    if (!img) return;
    const canvas = canvasRef.current;
    canvas.width = OUT; canvas.height = OUT;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, OUT, OUT);
    const sc = OUT / BOX;
    ctx.drawImage(img, view.x * sc, view.y * sc, img.naturalWidth * view.scale * sc, img.naturalHeight * view.scale * sc);
    onConfirm(canvas.toDataURL("image/jpeg", 0.92));
  };

  const sliderVal = baseScale > 0 ? Math.round(view.scale / baseScale * 100) : 100;

  return (
    <Modal onClose={onClose} title="Cắt ảnh đại diện">
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 12px" }}>Kéo để di chuyển • Cuộn chuột để phóng to/thu nhỏ</p>
        <div
          ref={cropRef}
          style={{
            width: BOX, height: BOX, margin: "0 auto", borderRadius: "50%",
            overflow: "hidden", cursor: "grab", border: "3px solid #e88a2e",
            position: "relative", background: "#f3f4f6", touchAction: "none",
          }}
          onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
          onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}
        >
          {ready && <img src={imageSrc} alt="" draggable={false} style={{
            position: "absolute", left: view.x, top: view.y,
            width: imgRef.current.naturalWidth * view.scale,
            height: imgRef.current.naturalHeight * view.scale,
            pointerEvents: "none", userSelect: "none",
          }} />}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", margin: "12px 0" }}>
          <span style={{ fontSize: 14, display: "flex", alignItems: "center" }}><Minus size={16} /></span>
          <input type="range" min="50" max="300" value={sliderVal}
            onChange={(e) => handleZoom(Number(e.target.value))}
            style={{ width: 160, accentColor: "#e88a2e" }} />
          <span style={{ fontSize: 14, display: "flex", alignItems: "center" }}><Plus size={16} /></span>
          <span style={{ fontSize: 11, color: "#6b7280", minWidth: 36 }}>{sliderVal}%</span>
        </div>
        <canvas ref={canvasRef} style={{ display: "none" }} />
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button onClick={handleConfirm} style={{ ...btnPrimary, flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}><Check size={14} /> Xác nhận</button>
          <button onClick={onClose} style={{ ...btnSecondary, flex: 1 }}>Hủy</button>
        </div>
      </div>
    </Modal>
  );
}

function ProfilePage({ user, updateUser }) {
  const isMobile = useIsMobile();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [draft, setDraft] = useState({ avatarUrl: "", email: "", phone: "", telegramId: "" });
  const [cropSrc, setCropSrc] = useState(null);
  const [showLightbox, setShowLightbox] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const avatarFileRef = useRef(null);

  // Password change
  const [showPwdSection, setShowPwdSection] = useState(false);
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [pwdMsg, setPwdMsg] = useState("");
  const [pwdError, setPwdError] = useState("");
  const [changingPwd, setChangingPwd] = useState(false);

  const pwdValid = {
    length: newPwd.length >= 8,
    upper: /[A-Z]/.test(newPwd),
    lower: /[a-z]/.test(newPwd),
    digit: /\d/.test(newPwd),
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPwd),
  };
  const allPwdValid = Object.values(pwdValid).every(Boolean);

  useEffect(() => {
    (async () => {
      try {
        const r = await apiFetch(`${API}/profile`);
        const data = await r.json();
        setProfile(data);
        setDraft({ avatarUrl: data.avatarUrl || "", email: data.email || "", phone: data.phone || "", telegramId: data.telegramId || "" });
      } catch { }
      setLoading(false);
    })();
  }, []);

  const handleAvatarFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) { showToast("Ảnh tối đa 5MB", "warning"); return; }
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true); setMsg("");
    try {
      const r = await apiFetch(`${API}/profile`, { method: "PUT", body: JSON.stringify(draft) });
      const data = await r.json();
      if (r.ok) {
        setProfile(data);
        setMsg("[OK] Đã cập nhật hồ sơ");
        setTimeout(() => setMsg(""), 3000);
      } else {
        setMsg("[ERR] Lỗi: " + (data.error || "Không thể cập nhật"));
      }
    } catch (e) {
      setMsg("[ERR] Lỗi kết nối: " + e.message);
    }
    setSaving(false);
  };

  const handleChangePwd = async () => {
    setPwdError(""); setPwdMsg("");
    if (!allPwdValid) { setPwdError("Mật khẩu chưa đạt yêu cầu"); return; }
    if (newPwd !== confirmPwd) { setPwdError("Mật khẩu xác nhận không khớp"); return; }
    setChangingPwd(true);
    try {
      const r = await apiFetch(`${API}/change-password`, {
        method: "PUT",
        body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd }),
      });
      const data = await r.json();
      if (!r.ok) { setPwdError(data.error); return; }
      setPwdMsg("[OK] Đổi mật khẩu thành công!");
      setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
      if (data.token && data.user) updateUser(data.user, data.token);
      setTimeout(() => setPwdMsg(""), 3000);
    } catch {
      setPwdError("Lỗi kết nối server");
    } finally {
      setChangingPwd(false);
    }
  };

  const PwdRule = ({ ok, text }) => (
    <div style={{ fontSize: 12, color: ok ? "#16a34a" : "#9ca3af", display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
      <span>{ok ? <Check size={14} style={{ color: "#16a34a" }} /> : <span style={{ width: 14, height: 14, display: "inline-block", borderRadius: 3, border: "1px solid #d1d5db" }} />}</span> {text}
    </div>
  );

  if (loading) return <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>Đang tải...</div>;

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      {/* Avatar & Name Header */}
      <div style={{
        background: "#fff", borderRadius: 16, padding: 24, marginBottom: 16,
        boxShadow: "0 1px 3px rgba(0,0,0,.08)", textAlign: "center",
      }}>
        <div
          onClick={() => draft.avatarUrl && setShowLightbox(true)}
          style={{
            width: 100, height: 100, borderRadius: "50%", margin: "0 auto 12px",
            background: draft.avatarUrl ? `url(${draft.avatarUrl}) center/cover` : "linear-gradient(135deg, #e88a2e, #d97706)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 36, color: "#fff", border: "3px solid #e5e7eb",
            cursor: draft.avatarUrl ? "pointer" : "default", transition: "border-color .2s",
          }}
          onMouseEnter={e => { if (draft.avatarUrl) e.currentTarget.style.borderColor = "#e88a2e"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "#e5e7eb"; }}
          title={draft.avatarUrl ? "Bấm để xem ảnh lớn" : ""}
        >
          {!draft.avatarUrl && (profile?.displayName || user?.displayName || "?")[0]?.toUpperCase()}
        </div>
        <h3 style={{ margin: "0 0 4px", fontSize: 20 }}>{profile?.displayName || user?.displayName}</h3>
        {(() => { const r = profile?.role || user?.role; return (
          <span style={{
            padding: "2px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600,
            background: r === "admin" ? "#fef2f2" : "#f0faf1",
            color: r === "admin" ? "#dc2626" : "#1a3c20",
          }}>{r === "admin" ? "Admin" : "Sale"}</span>
        ); })()}
        <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 8 }}>@{profile?.username || user?.username}</div>
      </div>
      {showLightbox && draft.avatarUrl && <ImageLightbox src={draft.avatarUrl} onClose={() => setShowLightbox(false)} />}

      {/* Profile Info */}
      <div style={{
        background: "#fff", borderRadius: 16, padding: isMobile ? 16 : 24, marginBottom: 16,
        boxShadow: "0 1px 3px rgba(0,0,0,.08)",
      }}>
        <h4 style={{ margin: "0 0 16px", fontSize: 15, color: "#374151", display: "flex", alignItems: "center", gap: 6 }}><ClipboardList size={16} /> Thông tin cá nhân</h4>
        {msg && <div style={{ background: msg.startsWith("[OK]") ? "#f0fdf4" : "#fef2f2", color: msg.startsWith("[OK]") ? "#16a34a" : "#dc2626", padding: "8px 12px", borderRadius: 8, fontSize: 13, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>{msg.startsWith("[OK]") ? <Check size={14} /> : <X size={14} />}{msg.replace(/^\[(OK|ERR)\] /, "")}</div>}

        <label style={{ ...labelStyle, marginTop: 0 }}>Ảnh đại diện</label>
        {draft.avatarUrl ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <div
              onClick={() => setShowLightbox(true)}
              style={{
                width: 64, height: 64, borderRadius: "50%", flexShrink: 0, cursor: "pointer",
                background: `url(${draft.avatarUrl}) center/cover`, border: "3px solid #e5e7eb",
                transition: "border-color .2s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#e88a2e"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#e5e7eb"; }}
              title="Bấm để xem ảnh lớn"
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{
                display: "inline-flex", alignItems: "center", gap: 4, padding: "6px 12px",
                background: "#f0faf1", color: "#1a3c20", borderRadius: 8, cursor: "pointer",
                fontSize: 12, fontWeight: 600, border: "1px solid #c5d9c8",
              }}>
                <Camera size={14} /> Đổi ảnh
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleAvatarFile(e.target.files?.[0])} />
              </label>
              <button type="button" onClick={() => setDraft(d => ({ ...d, avatarUrl: "" }))} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 12, textAlign: "left", padding: "2px 0", display: "flex", alignItems: "center", gap: 2 }}><X size={12} /> Xóa ảnh</button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => avatarFileRef.current?.click()}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleAvatarFile(e.dataTransfer.files?.[0]); }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            style={{
              border: `2px dashed ${dragOver ? "#e88a2e" : "#d1d5db"}`, borderRadius: 12,
              padding: "20px 16px", textAlign: "center", cursor: "pointer", marginBottom: 8,
              transition: "all .2s", background: dragOver ? "#fef6ee" : "#fafafa",
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 4, display: "flex", justifyContent: "center" }}><Camera size={32} color="#9ca3af" /></div>
            <div style={{ fontSize: 13, color: "#6b7280", fontWeight: 500 }}>Kéo thả ảnh vào đây hoặc <span style={{ color: "#e88a2e", fontWeight: 600 }}>bấm để chọn</span></div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>PNG, JPG, WEBP • Tối đa 5MB</div>
            <input ref={avatarFileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleAvatarFile(e.target.files?.[0])} />
          </div>
        )}
        {cropSrc && <AvatarCropModal imageSrc={cropSrc} onConfirm={(b64) => { setDraft(d => ({ ...d, avatarUrl: b64 })); setCropSrc(null); }} onClose={() => setCropSrc(null)} />}

        <label style={labelStyle}>Email</label>
        <input style={inputStyle} type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} placeholder="email@example.com" />

        <label style={labelStyle}>Số điện thoại</label>
        <input style={inputStyle} value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} placeholder="0909 xxx xxx" />

        <label style={labelStyle}>Telegram ID</label>
        <input style={inputStyle} value={draft.telegramId} onChange={(e) => setDraft({ ...draft, telegramId: e.target.value })} placeholder="123456789" />

        <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, width: "100%", marginTop: 8 }}>
          {saving ? "Đang lưu..." : <><Save size={14} /> Cập nhật thông tin</>}
        </button>
      </div>

      {/* Change Password */}
      <div style={{
        background: "#fff", borderRadius: 16, padding: isMobile ? 16 : 24,
        boxShadow: "0 1px 3px rgba(0,0,0,.08)",
      }}>
        <div
          onClick={() => setShowPwdSection(!showPwdSection)}
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
        >
          <h4 style={{ margin: 0, fontSize: 15, color: "#374151", display: "flex", alignItems: "center", gap: 6 }}><Key size={16} /> Đổi mật khẩu</h4>
          <span style={{ fontSize: 12, color: "#6b7280", display: "flex", alignItems: "center", gap: 2 }}>{showPwdSection ? <><ChevronDown size={14} /> Thu gọn</> : <><ChevronRight size={14} /> Mở rộng</>}</span>
        </div>
        {showPwdSection && (
          <div style={{ marginTop: 16 }}>
            {pwdMsg && <div style={{ background: pwdMsg.startsWith("[OK]") ? "#f0fdf4" : "#fef2f2", color: pwdMsg.startsWith("[OK]") ? "#16a34a" : "#dc2626", padding: "8px 12px", borderRadius: 8, fontSize: 13, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>{pwdMsg.startsWith("[OK]") ? <Check size={14} /> : <X size={14} />}{pwdMsg.replace(/^\[(OK|ERR)\] /, "")}</div>}
            {pwdError && <div style={{ background: "#fef2f2", color: "#dc2626", padding: "8px 12px", borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{pwdError}</div>}

            <label style={{ ...labelStyle, marginTop: 0 }}>Mật khẩu hiện tại</label>
            <div style={{ position: "relative" }}>
              <input style={{ ...inputStyle, paddingRight: 40 }} type={showCurrentPwd ? "text" : "password"} value={currentPwd}
                onChange={(e) => setCurrentPwd(e.target.value)} placeholder="Nhập mật khẩu hiện tại" />
              <button type="button" onClick={() => setShowCurrentPwd(!showCurrentPwd)} style={{
                position: "absolute", right: 8, top: 8, background: "none", border: "none",
                cursor: "pointer", fontSize: 16, color: "#6b7280", padding: 2,
              }}>{showCurrentPwd ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            </div>

            <label style={labelStyle}>Mật khẩu mới</label>
            <div style={{ position: "relative" }}>
              <input style={{ ...inputStyle, paddingRight: 40 }} type={showNewPwd ? "text" : "password"} value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)} placeholder="Nhập mật khẩu mới" />
              <button type="button" onClick={() => setShowNewPwd(!showNewPwd)} style={{
                position: "absolute", right: 8, top: 8, background: "none", border: "none",
                cursor: "pointer", fontSize: 16, color: "#6b7280", padding: 2,
              }}>{showNewPwd ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            </div>

            <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 12px", marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Yêu cầu mật khẩu:</div>
              <PwdRule ok={pwdValid.length} text="Ít nhất 8 ký tự" />
              <PwdRule ok={pwdValid.upper} text="Ít nhất 1 chữ hoa (A-Z)" />
              <PwdRule ok={pwdValid.lower} text="Ít nhất 1 chữ thường (a-z)" />
              <PwdRule ok={pwdValid.digit} text="Ít nhất 1 số (0-9)" />
              <PwdRule ok={pwdValid.special} text="Ít nhất 1 ký tự đặc biệt (!@#$%...)" />
            </div>

            <label style={labelStyle}>Xác nhận mật khẩu mới</label>
            <div style={{ position: "relative" }}>
              <input style={{ ...inputStyle, paddingRight: 40 }} type={showConfirmPwd ? "text" : "password"} value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)} placeholder="Nhập lại mật khẩu mới" />
              <button type="button" onClick={() => setShowConfirmPwd(!showConfirmPwd)} style={{
                position: "absolute", right: 8, top: 8, background: "none", border: "none",
                cursor: "pointer", fontSize: 16, color: "#6b7280", padding: 2,
              }}>{showConfirmPwd ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            </div>
            {confirmPwd && newPwd !== confirmPwd && (
              <div style={{ fontSize: 12, color: "#dc2626", marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}><X size={14} /> Mật khẩu xác nhận không khớp</div>
            )}

            <button onClick={handleChangePwd} disabled={changingPwd || !allPwdValid || newPwd !== confirmPwd || !currentPwd} style={{
              ...btnPrimary, width: "100%", marginTop: 8,
              opacity: (changingPwd || !allPwdValid || newPwd !== confirmPwd || !currentPwd) ? 0.6 : 1,
            }}>
              {changingPwd ? "Đang xử lý..." : <><Lock size={14} /> Đổi mật khẩu</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function UsersPage({ projects, leads }) {
  const isMobile = useIsMobile();
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [draft, setDraft] = useState({ username: "", password: "", displayName: "", role: "sale", telegramId: "", projectIds: [], avatarUrl: "", email: "", phone: "" });
  const [showDraftPwd, setShowDraftPwd] = useState(false);
  const [error, setError] = useState("");
  const [projectSearch, setProjectSearch] = useState("");
  const [autoCreateMsg, setAutoCreateMsg] = useState("");
  const [autoCreating, setAutoCreating] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [savingBot, setSavingBot] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(null);
  const [profileDraft, setProfileDraft] = useState({ avatarUrl: "", email: "", phone: "", telegramId: "" });
  const [userCropSrc, setUserCropSrc] = useState(null);
  const [userCropTarget, setUserCropTarget] = useState(null); // 'draft' or 'profile'
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [userDragOver, setUserDragOver] = useState(false);
  const userAvatarFileRef = useRef(null);
  const profileAvatarFileRef = useRef(null);

  // Telegram Bots
  const [bots, setBots] = useState([]);
  const [showBotForm, setShowBotForm] = useState(false);
  const [editingBot, setEditingBot] = useState(null);
  const [botDraft, setBotDraft] = useState({ name: "", token: "" });
  const [botError, setBotError] = useState("");

  const loadUsers = async () => {
    try {
      const r = await apiFetch(`${API}/users`);
      setUsers(await r.json());
    } catch (e) { console.error(e); }
  };

  const loadBots = async () => {
    try {
      const r = await apiFetch(`${API}/telegram-bots`);
      setBots(await r.json());
    } catch (e) { console.error(e); }
  };

  useEffect(() => { loadUsers(); loadBots(); }, []);

  const openNew = () => {
    setEditingUser(null);
    setDraft({ username: "", password: "", displayName: "", role: "sale", telegramId: "", projectIds: [], avatarUrl: "", email: "", phone: "" });
    setError("");
    setProjectSearch("");
    setShowDraftPwd(false);
    setShowForm(true);
  };

  const openEdit = (u) => {
    setEditingUser(u);
    setDraft({ username: u.username, password: "", displayName: u.displayName, role: u.role, telegramId: u.telegramId || "", projectIds: u.projectIds || [], avatarUrl: u.avatarUrl || "", email: u.email || "", phone: u.phone || "" });
    setError("");
    setProjectSearch("");
    setShowDraftPwd(false);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (savingUser) return;
    setError("");
    setSavingUser(true);
    try {
      if (editingUser) {
        const body = { displayName: draft.displayName, role: draft.role, telegramId: draft.telegramId, projectIds: draft.projectIds, avatarUrl: draft.avatarUrl, email: draft.email, phone: draft.phone };
        if (draft.password) body.password = draft.password;
        const r = await apiFetch(`${API}/users/${editingUser.id}`, { method: "PUT", body: JSON.stringify(body) });
        if (!r.ok) { const d = await r.json(); setError(d.error); return; }
        setUsers(await r.json());
      } else {
        if (!draft.username || !draft.password) { setError("Username và mật khẩu bắt buộc"); return; }
        const r = await apiFetch(`${API}/users`, {
          method: "POST",
          body: JSON.stringify(draft),
        });
        if (!r.ok) { const d = await r.json(); setError(d.error); return; }
        setUsers(await r.json());
      }
      setShowForm(false);
    } catch (e) {
      setError(e.message);
    }
    setSavingUser(false);
  };

  const handleDelete = async (id) => {
    if (!(await showConfirm("Xóa tài khoản này?"))) return;
    try {
      const r = await apiFetch(`${API}/users/${id}`, { method: "DELETE" });
      if (!r.ok) { const d = await r.json(); showToast(d.error, "error"); return; }
      setUsers(await r.json());
    } catch (e) { console.error(e); }
  };

  const handleAutoCreate = async () => {
    if (!(await showConfirm("Tự động tạo tài khoản cho các Sale có tên trong dữ liệu lead?\n\nMật khẩu mặc định: tên + 123 (VD: thao123)\nSale sẽ phải đổi mật khẩu khi đăng nhập lần đầu."))) return;
    setAutoCreating(true); setAutoCreateMsg("");
    try {
      const r = await apiFetch(`${API}/users/auto-create-sales`, { method: "POST" });
      const data = await r.json();
      if (r.ok) {
        setUsers(data.users);
        if (data.created > 0) {
          const list = data.createdList.map(c => `• ${c.displayName} → @${c.username} (MK: ${c.defaultPassword})`).join("\n");
          setAutoCreateMsg(`[OK] Đã tạo ${data.created} tài khoản:\n${list}`);
        } else {
          setAutoCreateMsg("[INFO] Không có sale mới cần tạo tài khoản.");
        }
      } else {
        setAutoCreateMsg("[ERR] Lỗi: " + (data.error || "Unknown"));
      }
    } catch (e) { setAutoCreateMsg("[ERR] " + e.message); }
    setAutoCreating(false);
  };

  const openProfile = (u) => {
    setShowProfileModal(u);
    setProfileDraft({ avatarUrl: u.avatarUrl || "", email: u.email || "", phone: u.phone || "", telegramId: u.telegramId || "" });
  };

  const handleUserAvatarFile = (file, target) => {
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) { showToast("Ảnh tối đa 5MB", "warning"); return; }
    const reader = new FileReader();
    reader.onload = () => { setUserCropSrc(reader.result); setUserCropTarget(target); };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    if (!showProfileModal || savingProfile) return;
    setSavingProfile(true);
    try {
      const r = await apiFetch(`${API}/users/${showProfileModal.id}/profile`, {
        method: "PUT", body: JSON.stringify(profileDraft),
      });
      if (r.ok) { setUsers(await r.json()); setShowProfileModal(null); }
    } catch (e) { console.error(e); }
    setSavingProfile(false);
  };

  // Bot handlers
  const openNewBot = () => {
    setEditingBot(null);
    setBotDraft({ name: "", token: "" });
    setBotError("");
    setShowBotForm(true);
  };

  const openEditBot = (b) => {
    setEditingBot(b);
    setBotDraft({ name: b.name, token: b.token });
    setBotError("");
    setShowBotForm(true);
  };

  const handleSaveBot = async () => {
    if (savingBot) return;
    setBotError("");
    if (!botDraft.name || !botDraft.token) { setBotError("Tên bot và token bắt buộc"); return; }
    setSavingBot(true);
    try {
      const url = editingBot ? `${API}/telegram-bots/${editingBot.id}` : `${API}/telegram-bots`;
      const r = await apiFetch(url, {
        method: editingBot ? "PUT" : "POST",
        body: JSON.stringify(botDraft),
      });
      if (!r.ok) { const d = await r.json(); setBotError(d.error); setSavingBot(false); return; }
      setBots(await r.json());
      setShowBotForm(false);
    } catch (e) { setBotError(e.message); }
    setSavingBot(false);
  };

  const handleDeleteBot = async (id) => {
    if (!(await showConfirm("Xóa bot này?"))) return;
    try {
      const r = await apiFetch(`${API}/telegram-bots/${id}`, { method: "DELETE" });
      if (!r.ok) { const d = await r.json(); showToast(d.error, "error"); return; }
      setBots(await r.json());
    } catch (e) { console.error(e); }
  };

  const toggleBot = async (b) => {
    try {
      const r = await apiFetch(`${API}/telegram-bots/${b.id}`, {
        method: "PUT",
        body: JSON.stringify({ isActive: !b.isActive }),
      });
      if (r.ok) setBots(await r.json());
    } catch (e) { console.error(e); }
  };

  return (
    <>
      {/* ===== TÀI KHOẢN ===== */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: 14, color: "#6b7280", display: "flex", alignItems: "center", gap: 6 }}><Users size={14} /> {users.length} tài khoản</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={handleAutoCreate} disabled={autoCreating} style={{ ...btnSecondary, minHeight: 40, fontSize: 12 }}>
            {autoCreating ? <><Hourglass size={14} className="spin" /> Đang tạo...</> : <><Bot size={14} /> Tự tạo TK Sale</>}
          </button>
          <button onClick={openNew} style={{ ...btnPrimary, minHeight: 40 }}>+ Thêm tài khoản</button>
        </div>
      </div>
      {autoCreateMsg && (
        <div style={{
          background: autoCreateMsg.startsWith("[OK]") ? "#f0fdf4" : autoCreateMsg.startsWith("[INFO]") ? "#f0faf1" : "#fef2f2",
          color: autoCreateMsg.startsWith("[OK]") ? "#16a34a" : autoCreateMsg.startsWith("[INFO]") ? "#1a3c20" : "#dc2626",
          padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 12, whiteSpace: "pre-line",
        }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            {autoCreateMsg.startsWith("[OK]") ? <Check size={14} /> : autoCreateMsg.startsWith("[INFO]") ? <Info size={14} /> : <X size={14} />}
            {autoCreateMsg.replace(/^\[(OK|ERR|INFO)\] /, "")}
          </span>
          <button onClick={() => setAutoCreateMsg("")} style={{ marginLeft: 8, background: "none", border: "none", cursor: "pointer", fontSize: 14 }}><X size={14} /></button>
        </div>
      )}

      {isMobile ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 32 }}>
          {users.map((u) => (
            <div key={u.id} style={{ background: "#fff", borderRadius: 10, padding: 14, boxShadow: "0 1px 3px rgba(0,0,0,.06)", border: "1px solid #e5e7eb" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                    background: u.avatarUrl ? `url(${u.avatarUrl}) center/cover` : "linear-gradient(135deg, #e88a2e, #d97706)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, color: "#fff",
                  }}>
                    {!u.avatarUrl && (u.displayName || "?")[0]?.toUpperCase()}
                  </div>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{u.displayName || u.username}</span>
                    <span style={{
                      marginLeft: 8, padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                      background: u.role === "admin" ? "#fef2f2" : "#f0faf1",
                      color: u.role === "admin" ? "#dc2626" : "#1a3c20",
                    }}>{u.role === "admin" ? "Admin" : "Sale"}</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => openProfile(u)} title="Hồ sơ" style={{ ...btnSecondary, padding: "6px 12px", fontSize: 12, minHeight: 36 }}><IdCard size={14} /></button>
                  <button onClick={() => openEdit(u)} style={{ ...btnSecondary, padding: "6px 12px", fontSize: 12, minHeight: 36 }}><Pencil size={14} /></button>
                  <button onClick={() => handleDelete(u.id)} style={{ ...btnDanger, padding: "6px 12px", fontSize: 12, minHeight: 36 }}><Trash2 size={14} /></button>
                </div>
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", display: "flex", flexDirection: "column", gap: 3 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}><User size={12} /> @{u.username}</div>
                {u.email && <div style={{ display: "flex", alignItems: "center", gap: 4 }}><Mail size={12} /> {u.email}</div>}
                {u.phone && <div style={{ display: "flex", alignItems: "center", gap: 4 }}><Smartphone size={12} /> {u.phone}</div>}
                {u.telegramId && <div style={{ display: "flex", alignItems: "center", gap: 4 }}><Send size={12} /> {u.telegramId}</div>}
                {u.role !== "admin" && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 2 }}>
                    {(u.projectIds && u.projectIds.length > 0)
                      ? u.projectIds.map(pid => {
                          const p = projects.find(pr => pr.id === pid);
                          return p ? <span key={pid} style={{ background: "#f0fdf4", color: "#16a34a", padding: "1px 6px", borderRadius: 8, fontSize: 10, fontWeight: 600 }}>{p.name}</span> : null;
                        })
                      : <span style={{ color: "#9ca3af", fontSize: 11 }}>Chưa gán dự án</span>
                    }
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
      <div style={{ background: "#fff", borderRadius: 12, overflow: "auto", boxShadow: "0 1px 3px rgba(0,0,0,.08)", marginBottom: 32 }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>#</th>
              <th style={thStyle}>Username</th>
              <th style={thStyle}>Tên hiển thị</th>
              <th style={thStyle}>Email / SĐT</th>
              <th style={thStyle}>Dự án</th>
              <th style={thStyle}>Telegram ID</th>
              <th style={thStyle}>Quyền</th>
              <th style={thStyle}>Ngày tạo</th>
              <th style={thStyle}>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={u.id} style={{ background: i % 2 ? "#f9fafb" : "#fff" }}>
                <td style={tdStyle}>{i + 1}</td>
                <td style={{ ...tdStyle, fontWeight: 600 }}>{u.username}</td>
                <td style={tdStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                      background: u.avatarUrl ? `url(${u.avatarUrl}) center/cover` : "linear-gradient(135deg, #e88a2e, #d97706)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, color: "#fff",
                    }}>
                      {!u.avatarUrl && (u.displayName || "?")[0]?.toUpperCase()}
                    </div>
                    {u.displayName}
                  </div>
                </td>
                <td style={{ ...tdStyle, fontSize: 11 }}>
                  {u.email && <div style={{ display: "flex", alignItems: "center", gap: 4 }}><Mail size={11} /> {u.email}</div>}
                  {u.phone && <div style={{ display: "flex", alignItems: "center", gap: 4 }}><Smartphone size={11} /> {u.phone}</div>}
                  {!u.email && !u.phone && <span style={{ color: "#9ca3af" }}>—</span>}
                </td>
                <td style={tdStyle}>
                  {u.role === "admin" ? (
                    <span style={{ color: "#6b7280", fontSize: 11, fontStyle: "italic" }}>Tất cả</span>
                  ) : (u.projectIds && u.projectIds.length > 0) ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                      {u.projectIds.map(pid => {
                        const p = projects.find(pr => pr.id === pid);
                        return p ? <span key={pid} style={{ background: "#f0fdf4", color: "#16a34a", padding: "1px 6px", borderRadius: 8, fontSize: 10, fontWeight: 600, whiteSpace: "nowrap" }}>{p.name}</span> : null;
                      })}
                    </div>
                  ) : (
                    <span style={{ color: "#9ca3af", fontSize: 11 }}>Chưa gán</span>
                  )}
                </td>
                <td style={tdStyle}>
                  {u.telegramId
                    ? <span style={{ background: "#f0faf1", color: "#1a3c20", padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}><Send size={11} /> {u.telegramId}</span>
                    : <span style={{ color: "#9ca3af", fontSize: 11 }}>Chưa cập nhật</span>
                  }
                </td>
                <td style={tdStyle}>
                  <span style={{
                    padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                    background: u.role === "admin" ? "#fef2f2" : "#f0faf1",
                    color: u.role === "admin" ? "#dc2626" : "#1a3c20",
                  }}>
                    {u.role === "admin" ? "Admin" : "Sale"}
                  </span>
                </td>
                <td style={{ ...tdStyle, fontSize: 11 }}>{u.createdAt || "-"}</td>
                <td style={tdStyle}>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => openProfile(u)} title="Hồ sơ" style={{ ...btnSecondary, padding: "2px 8px", fontSize: 11 }}><IdCard size={12} /></button>
                    <button onClick={() => openEdit(u)} style={{ ...btnSecondary, padding: "2px 8px", fontSize: 11 }}><Pencil size={12} /></button>
                    <button onClick={() => handleDelete(u.id)} style={{ ...btnDanger, padding: "2px 8px", fontSize: 11 }}><Trash2 size={12} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      {/* ===== TELEGRAM BOT ===== */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: 14, color: "#6b7280", display: "flex", alignItems: "center", gap: 6 }}><Bot size={14} /> Telegram Bot ({bots.length})</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={async () => {
            try {
              const r = await apiFetch(`${API}/telegram-webhook/setup`, { method: "POST" });
              const d = await r.json();
              showToast(d.ok ? d.msg : d.error, d.ok ? "success" : "error");
            } catch (e) { showToast(e.message, "error"); }
          }} style={{ ...btnSecondary, fontSize: 12, padding: "8px 12px", minHeight: 40, display: "flex", alignItems: "center", gap: 4 }}><Link size={14} /> Webhook</button>
          <button onClick={openNewBot} style={{ ...btnPrimary, minHeight: 40 }}>+ Thêm Bot</button>
        </div>
      </div>

      {bots.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: 12, padding: 24, textAlign: "center", color: "#9ca3af", fontSize: 13, boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>Chưa có bot nào. Thêm bot để gửi thông báo qua Telegram.</div>
      ) : isMobile ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {bots.map((b) => (
            <div key={b.id} style={{ background: "#fff", borderRadius: 10, padding: 14, boxShadow: "0 1px 3px rgba(0,0,0,.06)", border: "1px solid #e5e7eb" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 4 }}><Bot size={14} /> {b.name}</span>
                <button onClick={() => toggleBot(b)} style={{
                  padding: "4px 12px", borderRadius: 12, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", minHeight: 32,
                  background: b.isActive ? "#f0fdf4" : "#fef2f2", color: b.isActive ? "#16a34a" : "#dc2626",
                }}>{b.isActive ? <><Check size={12} /> On</> : <><Ban size={12} /> Off</>}</button>
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace", marginBottom: 8, wordBreak: "break-all" }}>{b.token.slice(0, 12)}...{b.token.slice(-6)}</div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => openEditBot(b)} style={{ ...btnSecondary, flex: 1, padding: "8px", fontSize: 12, minHeight: 36, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}><Pencil size={12} /> Sửa</button>
                <button onClick={() => handleDeleteBot(b.id)} style={{ ...btnDanger, flex: 1, padding: "8px", fontSize: 12, minHeight: 36, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}><Trash2 size={12} /> Xóa</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
      <div style={{ background: "#fff", borderRadius: 12, overflow: "auto", boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>#</th>
                <th style={thStyle}>Tên Bot</th>
                <th style={thStyle}>Token</th>
                <th style={thStyle}>Trạng thái</th>
                <th style={thStyle}>Ngày tạo</th>
                <th style={thStyle}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {bots.map((b, i) => (
                <tr key={b.id} style={{ background: i % 2 ? "#f9fafb" : "#fff" }}>
                  <td style={tdStyle}>{i + 1}</td>
                  <td style={{ ...tdStyle, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}><Bot size={12} /> {b.name}</td>
                  <td style={{ ...tdStyle, fontSize: 11, fontFamily: "monospace", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {b.token.slice(0, 12)}...{b.token.slice(-6)}
                  </td>
                  <td style={tdStyle}>
                    <button onClick={() => toggleBot(b)} style={{
                      padding: "2px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer",
                      background: b.isActive ? "#f0fdf4" : "#fef2f2",
                      color: b.isActive ? "#16a34a" : "#dc2626",
                    }}>
                      {b.isActive ? <><Check size={11} /> Hoạt động</> : <><Ban size={11} /> Tắt</>}
                    </button>
                  </td>
                  <td style={{ ...tdStyle, fontSize: 11 }}>{b.createdAt || "-"}</td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={() => openEditBot(b)} style={{ ...btnSecondary, padding: "2px 8px", fontSize: 11 }}><Pencil size={11} /></button>
                      <button onClick={() => handleDeleteBot(b.id)} style={{ ...btnDanger, padding: "2px 8px", fontSize: 11 }}><Trash2 size={11} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
      </div>
      )}

      {/* Modal thêm/sửa tài khoản */}
      {showForm && (
        <Modal onClose={() => setShowForm(false)} title={editingUser ? "Sửa tài khoản" : "Thêm tài khoản"}>
          {error && <div style={{ background: "#fef2f2", color: "#dc2626", padding: "8px 12px", borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{error}</div>}
          <label style={labelStyle}>Username</label>
          <input style={inputStyle} value={draft.username} disabled={!!editingUser}
            onChange={(e) => setDraft({ ...draft, username: e.target.value })} placeholder="VD: sale01" />
          <label style={labelStyle}>Mật khẩu {editingUser && "(để trống nếu không đổi)"}</label>
          <div style={{ position: "relative" }}>
            <input style={{ ...inputStyle, paddingRight: 40 }} type={showDraftPwd ? "text" : "password"} value={draft.password}
              onChange={(e) => setDraft({ ...draft, password: e.target.value })} placeholder="••••••" />
            <button type="button" onClick={() => setShowDraftPwd(!showDraftPwd)} style={{
              position: "absolute", right: 8, top: 8, background: "none", border: "none",
              cursor: "pointer", fontSize: 16, color: "#6b7280", padding: 2,
            }}>{showDraftPwd ? <EyeOff size={16} /> : <Eye size={16} />}</button>
          </div>
          {!editingUser && (
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: -4, marginBottom: 8 }}>
              <Lightbulb size={12} style={{ display: "inline", verticalAlign: "middle" }} /> MK mặc định: tên (không dấu) + 123. VD: <strong>thao123</strong>
            </div>
          )}
          <label style={labelStyle}>Tên hiển thị</label>
          <input style={inputStyle} value={draft.displayName}
            onChange={(e) => setDraft({ ...draft, displayName: e.target.value })} placeholder="VD: Nguyễn Văn A" />
          <label style={labelStyle}>Email</label>
          <input style={inputStyle} type="email" value={draft.email}
            onChange={(e) => setDraft({ ...draft, email: e.target.value })} placeholder="email@example.com" />
          <label style={labelStyle}>Số điện thoại</label>
          <input style={inputStyle} value={draft.phone}
            onChange={(e) => setDraft({ ...draft, phone: e.target.value })} placeholder="0909 xxx xxx" />
          <label style={labelStyle}>Ảnh đại diện</label>
          {draft.avatarUrl ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <div onClick={() => setLightboxSrc(draft.avatarUrl)} style={{
                width: 48, height: 48, borderRadius: "50%", flexShrink: 0, cursor: "pointer",
                background: `url(${draft.avatarUrl}) center/cover`, border: "2px solid #e5e7eb",
              }} title="Xem ảnh lớn" />
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 10px", background: "#f0faf1", color: "#1a3c20", borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: 600, border: "1px solid #c5d9c8" }}>
                  <Camera size={12} /> Đổi ảnh
                  <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleUserAvatarFile(e.target.files?.[0], "draft")} />
                </label>
                <button type="button" onClick={() => setDraft(d => ({ ...d, avatarUrl: "" }))} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 11, textAlign: "left", padding: 0, display: "flex", alignItems: "center", gap: 2 }}><X size={11} /> Xóa</button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => userAvatarFileRef.current?.click()}
              onDrop={(e) => { e.preventDefault(); setUserDragOver(false); handleUserAvatarFile(e.dataTransfer.files?.[0], "draft"); }}
              onDragOver={(e) => { e.preventDefault(); setUserDragOver(true); }}
              onDragLeave={() => setUserDragOver(false)}
              style={{ border: `2px dashed ${userDragOver ? "#e88a2e" : "#d1d5db"}`, borderRadius: 10, padding: "14px 12px", textAlign: "center", cursor: "pointer", marginBottom: 8, background: userDragOver ? "#fef6ee" : "#fafafa" }}
            >
              <div style={{ fontSize: 24, marginBottom: 2 }}><Camera size={24} style={{ color: "#9ca3af" }} /></div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>Kéo thả hoặc <span style={{ color: "#e88a2e", fontWeight: 600 }}>bấm chọn ảnh</span></div>
              <input ref={userAvatarFileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleUserAvatarFile(e.target.files?.[0], "draft")} />
            </div>
          )}
          <label style={labelStyle}>Telegram ID</label>
          <input style={inputStyle} value={draft.telegramId}
            onChange={(e) => setDraft({ ...draft, telegramId: e.target.value })} placeholder="VD: 123456789" />
          <label style={labelStyle}>Quyền</label>
          <select value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })}
            style={{ ...inputStyle }}>
            <option value="sale">Sale</option>
            <option value="admin">Admin</option>
          </select>
          {draft.role === "sale" && (
            <>
              <label style={labelStyle}><Building size={14} style={{ display: "inline", verticalAlign: "middle" }} /> Dự án được phép truy cập</label>
              {projects.length > 5 && (
                <input
                  style={{ ...inputStyle, marginBottom: 6 }}
                  placeholder="Tìm dự án..."
                  value={projectSearch}
                  onChange={(e) => setProjectSearch(e.target.value)}
                />
              )}
              <div style={{
                border: "1px solid #d1d5db", borderRadius: 8, padding: 8,
                maxHeight: 180, overflowY: "auto", marginBottom: 8, background: "#fafafa"
              }}>
                {projects
                  .filter(p => !projectSearch || p.name.toLowerCase().includes(projectSearch.toLowerCase()))
                  .map(p => (
                    <label key={p.id} style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "4px 6px",
                      borderRadius: 6, cursor: "pointer", fontSize: 13,
                      background: draft.projectIds.includes(p.id) ? "#f0faf1" : "transparent",
                    }}>
                      <input
                        type="checkbox"
                        checked={draft.projectIds.includes(p.id)}
                        onChange={(e) => {
                          const ids = e.target.checked
                            ? [...draft.projectIds, p.id]
                            : draft.projectIds.filter(id => id !== p.id);
                          setDraft({ ...draft, projectIds: ids });
                        }}
                        style={{ accentColor: "#e88a2e" }}
                      />
                      <span>{p.name}</span>
                    </label>
                  ))
                }
                {projects.filter(p => !projectSearch || p.name.toLowerCase().includes(projectSearch.toLowerCase())).length === 0 && (
                  <div style={{ color: "#9ca3af", fontSize: 12, textAlign: "center", padding: 8 }}>Không tìm thấy dự án</div>
                )}
              </div>
              {draft.projectIds.length > 0 && (
                <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>
                  Đã chọn: {draft.projectIds.length} dự án
                  <button
                    onClick={() => setDraft({ ...draft, projectIds: [] })}
                    style={{ marginLeft: 8, background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 11, textDecoration: "underline" }}
                  >Bỏ chọn tất cả</button>
                </div>
              )}
            </>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button onClick={handleSave} disabled={savingUser} style={{ ...btnPrimary, flex: 1, opacity: savingUser ? 0.6 : 1 }}>{savingUser ? "Đang lưu..." : "Lưu"}</button>
            <button onClick={() => setShowForm(false)} disabled={savingUser} style={{ ...btnSecondary, flex: 1 }}>Hủy</button>
          </div>
        </Modal>
      )}

      {/* Modal thêm/sửa bot */}
      {showBotForm && (
        <Modal onClose={() => setShowBotForm(false)} title={editingBot ? "Sửa Bot Telegram" : "Thêm Bot Telegram"}>
          {botError && <div style={{ background: "#fef2f2", color: "#dc2626", padding: "8px 12px", borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{botError}</div>}
          <label style={labelStyle}>Tên Bot</label>
          <input style={inputStyle} value={botDraft.name}
            onChange={(e) => setBotDraft({ ...botDraft, name: e.target.value })} placeholder="VD: CRM Notification Bot" />
          <label style={labelStyle}>Bot Token</label>
          <input style={inputStyle} value={botDraft.token}
            onChange={(e) => setBotDraft({ ...botDraft, token: e.target.value })} placeholder="VD: 7123456789:AAH..." />
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button onClick={handleSaveBot} disabled={savingBot} style={{ ...btnPrimary, flex: 1, opacity: savingBot ? 0.6 : 1 }}>{savingBot ? "Đang lưu..." : "Lưu"}</button>
            <button onClick={() => setShowBotForm(false)} disabled={savingBot} style={{ ...btnSecondary, flex: 1 }}>Hủy</button>
          </div>
        </Modal>
      )}

      {/* Modal hồ sơ user - đầy đủ thông tin */}
      {showProfileModal && (() => {
        try {
        const u = showProfileModal;
        if (!u || typeof u !== "object") return null;
        const userProjects = (u.projectIds || []).map(pid => projects.find(p => p.id === pid)).filter(Boolean);
        let isOnline = false;
        let lastSeenText = "Chưa hoạt động";
        try {
          if (u.lastActive) {
            const lastActiveTime = new Date(u.lastActive).getTime();
            if (!isNaN(lastActiveTime)) {
              isOnline = (Date.now() - lastActiveTime) < 5 * 60 * 1000;
              const diff = Math.floor((Date.now() - lastActiveTime) / 60000);
              if (diff < 1) lastSeenText = "Vừa mới";
              else if (diff < 60) lastSeenText = `${diff} phút trước`;
              else if (diff < 1440) lastSeenText = `${Math.floor(diff / 60)} giờ trước`;
              else lastSeenText = `${Math.floor(diff / 1440)} ngày trước`;
            }
          }
        } catch {}
        const infoRow = (IconComp, label, value) => value ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid #f3f4f6" }}>
            <span style={{ width: 24, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", color: "#6b7280" }}>{typeof IconComp === "function" ? <IconComp size={16} /> : IconComp}</span>
            <span style={{ fontSize: 12, color: "#6b7280", minWidth: 80 }}>{label}</span>
            <span style={{ fontSize: 13, color: "#111827", fontWeight: 500, flex: 1, wordBreak: "break-word" }}>{value}</span>
          </div>
        ) : null;
        return (
          <Modal onClose={() => setShowProfileModal(null)} title={`Hồ sơ - ${u.displayName || "User"}`}>
            {/* Avatar + Header */}
            <div style={{ textAlign: "center", marginBottom: 16, position: "relative" }}>
              <div
                onClick={() => profileDraft.avatarUrl && setLightboxSrc(profileDraft.avatarUrl)}
                style={{
                  width: 90, height: 90, borderRadius: "50%", margin: "0 auto 8px",
                  background: profileDraft.avatarUrl ? `url(${profileDraft.avatarUrl}) center/cover` : "linear-gradient(135deg, #e88a2e, #d97706)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 32, color: "#fff", border: "3px solid #e5e7eb",
                  cursor: profileDraft.avatarUrl ? "pointer" : "default", position: "relative",
                }}
                title={profileDraft.avatarUrl ? "Bấm để xem ảnh lớn" : ""}
              >
                {!profileDraft.avatarUrl && (u.displayName || "?")[0]?.toUpperCase()}
                <div style={{
                  position: "absolute", bottom: 2, right: 2, width: 16, height: 16, borderRadius: "50%",
                  background: isOnline ? "#22c55e" : "#9ca3af", border: "2px solid #fff",
                }} />
              </div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>{u.displayName}</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 4 }}>
                <span style={{
                  padding: "2px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                  background: u.role === "admin" ? "#fef2f2" : "#f0faf1",
                  color: u.role === "admin" ? "#dc2626" : "#1a3c20",
                }}>{u.role === "admin" ? "Admin" : "Sale"}</span>
                <span style={{ fontSize: 11, color: isOnline ? "#22c55e" : "#9ca3af" }}>
                  {isOnline ? <><CircleDot size={10} style={{ color: "#22c55e" }} /> Online</> : <><CircleOff size={10} /> {lastSeenText}</>}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>@{u.username}</div>
            </div>

            {/* Thông tin chi tiết - Chỉ đọc */}
            <div style={{ background: "#f9fafb", borderRadius: 12, padding: "4px 12px", marginBottom: 12 }}>
              {infoRow(Mail, "Email", u.email)}
              {infoRow(Smartphone, "SĐT", u.phone)}
              {infoRow(Send, "Telegram", u.telegramId)}
              {infoRow(Calendar, "Ngày tạo", u.createdAt ? new Date(u.createdAt).toLocaleDateString("vi-VN") : "")}
              {infoRow(Clock, "Hoạt động", lastSeenText)}
              {!u.email && !u.phone && !u.telegramId && (
                <div style={{ padding: "12px 0", color: "#9ca3af", fontSize: 12, textAlign: "center" }}>Chưa cập nhật thông tin liên hệ</div>
              )}
            </div>

            {/* Dự án */}
            {u.role !== "admin" && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}><Building size={14} /> Dự án được phân công</div>
                {userProjects.length > 0 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {userProjects.map(p => (
                      <span key={p.id} style={{ background: "#f0fdf4", color: "#16a34a", padding: "3px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600 }}>{p.name}</span>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: "#9ca3af", fontSize: 12 }}>Chưa gán dự án nào</div>
                )}
              </div>
            )}

            {/* Chỉnh sửa nhanh */}
            <details style={{ marginBottom: 8 }}>
              <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#374151", padding: "8px 0", userSelect: "none", display: "flex", alignItems: "center", gap: 4 }}><Pencil size={14} /> Chỉnh sửa thông tin</summary>
              <div style={{ marginTop: 8 }}>
                <label style={{ ...labelStyle, marginTop: 0 }}>Ảnh đại diện</label>
                {profileDraft.avatarUrl ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                    <div onClick={() => setLightboxSrc(profileDraft.avatarUrl)} style={{
                      width: 48, height: 48, borderRadius: "50%", flexShrink: 0, cursor: "pointer",
                      background: `url(${profileDraft.avatarUrl}) center/cover`, border: "2px solid #e5e7eb",
                    }} title="Xem ảnh lớn" />
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <label style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 10px", background: "#f0faf1", color: "#1a3c20", borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: 600, border: "1px solid #c5d9c8" }}>
                        <Camera size={12} /> Đổi ảnh
                        <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleUserAvatarFile(e.target.files?.[0], "profile")} />
                      </label>
                      <button type="button" onClick={() => setProfileDraft(d => ({ ...d, avatarUrl: "" }))} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 11, textAlign: "left", padding: 0, display: "flex", alignItems: "center", gap: 2 }}><X size={11} /> Xóa</button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => profileAvatarFileRef.current?.click()}
                    onDrop={(e) => { e.preventDefault(); handleUserAvatarFile(e.dataTransfer.files?.[0], "profile"); }}
                    onDragOver={(e) => e.preventDefault()}
                    style={{ border: "2px dashed #d1d5db", borderRadius: 10, padding: "12px 10px", textAlign: "center", cursor: "pointer", marginBottom: 8, background: "#fafafa" }}
                  >
                    <div style={{ fontSize: 20, marginBottom: 2 }}><Camera size={20} style={{ color: "#9ca3af" }} /></div>
                    <div style={{ fontSize: 11, color: "#6b7280" }}>Kéo thả hoặc <span style={{ color: "#e88a2e", fontWeight: 600 }}>bấm chọn</span></div>
                    <input ref={profileAvatarFileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleUserAvatarFile(e.target.files?.[0], "profile")} />
                  </div>
                )}
                <label style={labelStyle}>Email</label>
                <input style={inputStyle} type="email" value={profileDraft.email} onChange={(e) => setProfileDraft({ ...profileDraft, email: e.target.value })} placeholder="email@example.com" />
                <label style={labelStyle}>Số điện thoại</label>
                <input style={inputStyle} value={profileDraft.phone} onChange={(e) => setProfileDraft({ ...profileDraft, phone: e.target.value })} placeholder="0909 xxx xxx" />
                <label style={labelStyle}>Telegram ID</label>
                <input style={inputStyle} value={profileDraft.telegramId} onChange={(e) => setProfileDraft({ ...profileDraft, telegramId: e.target.value })} placeholder="123456789" />
                <button onClick={handleSaveProfile} disabled={savingProfile} style={{ ...btnPrimary, width: "100%", marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: savingProfile ? 0.6 : 1 }}><Save size={14} /> {savingProfile ? "Đang lưu..." : "Lưu thông tin"}</button>
              </div>
            </details>
          </Modal>
        );
        } catch (err) {
          console.error("Profile modal error:", err);
          return (
            <Modal onClose={() => setShowProfileModal(null)} title="Hồ sơ">
              <div style={{ textAlign: "center", padding: 24, color: "#dc2626" }}>
                <AlertCircle size={32} style={{ marginBottom: 8, opacity: 0.6 }} />
                <div style={{ fontSize: 14, fontWeight: 600 }}>Không thể hiển thị hồ sơ</div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Đã xảy ra lỗi khi tải thông tin người dùng</div>
              </div>
            </Modal>
          );
        }
      })()}

      {userCropSrc && <AvatarCropModal imageSrc={userCropSrc} onConfirm={(b64) => {
        if (userCropTarget === "draft") setDraft(d => ({ ...d, avatarUrl: b64 }));
        else setProfileDraft(d => ({ ...d, avatarUrl: b64 }));
        setUserCropSrc(null);
      }} onClose={() => setUserCropSrc(null)} />}
      {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
    </>
  );
}

/* ===== Sheet Post Status Config ===== */
const SHEET_STATUS = {
  STOP: { label: "STOP", color: "#ef4444", bg: "#fee2e2" },
  READY: { label: "READY", color: "#f59e0b", bg: "#fef3c7" },
  POSTED: { label: "POSTED", color: "#10b981", bg: "#d1fae5" },
};

/* ===== Posts Page (Sheet Integration) ===== */
function PostsPage({ projects }) {
  const isMobile = useIsMobile();
  const [sheetPosts, setSheetPosts] = useState([]);
  const [sheetHeaders, setSheetHeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchText, setSearchText] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterProject, setFilterProject] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedPost, setSelectedPost] = useState(null);
  const [togglingRow, setTogglingRow] = useState(null);
  const [showAll, setShowAll] = useState(false);

  const loadSheetData = async () => {
    setLoading(true);
    setError("");
    try {
      const r = await apiFetch(`${API}/sheet/posts`);
      const data = await r.json();
      if (!r.ok) { setError(data.error || "Lỗi tải dữ liệu"); setLoading(false); return; }
      setSheetPosts(data.data || []);
      setSheetHeaders(data.headers || []);
    } catch (e) { setError("Không kết nối được server"); }
    setLoading(false);
  };

  useEffect(() => { loadSheetData(); }, []);

  const getCol = (post, ...names) => {
    for (const n of names) {
      if (post[n] !== undefined && post[n] !== "") return post[n];
    }
    return "";
  };

  const getStatus = (post) => String(getCol(post, "STATUS", "status", "Status") || "STOP").toUpperCase();
  const getProject = (post) => getCol(post, "CONTENT_PULL", "Dự Án", "DỰ ÁN", "Du An", "content_pull") || (post._sheetProject || "");
  const getTitle = (post) => getCol(post, "Chủ đề bài viết", "CHỦ ĐỀ BÀI VIẾT", "chu_de_bai_viet", "Title");
  const getSchedule = (post) => getCol(post, "LỊCH VIẾT", "LICH VIET", "Lịch viết", "lich_viet", "LỊCH VIỆT");
  const getNeed = (post) => getCol(post, "NHU CẦU", "Nhu cầu", "nhu_cau");
  const getStage = (post) => getCol(post, "GIAI ĐOẠN HÀNH TRÌNH USER", "Giai đoạn", "giai_doan");
  const getPurpose = (post) => getCol(post, "MỤC ĐÍCH CONCEPT", "MỤC ĐÍCH CONTENT", "Mục đích", "muc_dich");
  const getOffice = (post) => getCol(post, "VĂN PHONG", "VĂN PHÒNG", "Van phong", "van_phong");
  const getContent = (post) => getCol(post, "CONTENT_FULL", "content", "Content", "Nội dung", "Gợi ý hướng khai triển nội dung", "goi_y");
  const getPage = (post) => getCol(post, "Page Kita group", "Page", "page");
  const getId = (post) => getCol(post, "ID", "id", "STT") || post._row;

  const parseScheduleDate = (post) => {
    const val = getSchedule(post);
    if (!val) return null;
    const str = String(val);
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d;
    // Try dd/MM/yyyy HH:mm:ss
    const m = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s*(\d{1,2}):(\d{1,2}):?(\d{1,2})?/);
    if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4]), Number(m[5]), Number(m[6] || 0));
    const m2 = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m2) return new Date(Number(m2[3]), Number(m2[2]) - 1, Number(m2[1]));
    return null;
  };

  const formatDateTime = (post) => {
    const d = parseScheduleDate(post);
    if (!d) return "-";
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  };

  const isToday = (post) => {
    const d = parseScheduleDate(post);
    if (!d) return false;
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  };

  const filtered = useMemo(() => {
    let list = sheetPosts;
    // Default: show only today's posts unless "showAll" is toggled
    if (!showAll) list = list.filter(p => isToday(p));
    if (filterStatus !== "all") list = list.filter(p => getStatus(p) === filterStatus);
    if (filterProject !== "all") {
      list = list.filter(p => (p._sheetProject || "") === filterProject);
    }
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      list = list.filter(p =>
        (getTitle(p) || "").toLowerCase().includes(q) ||
        (getProject(p) || "").toLowerCase().includes(q) ||
        (getContent(p) || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [sheetPosts, filterStatus, filterProject, searchText, showAll]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const uniqueProjects = useMemo(() => {
    const set = new Set();
    sheetPosts.forEach(p => {
      if (p._sheetProject) set.add(p._sheetProject);
    });
    return [...set].sort();
  }, [sheetPosts]);

  const statStop = sheetPosts.filter(p => getStatus(p) === "STOP").length;
  const statReady = sheetPosts.filter(p => getStatus(p) === "READY").length;
  const statPosted = sheetPosts.filter(p => getStatus(p) === "POSTED").length;

  const handleToggleStatus = async (post) => {
    const current = getStatus(post);
    if (current === "POSTED") return;
    const next = current === "STOP" ? "READY" : "STOP";
    setTogglingRow(post._row);
    try {
      const r = await apiFetch(`${API}/sheet/posts/status`, {
        method: "POST",
        body: JSON.stringify({ row: post._row, status: next, configId: post._configId }),
      });
      if (r.ok) {
        setSheetPosts(prev => prev.map(p =>
          p._row === post._row ? { ...p, STATUS: next, status: next, Status: next } : p
        ));
      } else {
        const err = await r.json().catch(() => ({}));
        showToast(err.error || "Lỗi cập nhật trạng thái", "error");
      }
    } catch (e) { showToast("Lỗi kết nối", "error"); }
    setTogglingRow(null);
  };

  if (loading) return <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>Đang tải dữ liệu từ Google Sheet...</div>;

  if (error) return (
    <div style={{ textAlign: "center", padding: 40 }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}><BarChart3 size={48} style={{ color: "#9ca3af" }} /></div>
      <div style={{ color: "#ef4444", fontWeight: 600, marginBottom: 8 }}>{error}</div>
      <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 16 }}>
        Vui lòng vào <strong><Settings size={12} style={{ display: "inline", verticalAlign: "middle" }} /> Cấu hình Sheet</strong> để thiết lập kết nối Google Sheet.
      </p>
      <button onClick={loadSheetData} style={{ ...btnPrimary, display: "inline-flex", alignItems: "center", gap: 6 }}><RefreshCw size={14} /> Thử lại</button>
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: isMobile ? 16 : 20, display: "flex", alignItems: "center", gap: 8 }}><ClipboardList size={20} /> Quản lý bài đăng</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => { setShowAll(!showAll); setCurrentPage(1); }}
            style={{
              ...(!showAll ? btnPrimary : btnSecondary),
              display: "flex", alignItems: "center", gap: 6,
            }}>
            {showAll ? <><Calendar size={14} /> Chỉ hôm nay</> : <><ClipboardList size={14} /> Xem tất cả</>}
          </button>
          <button onClick={loadSheetData} style={{ ...btnSecondary, display: "flex", alignItems: "center", gap: 6 }}>
            <RefreshCw size={14} /> Tải lại từ Sheet
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 16 }}>
        <Card title="STOP (chờ)" value={statStop} color="#ef4444" compact />
        <Card title="READY (sẵn sàng)" value={statReady} color="#f59e0b" compact />
        <Card title="POSTED (đã đăng)" value={statPosted} color="#10b981" compact />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          style={{ ...inputStyle, width: isMobile ? "100%" : 200, marginBottom: 0 }}
          placeholder="Tìm kiếm..."
          value={searchText} onChange={e => { setSearchText(e.target.value); setCurrentPage(1); }}
        />
        <select style={{ ...inputStyle, width: isMobile ? "48%" : 160, marginBottom: 0 }}
          value={filterProject} onChange={e => { setFilterProject(e.target.value); setCurrentPage(1); }}>
          <option value="all">Tất cả dự án</option>
          {uniqueProjects.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select style={{ ...inputStyle, width: isMobile ? "48%" : 130, marginBottom: 0 }}
          value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1); }}>
          <option value="all">Tất cả trạng thái</option>
          {Object.entries(SHEET_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,.08)", overflow: "auto" }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>STT</th>
              <th style={{ ...thStyle, minWidth: 90 }}>Trạng thái</th>
              <th style={thStyle}>Dự án</th>
              <th style={{ ...thStyle, minWidth: 250 }}>Nội dung đăng</th>
              <th style={thStyle}>Nhu cầu</th>
              <th style={thStyle}>Giai đoạn</th>
              <th style={thStyle}>Lịch viết</th>
              <th style={{ ...thStyle, minWidth: 60 }}>Xem</th>
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 && (
              <tr><td colSpan={8} style={{ ...tdStyle, textAlign: "center", color: "#9ca3af", padding: 40 }}>
                {sheetPosts.length === 0 ? "Chưa có dữ liệu từ Sheet" : (!showAll ? "Không có bài nào hôm nay. Bấm \"Xem tất cả\" để xem toàn bộ." : "Không tìm thấy bài nào")}
              </td></tr>
            )}
            {paged.map((post, idx) => {
              const status = getStatus(post);
              const st = SHEET_STATUS[status] || SHEET_STATUS.STOP;
              const isToggling = togglingRow === post._row;
              return (
                <tr key={post._row || idx} style={{ transition: "background .15s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ ...tdStyle, fontWeight: 600, color: "#6b7280", width: 50 }}>{getId(post)}</td>
                  <td style={tdStyle}>
                    {status === "POSTED" ? (
                      <span style={{ padding: "4px 12px", borderRadius: 12, background: st.bg, color: st.color, fontWeight: 700, fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <Check size={11} /> POSTED
                      </span>
                    ) : (
                      <button
                        onClick={() => handleToggleStatus(post)}
                        disabled={isToggling}
                        style={{
                          padding: "4px 12px", borderRadius: 12, border: "none", cursor: isToggling ? "wait" : "pointer",
                          background: st.bg, color: st.color, fontWeight: 700, fontSize: 11,
                          opacity: isToggling ? 0.5 : 1, transition: "all .2s",
                          display: "flex", alignItems: "center", gap: 4,
                        }}
                      >
                        {status === "STOP" ? <Pause size={11} /> : <Play size={11} />} {isToggling ? "..." : status}
                      </button>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <span style={{ background: "#fef6ee", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, color: "#e88a2e" }}>
                      {getProject(post) || "-"}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, maxWidth: 350 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 340, cursor: "pointer", color: "#1a3c20" }}
                      onClick={() => setSelectedPost(post)} title="Bấm để xem chi tiết">
                      {getContent(post) || getTitle(post) || "(Chưa có nội dung)"}
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: 11, color: "#6b7280" }}>{getNeed(post) || "-"}</span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: 11, color: "#6b7280" }}>{getStage(post) || "-"}</span>
                  </td>
                  <td style={{ ...tdStyle, whiteSpace: "nowrap", fontSize: 12 }}>
                    {formatDateTime(post)}
                  </td>
                  <td style={tdStyle}>
                    <button onClick={() => setSelectedPost(post)} title="Xem chi tiết"
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, padding: 4 }}><Eye size={16} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1}
            style={{ ...btnSecondary, padding: "4px 10px", opacity: currentPage <= 1 ? 0.4 : 1 }}>← Trước</button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const pg = currentPage <= 3 ? i + 1 : currentPage + i - 2;
            if (pg > totalPages || pg < 1) return null;
            return <button key={pg} onClick={() => setCurrentPage(pg)} style={{
              ...btnSecondary, padding: "4px 10px", background: pg === currentPage ? "#e88a2e" : "#f3f4f6",
              color: pg === currentPage ? "#fff" : "#374151",
            }}>{pg}</button>;
          })}
          <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}
            style={{ ...btnSecondary, padding: "4px 10px", opacity: currentPage >= totalPages ? 0.4 : 1 }}>Sau →</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "#6b7280" }}>{filtered.length} bài</span>
          <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
            style={{ ...inputStyle, width: 80, marginBottom: 0, fontSize: 12 }}>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {selectedPost && (
        <SheetPostDetail post={selectedPost} onClose={() => setSelectedPost(null)}
          getTitle={getTitle} getProject={getProject} getContent={getContent}
          getStatus={getStatus} getSchedule={getSchedule} getNeed={getNeed}
          getStage={getStage} getPurpose={getPurpose} getOffice={getOffice} getPage={getPage}
          sheetHeaders={sheetHeaders} />
      )}
    </div>
  );
}

/* ===== Sheet Post Detail Modal ===== */
function SheetPostDetail({ post, onClose, getTitle, getProject, getContent, getStatus, getSchedule, getNeed, getStage, getPurpose, getOffice, getPage, sheetHeaders }) {
  const isMobile = useIsMobile();
  const status = getStatus(post);
  const st = SHEET_STATUS[status] || SHEET_STATUS.STOP;

  const allFields = sheetHeaders
    .filter(h => h && h !== "_row" && post[h] !== undefined && post[h] !== "")
    .map(h => ({ key: h, value: post[h] }));

  return (
    <Modal onClose={onClose} title={<span style={{ display: "flex", alignItems: "center", gap: 6 }}><FileText size={16} /> Chi tiết bài viết</span>}>
      <div style={{ maxHeight: "70vh", overflow: "auto" }}>
        <div style={{ marginBottom: 16, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ padding: "4px 14px", borderRadius: 12, background: st.bg, color: st.color, fontWeight: 700, fontSize: 12 }}>
            {status}
          </span>
          {getProject(post) && (
            <span style={{ padding: "4px 14px", borderRadius: 12, background: "#fef6ee", color: "#e88a2e", fontWeight: 600, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Building size={12} /> {getProject(post)}
            </span>
          )}
          {getPage(post) && (
            <span style={{ padding: "4px 14px", borderRadius: 12, background: "#f0fdf4", color: "#16a34a", fontWeight: 600, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>
              <BookOpen size={12} /> {getPage(post)}
            </span>
          )}
        </div>

        {getTitle(post) && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ ...labelStyle, marginTop: 0 }}>Chủ đề bài viết</label>
            <div style={{ background: "#f8fafc", padding: 12, borderRadius: 8, fontSize: 14, fontWeight: 600, lineHeight: 1.5 }}>
              {getTitle(post)}
            </div>
          </div>
        )}

        {getContent(post) && (
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Nội dung đăng (content full)</label>
            <div style={{ background: "#f8fafc", padding: 12, borderRadius: 8, fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap", maxHeight: 300, overflow: "auto" }}>
              {getContent(post)}
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 16 }}>
          {getSchedule(post) && (
            <div>
              <label style={{ ...labelStyle }}><Calendar size={12} style={{ display: "inline", verticalAlign: "middle" }} /> Lịch viết</label>
              <div style={{ background: "#f8fafc", padding: 8, borderRadius: 6, fontSize: 13 }}>
                {(() => {
                  const val = getSchedule(post);
                  const str = String(val);
                  const d = new Date(str);
                  if (!isNaN(d.getTime())) {
                    const pad = (n) => String(n).padStart(2, "0");
                    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
                  }
                  return str;
                })()}
              </div>
            </div>
          )}
          {getNeed(post) && (
            <div>
              <label style={labelStyle}><Target size={12} style={{ display: "inline", verticalAlign: "middle" }} /> Nhu cầu</label>
              <div style={{ background: "#f8fafc", padding: 8, borderRadius: 6, fontSize: 13 }}>{getNeed(post)}</div>
            </div>
          )}
          {getStage(post) && (
            <div>
              <label style={labelStyle}><BarChart3 size={12} style={{ display: "inline", verticalAlign: "middle" }} /> Giai đoạn</label>
              <div style={{ background: "#f8fafc", padding: 8, borderRadius: 6, fontSize: 13 }}>{getStage(post)}</div>
            </div>
          )}
          {getPurpose(post) && (
            <div>
              <label style={labelStyle}><Target size={12} style={{ display: "inline", verticalAlign: "middle" }} /> Mục đích content</label>
              <div style={{ background: "#f8fafc", padding: 8, borderRadius: 6, fontSize: 13 }}>{getPurpose(post)}</div>
            </div>
          )}
          {getOffice(post) && (
            <div>
              <label style={labelStyle}><Building size={12} style={{ display: "inline", verticalAlign: "middle" }} /> Văn phòng</label>
              <div style={{ background: "#f8fafc", padding: 8, borderRadius: 6, fontSize: 13 }}>{getOffice(post)}</div>
            </div>
          )}
        </div>

        <details style={{ marginTop: 16 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 13, color: "#6b7280", padding: "8px 0" }}>
            <ClipboardList size={14} style={{ display: "inline", verticalAlign: "middle" }} /> Xem tất cả dữ liệu từ Sheet ({allFields.length} cột)
          </summary>
          <div style={{ marginTop: 8 }}>
            <table style={{ ...tableStyle, fontSize: 12 }}>
              <tbody>
                {allFields.map(({ key, value }) => (
                  <tr key={key}>
                    <td style={{ ...tdStyle, fontWeight: 600, width: "30%", verticalAlign: "top", color: "#374151", background: "#f8fafc" }}>{key}</td>
                    <td style={{ ...tdStyle, whiteSpace: "pre-wrap", wordBreak: "break-word", maxWidth: 400 }}>{String(value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>
    </Modal>
  );
}

/* ===== Sheet Config Page (Multi-sheet) ===== */
function SheetConfigPage() {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newProject, setNewProject] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [testingId, setTestingId] = useState(null);
  const [testResults, setTestResults] = useState({});

  const loadConfigs = async () => {
    try {
      const r = await apiFetch(`${API}/sheet/configs`);
      const data = await r.json();
      if (Array.isArray(data)) setConfigs(data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadConfigs(); }, []);

  const handleAdd = async () => {
    if (!newProject.trim() || !newUrl.trim()) return;
    setAdding(true);
    try {
      const r = await apiFetch(`${API}/sheet/configs`, {
        method: "POST",
        body: JSON.stringify({ projectName: newProject.trim(), scriptUrl: newUrl.trim() }),
      });
      if (r.ok) {
        const data = await r.json();
        setConfigs(data);
        setNewProject("");
        setNewUrl("");
      } else {
        const e = await r.json();
        showToast(e.error || "Lỗi thêm", "error");
      }
    } catch { showToast("Lỗi kết nối", "error"); }
    setAdding(false);
  };

  const handleDelete = async (id) => {
    if (!(await showConfirm("Xóa cấu hình Sheet này?"))) return;
    try {
      const r = await apiFetch(`${API}/sheet/configs/${id}`, { method: "DELETE" });
      if (r.ok) { const data = await r.json(); setConfigs(data); }
    } catch {}
  };

  const handleTest = async (id) => {
    setTestingId(id);
    setTestResults(prev => ({ ...prev, [id]: null }));
    try {
      const r = await apiFetch(`${API}/sheet/test/${id}`);
      const data = await r.json();
      if (r.ok) {
        setTestResults(prev => ({ ...prev, [id]: { ok: true, msg: `Kết nối thành công! ${data.count} bài viết.` } }));
      } else {
        setTestResults(prev => ({ ...prev, [id]: { ok: false, msg: data.error || "Lỗi" } }));
      }
    } catch { setTestResults(prev => ({ ...prev, [id]: { ok: false, msg: "Lỗi kết nối server" } })); }
    setTestingId(null);
  };

  if (loading) return <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>Đang tải...</div>;

  return (
    <div>
      <h2 style={{ margin: "0 0 16px", fontSize: 20, display: "flex", alignItems: "center", gap: 8 }}><Settings size={20} /> Cấu hình Google Sheet</h2>

      <div style={{ background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,.08)", maxWidth: 800 }}>
        <div style={{ background: "#f0faf1", padding: 16, borderRadius: 8, marginBottom: 20, fontSize: 13, lineHeight: 1.6 }}>
          <div style={{ fontWeight: 700, marginBottom: 8, color: "#1a3c20", display: "flex", alignItems: "center", gap: 6 }}><Pin size={14} /> Hướng dẫn kết nối Google Sheet</div>
          <ol style={{ margin: 0, paddingLeft: 20, color: "#374151" }}>
            <li>Mở Google Sheet của bạn</li>
            <li>Vào menu <strong>Tiện ích mở rộng</strong> → <strong>Apps Script</strong></li>
            <li>Xóa code cũ, dán đoạn code bên dưới vào</li>
            <li>Bấm <strong>Triển khai</strong> → <strong>Triển khai mới</strong></li>
            <li>Chọn loại: <strong>Ứng dụng web</strong></li>
            <li>Thực thi với tên: <strong>Tôi</strong> (Me)</li>
            <li>Ai có quyền: <strong>Bất kỳ ai</strong> (Anyone)</li>
            <li>Bấm <strong>Triển khai</strong> → Copy URL</li>
            <li>Nhập tên dự án + URL vào bên dưới → Bấm <strong>Thêm</strong></li>
            <li><strong>Lặp lại</strong> cho mỗi Sheet dự án khác</li>
          </ol>
        </div>

        <details style={{ marginBottom: 20 }}>
          <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 14, color: "#e88a2e", padding: "8px 0" }}>
            <ClipboardList size={14} style={{ display: "inline", verticalAlign: "middle" }} /> Xem code Apps Script (bấm để mở)
          </summary>
          <pre style={{
            background: "#1e293b", color: "#e2e8f0", padding: 16, borderRadius: 8,
            fontSize: 11, lineHeight: 1.5, overflow: "auto", maxHeight: 400, marginTop: 8,
          }}>{`function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheets()[0];
    var data = sheet.getDataRange().getValues();
    var headers = data[0].map(function(h) { return String(h).trim(); });
    var rows = [];
    for (var i = 1; i < data.length; i++) {
      if (!data[i][0] && !data[i][1]) continue;
      var row = { _row: i + 1 };
      headers.forEach(function(h, j) {
        var val = data[i][j];
        if (val instanceof Date) {
          val = Utilities.formatDate(val,
            Session.getScriptTimeZone(),
            "yyyy-MM-dd HH:mm:ss");
        }
        row[h] = val;
      });
      rows.push(row);
    }
    return ContentService
      .createTextOutput(JSON.stringify({
        success: true, data: rows, headers: headers
      }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false, error: err.message
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheets()[0];
    if (body.action === 'updateStatus') {
      var row = Number(body.row);
      var status = String(body.status);
      if (row < 2) throw new Error('Invalid row');
      sheet.getRange(row, 2).setValue(status);
      SpreadsheetApp.flush();
      return ContentService
        .createTextOutput(JSON.stringify({
          success: true, row: row, status: status
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false, error: 'Unknown action'
      }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false, error: err.message
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`}</pre>
        </details>

        {/* Add new sheet config */}
        <div style={{ background: "#f8fafc", padding: 16, borderRadius: 8, marginBottom: 20 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}><Plus size={14} /> Thêm Sheet dự án mới</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              style={{ ...inputStyle, width: 180, marginBottom: 0 }}
              value={newProject}
              onChange={e => setNewProject(e.target.value)}
              placeholder="Tên dự án (VD: Sun Group BLC)"
            />
            <input
              style={{ ...inputStyle, flex: 1, minWidth: 250, marginBottom: 0 }}
              value={newUrl}
              onChange={e => setNewUrl(e.target.value)}
              placeholder="URL Apps Script (https://script.google.com/...)"
            />
            <button onClick={handleAdd} disabled={adding || !newProject.trim() || !newUrl.trim()}
              style={{ ...btnPrimary, opacity: (adding || !newProject.trim() || !newUrl.trim()) ? 0.6 : 1, whiteSpace: "nowrap" }}>
              {adding ? "Đang thêm..." : <><Plus size={14} /> Thêm</>}
            </button>
          </div>
        </div>

        {/* List existing configs */}
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}><BarChart3 size={14} /> Danh sách Sheet đã cấu hình ({configs.length})</div>
        {configs.length === 0 && (
          <div style={{ color: "#9ca3af", textAlign: "center", padding: 24, fontSize: 13 }}>
            Chưa có Sheet nào. Hãy thêm Sheet dự án ở trên.
          </div>
        )}
        {configs.map(cfg => (
          <div key={cfg.id} style={{
            background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 12, marginBottom: 8,
            display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8,
          }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#1a3c20", display: "flex", alignItems: "center", gap: 4 }}><Building size={14} /> {cfg.name}</div>
              <div style={{ fontSize: 11, color: "#6b7280", wordBreak: "break-all", marginTop: 2 }}>{cfg.script_url}</div>
              {testResults[cfg.id] && (
                <div style={{
                  marginTop: 6, padding: 6, borderRadius: 6, fontSize: 12, fontWeight: 600,
                  background: testResults[cfg.id].ok ? "#d1fae5" : "#fee2e2",
                  color: testResults[cfg.id].ok ? "#065f46" : "#991b1b",
                }}>{testResults[cfg.id].msg}</div>
              )}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => handleTest(cfg.id)} disabled={testingId === cfg.id}
                style={{ ...btnSecondary, padding: "4px 12px", fontSize: 12, opacity: testingId === cfg.id ? 0.5 : 1 }}>
                {testingId === cfg.id ? "..." : <><Link size={12} /> Test</>}
              </button>
              <button onClick={() => handleDelete(cfg.id)} style={{ ...btnDanger, padding: "4px 12px", fontSize: 12 }}>
                <Trash2 size={12} /> Xóa
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ===== Calendar Page (Sheet Integration) ===== */
function CalendarPage({ projects }) {
  const isMobile = useIsMobile();
  const [sheetPosts, setSheetPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterProject, setFilterProject] = useState("all");
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  useEffect(() => {
    (async () => {
      try {
        const r = await apiFetch(`${API}/sheet/posts`);
        const data = await r.json();
        if (r.ok && data.data) setSheetPosts(data.data);
        else setError(data.error || "Lỗi tải dữ liệu");
      } catch (e) { setError("Không kết nối được"); }
      setLoading(false);
    })();
  }, []);

  const getScheduleDate = (post) => {
    const val = post["LỊCH VIẾT"] || post["LICH VIET"] || post["Lịch viết"] || post["lich_viet"] || post["LỊCH VIỆT"] || "";
    if (!val) return null;
    const str = String(val);
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d;
    const m = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s*(\d{1,2}):(\d{1,2}):?(\d{1,2})?/);
    if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4]), Number(m[5]), Number(m[6] || 0));
    const m2 = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m2) return new Date(Number(m2[3]), Number(m2[2]) - 1, Number(m2[1]));
    return null;
  };

  const getStatus = (post) => String(post["STATUS"] || post["status"] || post["Status"] || "STOP").toUpperCase();
  const getTitle = (post) => post["CONTENT_FULL"] || post["content"] || post["Content"] || post["Nội dung"] || post["Chủ đề bài viết"] || post["CHỦ ĐỀ BÀI VIẾT"] || "";
  const getProject = (post) => post["CONTENT_PULL"] || post["Dự Án"] || post["DỰ ÁN"] || (post._sheetProject || "");

  const uniqueProjects = useMemo(() => {
    const set = new Set();
    sheetPosts.forEach(p => {
      if (p._sheetProject) set.add(p._sheetProject);
    });
    return [...set].sort();
  }, [sheetPosts]);

  const filteredPosts = useMemo(() => {
    if (filterProject === "all") return sheetPosts;
    return sheetPosts.filter(p => (p._sheetProject || "") === filterProject);
  }, [sheetPosts, filterProject]);

  const prevMonth = () => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks = [];
  let day = 1 - firstDay;
  while (day <= daysInMonth) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      week.push(day > 0 && day <= daysInMonth ? day : null);
      day++;
    }
    weeks.push(week);
  }

  const getPostsForDay = (d) => {
    if (!d) return [];
    return filteredPosts.filter(p => {
      const date = getScheduleDate(p);
      if (!date) return false;
      return date.getFullYear() === year && date.getMonth() === month && date.getDate() === d;
    });
  };

  const dayNames = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
  const monthNames = ["Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
    "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"];
  const today = new Date();
  const isToday = (d) => d && today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;

  if (loading) return <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>Đang tải...</div>;
  if (error) return (
    <div style={{ textAlign: "center", padding: 40 }}>
      <div style={{ color: "#ef4444", fontWeight: 600 }}>{error}</div>
      <p style={{ color: "#6b7280", fontSize: 13 }}>Vui lòng cấu hình kết nối Google Sheet trước.</p>
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: isMobile ? 16 : 20, display: "flex", alignItems: "center", gap: 8 }}><Calendar size={20} /> Lịch đăng bài</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select style={{ ...inputStyle, width: 160, marginBottom: 0, fontSize: 12 }}
            value={filterProject} onChange={e => setFilterProject(e.target.value)}>
            <option value="all">Tất cả dự án</option>
            {uniqueProjects.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <button onClick={prevMonth} style={{ ...btnSecondary, padding: "6px 12px" }}><ChevronLeft size={14} /></button>
          <span style={{ fontWeight: 700, fontSize: 15, minWidth: 140, textAlign: "center" }}>
            {monthNames[month]} {year}
          </span>
          <button onClick={nextMonth} style={{ ...btnSecondary, padding: "6px 12px" }}><ChevronRight size={14} /></button>
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,.08)", overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)" }}>
          {dayNames.map(d => (
            <div key={d} style={{ padding: "10px 4px", textAlign: "center", fontWeight: 700, fontSize: 12, color: "#6b7280", background: "#f8fafc", borderBottom: "1px solid #e5e7eb" }}>{d}</div>
          ))}
          {weeks.flat().map((d, i) => {
            const dayPosts = getPostsForDay(d);
            return (
              <div key={i} style={{
                minHeight: isMobile ? 60 : 100, padding: 4, borderBottom: "1px solid #f3f4f6", borderRight: "1px solid #f3f4f6",
                background: isToday(d) ? "#fef6ee" : (d ? "#fff" : "#fafafa"),
              }}>
                {d && (
                  <>
                    <div style={{ fontSize: 12, fontWeight: isToday(d) ? 700 : 400, color: isToday(d) ? "#e88a2e" : "#374151", marginBottom: 2 }}>{d}</div>
                    {dayPosts.slice(0, isMobile ? 1 : 3).map((p, pi) => {
                      const status = getStatus(p);
                      const st = SHEET_STATUS[status] || SHEET_STATUS.STOP;
                      return (
                        <div key={pi} style={{
                          background: st.bg, color: st.color, padding: "2px 4px", borderRadius: 4,
                          fontSize: 10, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          fontWeight: 600, cursor: "default",
                        }} title={`${getTitle(p)} - ${status}`}>
                          {getTitle(p).slice(0, 25) || "..."}
                        </div>
                      );
                    })}
                    {dayPosts.length > (isMobile ? 1 : 3) && (
                      <div style={{ fontSize: 9, color: "#6b7280" }}>+{dayPosts.length - (isMobile ? 1 : 3)} bài</div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
        {Object.entries(SHEET_STATUS).map(([k, v]) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: v.bg, border: `1px solid ${v.color}`, display: "inline-block" }} />
            <span style={{ color: v.color, fontWeight: 600 }}>{v.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
/* ===== Shared styles ===== */
const tableStyle = { width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 13 };
const thStyle = {
  padding: "12px 14px", textAlign: "left", background: "linear-gradient(135deg, #f0f4f1, #e8ede9)",
  borderBottom: "2px solid #c5d9c8", fontSize: 12, fontWeight: 700, color: "#1a3c20",
  whiteSpace: "nowrap", letterSpacing: "0.02em", textTransform: "uppercase",
};
const tdStyle = { padding: "12px 14px", borderBottom: "1px solid #f0f2f5", verticalAlign: "middle" };
const labelStyle = { display: "block", fontSize: 13, fontWeight: 600, color: "#1a3c20", marginBottom: 6, marginTop: 14, letterSpacing: "0.01em" };
const inputStyle = {
  width: "100%", padding: "10px 14px", borderRadius: 10,
  border: "1px solid #d1d5db", fontSize: 13, marginBottom: 8, boxSizing: "border-box",
  transition: "border-color .2s, box-shadow .2s, background .2s",
  background: "#fafbfc",
};
const btnPrimary = {
  padding: "10px 22px", background: "linear-gradient(135deg, #e88a2e, #d97706)", color: "#fff",
  border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 600, fontSize: 13,
  boxShadow: "0 2px 8px rgba(232,138,46,.3)",
  transition: "transform .15s, box-shadow .15s, opacity .15s",
  display: "inline-flex", alignItems: "center", gap: 6,
};
const btnSecondary = {
  padding: "10px 18px", background: "#f8f9fa", color: "#374151",
  border: "1px solid #e5e7eb", borderRadius: 10, cursor: "pointer", fontWeight: 600, fontSize: 13,
  transition: "transform .15s, box-shadow .15s, background .15s",
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
};
const btnDanger = {
  padding: "10px 18px", background: "#fff5f5", color: "#dc2626",
  border: "1px solid #fca5a5", borderRadius: 10, cursor: "pointer", fontWeight: 600, fontSize: 13,
  transition: "transform .15s, box-shadow .15s, background .15s",
  display: "inline-flex", alignItems: "center", gap: 6,
};
