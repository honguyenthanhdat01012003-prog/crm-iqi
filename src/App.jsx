import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { io as socketIOClient } from "socket.io-client";
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
  ExternalLink, Shield, Globe, Layers, TrendingUp, Activity,
  FolderOpen, ArrowLeft, Gauge, MapPin, DollarSign, Radar, Award, BarChart2, TrendingDown, Crown, Crosshair, Newspaper
} from "lucide-react";
import { MaintenancePage } from "./NotFound";

const API = "/api";

/* ===== Error Boundary ===== */
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error("React Error Boundary:", error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#f8fafb", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 32, maxWidth: 420, textAlign: "center", boxShadow: "0 4px 24px rgba(0,0,0,.1)" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
            <h2 style={{ margin: "0 0 8px", fontSize: 18, color: "#dc2626" }}>Đã xảy ra lỗi</h2>
            <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 16 }}>{this.state.error?.message || "Lỗi không xác định"}</p>
            <button onClick={() => window.location.reload()} style={{ padding: "10px 24px", background: "#1a3c20", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 600, fontSize: 14 }}>Tải lại trang</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ===== Toast + Confirm global helpers ===== */
let _toastFn = null;
let _confirmFn = null;
function showToast(msg, type = "info") { _toastFn && _toastFn(typeof msg === "string" ? msg : String(msg || ""), type); }
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
  appointment: "Hẹn gặp/hẹn xem dự án",
  booked: "Booking/Cọc",
  booking_other: "Booking sản khác",
  closed: "Chốt",
  not_interested: "Không quan tâm",
  spam: "Phá/rác",
  sale: "Sale",
  weak_finance: "Tài chính yếu",
  unreachable: "Chưa liên lạc được",
  callback: "Liên lạc lại sau",
  wrong_phone: "Thuê bao",
  wrong_number: "Sai số",
  hung_up: "Tắt máy ngang",
  blocked: "Chặn",
  has_sale: "Đang có sale khác chăm",
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
  booking_other: "#14b8a6",
  closed: "#059669",
  not_interested: "#ef4444",
  spam: "#eab308",
  sale: "#2563eb",
  weak_finance: "#f97316",
  unreachable: "#6b7280",
  callback: "#e88a2e",
  wrong_phone: "#9ca3af",
  wrong_number: "#78716c",
  hung_up: "#a1a1aa",
  blocked: "#1f2937",
  has_sale: "#0284c7",
  lost: "#dc2626",
};

// Reverse lookup: label → key for status normalization on frontend
const STATUS_LABEL_TO_KEY = {};
Object.entries(STATUS_LABELS).forEach(([k, v]) => { STATUS_LABEL_TO_KEY[v] = k; STATUS_LABEL_TO_KEY[k] = k; });

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

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

const ElapsedTimer = ({ estimatedTime }) => {
  const [elapsed, setElapsed] = React.useState(0);
  React.useEffect(() => {
    setElapsed(0);
    const interval = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(interval);
  }, []);
  const est = estimatedTime || 0;
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const progress = est > 0 ? Math.min(0.95, elapsed / est) : Math.min(0.95, elapsed / 120);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <div style={{ position: "relative", width: 80, height: 80 }}>
        <svg width="80" height="80" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(59,130,246,0.15)" strokeWidth="5" />
          <circle cx="40" cy="40" r="34" fill="none" stroke="#3b82f6" strokeWidth="5"
            strokeDasharray={`${2 * Math.PI * 34}`}
            strokeDashoffset={`${2 * Math.PI * 34 * (1 - progress)}`}
            strokeLinecap="round"
            style={{ transform: "rotate(-90deg)", transformOrigin: "center", transition: "stroke-dashoffset 1s linear" }} />
        </svg>
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", fontSize: 18, fontWeight: 800, color: "#f1f5f9", fontVariantNumeric: "tabular-nums" }}>
          {`${mins}:${String(secs).padStart(2, "0")}`}
        </div>
      </div>
      <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>
        {est > 0 ? `\u01af\u1edbc t\u00ednh ~${est}s` : "\u0110ang x\u1eed l\u00fd..."}
      </div>
    </div>
  );
};

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
    return <ErrorBoundary><LoginPage onLogin={(u, t) => { setUser(u); setToken(t); }} /></ErrorBoundary>;
  }

  if (user.mustChangePassword) {
    return <ErrorBoundary><ForceChangePasswordPage user={user} onChanged={(u, t) => updateUser(u, t)} onLogout={() => {
      localStorage.removeItem("crm_token");
      localStorage.removeItem("crm_user");
      setUser(null);
      setToken("");
    }} /></ErrorBoundary>;
  }

  return <ErrorBoundary><CRMApp user={user} updateUser={updateUser} onLogout={() => {
    apiFetch(`${API}/logout`, { method: "POST" }).catch(() => {});
    localStorage.removeItem("crm_token");
    localStorage.removeItem("crm_user");
    setUser(null);
    setToken("");
  }} /></ErrorBoundary>;
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
      if (!res.ok) { setError(String(data.error || "Đăng nhập thất bại")); return; }
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
      if (!res.ok) { setError(String(data.error || "Lỗi đổi mật khẩu")); return; }
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
  const isAdmin = user.role === "admin" || user.role === "manager";
  const isAdminOnly = user.role === "admin";
  const isManager = user.role === "manager";
  const isMobile = useIsMobile();
  const adminPages = ["dashboard", "leads", "projects", "campaigns", "sales", "users", "posts", "calendar", "sheet_config", "profile"];
  const managerPages = ["dashboard", "leads", "projects", "campaigns", "sales", "users", "posts", "calendar", "profile"];
  const salePages = ["leads", "profile"];
  const [page, setPage] = useState(() => {
    try {
      const saved = localStorage.getItem("crm_page");
      const allowed = isAdminOnly ? adminPages : isManager ? managerPages : salePages;
      if (saved && allowed.includes(saved)) return saved;
    } catch {}
    return isAdmin ? "dashboard" : "leads";
  });
  useEffect(() => { localStorage.setItem("crm_page", page); }, [page]);

  // Refresh user data (projectIds etc.) from server on mount
  useEffect(() => {
    apiFetch(`${API}/me`).then(r => r.json()).then(data => {
      if (data.user) updateUser(data.user);
    }).catch(() => {});
  }, []);

  const [leads, setLeads] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [projects, setProjects] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [lastSync, setLastSync] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [managerFilter, setManagerFilter] = useState("all");
  const [saleFilter, setSaleFilter] = useState("all");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Project modal state
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [draftProject, setDraftProject] = useState({ name: "", leadUrl: "", costUrl: "" });

  // Legacy import modal state
  const [showLegacyModal, setShowLegacyModal] = useState(false);
  const [legacyDraft, setLegacyDraft] = useState({ name: "", sheetUrl: "" });
  const [legacyImporting, setLegacyImporting] = useState(false);

  // Notification state
  const [notifications, setNotifications] = useState([]);
  const [showNotif, setShowNotif] = useState(false);
  const [highlightLeadId, setHighlightLeadId] = useState(null);
  const [syncCountdown, setSyncCountdown] = useState(0);
  const [syncHash, setSyncHash] = useState("");
  const [seenLeadKeys, setSeenLeadKeys] = useState(() => {
    try { const s = localStorage.getItem("crm_seen_keys"); return s ? new Set(JSON.parse(s)) : new Set(); } catch { return new Set(); }
  });

  const applyApiData = useCallback((data) => {
    // If server says no change, skip all state updates
    if (data.noChange) {
      if (data.hash) setSyncHash(data.hash);
      if (data.lastSync) setLastSync(data.lastSync);
      return;
    }
    // Targeted single-lead update (e.g. manager change)
    if (data.updatedLead) {
      setLeads(prev => (Array.isArray(prev) ? prev : []).map(l =>
        (l.id === data.updatedLead.id || (data.updatedLead.name && l.name === data.updatedLead.name && l.phone === data.updatedLead.phone))
          ? { ...l, ...data.updatedLead }
          : l
      ));
      return;
    }
    if (data.hash) setSyncHash(data.hash);
    if (Array.isArray(data.leads)) {
      setLeads((prev) => {
        const prevArr = Array.isArray(prev) ? prev : [];
        // Use name+phone as stable key (IDs change every sync)
        const prevKeys = new Set(prevArr.map(l => `${l.name}||${l.phone}`));
        const newLeads = data.leads.filter(l => {
          const key = `${l.name}||${l.phone}`;
          return !prevKeys.has(key) && !seenLeadKeys.has(key);
        });
        if (newLeads.length > 0 && prevArr.length > 0) {
          setNotifications(n => {
            const existing = new Set((Array.isArray(n) ? n : []).map(x => `${x.name}||${x.phone}`));
            const fresh = newLeads.filter(l => !existing.has(`${l.name}||${l.phone}`));
            return [...fresh.map(l => ({ ...l, notifTime: Date.now() })), ...(Array.isArray(n) ? n : [])].slice(0, 50);
          });
        }
        return data.leads;
      });
    }
    if (Array.isArray(data.campaigns)) setCampaigns(data.campaigns);
    if (Array.isArray(data.projects)) setProjects(data.projects);
    if (Array.isArray(data.schedules)) setSchedules(data.schedules);
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
    // Connection health state
    const checkHealth = () => fetch(`${API}/version`, { signal: AbortSignal.timeout(8000) })
      .then(r => { if (r.ok) { setServerDown(false); return r.json(); } throw new Error(); })
      .then(v => console.log(`[CRM] Server version: ${v.version} uptime: ${Math.round(v.uptime)}s`))
      .catch(() => setServerDown(true));
    checkHealth();
    apiFetch(`${API}/data`)
      .then((r) => r.json())
      .then((data) => {
        setServerDown(false);
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
      .catch(() => setServerDown(true));
  }, [applyApiData]);

  // Socket.IO: real-time data updates (replaces 10s polling)
  useEffect(() => {
    const socket = socketIOClient(window.location.origin, { transports: ["websocket", "polling"] });
    socket.on("connect", () => {
      console.log("[socket.io] Connected:", socket.id);
      setServerDown(false);
    });
    socket.on("disconnect", () => {
      console.log("[socket.io] Disconnected");
    });
    socket.on("data-changed", () => {
      apiFetch(`${API}/data`)
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(applyApiData)
        .catch(() => {});
    });
    return () => socket.disconnect();
  }, [applyApiData]);

  // Connection health check - detect server down (fallback, 30s)
  const [serverDown, setServerDown] = useState(false);
  useEffect(() => {
    const healthIv = setInterval(() => {
      fetch(`${API}/version`, { signal: AbortSignal.timeout(8000) })
        .then(r => { if (r.ok) setServerDown(false); else setServerDown(true); })
        .catch(() => setServerDown(true));
    }, 30000);
    return () => clearInterval(healthIv);
  }, []);

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
    setDraftProject({ name: "", leadUrl: "", costUrl: "", fbCode: "", fbPerson: "" });
    setShowProjectModal(true);
  };

  const openEditProject = (p) => {
    setEditingProject(p);
    setDraftProject({ name: p.name, leadUrl: p.leadUrl || "", costUrl: p.costUrl || "", fbCode: p.fbCode || "", fbPerson: p.fbPerson || "" });
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
    let list = Array.isArray(leads) ? leads : [];
    if (selectedProject && selectedProject !== "all") {
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
          (l.saleName || "").toLowerCase().includes(q) ||
          (l.product || "").toLowerCase().includes(q)
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
    if (managerFilter && managerFilter !== "all") {
      list = list.filter((l) => (l.managerName || "") === managerFilter);
    }
    if (saleFilter && saleFilter !== "all") {
      list = list.filter((l) =>
        (l.saleName || "") === saleFilter ||
        (l.saleHistory && l.saleHistory.some(h => h.saleName === saleFilter))
      );
      // Override status: show selected sale's own latest feedback status
      list = list.map(l => {
        if (l.saleHistory && l.saleHistory.length) {
          for (let i = l.saleHistory.length - 1; i >= 0; i--) {
            const h = l.saleHistory[i];
            if (h.status && h.action !== "Chia lead" && h.saleName === saleFilter) {
              const key = STATUS_LABEL_TO_KEY[h.status] || STATUS_LABEL_TO_KEY[h.status.trim()];
              if (key) return { ...l, status: key, rawStatus: h.status };
              break;
            }
          }
        }
        return l;
      });
    }
    return list;
  }, [leads, selectedProject, statusFilter, searchText, dateFrom, dateTo, managerFilter, saleFilter]);

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

  const activeCost = (!selectedProject || selectedProject === "all") ? totalProjectCost : projectCostMap[selectedProject] || {};

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
    const list = Array.isArray(campaigns) ? campaigns : [];
    if (selectedProject === "all") return list;
    return list.filter((c) => c.projectId === Number(selectedProject));
  }, [campaigns, selectedProject]);

  // --- Pages ---
  const postChildren = [
    { key: "posts", label: "Tất cả bài", icon: FileText },
    { key: "calendar", label: "Lịch đăng bài", icon: Calendar },
  ];
  if (isAdminOnly) postChildren.push({ key: "fb_pages_mgmt", label: "Quản lý Page", icon: Globe });
  if (isAdminOnly) postChildren.push({ key: "sheet_config", label: "Cấu hình Sheet", icon: Settings });
  const NAV = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, adminOnly: true },
    { key: "leads", label: "Khách hàng", icon: Users, adminOnly: false },
    { key: "projects", label: "Dự án", icon: Building2, adminOnly: true },
    { key: "campaigns", label: "Chiến dịch", icon: Megaphone, adminOnly: true },
    { key: "sales", label: "Sale", icon: Trophy, adminOnly: true },
    { key: "users", label: "Quản lý tài khoản", icon: UserCog, adminOnly: true },
    { key: "profile", label: "Hồ sơ cá nhân", icon: IdCard, adminOnly: false },
    { key: "messenger_inbox", label: "Hộp thư Messenger", icon: MessageSquare, adminOnly: true },
    { key: "post_mgmt", label: "Quản lý bài đăng", icon: FileEdit, adminOnly: true, children: postChildren },
    { key: "capi_settings", label: "Facebook CAPI", icon: Zap, adminOnly: true },
    { key: "daily_news", label: "Điểm tin BĐS", icon: Newspaper, adminOnly: false },
    { key: "guide", label: "Hướng dẫn sử dụng", icon: BookOpen, adminOnly: true },
  ];

  const [openSubmenu, setOpenSubmenu] = useState("post_mgmt");

  const [hoverSubmenu, setHoverSubmenu] = useState(null);

  const visibleNav = NAV.filter((n) => !n.adminOnly || isAdmin);

  if (serverDown && leads.length === 0) {
    return <MaintenancePage message="Không thể kết nối đến máy chủ CRM. Server có thể đang bảo trì hoặc database đang tắt. Vui lòng thử lại sau." />;
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", background: "#f0f2f5" }}>
      {/* Server down warning banner */}
      {serverDown && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999, background: "linear-gradient(135deg, #dc2626, #b91c1c)", color: "#fff", textAlign: "center", padding: "8px 16px", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 2px 12px rgba(220,38,38,.3)" }}>
          <AlertCircle size={16} /> Mất kết nối máy chủ — Dữ liệu có thể không được cập nhật
        </div>
      )}
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
          position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 999,
          ...(isMobile ? {
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

        {/* Project selector removed from sidebar - now in leads filter area */}

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
                background: user.role === "admin" ? "#e88a2e" : user.role === "manager" ? "#3b82f6" : "#7ab648", color: "#fff",
              }}>{user.role === "admin" ? "Admin" : user.role === "manager" ? "Quản lý" : "Sale"}</span>
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
      <main style={{ flex: 1, overflow: "auto", minWidth: 0, background: "#f8fafb", display: "flex", flexDirection: "column", marginLeft: isMobile ? 0 : (sidebarOpen ? 230 : 60), transition: "margin-left .2s ease" }}>
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
                title={syncing ? "Đang đồng bộ..." : "Đồng bộ dữ liệu"}
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
                  animation: syncing ? "spin 1s linear infinite" : "none",
                }}><RefreshCw size={22} /></span>
                <span style={{
                  fontSize: 10, fontWeight: 700, marginTop: 1,
                  color: syncing ? "#e88a2e" : "#6b7280",
                }}>{syncing ? "..." : ""}</span>
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
            selectedProject={selectedProject}
            setSelectedProject={setSelectedProject}
            schedules={schedules}
            setSchedules={setSchedules}
            managerFilter={managerFilter}
            setManagerFilter={setManagerFilter}
            saleFilter={saleFilter}
            setSaleFilter={setSaleFilter}
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
            isAdminOnly={isAdminOnly}
            openLegacyImport={() => { setLegacyDraft({ name: "", sheetUrl: "" }); setShowLegacyModal(true); }}
          />
        )}
        {page === "campaigns" && isAdmin && <CampaignsPage leads={leads} projects={projects} isManager={isManager} isAdminOnly={isAdminOnly} />}
        {page === "sales" && isAdmin && <SalesPage ranking={saleRanking} leads={filteredLeads} apiFetch={apiFetch} applyApiData={applyApiData} />}
        {page === "users" && isAdmin && <UsersPage projects={projects} leads={leads} isManager={isManager} isAdminOnly={isAdminOnly} />}
        {page === "profile" && <ProfilePage user={user} updateUser={updateUser} />}
        {page === "posts" && isAdmin && <PostsPage projects={projects} />}
        {page === "calendar" && isAdmin && <CalendarPage projects={projects} />}
        {page === "fb_pages_mgmt" && isAdminOnly && <FbPagesPage />}
        {page === "sheet_config" && isAdminOnly && <SheetConfigPage />}
        {page === "messenger_inbox" && isAdminOnly && <MessengerInboxPage />}
        {page === "guide" && isAdmin && <GuidePage />}
        {page === "capi_settings" && isAdminOnly && <CapiSettingsPage />}
        {page === "daily_news" && <DailyNewsPage isAdmin={isAdminOnly} />}
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={labelStyle}>Mã dự án (FB Ads)</label>
              <input
                style={inputStyle}
                value={draftProject.fbCode}
                onChange={(e) => setDraftProject({ ...draftProject, fbCode: e.target.value })}
                placeholder="VD: CT4, BLC..."
              />
            </div>
            <div>
              <label style={labelStyle}>Người phụ trách</label>
              <input
                style={inputStyle}
                value={draftProject.fbPerson}
                onChange={(e) => setDraftProject({ ...draftProject, fbPerson: e.target.value })}
                placeholder="VD: TĐ"
              />
            </div>
          </div>
          <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 8, lineHeight: 1.5 }}>
            💡 Mã dự án dùng để phân loại chiến dịch FB Ads. VD: nếu mã là "CT4", chiến dịch có chứa "CT4" trong tên sẽ tự động gán vào dự án này.
          </div>
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

      {/* Legacy Import Modal */}
      {showLegacyModal && (
        <Modal onClose={() => !legacyImporting && setShowLegacyModal(false)} title="Thêm Data Cũ">
          <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 12, color: "#1e40af", lineHeight: 1.6 }}>
            📋 Sheet cần có các cột: <b>STT, Họ tên khách, SĐT, Nhu cầu, Status, Feedback khách</b><br />
            Data cũ sẽ hiển thị riêng biệt (badge xanh) và không bị sync tự động.
          </div>
          <label style={labelStyle}>Tên dự án (data cũ)</label>
          <input
            style={inputStyle}
            value={legacyDraft.name}
            onChange={(e) => setLegacyDraft({ ...legacyDraft, name: e.target.value })}
            placeholder="VD: DATA CŨ - SUN VŨNG TÀU"
          />
          <label style={labelStyle}>Google Sheets URL (CSV)</label>
          <input
            style={inputStyle}
            value={legacyDraft.sheetUrl}
            onChange={(e) => setLegacyDraft({ ...legacyDraft, sheetUrl: e.target.value })}
            placeholder="https://docs.google.com/spreadsheets/d/e/.../pub?gid=0&single=true&output=csv"
          />
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button
              onClick={async () => {
                if (!legacyDraft.name.trim() || !legacyDraft.sheetUrl.trim()) { showToast("Vui lòng điền đầy đủ", "error"); return; }
                setLegacyImporting(true);
                try {
                  const r = await apiFetch(`${API}/projects/import-legacy`, {
                    method: "POST",
                    body: JSON.stringify(legacyDraft),
                  });
                  const data = await r.json();
                  if (!r.ok) { showToast(data.error || "Lỗi", "error"); return; }
                  applyApiData(data);
                  showToast(`Import thành công: ${data.imported} khách hàng cũ`, "success");
                  setShowLegacyModal(false);
                  setLegacyDraft({ name: "", sheetUrl: "" });
                } catch (e) { showToast("Lỗi: " + e.message, "error"); }
                finally { setLegacyImporting(false); }
              }}
              disabled={legacyImporting}
              style={{ ...btnPrimary, flex: 1, background: "linear-gradient(135deg, #2563eb, #1d4ed8)", opacity: legacyImporting ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              {legacyImporting && <span style={{ display: "inline-block", width: 16, height: 16, border: "2px solid #fff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />}
              {legacyImporting ? "Đang import..." : "Import Data Cũ"}
            </button>
            <button onClick={() => !legacyImporting && setShowLegacyModal(false)} disabled={legacyImporting} style={{ ...btnSecondary, flex: 1 }}>Hủy</button>
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

function LeadsPage({ leads, searchText, setSearchText, statusFilter, setStatusFilter, dateFrom, setDateFrom, dateTo, setDateTo, projects, user, applyApiData, onLogout, highlightLeadId, setHighlightLeadId, selectedProject, setSelectedProject, schedules, setSchedules, managerFilter, setManagerFilter, saleFilter, setSaleFilter }) {
  const isAdminOnly = user.role === "admin";
  const isMobile = useIsMobile();
  const [expandedId, setExpandedId] = useState(null);
  const expandedPhoneRef = React.useRef(null);

  // Track which phone is expanded so we can restore after sync changes IDs
  const setExpandedIdStable = React.useCallback((id) => {
    setExpandedId(id);
    if (id) {
      const lead = leads.find(l => l.id === id);
      expandedPhoneRef.current = lead ? lead.phone : null;
    } else {
      expandedPhoneRef.current = null;
    }
  }, [leads]);

  // When leads array changes (IDs change), restore expandedId by phone
  React.useEffect(() => {
    if (expandedPhoneRef.current && expandedId) {
      const current = leads.find(l => l.id === expandedId);
      if (!current) {
        const byPhone = leads.find(l => l.phone === expandedPhoneRef.current);
        if (byPhone) setExpandedId(byPhone.id);
      }
    }
  }, [leads]);

  // Collapse expanded lead when switching projects
  React.useEffect(() => {
    setExpandedId(null);
    expandedPhoneRef.current = null;
  }, [selectedProject]);

  const [activeTab, setActiveTab] = useState("all");
  const [pageSize, setPageSize] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);
  const [productFilter, setProductFilter] = useState([]);
  const [productFilterOpen, setProductFilterOpen] = useState(false);
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
  const [saleFilterOpen, setSaleFilterOpen] = useState(false);
  const [saleFilterSearch, setSaleFilterSearch] = useState("");
  const saleFilterRef = React.useRef(null);
  React.useEffect(() => {
    if (!saleFilterOpen) return;
    const handler = (e) => { if (saleFilterRef.current && !saleFilterRef.current.contains(e.target)) { setSaleFilterOpen(false); setSaleFilterSearch(""); } };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [saleFilterOpen]);
  const [shuffleOpen, setShuffleOpen] = useState(false);
  const [shuffleProject, setShuffleProject] = useState("");
  const [shuffleSaleSearch, setShuffleSaleSearch] = useState("");
  const [shuffleStatus, setShuffleStatus] = useState("all");
  const [shuffleProduct, setShuffleProduct] = useState([]);
  const [shuffleProductOpen, setShuffleProductOpen] = useState(false);
  const [shufflePickCount, setShufflePickCount] = useState("all");
  const [shuffleSelected, setShuffleSelected] = useState(new Set());
  const [shuffling, setShuffling] = useState(false);
  const [shuffleMsg, setShuffleMsg] = useState("");
  const [shuffleSaleFocused, setShuffleSaleFocused] = useState(false);
  const [shuffleSelectedSales, setShuffleSelectedSales] = useState([]);
  const [shuffleStartDate, setShuffleStartDate] = useState("");
  const [shuffleEndDate, setShuffleEndDate] = useState("");
  const [shuffleDistributeTimes, setShuffleDistributeTimes] = useState(["08:00"]);
  const [shuffleLeadsPerDay, setShuffleLeadsPerDay] = useState(5);
  const [shuffleNumSlots, setShuffleNumSlots] = useState(1);
  const [scheduleDetailId, setScheduleDetailId] = useState(null);
  const [scheduleDetailData, setScheduleDetailData] = useState(null);
  const [scheduleDetailLoading, setScheduleDetailLoading] = useState(false);
  const [scheduleCalDay, setScheduleCalDay] = useState(null);
  const [scheduleCalMonth, setScheduleCalMonth] = useState(null); // {month, year}
  const [scheduleExpandedSales, setScheduleExpandedSales] = useState({}); // { saleName: true }
  const [scheduleSaleSearch, setScheduleSaleSearch] = useState("");
  const [scheduleHistoryPage, setScheduleHistoryPage] = useState(1);
  const [scheduleHistorySearch, setScheduleHistorySearch] = useState("");
  const [scheduleEditing, setScheduleEditing] = useState(null); // {leadsPerDay, distributeTimes, numSlots}
  const [allUsers, setAllUsers] = useState([]);
  const [redistributing, setRedistributing] = useState(false);
  const [recoverModal, setRecoverModal] = useState(null); // { backups: [], step: 1|2, selectedBackup, selectedProject, loading }
  const [restoreModal, setRestoreModal] = useState(null); // { step: 'pick'|'preview'|'done', projectId, preview, loading, result }
  const isAdmin = user.role === "admin" || user.role === "manager";
  const isSale = user.role === "sale";

  useEffect(() => {
    if (isAdmin) {
      apiFetch(`${API}/users`).then(r => r.json()).then(data => setAllUsers(Array.isArray(data) ? data : [])).catch(() => {});
    }
  }, [isAdmin]);

  // Show NEW tag: only for leads received TODAY (same date)
  const isRecentLead = useCallback((l) => {
    const d = parseLeadDate(l.createdAt);
    if (!d) return false;
    const today = new Date();
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
  }, []);

  const projectMap = useMemo(() => {
    const m = {};
    const list = Array.isArray(projects) ? projects : [];
    list.forEach((p) => (m[p.id] = p.name));
    return m;
  }, [projects]);

  // Available projects for this user
  const availableProjects = useMemo(() => {
    const list = Array.isArray(projects) ? projects : [];
    if (isSale || user.role === "manager") return list.filter(p => user.projectIds && user.projectIds.includes(p.id));
    return list;
  }, [projects, isSale, user.projectIds, user.role]);

  // Lead counts per project (from ALL leads passed to this page, not filtered)
  const projectLeadCounts = useMemo(() => {
    const counts = {};
    const list = Array.isArray(leads) ? leads : [];
    list.forEach(l => { counts[l.projectId] = (counts[l.projectId] || 0) + 1; });
    return counts;
  }, [leads]);

  // Bitrix-style lead categories
  const LEAD_TABS = useMemo(() => [
    { key: "all", label: "Tất cả", Icon: ClipboardList, filter: () => true },
    { key: "new", label: "Chưa feedback", Icon: BadgePlus, filter: (l) => l.status === "new" || !l.status },
    { key: "interested", label: "Quan tâm", Icon: Star, filter: (l) => l.status === "interested" },
    { key: "low_interest", label: "QT hời hợt", Icon: Sparkles, filter: (l) => l.status === "low_interest" },
    { key: "other_project", label: "QT DA khác", Icon: ArrowLeftRight, filter: (l) => l.status === "other_project" },
    { key: "appointment", label: "Hẹn xem", Icon: CalendarCheck, filter: (l) => l.status === "appointment" },
    { key: "booked", label: "Booking/Cọc", Icon: CheckCircle, filter: (l) => l.status === "booked" },
    { key: "booking_other", label: "Booking sản khác", Icon: CheckCircle, filter: (l) => l.status === "booking_other" },
    { key: "closed", label: "Chốt", Icon: Trophy, filter: (l) => l.status === "closed" },
    { key: "not_interested", label: "Không quan tâm", Icon: ThumbsDown, filter: (l) => l.status === "not_interested" },
    { key: "spam", label: "Phá/rác", Icon: Ban, filter: (l) => l.status === "spam" },
    { key: "sale", label: "Sale", Icon: Users, filter: (l) => l.status === "sale" },
    { key: "weak_finance", label: "Tài chính yếu", Icon: Banknote, filter: (l) => l.status === "weak_finance" },
    { key: "unreachable", label: "Chưa liên lạc được", Icon: PhoneOff, filter: (l) => l.status === "unreachable" },
    { key: "callback", label: "Liên lạc lại sau", Icon: PhoneIncoming, filter: (l) => l.status === "callback" },
    { key: "wrong_phone", label: "Thuê bao", Icon: XCircle, filter: (l) => l.status === "wrong_phone" },
    { key: "wrong_number", label: "Sai số", Icon: XCircle, filter: (l) => l.status === "wrong_number" },
    { key: "hung_up", label: "Tắt máy ngang", Icon: PhoneOff, filter: (l) => l.status === "hung_up" },
    { key: "has_sale", label: "Có sale khác", Icon: Users, filter: (l) => l.status === "has_sale" },
  ], []);

  // Unique product values for filter
  const uniqueProducts = useMemo(() => {
    const set = new Set();
    (Array.isArray(leads) ? leads : []).forEach(l => { if (l.product && l.product !== "-") set.add(l.product); });
    return [...set].sort((a, b) => a.localeCompare(b, "vi"));
  }, [leads]);

  // Apply product filter & sort on top of leads from CRMApp
  const processedLeads = useMemo(() => {
    let list = Array.isArray(leads) ? [...leads] : [];
    if (productFilter.length > 0) {
      list = list.filter((l) => productFilter.includes(l.product || "-"));
    }
    if (sortConfig.key && sortConfig.direction) {
      const dir = sortConfig.direction === "asc" ? 1 : -1;
      list.sort((a, b) => {
        let va = "", vb = "";
        if (sortConfig.key === "name") { va = a.name || ""; vb = b.name || ""; }
        else if (sortConfig.key === "phone") { va = a.phone || ""; vb = b.phone || ""; }
        else if (sortConfig.key === "product") { va = a.product || ""; vb = b.product || ""; }
        else if (sortConfig.key === "status") { va = a.status || ""; vb = b.status || ""; }
        else if (sortConfig.key === "saleName") { va = a.saleName || ""; vb = b.saleName || ""; }
        else if (sortConfig.key === "managerName") { va = a.managerName || ""; vb = b.managerName || ""; }
        else if (sortConfig.key === "createdAt") { va = a.createdAt || ""; vb = b.createdAt || ""; }
        return va.localeCompare(vb, "vi") * dir;
      });
    }
    return list;
  }, [leads, productFilter, sortConfig]);

  const tabCounts = useMemo(() => {
    const counts = {};
    LEAD_TABS.forEach((t) => { counts[t.key] = processedLeads.filter(t.filter).length; });
    return counts;
  }, [processedLeads, LEAD_TABS]);

  const parseDate = (s) => {
    if (!s || s === "-") return 0;
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +m[6]).getTime();
    const t = new Date(s).getTime();
    return isNaN(t) ? 0 : t;
  };
  const tabFiltered = useMemo(() => {
    const tab = LEAD_TABS.find((t) => t.key === activeTab);
    const filtered = tab ? processedLeads.filter(tab.filter) : [...processedLeads];
    return filtered.sort((a, b) => parseDate(b.createdAt) - parseDate(a.createdAt));
  }, [processedLeads, activeTab, LEAD_TABS]);

  // Navigate to highlighted lead from notification click
  useEffect(() => {
    if (!highlightLeadId) return;
    // Auto-select "all" project to ensure the lead is visible
    if (!selectedProject) setSelectedProject("all");
    // Switch to "all" tab so we can find the lead
    setActiveTab("all");
  }, [highlightLeadId]);

  useEffect(() => {
    if (!highlightLeadId || activeTab !== "all") return;
    const idx = tabFiltered.findIndex(l => l.id === highlightLeadId);
    if (idx >= 0) {
      const targetPage = Math.floor(idx / pageSize) + 1;
      setCurrentPage(targetPage);
      setExpandedIdStable(highlightLeadId);
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
    (Array.isArray(leads) ? leads : []).forEach(l => {
      if (l.saleName) names.add(l.saleName);
      if (l.saleHistory) l.saleHistory.forEach(h => { if (h.saleName && h.saleName !== "chưa chia") names.add(h.saleName); });
    });
    return [...names].sort();
  }, [leads]);

  const allSaleUsers = useMemo(() => {
    return (Array.isArray(allUsers) ? allUsers : []).filter(u => u.role === "sale" && u.displayName).map(u => u.displayName);
  }, [allUsers]);

  const allManagerNames = useMemo(() => {
    return (Array.isArray(allUsers) ? allUsers : []).filter(u => (u.role === "manager" || u.role === "admin") && u.displayName).map(u => u.displayName).sort();
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
    if (shuffleProduct.length > 0) {
      list = list.filter(l => shuffleProduct.includes(l.product || "-"));
    }
    // Filter by date range (lead createdAt within startDate..endDate)
    if (shuffleStartDate) {
      const start = new Date(shuffleStartDate + "T00:00:00");
      list = list.filter(l => {
        const d = parseLeadDate(l.createdAt);
        return d && d >= start;
      });
    }
    if (shuffleEndDate) {
      const end = new Date(shuffleEndDate + "T23:59:59");
      list = list.filter(l => {
        const d = parseLeadDate(l.createdAt);
        return d && d <= end;
      });
    }
    // Deduplicate by phone to prevent assigning same customer twice
    const seen = new Set();
    list = list.filter(l => {
      const key = (l.phone || '').trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return list;
  }, [leads, shuffleProject, shuffleStatus, shuffleProduct, shuffleStartDate, shuffleEndDate]);

  // Unique products for shuffle project
  const shuffleUniqueProducts = useMemo(() => {
    const pid = Number(shuffleProject);
    if (!pid) return [];
    const set = new Set();
    leads.filter(l => l.projectId === pid).forEach(l => { if (l.product && l.product !== "-") set.add(l.product); });
    return [...set].sort((a, b) => a.localeCompare(b, "vi"));
  }, [leads, shuffleProject]);

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

  // Reset when project/status/date changes
  useEffect(() => { setShufflePickCount("all"); }, [shuffleProject, shuffleStatus, shuffleProduct, shuffleStartDate, shuffleEndDate]);

  // Calculate schedule preview
  const schedulePreview = useMemo(() => {
    const salesCount = shuffleSelectedSales.length;
    if (!salesCount || !shuffleSelected.size) return null;
    const perDay = shuffleLeadsPerDay || 5;
    const totalPerDay = perDay * salesCount;
    const totalLeads = shuffleSelected.size;
    const daysNeeded = Math.ceil(totalLeads / totalPerDay);
    // Actual per-person: if totalLeads < totalPerDay, distribute evenly
    const actualPerPerson = totalLeads < totalPerDay
      ? Math.ceil(totalLeads / salesCount)
      : perDay;
    const perPersonPerTour = Math.min(actualPerPerson * daysNeeded, Math.ceil(totalLeads / salesCount));
    const totalTours = salesCount;
    const totalDays = daysNeeded * totalTours;
    const isReduced = totalLeads < totalPerDay;
    return { daysNeeded, totalPerDay: Math.min(totalPerDay, totalLeads), perPersonPerTour, perDay: isReduced ? actualPerPerson : perDay, totalTours, totalDays, isReduced, actualPerPerson };
  }, [shuffleSelectedSales, shuffleSelected.size, shuffleLeadsPerDay]);

  const handleScheduleDistribution = async () => {
    if (!shuffleSelectedSales.length) return;
    const ids = [...shuffleSelected];
    if (!ids.length) return;
    if (!shuffleStartDate || !shuffleEndDate) { setShuffleMsg("[ERR] Cần chọn ngày bắt đầu và ngày kết thúc"); return; }
    setShuffling(true);
    setShuffleMsg("");
    try {
      const r = await apiFetch(`${API}/leads/schedule-distribution`, {
        method: "POST",
        body: JSON.stringify({
          projectId: shuffleProject,
          saleNames: shuffleSelectedSales,
          statusFilter: shuffleStatus,
          startDate: shuffleStartDate,
          endDate: shuffleEndDate,
          leadsPerDay: shuffleLeadsPerDay,
          leadIds: ids,
          distributeTimes: shuffleDistributeTimes,
        }),
      });
      const data = await r.json();
      if (data.error) { setShuffleMsg("[ERR] " + data.error); }
      else {
        setShuffleMsg("[OK] " + data.msg);
        applyApiData(data);
        if (Array.isArray(data.schedules)) setSchedules(data.schedules);
        setShuffleSelected(new Set());
      }
    } catch (e) {
      setShuffleMsg("[ERR] Lỗi: " + e.message);
    } finally {
      setShuffling(false);
    }
  };

  const handleCancelSchedule = async (scheduleId) => {
    try {
      const r = await apiFetch(`${API}/leads/schedules/${scheduleId}`, { method: "DELETE" });
      const data = await r.json();
      if (Array.isArray(data.schedules)) setSchedules(data.schedules);
      setShuffleMsg("[OK] " + (data.msg || "Đã hủy"));
    } catch (e) {
      setShuffleMsg("[ERR] " + e.message);
    }
  };

  const handleRevokeSchedule = async (scheduleId) => {
    if (!window.confirm("Thu hồi TẤT CẢ lead đã chia từ lịch này? Lead sẽ trở về trạng thái chưa chia.")) return;
    try {
      const r = await apiFetch(`${API}/leads/schedules/${scheduleId}/revoke`, { method: "POST" });
      const data = await r.json();
      if (data.error) { setShuffleMsg("[ERR] " + data.error); return; }
      if (Array.isArray(data.schedules)) setSchedules(data.schedules);
      setShuffleMsg(`[OK] ${data.msg}`);
      if (scheduleDetailId === scheduleId) handleViewScheduleDetail(scheduleId);
    } catch (e) {
      setShuffleMsg("[ERR] " + e.message);
    }
  };

  const handleRestoreSchedule = async (scheduleId) => {
    if (!window.confirm("Khôi phục lead về sale cũ dựa trên lịch sử feedback? Chỉ khôi phục lead hiện chưa có sale.")) return;
    try {
      const r = await apiFetch(`${API}/leads/schedules/${scheduleId}/restore`, { method: "POST" });
      const data = await r.json();
      if (data.error) { setShuffleMsg("[ERR] " + data.error); return; }
      if (Array.isArray(data.schedules)) setSchedules(data.schedules);
      setShuffleMsg(`[OK] ${data.msg}`);
      if (scheduleDetailId === scheduleId) handleViewScheduleDetail(scheduleId);
    } catch (e) {
      setShuffleMsg("[ERR] " + e.message);
    }
  };

  const handleUpdateSchedule = async (scheduleId) => {
    if (!scheduleEditing) return;
    try {
      const r = await apiFetch(`${API}/leads/schedules/${scheduleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadsPerDay: scheduleEditing.leadsPerDay, distributeTimes: scheduleEditing.distributeTimes }),
      });
      const data = await r.json();
      if (data.error) { setShuffleMsg("[ERR] " + data.error); return; }
      if (Array.isArray(data.schedules)) setSchedules(data.schedules);
      setScheduleEditing(null);
      setShuffleMsg("[OK] " + (data.msg || "Đã cập nhật"));
      // Refresh detail data
      handleViewScheduleDetail(scheduleId);
    } catch (e) {
      setShuffleMsg("[ERR] " + e.message);
    }
  };

  const handleViewScheduleDetail = async (scheduleId) => {
    setScheduleDetailId(scheduleId);
    setScheduleDetailData(null);
    setScheduleCalDay(null);
    setScheduleCalMonth(null);
    setScheduleDetailLoading(true);
    try {
      const r = await apiFetch(`${API}/leads/schedules/${scheduleId}/detail`);
      const data = await r.json();
      setScheduleDetailData(data);
    } catch (e) {
      setScheduleDetailData(null);
    } finally {
      setScheduleDetailLoading(false);
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

      {/* Project selection screen - shown when no project selected */}
      {!selectedProject ? (
        <div>
          <h2 style={{ fontSize: isMobile ? 16 : 20, fontWeight: 700, color: "#1f2937", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <FolderOpen size={isMobile ? 18 : 22} /> Chọn dự án để xem khách hàng
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
            {isAdmin && user.role === "admin" && (
              <div onClick={() => setSelectedProject("all")}
                style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", borderRadius: 12, padding: 20, cursor: "pointer", color: "#fff", boxShadow: "0 2px 8px rgba(217,119,6,.25)", transition: "transform .15s, box-shadow .15s" }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(217,119,6,.35)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 2px 8px rgba(217,119,6,.25)"; }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                  <ClipboardList size={16} /> Tất cả dự án
                </div>
                <div style={{ fontSize: 24, fontWeight: 800 }}>{leads.length}</div>
                <div style={{ fontSize: 12, opacity: 0.9 }}>khách hàng</div>
              </div>
            )}
            {availableProjects.map(p => {
              const count = projectLeadCounts[p.id] || 0;
              return (
                <div key={p.id} onClick={() => setSelectedProject(String(p.id))}
                  style={{ background: "#fff", borderRadius: 12, padding: 20, cursor: "pointer", border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,.06)", transition: "transform .15s, box-shadow .15s, border-color .15s" }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,.1)"; e.currentTarget.style.borderColor = "#e88a2e"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,.06)"; e.currentTarget.style.borderColor = "#e5e7eb"; }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#1f2937", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                    <Building2 size={16} style={{ color: "#e88a2e" }} /> {p.name}
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "#e88a2e" }}>{count}</div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>khách hàng</div>
                </div>
              );
            })}
          </div>
          {availableProjects.length === 0 && (
            <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>
              <FolderOpen size={40} style={{ marginBottom: 8, opacity: 0.4 }} />
              <div style={{ fontSize: 14 }}>Chưa được phân công dự án nào</div>
            </div>
          )}
        </div>
      ) : (
      <>

      {/* Admin chia lead */}
      {isAdmin && (
        <div style={{ marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "stretch" }}>
          <button onClick={() => setShuffleOpen(!shuffleOpen)}
            style={{ ...btnPrimary, padding: "12px 20px", fontSize: 14, display: "flex", alignItems: "center", gap: 8, borderRadius: 12, flex: "1 1 auto", minWidth: 180, justifyContent: "center" }}>
            <Shuffle size={16} /> Chia Lead cho Sale
          </button>
          {isAdminOnly && selectedProject && (
            <button
              disabled={redistributing}
              onClick={async () => {
                if (!selectedProject) { showToast("Chọn dự án trước", "error"); return; }
                if (!window.confirm("Phân chia lại TẤT CẢ lead cho các quản lý theo thứ tự xoay vòng?")) return;
                setRedistributing(true);
                try {
                  const r = await apiFetch(`${API}/admin/redistribute-managers/${selectedProject}`, { method: "POST" });
                  const data = await r.json();
                  if (!r.ok) { showToast(data.error || "Lỗi", "error"); return; }
                  const distStr = Object.entries(data.distribution).map(([k, v]) => `${k}: ${v}`).join(", ");
                  showToast(`Đã phân chia ${data.total} lead cho ${data.managers} quản lý (${distStr})`, "success");
                  // Refresh data
                  const r2 = await apiFetch(`${API}/data`);
                  const d2 = await r2.json();
                  applyApiData(d2);
                } catch (e) {
                  showToast("Lỗi: " + e.message, "error");
                } finally {
                  setRedistributing(false);
                }
              }}
              style={{ ...btnPrimary, padding: "12px 20px", fontSize: 14, display: "flex", alignItems: "center", gap: 8, background: "linear-gradient(135deg, #7c3aed, #6d28d9)", borderRadius: 12, flex: "1 1 auto", minWidth: 180, justifyContent: "center" }}>
              <Shield size={16} /> {redistributing ? "Đang chia..." : "Phân chia lại quản lý"}
            </button>
          )}
          {isAdminOnly && selectedProject && (
            <button
              onClick={async () => {
                if (!window.confirm("Khôi phục lại Sale + Trạng thái từ lịch sử liên hệ?\nDùng khi bị mất dữ liệu sale sau sync lỗi.")) return;
                try {
                  const r = await apiFetch(`${API}/recover-sales`, {
                    method: "POST",
                    body: JSON.stringify({ projectId: selectedProject }),
                  });
                  const data = await r.json();
                  if (!r.ok) { showToast(data.error || "Lỗi", "error"); return; }
                  showToast(`Khôi phục xong: ${data.fixedSale} sale, ${data.fixedStatus} trạng thái (${data.total} lead)`, "success");
                  const r2 = await apiFetch(`${API}/data`);
                  const d2 = await r2.json();
                  applyApiData(d2);
                } catch (e) {
                  showToast("Lỗi: " + e.message, "error");
                }
              }}
              style={{ ...btnPrimary, padding: "12px 20px", fontSize: 14, display: "flex", alignItems: "center", gap: 8, background: "linear-gradient(135deg, #dc2626, #b91c1c)", borderRadius: 12, flex: "1 1 auto", minWidth: 180, justifyContent: "center" }}>
              <RefreshCw size={16} /> Khôi phục Sale từ lịch sử
            </button>
          )}
          {isAdminOnly && (
            <button
              onClick={() => setRestoreModal({ step: 'pick', projectId: selectedProject ? Number(selectedProject) : null, preview: null, loading: false, result: null })}
              style={{ ...btnPrimary, padding: "12px 20px", fontSize: 14, display: "flex", alignItems: "center", gap: 8, background: "linear-gradient(135deg, #16a34a, #15803d)", borderRadius: 12, flex: "1 1 auto", minWidth: 200, justifyContent: "center" }}>
              <RefreshCw size={16} /> Khôi phục lead về Sale cũ
            </button>
          )}
          {isAdminOnly && selectedProject && (
            <button
              onClick={async () => {
                if (!window.confirm("Khôi phục Sale + Trạng thái + Lịch sử từ bản backup trước sync?\nDùng khi sync lỗi làm mất hết dữ liệu.")) return;
                try {
                  const r = await apiFetch(`${API}/recover-from-backup`, {
                    method: "POST",
                    body: JSON.stringify({ projectId: selectedProject }),
                  });
                  const data = await r.json();
                  if (data.error && data.total === 0) { showToast(data.error, "error"); return; }
                  if (!r.ok) { showToast(data.error || "Lỗi", "error"); return; }
                  showToast(`Khôi phục từ backup: ${data.fixedSale} sale, ${data.fixedStatus} trạng thái, ${data.fixedHistory} lịch sử (${data.total} lead)`, "success");
                  const r2 = await apiFetch(`${API}/data`);
                  const d2 = await r2.json();
                  applyApiData(d2);
                } catch (e) {
                  showToast("Lỗi: " + e.message, "error");
                }
              }}
              style={{ ...btnPrimary, padding: "12px 20px", fontSize: 14, display: "flex", alignItems: "center", gap: 8, background: "linear-gradient(135deg, #7c3aed, #5b21b6)", borderRadius: 12, flex: "1 1 auto", minWidth: 180, justifyContent: "center" }}>
              <RefreshCw size={16} /> Khôi phục từ Backup
            </button>
          )}
          {isAdminOnly && <button
            onClick={async () => {
              if (!window.confirm("Khôi phục Sale + Trạng thái + Lịch sử từ file crm.db.backup (hôm qua)?\n\n• Sale: chỉ cập nhật lead đang 'Chưa chia'\n• Trạng thái: chỉ cập nhật lead đang 'Mới'\n• Lịch sử: khôi phục các lần feedback/liên hệ cũ")) return;
              try {
                const r = await apiFetch(`${API}/recover-sale-from-dbbackup`, { method: "POST", body: JSON.stringify({}) });
                const data = await r.json();
                if (!r.ok) { showToast(data.error || "Lỗi", "error"); return; }
                showToast(`Khôi phục từ DB backup: ${data.fixedSale} sale, ${data.fixedStatus} trạng thái, ${data.fixedHistory} lịch sử`, "success");
                const r2 = await apiFetch(`${API}/data`);
                const d2 = await r2.json();
                applyApiData(d2);
              } catch (e) {
                showToast("Lỗi: " + e.message, "error");
              }
            }}
            style={{ ...btnPrimary, padding: "12px 20px", fontSize: 14, display: "flex", alignItems: "center", gap: 8, background: "linear-gradient(135deg, #059669, #047857)", borderRadius: 12, flex: "1 1 auto", minWidth: 180, justifyContent: "center" }}>
            <RefreshCw size={16} /> Khôi phục Sale từ DB Backup
          </button>}
          {isAdminOnly && <button
            onClick={async () => {
              try {
                const r = await apiFetch(`${API}/backups`);
                const data = await r.json();
                if (!data.backups?.length) { showToast("Chưa có bản backup nào", "info"); return; }
                setRecoverModal({ backups: data.backups, step: 1, selectedBackup: null, selectedProject: null, loading: false });
              } catch (e) { showToast("Lỗi: " + e.message, "error"); }
            }}
            style={{ ...btnPrimary, padding: "12px 20px", fontSize: 14, display: "flex", alignItems: "center", gap: 8, background: "linear-gradient(135deg, #d97706, #b45309)", borderRadius: 12, flex: "1 1 auto", minWidth: 200, justifyContent: "center" }}>
            <RefreshCw size={16} /> Khôi phục theo dự án
          </button>}
          {isAdminOnly && <button
            onClick={async () => {
              if (!window.confirm("Backup database ngay bây giờ?")) return;
              try {
                const r = await apiFetch(`${API}/backup-now`, { method: "POST" });
                const data = await r.json();
                if (!r.ok) { showToast(data.error || "Lỗi", "error"); return; }
                showToast(`Backup OK: ${data.filename} (${data.sizeMB}MB)${data.removed ? `, xóa ${data.removed} bản cũ` : ""}`, "success");
              } catch (e) { showToast("Lỗi: " + e.message, "error"); }
            }}
            style={{ ...btnPrimary, padding: "12px 20px", fontSize: 14, display: "flex", alignItems: "center", gap: 8, background: "linear-gradient(135deg, #0284c7, #0369a1)", borderRadius: 12, flex: "1 1 auto", minWidth: 140, justifyContent: "center" }}>
            <Save size={16} /> Backup DB
          </button>}
          {isAdminOnly && <button
            onClick={async () => {
              try {
                const r = await apiFetch(`${API}/backups`);
                const data = await r.json();
                if (!data.backups?.length) { showToast("Chưa có bản backup nào", "info"); return; }
                const list = data.backups.map((b, i) => `${i + 1}. ${b.filename} (${b.sizeMB}MB) - ${new Date(b.date).toLocaleString("vi-VN")}`).join("\n");
                const choice = window.prompt(`Có ${data.total} bản backup:\n\n${list}\n\nNhập số thứ tự để khôi phục (hoặc bấm Cancel):`);
                if (!choice) return;
                const idx = parseInt(choice) - 1;
                if (isNaN(idx) || idx < 0 || idx >= data.backups.length) { showToast("Số không hợp lệ", "error"); return; }
                const selected = data.backups[idx];
                if (!window.confirm(`⚠️ Khôi phục DB từ:\n${selected.filename}\n(${new Date(selected.date).toLocaleString("vi-VN")})\n\nDB hiện tại sẽ được backup trước khi restore.\nSau khi restore cần RESTART server.`)) return;
                const r2 = await apiFetch(`${API}/restore-backup`, { method: "POST", body: JSON.stringify({ filename: selected.filename }) });
                const d2 = await r2.json();
                if (!r2.ok) { showToast(d2.error || "Lỗi", "error"); return; }
                showToast(d2.message, "success");
              } catch (e) { showToast("Lỗi: " + e.message, "error"); }
            }}
            style={{ ...btnPrimary, padding: "12px 20px", fontSize: 14, display: "flex", alignItems: "center", gap: 8, background: "linear-gradient(135deg, #64748b, #475569)", borderRadius: 12, flex: "1 1 auto", minWidth: 140, justifyContent: "center" }}>
            <RefreshCw size={16} /> Restore DB
          </button>}

          {/* Restore Lead Modal */}
          {restoreModal && (
            <Modal onClose={() => !restoreModal.loading && setRestoreModal(null)} title="Khôi phục lead về Sale cũ">
              {restoreModal.step === 'pick' && (<>
                <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>Chọn dự án cần khôi phục lead chưa có sale về sale cũ từ lịch sử</div>
                <div style={{ maxHeight: 320, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 8, marginBottom: 12 }}>
                  {projects.map(p => (
                    <div key={p.id} onClick={() => setRestoreModal(prev => ({ ...prev, projectId: p.id }))}
                      style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", gap: 8,
                        background: restoreModal.projectId === p.id ? "#f0fdf4" : "transparent",
                        fontWeight: restoreModal.projectId === p.id ? 700 : 400, fontSize: 13 }}>
                      <span style={{ width: 18, height: 18, borderRadius: 9, border: restoreModal.projectId === p.id ? "2px solid #16a34a" : "1px solid #d1d5db", background: restoreModal.projectId === p.id ? "#16a34a" : "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 10, color: "#fff" }}>
                        {restoreModal.projectId === p.id && "✓"}
                      </span>
                      {p.name}
                    </div>
                  ))}
                </div>
                <button disabled={!restoreModal.projectId || restoreModal.loading}
                  onClick={async () => {
                    setRestoreModal(prev => ({ ...prev, loading: true }));
                    try {
                      const r = await apiFetch(`${API}/leads/restore-preview/${restoreModal.projectId}`);
                      const data = await r.json();
                      setRestoreModal(prev => ({ ...prev, step: 'preview', preview: data, loading: false }));
                    } catch (e) {
                      showToast("Lỗi: " + e.message, "error");
                      setRestoreModal(prev => ({ ...prev, loading: false }));
                    }
                  }}
                  style={{ ...btnPrimary, width: "100%", padding: "10px 16px", fontSize: 14, borderRadius: 10, background: (!restoreModal.projectId || restoreModal.loading) ? "#93c5fd" : "linear-gradient(135deg, #16a34a, #15803d)" }}>
                  {restoreModal.loading ? "Đang kiểm tra..." : "Tiếp theo →"}
                </button>
              </>)}
              {restoreModal.step === 'preview' && restoreModal.preview && (<>
                <div style={{ fontSize: 13, color: "#374151", marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>📊 Kết quả kiểm tra:</div>
                  <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: 12, marginBottom: 8 }}>
                    <div>Lead chưa có sale: <b>{restoreModal.preview.totalUnassigned}</b></div>
                    <div>Có thể khôi phục: <b style={{ color: "#16a34a" }}>{restoreModal.preview.restorable}</b></div>
                    {restoreModal.preview.totalUnassigned - restoreModal.preview.restorable > 0 && (
                      <div style={{ color: "#9ca3af", fontSize: 12 }}>Không có lịch sử: {restoreModal.preview.totalUnassigned - restoreModal.preview.restorable}</div>
                    )}
                  </div>
                  {Object.keys(restoreModal.preview.salesBreakdown || {}).length > 0 && (
                    <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
                      <div style={{ padding: "8px 12px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb", fontSize: 12, fontWeight: 700, display: "flex", justifyContent: "space-between" }}>
                        <span>Sale</span><span>Số lead nhận lại</span>
                      </div>
                      {Object.entries(restoreModal.preview.salesBreakdown).sort((a, b) => b[1] - a[1]).map(([name, count]) => (
                        <div key={name} style={{ padding: "6px 12px", borderBottom: "1px solid #f3f4f6", fontSize: 12, display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontWeight: 600 }}>{name}</span>
                          <span style={{ color: "#16a34a", fontWeight: 700 }}>{count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {restoreModal.preview.restorable === 0 ? (
                  <div style={{ textAlign: "center", color: "#9ca3af", fontSize: 13, padding: 16 }}>Không có lead nào để khôi phục</div>
                ) : (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setRestoreModal(prev => ({ ...prev, step: 'pick', preview: null }))}
                      style={{ flex: 1, padding: "10px 16px", fontSize: 13, borderRadius: 10, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer", fontWeight: 600 }}>
                      ← Quay lại
                    </button>
                    <button disabled={restoreModal.loading}
                      onClick={async () => {
                        setRestoreModal(prev => ({ ...prev, loading: true }));
                        try {
                          const r = await apiFetch(`${API}/leads/restore-by-project`, {
                            method: "POST",
                            body: JSON.stringify({ projectId: restoreModal.projectId }),
                          });
                          const data = await r.json();
                          if (data.error) { showToast(data.error, "error"); setRestoreModal(prev => ({ ...prev, loading: false })); return; }
                          setRestoreModal(prev => ({ ...prev, step: 'done', result: data, loading: false }));
                          const r2 = await apiFetch(`${API}/data`);
                          const d2 = await r2.json();
                          applyApiData(d2);
                        } catch (e) {
                          showToast("Lỗi: " + e.message, "error");
                          setRestoreModal(prev => ({ ...prev, loading: false }));
                        }
                      }}
                      style={{ ...btnPrimary, flex: 2, padding: "10px 16px", fontSize: 13, borderRadius: 10, background: restoreModal.loading ? "#93c5fd" : "linear-gradient(135deg, #16a34a, #15803d)" }}>
                      {restoreModal.loading ? "Đang khôi phục..." : `✓ Khôi phục ${restoreModal.preview.restorable} lead`}
                    </button>
                  </div>
                )}
              </>)}
              {restoreModal.step === 'done' && restoreModal.result && (<>
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                  <div style={{ fontSize: 48, marginBottom: 8 }}>✅</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#16a34a", marginBottom: 8 }}>Khôi phục thành công!</div>
                  <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.6 }}>
                    <div>Lead khôi phục: <b>{restoreModal.result.restored}</b> / {restoreModal.result.total}</div>
                    <div>Sale nhận lại lead: <b>{restoreModal.result.salesRestored}</b></div>
                    {restoreModal.result.chiaEntriesAdded > 0 && (
                      <div style={{ fontSize: 12, color: "#6b7280" }}>Thêm {restoreModal.result.chiaEntriesAdded} lượt chia để sale cũ thấy lead</div>
                    )}
                  </div>
                </div>
                <button onClick={() => setRestoreModal(null)}
                  style={{ ...btnPrimary, width: "100%", padding: "10px 16px", fontSize: 14, borderRadius: 10 }}>
                  Đóng
                </button>
              </>)}
            </Modal>
          )}

          {/* Selective Recovery Modal */}
          {recoverModal && (
            <Modal onClose={() => !recoverModal.loading && setRecoverModal(null)} title="Khôi phục feedback theo dự án">
              {recoverModal.step === 1 && (<>
                <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>Bước 1/2: Chọn dự án cần khôi phục</div>
                <div style={{ maxHeight: 320, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
                  {projects.map(p => (
                    <div key={p.id} onClick={() => setRecoverModal(prev => ({ ...prev, selectedProject: p.id }))}
                      style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", gap: 8,
                        background: recoverModal.selectedProject === p.id ? "#eff6ff" : "transparent",
                        fontWeight: recoverModal.selectedProject === p.id ? 700 : 400, fontSize: 13 }}>
                      <span style={{ width: 18, height: 18, borderRadius: 9, border: recoverModal.selectedProject === p.id ? "2px solid #2563eb" : "1px solid #d1d5db", background: recoverModal.selectedProject === p.id ? "#2563eb" : "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 10, color: "#fff" }}>
                        {recoverModal.selectedProject === p.id && "✓"}
                      </span>
                      {p.name} {p.is_legacy ? <span style={{ fontSize: 10, background: "#dbeafe", color: "#2563eb", padding: "1px 6px", borderRadius: 6, fontWeight: 600 }}>Data cũ</span> : null}
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
                  <button onClick={() => setRecoverModal(null)} style={{ ...btnSecondary, padding: "8px 20px", borderRadius: 8 }}>Hủy</button>
                  <button disabled={!recoverModal.selectedProject}
                    onClick={() => setRecoverModal(prev => ({ ...prev, step: 2, selectedBackup: null }))}
                    style={{ ...btnPrimary, padding: "8px 20px", borderRadius: 8, opacity: recoverModal.selectedProject ? 1 : 0.5 }}>Tiếp theo →</button>
                </div>
              </>)}
              {recoverModal.step === 2 && (<>
                <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>
                  Bước 2/2: Chọn bản backup cho <b>{projects.find(p => p.id === recoverModal.selectedProject)?.name}</b>
                </div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 12 }}>Chỉ khôi phục status + sale + feedback. Không ảnh hưởng dữ liệu khác.</div>
                <div style={{ maxHeight: 300, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
                  {recoverModal.backups.map((b, i) => {
                    const d = new Date(b.date);
                    const label = d.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
                    const isStartup = b.filename.includes("startup");
                    const isManual = b.filename.includes("manual");
                    return (
                      <div key={b.filename} onClick={() => setRecoverModal(prev => ({ ...prev, selectedBackup: b.filename }))}
                        style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", gap: 10,
                          background: recoverModal.selectedBackup === b.filename ? "#fef3c7" : "transparent", fontSize: 13 }}>
                        <span style={{ width: 18, height: 18, borderRadius: 9, border: recoverModal.selectedBackup === b.filename ? "2px solid #d97706" : "1px solid #d1d5db", background: recoverModal.selectedBackup === b.filename ? "#d97706" : "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 10, color: "#fff" }}>
                          {recoverModal.selectedBackup === b.filename && "✓"}
                        </span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: recoverModal.selectedBackup === b.filename ? 700 : 400 }}>{label}</div>
                          <div style={{ fontSize: 11, color: "#9ca3af" }}>{b.sizeMB}MB {isStartup && "· Khởi động"}{isManual && "· Thủ công"}{!isStartup && !isManual && "· Tự động"}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 16 }}>
                  <button onClick={() => setRecoverModal(prev => ({ ...prev, step: 1, selectedBackup: null }))}
                    style={{ ...btnSecondary, padding: "8px 20px", borderRadius: 8 }}>← Quay lại</button>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setRecoverModal(null)} style={{ ...btnSecondary, padding: "8px 20px", borderRadius: 8 }}>Hủy</button>
                    <button disabled={!recoverModal.selectedBackup || recoverModal.loading}
                      onClick={async () => {
                        setRecoverModal(prev => ({ ...prev, loading: true }));
                        try {
                          const r = await apiFetch(`${API}/recover-selective`, {
                            method: "POST",
                            body: JSON.stringify({ filename: recoverModal.selectedBackup, projectId: recoverModal.selectedProject }),
                          });
                          const d = await r.json();
                          if (!r.ok) { showToast(d.error || "Lỗi", "error"); setRecoverModal(prev => ({ ...prev, loading: false })); return; }
                          showToast(`Khôi phục xong: ${d.fixedSale} sale, ${d.fixedStatus} trạng thái, ${d.fixedHistory} lịch sử (${d.total} lead)`, "success");
                          setRecoverModal(null);
                          const r2 = await apiFetch(`${API}/data`);
                          const d2 = await r2.json();
                          applyApiData(d2);
                        } catch (e) { showToast("Lỗi: " + e.message, "error"); setRecoverModal(prev => ({ ...prev, loading: false })); }
                      }}
                      style={{ ...btnPrimary, padding: "8px 20px", borderRadius: 8, background: "linear-gradient(135deg, #d97706, #b45309)", opacity: recoverModal.selectedBackup && !recoverModal.loading ? 1 : 0.5 }}>
                      {recoverModal.loading ? "Đang khôi phục..." : "Khôi phục"}
                    </button>
                  </div>
                </div>
              </>)}
            </Modal>
          )}
          {shuffleOpen && (
            <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 12, padding: 16, marginTop: 8, fontSize: 13, width: "100%" }}>
              <div style={{ fontWeight: 700, marginBottom: 12, color: "#9a3412", fontSize: 15, display: "flex", alignItems: "center", gap: 6 }}><Shuffle size={18} /> Chia Lead cho Sale (Xoay vòng tự động)</div>

              {/* Row 1: Chọn dự án */}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                <div style={{ minWidth: 180 }}>
                  <label style={{ fontSize: 11, color: "#6b7280", fontWeight: 600 }}>1. Chọn dự án</label>
                  <select value={shuffleProject} onChange={(e) => { setShuffleProject(e.target.value); setShuffleSelected(new Set()); setShuffleSelectedSales([]); }}
                    style={{ display: "block", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, marginTop: 4, width: "100%", color: shuffleProject ? "#1f2937" : "#9ca3af" }}>
                    <option value="">-- Chọn dự án --</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>

                {/* Row 2: Chọn Sale (multi-select) */}
                {shuffleProject && (
                  <div style={{ minWidth: 200, flex: 1, position: "relative" }}>
                    <label style={{ fontSize: 11, color: "#6b7280", fontWeight: 600 }}>2. Chọn Sale (nhiều người)</label>
                    <input value={shuffleSaleSearch} onChange={(e) => setShuffleSaleSearch(e.target.value)}
                      onFocus={() => setShuffleSaleFocused(true)}
                      onBlur={() => setTimeout(() => setShuffleSaleFocused(false), 200)}
                      placeholder="Tìm sale để thêm..."
                      style={{ ...inputStyle, marginBottom: 0, marginTop: 4, width: "100%", fontSize: 13 }} />
                    {(() => {
                      const q = shuffleSaleSearch.toLowerCase();
                      const userSales = allUsers.filter(u => u.role === "sale" && u.displayName).map(u => u.displayName);
                      const allSales = [...new Set([...userSales, ...saleNames])].sort();
                      const filtered = allSales.filter(s => (!q || s.toLowerCase().includes(q)) && !shuffleSelectedSales.includes(s));
                      if (shuffleSaleFocused) return (
                        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #d1d5db", borderRadius: 8, maxHeight: 200, overflowY: "auto", zIndex: 50, boxShadow: "0 4px 12px rgba(0,0,0,.1)" }}>
                          {filtered.length > 0 ? filtered.map(s => (
                            <div key={s} onClick={() => { setShuffleSelectedSales(prev => [...prev, s]); setShuffleSaleSearch(""); setShuffleSaleFocused(false); }}
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
                    {shuffleSelectedSales.length > 0 && (
                      <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {shuffleSelectedSales.map(s => (
                          <span key={s} style={{ background: "#e8f5e9", color: "#1a3c20", padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <Check size={10} /> {s}
                            <button onClick={() => setShuffleSelectedSales(prev => prev.filter(x => x !== s))}
                              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#ef4444", padding: 0, marginLeft: 2 }}><X size={12} /></button>
                          </span>
                        ))}
                        <button onClick={() => setShuffleSelectedSales([])}
                          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 10, color: "#ef4444", fontWeight: 600 }}>Xóa tất cả</button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Row 3: Trạng thái + Giai đoạn ngày + Số lượng */}
              {shuffleProject && shuffleSelectedSales.length > 0 && (
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
                    <div style={{ minWidth: 180, position: "relative" }}>
                      <label style={{ fontSize: 11, color: "#6b7280", fontWeight: 600 }}>3b. Lọc theo nhu cầu {shuffleProduct.length > 0 && <span style={{ color: "#f59e0b" }}>({shuffleProduct.length})</span>}</label>
                      <button onClick={() => setShuffleProductOpen(p => !p)}
                        style={{ display: "block", padding: "8px 10px", borderRadius: 8, border: shuffleProduct.length > 0 ? "2px solid #f59e0b" : "1px solid #d1d5db", fontSize: 13, marginTop: 4, width: "100%", color: "#1f2937", background: "#fff", cursor: "pointer", textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {shuffleProduct.length === 0 ? "Tất cả nhu cầu" : `Nhu cầu (${shuffleProduct.length})`}
                      </button>
                      {shuffleProductOpen && (
                        <div style={{ position: "absolute", top: "100%", left: 0, zIndex: 50, background: "#fff", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,.15)", border: "1px solid #e5e7eb", width: 240, maxHeight: 250, overflow: "auto", marginTop: 2 }}>
                          <div style={{ padding: "6px 10px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                            <button onClick={() => setShuffleProduct([...shuffleUniqueProducts])} style={{ background: "none", border: "none", cursor: "pointer", color: "#2563eb", fontSize: 11, padding: 0 }}>Chọn tất cả</button>
                            <button onClick={() => setShuffleProduct([])} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 11, padding: 0 }}>Xóa</button>
                          </div>
                          {shuffleUniqueProducts.map(p => (
                            <label key={p} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", cursor: "pointer", fontSize: 12, background: shuffleProduct.includes(p) ? "#eff6ff" : "transparent" }}>
                              <input type="checkbox" checked={shuffleProduct.includes(p)}
                                onChange={() => setShuffleProduct(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])} />
                              {p}
                            </label>
                          ))}
                          <div style={{ padding: "6px 10px", borderTop: "1px solid #f3f4f6", textAlign: "right" }}>
                            <button onClick={() => setShuffleProductOpen(false)}
                              style={{ background: "#2563eb", color: "#fff", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, padding: "4px 14px", borderRadius: 6 }}>OK</button>
                          </div>
                        </div>
                      )}
                    </div>
                    <div style={{ minWidth: 145 }}>
                      <label style={{ fontSize: 11, color: "#6b7280", fontWeight: 600 }}>4. Ngày bắt đầu có khách</label>
                      <input type="date" value={shuffleStartDate} onChange={(e) => setShuffleStartDate(e.target.value)}
                        style={{ display: "block", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, marginTop: 4, width: "100%", color: "#1f2937" }} />
                    </div>
                    <div style={{ minWidth: 145 }}>
                      <label style={{ fontSize: 11, color: "#6b7280", fontWeight: 600 }}>5. Ngày ngừng nhận lead</label>
                      <input type="date" value={shuffleEndDate} onChange={(e) => setShuffleEndDate(e.target.value)}
                        min={shuffleStartDate || undefined}
                        style={{ display: "block", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, marginTop: 4, width: "100%", color: "#1f2937" }} />
                    </div>
                    <div style={{ minWidth: 120 }}>
                      <label style={{ fontSize: 11, color: "#6b7280", fontWeight: 600 }}>6. Lead/ngày/người</label>
                      <input type="number" min={1} max={100} value={shuffleLeadsPerDay}
                        onChange={(e) => {
                          const v = Math.max(1, Math.min(100, Number(e.target.value) || 1));
                          setShuffleLeadsPerDay(v);
                          if (v < shuffleNumSlots) {
                            setShuffleNumSlots(v);
                            setShuffleDistributeTimes(prev => prev.slice(0, v));
                          }
                        }}
                        style={{ display: "block", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, marginTop: 4, width: "100%", color: "#1f2937" }} />
                    </div>
                    <div style={{ minWidth: 130 }}>
                      <label style={{ fontSize: 11, color: "#6b7280", fontWeight: 600 }}>7. Số khung giờ/ngày</label>
                      <select value={shuffleNumSlots}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          setShuffleNumSlots(n);
                          setShuffleDistributeTimes(prev => {
                            const arr = [...prev];
                            while (arr.length < n) arr.push(arr.length === 0 ? "08:00" : arr.length === 1 ? "12:00" : "18:00");
                            return arr.slice(0, n);
                          });
                        }}
                        style={{ display: "block", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, marginTop: 4, width: "100%", color: "#1f2937" }}>
                        {Array.from({ length: Math.min(shuffleLeadsPerDay, 10) }, (_, i) => i + 1).map(n => (
                          <option key={n} value={n}>{n} khung giờ</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ minWidth: 150 }}>
                      <label style={{ fontSize: 11, color: "#6b7280", fontWeight: 600 }}>8. Chọn số lượng lead</label>
                      <select value={shufflePickCount} onChange={(e) => setShufflePickCount(e.target.value)}
                        style={{ display: "block", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, marginTop: 4, width: "100%", color: "#1f2937" }}>
                        <option value="all">Tất cả ({shuffleFilteredLeads.length})</option>
                        <option value="10">10 lead</option>
                        <option value="25">25 lead</option>
                        <option value="50">50 lead</option>
                        <option value="100">100 lead</option>
                        <option value="manual">Chọn tay</option>
                      </select>
                    </div>
                  </div>

                  {/* Time slot pickers */}
                  {shuffleNumSlots > 0 && (
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12, alignItems: "flex-end" }}>
                      {shuffleDistributeTimes.map((t, i) => {
                        const perSlot = Math.ceil(shuffleLeadsPerDay / shuffleNumSlots);
                        return (
                          <div key={i} style={{ minWidth: 140 }}>
                            <label style={{ fontSize: 11, color: "#6b7280", fontWeight: 600 }}>
                              Khung {i + 1} ({perSlot} lead/người)
                            </label>
                            <input type="time" value={t}
                              onChange={(e) => {
                                const arr = [...shuffleDistributeTimes];
                                arr[i] = e.target.value;
                                setShuffleDistributeTimes(arr);
                              }}
                              style={{ display: "block", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, marginTop: 4, width: "100%", color: "#1f2937" }} />
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Date range info */}
                  {shuffleStartDate && shuffleEndDate && (
                    <div style={{ background: "#fefce8", border: "1px solid #fde68a", borderRadius: 8, padding: 8, marginBottom: 10, fontSize: 11, color: "#92400e" }}>
                      📅 Giai đoạn nhận khách: <strong>{shuffleStartDate}</strong> → <strong>{shuffleEndDate}</strong>
                      &nbsp;| Lead trong giai đoạn: <strong>{shuffleFilteredLeads.length}</strong>
                      &nbsp;| Chia {shuffleLeadsPerDay} lead/ngày/người × {shuffleNumSlots} khung giờ ({shuffleDistributeTimes.join(', ')}).
                    </div>
                  )}

                  {/* Schedule info box */}
                  {schedulePreview && shuffleStartDate && shuffleEndDate && (
                    <div style={{ background: schedulePreview.isReduced ? "#fffbeb" : "#eff6ff", border: `1px solid ${schedulePreview.isReduced ? "#fde68a" : "#bfdbfe"}`, borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 12 }}>
                      <div style={{ fontWeight: 700, color: schedulePreview.isReduced ? "#92400e" : "#1e40af", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}><Info size={14} /> Thông tin lịch chia lead</div>
                      {schedulePreview.isReduced && (
                        <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 6, padding: "8px 12px", marginBottom: 8, fontSize: 11, color: "#dc2626", fontWeight: 600 }}>
                          ⚠️ Tổng lead ({shuffleSelected.size}) ít hơn yêu cầu ({(shuffleLeadsPerDay || 5) * shuffleSelectedSales.length}/ngày). Hệ thống sẽ chia đều: ~{schedulePreview.actualPerPerson} lead/người/ngày.
                        </div>
                      )}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, color: "#374151" }}>
                        <div>👥 Số sale: <strong>{shuffleSelectedSales.length} người</strong></div>
                        <div>📊 Tổng lead: <strong>{shuffleSelected.size}</strong></div>
                        <div>📋 Lead/ngày/người: <strong>{schedulePreview.perDay}</strong>{schedulePreview.isReduced && <span style={{ color: "#dc2626", fontSize: 10 }}> (giảm từ {shuffleLeadsPerDay})</span>}</div>
                        <div>📝 Lead/ngày tổng: <strong>{schedulePreview.totalPerDay}</strong></div>
                        <div>🕐 Khung giờ: <strong>{shuffleNumSlots} khung</strong> ({Math.ceil(schedulePreview.perDay / shuffleNumSlots)} lead/khung/người)</div>
                        <div>⏰ Giờ chia: <strong>{shuffleDistributeTimes.join(' | ')}</strong></div>
                        <div>🔄 Số tour: <strong>{schedulePreview.totalTours} tour</strong> ({schedulePreview.daysNeeded} ngày/tour)</div>
                        <div>⏱️ Tổng số ngày: <strong>{schedulePreview.totalDays} ngày</strong></div>
                        <div>👤 Mỗi người nhận: <strong>tất cả {shuffleSelected.size} lead</strong> (qua {schedulePreview.totalTours} tour)</div>
                      </div>
                      <div style={{ marginTop: 6, fontSize: 11, color: "#6b7280" }}>
                        Mỗi ngày chia {schedulePreview.perDay} lead/người chia thành {shuffleNumSlots} khung giờ. Chia đều cho tất cả sale, chênh lệch tối đa 1 lead. Xoay vòng {schedulePreview.totalTours} tour.
                      </div>
                    </div>
                  )}

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
                    <button onClick={handleScheduleDistribution} disabled={shuffling || !shuffleSelected.size || !shuffleSelectedSales.length || !shuffleStartDate || !shuffleEndDate}
                      style={{ ...btnPrimary, padding: "10px 24px", fontSize: 14, opacity: (!shuffleSelected.size || shuffling || !shuffleSelectedSales.length || !shuffleStartDate || !shuffleEndDate) ? 0.5 : 1 }}>
                      {shuffling ? "Đang tạo lịch..." : <><Share2 size={14} /> Tạo lịch chia {shuffleSelected.size} lead cho {shuffleSelectedSales.length} sale</>}
                    </button>
                  </div>
                </>
              )}

              {/* Active schedules list */}
              {schedules && schedules.length > 0 && (() => {
                const filtered = schedules.filter(sch => {
                  if (!scheduleHistorySearch.trim()) return true;
                  const q = scheduleHistorySearch.toLowerCase();
                  const projName = projects.find(p => p.id === sch.projectId)?.name || "";
                  return projName.toLowerCase().includes(q) || sch.saleNames.some(s => s.toLowerCase().includes(q)) || String(sch.id).includes(q);
                });
                const perPage = 5;
                const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
                const safePage = Math.min(scheduleHistoryPage, totalPages);
                const paged = filtered.slice((safePage - 1) * perPage, safePage * perPage);
                return (
                <div style={{ marginTop: 16, borderTop: "1px solid #fed7aa", paddingTop: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#9a3412", display: "flex", alignItems: "center", gap: 4 }}>
                      <CalendarCheck size={14} /> Lịch sử chia lead ({filtered.length})
                    </div>
                    <input value={scheduleHistorySearch} onChange={e => { setScheduleHistorySearch(e.target.value); setScheduleHistoryPage(1); }}
                      placeholder="Tìm lịch sử..." style={{ ...inputStyle, width: 160, fontSize: 11, padding: "4px 8px" }} />
                  </div>
                  {paged.map(sch => {
                    const projName = projects.find(p => p.id === sch.projectId)?.name || `#${sch.projectId}`;
                    const totalTours = sch.totalTours || sch.saleNames.length || 1;
                    const curTour = sch.currentTour || 0;
                    const overallDone = curTour * sch.totalCount + sch.assignedIndex;
                    const overallTotal = totalTours * sch.totalCount;
                    const pct = overallTotal ? Math.round(overallDone / overallTotal * 100) : 0;
                    return (
                      <div key={sch.id} style={{
                        background: sch.isActive ? "#fff" : "#f9fafb",
                        border: "1px solid " + (sch.isActive ? "#d1d5db" : "#e5e7eb"),
                        borderRadius: 8, padding: 10, marginBottom: 6, fontSize: 12,
                        opacity: sch.isActive ? 1 : 0.7,
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                          <span style={{ fontWeight: 700, color: "#1f2937" }}>
                            #{sch.id} - {projName}
                            {sch.isActive ? (
                              <span style={{ background: "#dcfce7", color: "#166534", padding: "1px 6px", borderRadius: 8, fontSize: 10, marginLeft: 6 }}>Đang chạy</span>
                            ) : (
                              <span style={{ background: "#f3f4f6", color: "#6b7280", padding: "1px 6px", borderRadius: 8, fontSize: 10, marginLeft: 6 }}>Hoàn thành</span>
                            )}
                          </span>
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <button onClick={() => handleViewScheduleDetail(sch.id)}
                              style={{ background: "#2563eb", color: "#fff", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 6 }}>Xem chi tiết</button>
                            {sch.isActive && (
                              <button onClick={() => handleCancelSchedule(sch.id)}
                                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#ef4444", fontWeight: 600 }}>Hủy</button>
                            )}
                          </div>
                        </div>
                        <div style={{ color: "#6b7280", marginBottom: 4 }}>
                          Sale: {sch.saleNames.join(", ")} | {sch.leadsPerDay} lead/ngày/người
                          {sch.distributeTimes && sch.distributeTimes.length > 0 && ` | ⏰ ${sch.distributeTimes.join(', ')}`}
                          {sch.startDate && ` | ${sch.startDate} → ${sch.endDate}`}
                        </div>
                        <div style={{ background: "#f3f4f6", borderRadius: 4, height: 6, overflow: "hidden", marginBottom: 2 }}>
                          <div style={{ background: sch.isActive ? "#22c55e" : "#9ca3af", height: "100%", width: `${pct}%`, transition: "width .3s" }} />
                        </div>
                        <div style={{ fontSize: 11, color: "#9ca3af" }}>
                          Tour {Math.min(curTour + 1, totalTours)}/{totalTours} | Đã chia: {overallDone}/{overallTotal} ({pct}%)
                          {sch.lastProcessedDate && ` | Lần cuối: ${sch.lastProcessedDate}`}
                        </div>
                      </div>
                    );
                  })}
                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 8 }}>
                      <button onClick={() => setScheduleHistoryPage(p => Math.max(1, p - 1))} disabled={safePage <= 1}
                        style={{ background: "none", border: "1px solid #d1d5db", borderRadius: 6, padding: "3px 10px", fontSize: 12, cursor: safePage <= 1 ? "default" : "pointer", color: safePage <= 1 ? "#d1d5db" : "#374151" }}>←</button>
                      <span style={{ fontSize: 12, color: "#6b7280" }}>Trang {safePage}/{totalPages}</span>
                      <button onClick={() => setScheduleHistoryPage(p => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}
                        style={{ background: "none", border: "1px solid #d1d5db", borderRadius: 6, padding: "3px 10px", fontSize: 12, cursor: safePage >= totalPages ? "default" : "pointer", color: safePage >= totalPages ? "#d1d5db" : "#374151" }}>→</button>
                    </div>
                  )}
                </div>
                );
              })()}

              {/* Schedule Detail Modal - Calendar View */}
              {scheduleDetailId && (
                <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
                  onClick={() => { setScheduleDetailId(null); setScheduleDetailData(null); setScheduleCalDay(null); setScheduleCalMonth(null); setScheduleExpandedSales({}); setScheduleSaleSearch(""); }}>
                  <div style={{ background: "#fff", borderRadius: 12, width: "100%", maxWidth: 900, maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }}
                    onClick={e => e.stopPropagation()}>
                    {/* Modal header */}
                    {(() => {
                      const sch = schedules.find(s => s.id === scheduleDetailId);
                      const projName = sch ? (projects.find(p => p.id === sch.projectId)?.name || `#${sch.projectId}`) : "";
                      return (
                        <div style={{ padding: "14px 16px", borderBottom: "1px solid #e5e7eb", flexShrink: 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 15, color: "#1f2937", display: "flex", alignItems: "center", gap: 6 }}>
                                <Calendar size={16} /> Lịch chia lead #{scheduleDetailId}
                              </div>
                              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                                {projName}
                                {sch && sch.startDate && ` | ${sch.startDate} → ${sch.endDate}`}
                                {sch && sch.distributeTimes && sch.distributeTimes.length > 0 && ` | ⏰ ${sch.distributeTimes.join(', ')}`}
                                {sch && ` | ${sch.saleNames.join(", ")} | ${sch.leadsPerDay} lead/ngày/người`}
                                {sch && sch.totalTours > 1 && ` | Tour ${Math.min((sch.currentTour || 0) + 1, sch.totalTours)}/${sch.totalTours}`}
                              </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              {sch && sch.isActive && !scheduleEditing && (
                                <button onClick={() => setScheduleEditing({ leadsPerDay: sch.leadsPerDay, distributeTimes: [...sch.distributeTimes], numSlots: sch.distributeTimes.length })}
                                  style={{ background: "#f59e0b", color: "#fff", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 6, display: "flex", alignItems: "center", gap: 4 }}>
                                  <Settings size={13} /> Tăng hiệu suất
                                </button>
                              )}
                              {sch && isAdminOnly && (
                                <button onClick={() => handleRestoreSchedule(sch.id)}
                                  style={{ background: "#f0fdf4", color: "#16a34a", border: "1px solid #86efac", cursor: "pointer", fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 6, display: "flex", alignItems: "center", gap: 4 }}>
                                  <RefreshCw size={13} /> Khôi phục
                                </button>
                              )}
                              {sch && isAdminOnly && (
                                <button onClick={() => handleRevokeSchedule(sch.id)}
                                  style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fca5a5", cursor: "pointer", fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 6, display: "flex", alignItems: "center", gap: 4 }}>
                                  <Trash2 size={13} /> Thu hồi
                                </button>
                              )}
                              <button onClick={() => { setScheduleDetailId(null); setScheduleDetailData(null); setScheduleCalDay(null); setScheduleCalMonth(null); setScheduleEditing(null); setScheduleExpandedSales({}); setScheduleSaleSearch(""); }}
                                style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                                <X size={20} color="#6b7280" />
                              </button>
                            </div>
                          </div>
                          {/* Inline edit form */}
                          {scheduleEditing && sch && sch.isActive && (
                            <div style={{ marginTop: 10, padding: 12, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8 }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: "#92400e", marginBottom: 8 }}>⚡ Tăng hiệu suất (áp dụng từ bây giờ)</div>
                              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                                <div>
                                  <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 2 }}>Lead/ngày/người</label>
                                  <input type="number" min={1} max={100} value={scheduleEditing.leadsPerDay}
                                    onChange={e => {
                                      const v = Math.max(1, Math.min(100, Number(e.target.value) || 1));
                                      setScheduleEditing(prev => ({
                                        ...prev, leadsPerDay: v,
                                        numSlots: Math.min(prev.numSlots, v),
                                        distributeTimes: prev.distributeTimes.slice(0, Math.min(prev.numSlots, v))
                                      }));
                                    }}
                                    style={{ width: 70, padding: "4px 8px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13 }} />
                                </div>
                                <div>
                                  <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 2 }}>Khung giờ/ngày</label>
                                  <select value={scheduleEditing.numSlots}
                                    onChange={e => {
                                      const v = Number(e.target.value);
                                      setScheduleEditing(prev => {
                                        const defaults = ["08:00", "12:00", "18:00", "09:00", "14:00", "17:00", "10:00", "15:00", "19:00", "20:00"];
                                        const arr = [...prev.distributeTimes];
                                        while (arr.length < v) arr.push(defaults[arr.length] || "08:00");
                                        return { ...prev, numSlots: v, distributeTimes: arr.slice(0, v) };
                                      });
                                    }}
                                    style={{ width: 60, padding: "4px 8px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13 }}>
                                    {Array.from({ length: Math.min(scheduleEditing.leadsPerDay, 10) }, (_, i) => i + 1).map(n => (
                                      <option key={n} value={n}>{n}</option>
                                    ))}
                                  </select>
                                </div>
                                {scheduleEditing.distributeTimes.map((t, i) => (
                                  <div key={i}>
                                    <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 2 }}>Khung {i + 1} ({Math.ceil(scheduleEditing.leadsPerDay / scheduleEditing.numSlots)} lead)</label>
                                    <input type="time" value={t}
                                      onChange={e => setScheduleEditing(prev => {
                                        const arr = [...prev.distributeTimes];
                                        arr[i] = e.target.value;
                                        return { ...prev, distributeTimes: arr };
                                      })}
                                      style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13 }} />
                                  </div>
                                ))}
                              </div>
                              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                                <button onClick={() => handleUpdateSchedule(scheduleDetailId)}
                                  style={{ background: "#059669", color: "#fff", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, padding: "6px 16px", borderRadius: 6 }}>
                                  ✓ Áp dụng
                                </button>
                                <button onClick={() => setScheduleEditing(null)}
                                  style={{ background: "none", border: "1px solid #d1d5db", cursor: "pointer", fontSize: 12, color: "#6b7280", padding: "6px 12px", borderRadius: 6 }}>
                                  Hủy
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Modal body */}
                    <div style={{ overflow: "auto", padding: 16, flex: 1 }}>
                      {scheduleDetailLoading && <div style={{ textAlign: "center", color: "#9ca3af", padding: 32 }}>Đang tải...</div>}
                      {scheduleDetailData && scheduleDetailData.schedule && (() => {
                        const det = scheduleDetailData;
                        const log = det.schedule.assignmentLog || [];
                        const leadMap = {};
                        (det.leadDetails || []).forEach(l => { leadMap[l.id] = l; });

                        const sNames = det.schedule.saleNames;
                        const perDay = det.schedule.leadsPerDay || 5;
                        const currentTour = det.schedule.currentTour || 0;
                        const totalTours = det.schedule.totalTours || sNames.length;
                        const pastEntries = log.map(e => ({ ...e, planned: false }));

                        // Build future plan for remaining leads across all remaining tours
                        const totalPerDay = perDay * sNames.length;
                        const futurePlan = [];
                        let futureDate = new Date();
                        futureDate.setDate(futureDate.getDate() + 1);

                        // Current tour remaining
                        const allLeadIds = det.schedule.leadIds;
                        let startTour = currentTour;
                        let startIdx = det.schedule.assignedIndex;

                        for (let tour = startTour; tour < totalTours; tour++) {
                          const remaining = allLeadIds.slice(tour === startTour ? startIdx : 0);
                          if (!remaining.length) continue;
                          let rIdx = 0;
                          while (rIdx < remaining.length) {
                            const dayBatch = remaining.slice(rIdx, rIdx + totalPerDay);
                            const dateStr = futureDate.toISOString().slice(0, 10);
                            // Even round-robin: distribute dayBatch evenly across all sales
                            const ns = sNames.length;
                            const perPerson = Math.floor(dayBatch.length / ns);
                            const extra = dayBatch.length % ns;
                            let leadIdx = 0;
                            for (let si = 0; si < ns; si++) {
                              const rotatedSi = (si + tour) % ns;
                              const quota = perPerson + (si < extra ? 1 : 0);
                              for (let q = 0; q < quota; q++) {
                                if (leadIdx < dayBatch.length) {
                                  futurePlan.push({ leadId: dayBatch[leadIdx], saleName: sNames[rotatedSi], date: dateStr, planned: true, tour });
                                  leadIdx++;
                                }
                              }
                            }
                            rIdx += dayBatch.length;
                            futureDate.setDate(futureDate.getDate() + 1);
                          }
                        }
                        const allEntries = [...pastEntries, ...futurePlan];
                        const byDate = {};
                        allEntries.forEach(e => {
                          if (!byDate[e.date]) byDate[e.date] = [];
                          byDate[e.date].push(e);
                        });

                        const saleSummary = {};
                        sNames.forEach(s => { saleSummary[s] = { done: 0, planned: 0 }; });
                        allEntries.forEach(e => {
                          if (saleSummary[e.saleName]) {
                            if (e.planned) saleSummary[e.saleName].planned++;
                            else saleSummary[e.saleName].done++;
                          }
                        });

                        const allDates = Object.keys(byDate).sort();
                        const firstDate = allDates.length ? new Date(allDates[0] + "T00:00:00") : new Date();
                        const lastDate = allDates.length ? new Date(allDates[allDates.length - 1] + "T00:00:00") : new Date();
                        const defaultMonth = firstDate.getMonth();
                        const defaultYear = firstDate.getFullYear();
                        const calMonth = scheduleCalMonth ? scheduleCalMonth.month : defaultMonth;
                        const calYear = scheduleCalMonth ? scheduleCalMonth.year : defaultYear;
                        const minMonth = firstDate.getFullYear() * 12 + firstDate.getMonth();
                        const maxMonth = lastDate.getFullYear() * 12 + lastDate.getMonth();
                        const curMonth = calYear * 12 + calMonth;
                        const canPrev = curMonth > minMonth;
                        const canNext = curMonth < maxMonth;
                        const firstDayOfMonth = new Date(calYear, calMonth, 1).getDay();
                        const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
                        const calWeeks = [];
                        let week = new Array(firstDayOfMonth).fill(null);
                        for (let d = 1; d <= daysInMonth; d++) {
                          week.push(d);
                          if (week.length === 7) { calWeeks.push(week); week = []; }
                        }
                        if (week.length) { while (week.length < 7) week.push(null); calWeeks.push(week); }

                        const calDayNames = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
                        const calMonthNames = ["Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
                          "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"];
                        const todayStr = getTodayStr();
                        const saleColors = ["#059669", "#2563eb", "#d97706", "#dc2626", "#7c3aed", "#0891b2", "#be185d", "#65a30d"];

                        return (
                          <div>
                            {/* Summary badges */}
                            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                              {sNames.map((name, si) => (
                                <div key={name} style={{
                                  background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8,
                                  padding: "6px 12px", display: "flex", alignItems: "center", gap: 6, fontSize: 12,
                                }}>
                                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: saleColors[si % saleColors.length], display: "inline-block" }} />
                                  <strong>{name}</strong>
                                  <span style={{ color: "#6b7280" }}>{saleSummary[name].done} đã chia</span>
                                  {saleSummary[name].planned > 0 && <span style={{ color: "#d97706" }}>+ {saleSummary[name].planned} dự kiến</span>}
                                </div>
                              ))}
                            </div>

                            {/* Calendar grid */}
                            <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden" }}>
                              <div style={{ padding: "8px 12px", background: "#f8fafc", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <button onClick={() => { if (canPrev) { const p = curMonth - 1; setScheduleCalMonth({ month: p % 12, year: Math.floor(p / 12) }); setScheduleCalDay(null); } }}
                                  disabled={!canPrev} style={{ background: "none", border: "none", cursor: canPrev ? "pointer" : "default", padding: "4px 8px", fontSize: 16, color: canPrev ? "#374151" : "#d1d5db" }}>◀</button>
                                <span style={{ fontWeight: 700, fontSize: 14, color: "#374151" }}>{calMonthNames[calMonth]} {calYear}</span>
                                <button onClick={() => { if (canNext) { const n = curMonth + 1; setScheduleCalMonth({ month: n % 12, year: Math.floor(n / 12) }); setScheduleCalDay(null); } }}
                                  disabled={!canNext} style={{ background: "none", border: "none", cursor: canNext ? "pointer" : "default", padding: "4px 8px", fontSize: 16, color: canNext ? "#374151" : "#d1d5db" }}>▶</button>
                              </div>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)" }}>
                                {calDayNames.map(d => (
                                  <div key={d} style={{ padding: "8px 4px", textAlign: "center", fontWeight: 700, fontSize: 11, color: d === "CN" ? "#ef4444" : "#6b7280", background: "#f8fafc", borderBottom: "1px solid #e5e7eb" }}>{d}</div>
                                ))}
                                {calWeeks.flat().map((day, i) => {
                                  const dateStr = day ? `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}` : null;
                                  const dayEntries = dateStr ? (byDate[dateStr] || []) : [];
                                  const isTodayCell = dateStr === todayStr;
                                  const isSelected = dateStr === scheduleCalDay;
                                  const hasPast = dayEntries.some(e => !e.planned);
                                  const hasFuture = dayEntries.some(e => e.planned);

                                  return (
                                    <div key={i}
                                      onClick={() => { if (dayEntries.length > 0) { setScheduleCalDay(isSelected ? null : dateStr); setScheduleExpandedSales({}); setScheduleSaleSearch(""); } }}
                                      style={{
                                        minHeight: isMobile ? 50 : 80, padding: 3,
                                        borderBottom: "1px solid #f3f4f6", borderRight: "1px solid #f3f4f6",
                                        background: isSelected ? "#dbeafe" : isTodayCell ? "#fef6ee" : (day ? "#fff" : "#fafafa"),
                                        cursor: dayEntries.length > 0 ? "pointer" : "default",
                                        outline: isSelected ? "2px solid #3b82f6" : "none",
                                        outlineOffset: -2,
                                      }}>
                                      {day && (
                                        <>
                                          <div style={{ fontSize: 11, fontWeight: isTodayCell ? 700 : 400, color: isTodayCell ? "#e88a2e" : (i % 7 === 0 ? "#ef4444" : "#374151"), marginBottom: 1 }}>{day}</div>
                                          {dayEntries.length > 0 && (() => {
                                            const bySale = {};
                                            dayEntries.forEach(e => {
                                              if (!bySale[e.saleName]) bySale[e.saleName] = [];
                                              bySale[e.saleName].push(e);
                                            });
                                            const saleEntries = Object.entries(bySale);
                                            const maxShow = isMobile ? 1 : 3;
                                            return (
                                              <>
                                                {saleEntries.slice(0, maxShow).map(([sale, entries]) => {
                                                  const si = sNames.indexOf(sale);
                                                  const color = saleColors[si >= 0 ? si % saleColors.length : 0];
                                                  const isPlanned = entries[0].planned;
                                                  return (
                                                    <div key={sale} style={{
                                                      background: isPlanned ? "#fefce8" : "#ecfdf5",
                                                      color: isPlanned ? "#92400e" : color,
                                                      padding: "1px 4px", borderRadius: 3,
                                                      fontSize: 9, marginBottom: 1, overflow: "hidden",
                                                      textOverflow: "ellipsis", whiteSpace: "nowrap",
                                                      fontWeight: 600, borderLeft: `2px solid ${color}`,
                                                    }}>
                                                      {sale}: {entries.length}
                                                    </div>
                                                  );
                                                })}
                                                {saleEntries.length > maxShow && (
                                                  <div style={{ fontSize: 8, color: "#9ca3af" }}>+{saleEntries.length - maxShow}</div>
                                                )}
                                                <div style={{ fontSize: 8, color: hasPast && hasFuture ? "#d97706" : hasPast ? "#059669" : "#d97706", marginTop: 1 }}>
                                                  {dayEntries.length} lead {hasPast && !hasFuture ? "✓" : hasFuture && !hasPast ? "⏳" : ""}
                                                </div>
                                              </>
                                            );
                                          })()}
                                        </>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Detail panel - only for clicked day */}
                            {scheduleCalDay && byDate[scheduleCalDay] && (() => {
                              const entries = byDate[scheduleCalDay];
                              const isTodayRow = scheduleCalDay === todayStr;
                              const isPast = scheduleCalDay < todayStr;
                              const bySale = {};
                              entries.forEach(e => {
                                if (!bySale[e.saleName]) bySale[e.saleName] = [];
                                bySale[e.saleName].push(e);
                              });
                              const saleList = Object.entries(bySale).sort((a, b) => b[1].length - a[1].length);
                              const filteredSaleList = scheduleSaleSearch
                                ? saleList.filter(([sale]) => sale.toLowerCase().includes(scheduleSaleSearch.toLowerCase()))
                                : saleList;
                              return (
                                <div style={{ marginTop: 12, borderRadius: 10, border: isTodayRow ? "2px solid #93c5fd" : "1px solid #e5e7eb", overflow: "hidden", background: "#fff" }}>
                                  {/* Header */}
                                  <div style={{
                                    padding: "10px 14px", fontSize: 13, fontWeight: 700,
                                    background: isTodayRow ? "#dbeafe" : isPast ? "#f0fdf4" : "#fefce8",
                                    color: isTodayRow ? "#1d4ed8" : isPast ? "#065f46" : "#92400e",
                                    display: "flex", justifyContent: "space-between", alignItems: "center",
                                  }}>
                                    <span>📅 {scheduleCalDay} {isTodayRow && "— Hôm nay"}</span>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                      <span style={{
                                        fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 12,
                                        background: isTodayRow ? "#3b82f6" : isPast ? "#059669" : "#d97706", color: "#fff",
                                      }}>{entries.length} lead · {saleList.length} sale</span>
                                      <button onClick={() => { setScheduleCalDay(null); setScheduleExpandedSales({}); setScheduleSaleSearch(""); }}
                                        style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
                                        <X size={16} color="#6b7280" />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Search sale */}
                                  {saleList.length > 4 && (
                                    <div style={{ padding: "8px 14px", borderBottom: "1px solid #f3f4f6", background: "#f9fafb" }}>
                                      <input
                                        type="text" placeholder="🔍 Tìm sale..." value={scheduleSaleSearch}
                                        onChange={e => setScheduleSaleSearch(e.target.value)}
                                        style={{
                                          width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid #e5e7eb",
                                          fontSize: 12, outline: "none", background: "#fff", boxSizing: "border-box",
                                        }}
                                      />
                                    </div>
                                  )}

                                  {/* Expand all / Collapse all */}
                                  <div style={{ padding: "6px 14px", borderBottom: "1px solid #f3f4f6", background: "#fafbfc", display: "flex", justifyContent: "flex-end", gap: 8 }}>
                                    <button onClick={() => { const all = {}; filteredSaleList.forEach(([s]) => { all[s] = true; }); setScheduleExpandedSales(all); }}
                                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#3b82f6", fontWeight: 600, padding: "2px 6px" }}>
                                      Mở tất cả
                                    </button>
                                    <span style={{ color: "#d1d5db" }}>|</span>
                                    <button onClick={() => setScheduleExpandedSales({})}
                                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#6b7280", fontWeight: 600, padding: "2px 6px" }}>
                                      Thu gọn
                                    </button>
                                  </div>

                                  {/* Sale accordion list */}
                                  <div style={{ maxHeight: isMobile ? "60vh" : "50vh", overflowY: "auto" }}>
                                    {filteredSaleList.map(([sale, saleEntries], idx) => {
                                      const si = sNames.indexOf(sale);
                                      const color = saleColors[si >= 0 ? si % saleColors.length : 0];
                                      const isExpanded = !!scheduleExpandedSales[sale];
                                      const plannedCount = saleEntries.filter(e => e.planned).length;
                                      const doneCount = saleEntries.length - plannedCount;
                                      return (
                                        <div key={sale} style={{ borderBottom: idx < filteredSaleList.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                                          {/* Sale header - clickable */}
                                          <div
                                            onClick={() => setScheduleExpandedSales(prev => ({ ...prev, [sale]: !prev[sale] }))}
                                            style={{
                                              padding: "10px 14px", cursor: "pointer", display: "flex", alignItems: "center",
                                              justifyContent: "space-between", background: isExpanded ? "#f0f9ff" : "#fff",
                                              transition: "background 0.15s",
                                            }}
                                            onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = "#fafbfc"; }}
                                            onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = "#fff"; }}
                                          >
                                            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
                                              <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                                              <span style={{ fontWeight: 700, fontSize: 13, color: "#1f2937", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                {sale}
                                              </span>
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                                              {doneCount > 0 && (
                                                <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: "#d1fae5", color: "#065f46" }}>
                                                  {doneCount} đã chia
                                                </span>
                                              )}
                                              {plannedCount > 0 && (
                                                <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: "#fef3c7", color: "#92400e" }}>
                                                  {plannedCount} dự kiến
                                                </span>
                                              )}
                                              <span style={{
                                                fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
                                                background: color, color: "#fff", minWidth: 28, textAlign: "center",
                                              }}>
                                                {saleEntries.length}
                                              </span>
                                              <span style={{ fontSize: 12, color: "#9ca3af", transition: "transform 0.15s", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
                                            </div>
                                          </div>
                                          {/* Expanded lead list */}
                                          {isExpanded && (
                                            <div style={{ background: "#f9fafb", borderTop: "1px solid #f0f0f0" }}>
                                              {saleEntries.map((entry, ei) => {
                                                const lead = leadMap[entry.leadId];
                                                return (
                                                  <div key={ei} style={{
                                                    padding: isMobile ? "6px 14px 6px 30px" : "5px 14px 5px 30px",
                                                    fontSize: 12, borderBottom: "1px solid #f3f4f6",
                                                    display: "flex", justifyContent: "space-between", alignItems: "center",
                                                    background: entry.planned ? "#fffbeb" : "#fff",
                                                  }}>
                                                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
                                                      <span style={{ color: "#6b7280", fontSize: 11, marginRight: 4 }}>{ei + 1}.</span>
                                                      {lead ? <><strong>{lead.name}</strong> <span style={{ color: "#9ca3af", fontSize: 11 }}>{lead.phone}</span></> : `#${entry.leadId}`}
                                                    </span>
                                                    <span style={{
                                                      fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 4, flexShrink: 0, marginLeft: 4,
                                                      background: entry.planned ? "#fef3c7" : "#d1fae5",
                                                      color: entry.planned ? "#92400e" : "#065f46",
                                                    }}>
                                                      {entry.planned ? "Dự kiến" : "✓ Đã chia"}
                                                    </span>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                    {filteredSaleList.length === 0 && (
                                      <div style={{ padding: "16px 14px", textAlign: "center", color: "#9ca3af", fontSize: 12 }}>
                                        Không tìm thấy sale "{scheduleSaleSearch}"
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
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

      {/* Search / Date / Project filters */}
      <div style={{ display: "flex", gap: isMobile ? 8 : 12, marginBottom: isMobile ? 10 : 16, flexWrap: "wrap", alignItems: "center" }}>
        <input
          style={{ ...inputStyle, flex: "1 1 100%", marginBottom: 0, minHeight: 44, fontSize: 14 }}
          placeholder="Tìm tên, SĐT, chiến dịch, sale, nhu cầu..."
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
        {/* Nhu cầu filter - multi-select */}
        {uniqueProducts.length > 0 && (
          <div style={{ position: "relative", minWidth: isMobile ? "100%" : 160 }}>
            <button onClick={() => setProductFilterOpen(p => !p)}
              style={{ padding: "8px 12px", borderRadius: 8, border: productFilter.length > 0 ? "2px solid #f59e0b" : "1px solid #d1d5db", fontSize: 13, minHeight: 44, background: "#fff", color: "#1f2937", width: "100%", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{productFilter.length === 0 ? "Tất cả nhu cầu" : `Nhu cầu (${productFilter.length})`}</span>
              <ChevronDown size={14} style={{ flexShrink: 0, color: "#9ca3af" }} />
            </button>
            {productFilterOpen && (
              <div style={{ position: "absolute", top: "100%", left: 0, zIndex: 100, background: "#fff", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,.15)", border: "1px solid #e5e7eb", width: Math.max(240, 0), maxHeight: 280, marginTop: 2, display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
                <div style={{ padding: "6px 10px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", fontSize: 11, flexShrink: 0 }}>
                  <button onClick={() => setProductFilter([...uniqueProducts])} style={{ background: "none", border: "none", cursor: "pointer", color: "#2563eb", fontSize: 11, padding: 0 }}>Chọn tất cả</button>
                  <button onClick={() => setProductFilter([])} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 11, padding: 0 }}>Xóa</button>
                </div>
                <div style={{ overflowY: "auto", flex: 1 }}>
                  {uniqueProducts.map(p => (
                    <label key={p} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", cursor: "pointer", fontSize: 12, background: productFilter.includes(p) ? "#eff6ff" : "transparent" }}>
                      <input type="checkbox" checked={productFilter.includes(p)}
                        onChange={() => { setProductFilter(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]); setCurrentPage(1); }} />
                      {p}
                    </label>
                  ))}
                </div>
                <div style={{ padding: "6px 10px", borderTop: "1px solid #f3f4f6", textAlign: "right", flexShrink: 0 }}>
                  <button onClick={() => setProductFilterOpen(false)}
                    style={{ background: "#2563eb", color: "#fff", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, padding: "4px 14px", borderRadius: 6 }}>OK</button>
                </div>
              </div>
            )}
          </div>
        )}
        {/* Advanced filter button */}
        <div style={{ position: "relative" }}>
          <button onClick={() => setShowAdvancedFilter(prev => !prev)}
            style={{
              padding: "8px 12px", borderRadius: 8, minHeight: 44,
              border: (sortConfig.key || productFilter.length > 0) ? "2px solid #2563eb" : "1px solid #d1d5db",
              background: showAdvancedFilter ? "#eff6ff" : "#fff", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "#374151", fontWeight: 600,
            }}
            title="Bộ lọc nâng cao">
            <Filter size={15} /> Lọc
          </button>
          {/* Advanced filter panel - Google Sheets style */}
          {showAdvancedFilter && (
            <div style={{
              position: "absolute", top: "100%", right: 0, marginTop: 4, zIndex: 100,
              background: "#fff", borderRadius: 10, boxShadow: "0 8px 32px rgba(0,0,0,.18)", border: "1px solid #e5e7eb",
              width: 280, padding: 0, overflow: "hidden",
            }} onClick={e => e.stopPropagation()}>
              {/* Sort options */}
              <div style={{ borderBottom: "1px solid #f3f4f6" }}>
                <button onClick={() => { setSortConfig({ key: "name", direction: "asc" }); setShowAdvancedFilter(false); }}
                  style={{ width: "100%", textAlign: "left", padding: "10px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#374151", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 15 }}>↑</span> Sắp xếp A đến Z
                </button>
                <button onClick={() => { setSortConfig({ key: "name", direction: "desc" }); setShowAdvancedFilter(false); }}
                  style={{ width: "100%", textAlign: "left", padding: "10px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#374151", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 15 }}>↓</span> Sắp xếp Z đến A
                </button>
              </div>
              {/* Sort by field */}
              <div style={{ borderBottom: "1px solid #f3f4f6", padding: "8px 14px" }}>
                <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4, fontWeight: 600 }}>Sắp xếp theo</div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {[
                    { key: "name", label: "Tên" }, { key: "product", label: "Nhu cầu" },
                    { key: "status", label: "Trạng thái" }, { key: "saleName", label: "Sale" },
                    { key: "createdAt", label: "Ngày" },
                  ].map(f => (
                    <button key={f.key}
                      onClick={() => setSortConfig(prev => prev.key === f.key ? { key: f.key, direction: prev.direction === "asc" ? "desc" : "asc" } : { key: f.key, direction: "asc" })}
                      style={{
                        padding: "3px 8px", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600,
                        border: sortConfig.key === f.key ? "1px solid #2563eb" : "1px solid #e5e7eb",
                        background: sortConfig.key === f.key ? "#eff6ff" : "#fff",
                        color: sortConfig.key === f.key ? "#2563eb" : "#6b7280",
                      }}>
                      {f.label} {sortConfig.key === f.key && (sortConfig.direction === "asc" ? "↑" : "↓")}
                    </button>
                  ))}
                </div>
              </div>
              {/* Filter by nhu cầu (value list) - multi-select */}
              <div style={{ borderBottom: "1px solid #f3f4f6", padding: "8px 14px", maxHeight: 200, overflowY: "auto" }}>
                <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4, fontWeight: 600 }}>Lọc theo nhu cầu {productFilter.length > 0 && <span style={{ color: "#f59e0b" }}>({productFilter.length})</span>}</div>
                <div style={{ marginBottom: 4, fontSize: 12 }}>
                  <button onClick={() => setProductFilter([...uniqueProducts])}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#2563eb", fontSize: 12, padding: 0, textDecoration: "underline" }}>
                    Chọn tất cả
                  </button>
                  <span style={{ color: "#d1d5db" }}> - </span>
                  <button onClick={() => setProductFilter([])}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 12, padding: 0, textDecoration: "underline" }}>
                    Xóa
                  </button>
                </div>
                {uniqueProducts.map(p => (
                  <label key={p} style={{
                      padding: "4px 8px", borderRadius: 4, cursor: "pointer", fontSize: 12,
                      background: productFilter.includes(p) ? "#eff6ff" : "transparent",
                      display: "flex", alignItems: "center", gap: 6,
                    }}>
                    <input type="checkbox" checked={productFilter.includes(p)}
                      onChange={() => { setProductFilter(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]); setCurrentPage(1); }} />
                    <span style={{ color: productFilter.includes(p) ? "#2563eb" : "#374151", fontWeight: productFilter.includes(p) ? 700 : 400 }}>{p}</span>
                  </label>
                ))}
              </div>
              {/* Clear all / close */}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 14px", gap: 8 }}>
                <button onClick={() => { setProductFilter([]); setSortConfig({ key: null, direction: null }); }}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#ef4444", fontWeight: 600 }}>
                  Xóa bộ lọc
                </button>
                <button onClick={() => setShowAdvancedFilter(false)}
                  style={{ background: "#2563eb", color: "#fff", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, padding: "5px 16px", borderRadius: 6 }}>
                  OK
                </button>
              </div>
            </div>
          )}
        </div>
        {setSelectedProject && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: isMobile ? "100%" : "auto" }}>
            <button onClick={() => setSelectedProject(null)} title="Quay về chọn dự án"
              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", minHeight: 44 }}>
              <ArrowLeft size={16} style={{ color: "#6b7280" }} />
            </button>
            <select
              value={selectedProject || "all"}
              onChange={(e) => setSelectedProject(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, minHeight: 44, background: "#fff", color: "#1f2937", flex: isMobile ? 1 : "none", minWidth: isMobile ? 0 : 180 }}
            >
              {isAdmin && user.role === "admin" && <option value="all">Tất cả dự án</option>}
              {availableProjects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}
        {isAdmin && allManagerNames.length > 0 && (
          <select
            value={managerFilter}
            onChange={(e) => { setManagerFilter(e.target.value); setCurrentPage(1); }}
            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, minHeight: 44, background: "#fff", color: "#1f2937", minWidth: isMobile ? 0 : 160 }}
          >
            <option value="all">Tất cả quản lý</option>
            {allManagerNames.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        )}
        {isAdmin && saleNames.length > 0 && (
          <div ref={saleFilterRef} style={{ position: "relative" }}>
            <div
              onClick={() => setSaleFilterOpen(!saleFilterOpen)}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, minHeight: 44, background: "#fff", color: "#1f2937", minWidth: isMobile ? 0 : 160, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{saleFilter === "all" ? "Tất cả sale" : saleFilter}</span>
              <span style={{ fontSize: 10, color: "#9ca3af" }}>▼</span>
            </div>
            {saleFilterOpen && (
              <div style={{ position: "absolute", top: "100%", left: 0, zIndex: 999, background: "#fff", border: "1px solid #d1d5db", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,.12)", minWidth: 220, maxHeight: 320, display: "flex", flexDirection: "column" }}>
                <div style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>
                  <input
                    autoFocus
                    placeholder="Tìm sale..."
                    value={saleFilterSearch}
                    onChange={(e) => setSaleFilterSearch(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                  />
                </div>
                <div style={{ overflowY: "auto", maxHeight: 260 }}>
                  <div
                    onClick={() => { setSaleFilter("all"); setSaleFilterOpen(false); setSaleFilterSearch(""); setCurrentPage(1); }}
                    style={{ padding: "8px 12px", fontSize: 13, cursor: "pointer", background: saleFilter === "all" ? "#f0f9ff" : "transparent", fontWeight: saleFilter === "all" ? 600 : 400 }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "#f3f4f6"}
                    onMouseLeave={(e) => e.currentTarget.style.background = saleFilter === "all" ? "#f0f9ff" : "transparent"}
                  >
                    Tất cả sale
                  </div>
                  {saleNames.filter(s => !saleFilterSearch || s.toLowerCase().includes(saleFilterSearch.toLowerCase())).map(s => (
                    <div
                      key={s}
                      onClick={() => { setSaleFilter(s); setSaleFilterOpen(false); setSaleFilterSearch(""); setCurrentPage(1); }}
                      style={{ padding: "8px 12px", fontSize: 13, cursor: "pointer", background: saleFilter === s ? "#f0f9ff" : "transparent", fontWeight: saleFilter === s ? 600 : 400 }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "#f3f4f6"}
                      onMouseLeave={(e) => e.currentTarget.style.background = saleFilter === s ? "#f0f9ff" : "transparent"}
                    >
                      {s}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
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
                <div onClick={() => setExpandedIdStable(isOpen ? null : l.id)}
                  style={{ padding: isMobile ? "10px 12px" : "12px 16px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                      {isRecentLead(l) && <span style={{ background: "#10b981", color: "#fff", padding: "1px 6px", borderRadius: 8, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>NEW</span>}
                      {l.regCount > 1 && <span style={{ background: "#f59e0b", color: "#fff", padding: "1px 6px", borderRadius: 8, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>ĐK lần {l.regIndex}</span>}
                      <span style={{ fontWeight: 700, fontSize: isMobile ? 13 : 14 }}>{l.name}</span>
                      <span style={{
                        padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                        background: (STATUS_COLORS[l.status] || "#6b7280") + "18",
                        color: STATUS_COLORS[l.status] || "#6b7280",
                      }}>
                        {STATUS_LABELS[l.status] || l.status}
                      </span>
                      {!isSale && l.isHot && <span style={{ fontSize: 11, display: "flex", alignItems: "center" }}>{(() => { const t = getLeadTemp(l.createdAt); return t.icon === "very_hot" ? <><Flame size={13} /><Flame size={13} /></> : t.icon === "hot" ? <Flame size={13} /> : t.icon === "warm" ? <CloudSun size={13} /> : <Snowflake size={13} />; })()}</span>}
                    </div>
                    <div style={{ display: "flex", gap: isMobile ? 8 : 16, fontSize: 12, color: "#6b7280", flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 2 }}><Smartphone size={12} /> {l.phone || "-"}</span>
                      {!isSale && <span style={{ display: "flex", alignItems: "center", gap: 2 }}><Calendar size={12} /> {l.createdAt || "-"}</span>}
                      {histCount > 0 && <span style={{ display: "flex", alignItems: "center", gap: 2 }}><ClipboardList size={12} /> {histCount}</span>}
                      {isAdmin && l.saleName && <span style={{ display: "flex", alignItems: "center", gap: 2 }}><User size={12} /> {l.saleName}</span>}
                      {isAdmin && l.managerName && <span style={{ display: "flex", alignItems: "center", gap: 2, color: "#2563eb" }}><Shield size={12} /> {l.managerName}</span>}
                      {isAdmin && <span style={{ fontSize: 11 }}>{projectMap[l.projectId] || "-"}</span>}
                    </div>
                  </div>
                  <span style={{ fontSize: 14, color: "#9ca3af", flexShrink: 0 }}>{isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
                </div>
                {isOpen && (
                  <div style={{ borderTop: "1px solid #e5e7eb" }}>
                    <LeadDetail lead={l} projectName={projectMap[l.projectId] || "-"} isAdmin={isAdmin} user={user} applyApiData={applyApiData} saleNames={getProjectSaleNames(l.projectId)} managerNames={allManagerNames} isMobile={isMobile} allUsers={allUsers} />
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
                <th style={thStyle}>Người quản lý</th>
                <th style={thStyle}>Sale hiện tại</th>
                <th style={thStyle}>Dự án</th>
                {!isSale && <th style={thStyle}>Ngày nhận lead</th>}
                {!isSale && <th style={thStyle}>Trạng thái</th>}
              </tr>
            </thead>
            <tbody>
              {tabFiltered.slice((currentPage - 1) * pageSize, currentPage * pageSize).flatMap((l, i) => {
                const isOpen = expandedId === l.id;
                const globalIdx = (currentPage - 1) * pageSize + i;
                const rows = [
                  <tr key={l.id} id={`lead-${l.id}`} onClick={() => setExpandedIdStable(isOpen ? null : l.id)}
                    style={{ background: isOpen ? "#f0faf1" : globalIdx % 2 ? "#f9fafb" : "#fff", cursor: "pointer", transition: "background .15s" }}>
                    <td style={tdStyle}>{globalIdx + 1}</td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{isOpen ? <ChevronDown size={12} style={{ display: "inline", verticalAlign: "middle" }} /> : <ChevronRight size={12} style={{ display: "inline", verticalAlign: "middle" }} />} {isRecentLead(l) && <span style={{ background: "#10b981", color: "#fff", padding: "1px 6px", borderRadius: 8, fontSize: 10, fontWeight: 700, marginRight: 4 }}>NEW</span>}{l.regCount > 1 && <span style={{ background: "#f59e0b", color: "#fff", padding: "1px 6px", borderRadius: 8, fontSize: 10, fontWeight: 700, marginRight: 4 }}>ĐK lần {l.regIndex}</span>}{l.name}</td>
                    <td style={tdStyle}>{l.phone || "-"}</td>
                    <td style={{ ...tdStyle, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.product || "-"}</td>
                    <td style={tdStyle}>
                      <span style={{
                        padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                        background: (STATUS_COLORS[l.status] || "#6b7280") + "18",
                        color: STATUS_COLORS[l.status] || "#6b7280", whiteSpace: "nowrap",
                      }}>{STATUS_LABELS[l.status] || l.status}</span>
                    </td>
                    <td style={{ ...tdStyle, fontSize: 12, color: "#4b5563" }}>{l.managerName || "-"}</td>
                    <td style={tdStyle}>{l.saleName || "Chưa chia"}</td>
                    <td style={{ ...tdStyle, fontSize: 11 }}>{projectMap[l.projectId] || "-"}</td>
                    {!isSale && <td style={{ ...tdStyle, fontSize: 11, whiteSpace: "nowrap" }}>{l.createdAt || "-"}</td>}
                    {!isSale && <td style={tdStyle}>
                      {(() => { const t = getLeadTemp(l.createdAt); return (
                        <span style={{ background: t.bg, color: t.color, padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>{t.label}</span>
                      ); })()}
                    </td>}
                  </tr>,
                ];
                if (isOpen) {
                  rows.push(
                    <tr key={`${l.id}-detail`}>
                      <td colSpan={isSale ? 8 : 10} style={{ padding: 0, background: "#f8fafc", borderBottom: "2px solid #e88a2e" }}>
                        <LeadDetail lead={l} projectName={projectMap[l.projectId] || "-"} isAdmin={isAdmin} user={user} applyApiData={applyApiData} saleNames={getProjectSaleNames(l.projectId)} managerNames={allManagerNames} isMobile={false} allUsers={allUsers} />
                      </td>
                    </tr>
                  );
                }
                return rows;
              })}
              {tabFiltered.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ ...tdStyle, textAlign: "center", color: "#9ca3af" }}>Không có khách hàng nào</td>
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
  )}
    </>
  );
}

function LeadDetail({ lead, projectName, isAdmin, user, applyApiData, saleNames = [], managerNames = [], isMobile = false, allUsers = [] }) {
  const isSale = user.role === "sale";
  const history = lead.saleHistory || [];
  const registrations = lead.registrations || [];
  const [showForm, setShowForm] = useState(false);
  const [histStatus, setHistStatus] = useState("");
  const [histFeedback, setHistFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const [editStatus, setEditStatus] = useState(lead.status || "new");
  const [savingStatus, setSavingStatus] = useState(false);
  const [editSale, setEditSale] = useState(lead.saleName || "");
  const [savingSale, setSavingSale] = useState(false);
  const [editManager, setEditManager] = useState("");
  const [savingManager, setSavingManager] = useState(false);
  const [showRegHistory, setShowRegHistory] = useState(false);
  const [expandedSaleContact, setExpandedSaleContact] = useState(null); // track which sale contact group is expanded
  const [adPreview, setAdPreview] = useState(null);
  const [loadingAdPreview, setLoadingAdPreview] = useState(false);
  const [showAdPreview, setShowAdPreview] = useState(false);
  // Messenger chat state
  const [messengerConvs, setMessengerConvs] = useState([]);
  const [messengerLoading, setMessengerLoading] = useState(false);
  const [messengerError, setMessengerError] = useState("");
  const [messengerOpen, setMessengerOpen] = useState(true);
  const [activeMessengerConv, setActiveMessengerConv] = useState(null);
  const [messengerMsgs, setMessengerMsgs] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [messengerDraft, setMessengerDraft] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);
  const messengerEndRef = useRef(null);

  const handleViewAdPreview = async (adName) => {
    if (!adName || adName === "-") return;
    setShowAdPreview(true);
    setLoadingAdPreview(true);
    setAdPreview(null);
    try {
      const r = await apiFetch(`${API}/fb-ads/ad-preview?adName=${encodeURIComponent(adName)}`);
      const data = await r.json();
      setAdPreview(data);
    } catch (e) {
      setAdPreview({ error: e.message });
    } finally {
      setLoadingAdPreview(false);
    }
  };

  // Messenger: load conversations for this lead
  const loadMessengerConvs = async () => {
    if (!lead.name) return;
    setMessengerLoading(true);
    setMessengerError("");
    try {
      const r = await apiFetch(`${API}/fb-messenger/lead-conversations?leadName=${encodeURIComponent(lead.name)}`);
      const ct = r.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        setMessengerError("Server trả về lỗi (không phải JSON). Có thể server chưa restart sau khi cập nhật. Hãy restart lại server trên VPS.");
        return;
      }
      const data = await r.json();
      if (!r.ok) { setMessengerError(data.error || "Lỗi tải chat"); return; }
      if (data.noPages) { setMessengerError(data.message || "Chưa thêm Page Facebook. Vào Quản lý Page để thêm."); return; }
      setMessengerConvs(data.conversations || []);
      if (!data.conversations?.length) setMessengerError("Không tìm thấy cuộc hội thoại nào khớp với tên \"" + lead.name + "\" trên Messenger");
    } catch (e) { setMessengerError("Không thể kết nối: " + (e.message || "Kiểm tra server đã chạy chưa")); }
    finally { setMessengerLoading(false); }
  };

  // Messenger: load messages for a conversation
  const loadMessengerMessages = async (conv) => {
    setActiveMessengerConv(conv);
    setLoadingMsgs(true);
    setMessengerMsgs([]);
    try {
      const r = await apiFetch(`${API}/fb-messenger/messages?pageId=${conv.pageDbId}&conversationId=${conv.id}`);
      const data = await r.json();
      if (r.ok) {
        setMessengerMsgs((data.messages || []).reverse());
        setTimeout(() => messengerEndRef.current?.scrollIntoView({ behavior: "smooth" }), 150);
      }
    } catch { /* ignore */ }
    setLoadingMsgs(false);
  };

  // Messenger: send reply
  const sendMessengerReply = async () => {
    if (!messengerDraft.trim() || !activeMessengerConv || sendingMsg) return;
    const text = messengerDraft.trim();
    const customer = activeMessengerConv.senders?.find(s => s.id !== activeMessengerConv.pageId);
    if (!customer) return;
    setSendingMsg(true);
    setMessengerDraft("");
    try {
      const r = await apiFetch(`${API}/fb-messenger/reply`, {
        method: "POST",
        body: JSON.stringify({ pageId: activeMessengerConv.pageDbId, recipientId: customer.id, message: text }),
      });
      if (r.ok) loadMessengerMessages(activeMessengerConv);
      else { const d = await r.json().catch(() => ({})); setMessengerDraft(text); setMessengerError(d.error || "Gửi thất bại"); }
    } catch { setMessengerDraft(text); }
    setSendingMsg(false);
  };

  // Auto-open messenger section on mount if lead name exists
  useEffect(() => {
    if (messengerOpen && messengerConvs.length === 0 && !messengerLoading) loadMessengerConvs();
  }, [messengerOpen]);

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
        body: JSON.stringify({ saleName: editSale, phone: lead.phone }),
      });
      const data = await r.json();
      applyApiData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setSavingSale(false);
    }
  };

  const handleChangeManager = async () => {
    console.log("[handleChangeManager] Called, editManager=", editManager, "lead.id=", lead.id);
    if (!editManager) {
      console.log("[handleChangeManager] EARLY RETURN: editManager is empty");
      return;
    }
    setSavingManager(true);
    try {
      console.log("[handleChangeManager] Calling API: PUT /api/leads/" + lead.id, { managerName: editManager, phone: lead.phone, name: lead.name });
      const r = await apiFetch(`${API}/leads/${lead.id}`, {
        method: "PUT",
        body: JSON.stringify({ managerName: editManager, phone: lead.phone, name: lead.name }),
      });
      console.log("[handleChangeManager] API Response status:", r.status);
      const data = await r.json();
      console.log("[handleChangeManager] API Response data:", data);
      if (!r.ok) {
        showToast("Đổi quản lý thất bại: " + (data.error || r.statusText), "error");
        return;
      }
      const serverManager = data.updatedLead?.managerName || editManager;
      applyApiData({ updatedLead: { id: lead.id, name: lead.name, phone: lead.phone, managerName: serverManager } });
      setEditManager("");
      showToast(`Đã đổi quản lý thành ${serverManager}!`, "success");
    } catch (e) {
      console.error("[handleChangeManager] ERROR:", e);
      showToast("Lỗi kết nối: " + e.message, "error");
    } finally {
      setSavingManager(false);
    }
  };

  return (
    <div style={{ padding: isMobile ? "12px" : "16px 24px" }}>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fill, minmax(140px, 1fr))", gap: isMobile ? 8 : 16, marginBottom: 12, fontSize: 13 }}>
        <div><span style={{ color: "#6b7280", fontSize: 11 }}>Khách hàng</span><br /><b>{lead.name}</b></div>
        <div><span style={{ color: "#6b7280", fontSize: 11 }}>SĐT</span><br /><b>{lead.phone || "-"}</b></div>
        <div><span style={{ color: "#6b7280", fontSize: 11 }}>Dự án</span><br /><b>{projectName}</b></div>
        <div><span style={{ color: "#6b7280", fontSize: 11 }}>Sản phẩm</span><br /><b>{lead.product || "-"}</b></div>
        {!isSale && <div><span style={{ color: "#6b7280", fontSize: 11 }}>Ngày nhận lead</span><br /><b style={{ fontSize: isMobile ? 11 : 13 }}>{lead.createdAt || "-"}</b></div>}
        {!isSale && <div>
          <span style={{ color: "#6b7280", fontSize: 11 }}>Trạng thái lead</span><br />
          {(() => { const t = getLeadTemp(lead.createdAt); return (
            <span style={{ color: t.color, fontWeight: 700 }}>{t.label}</span>
          ); })()}
        </div>}
        {isAdmin && <div><span style={{ color: "#6b7280", fontSize: 11 }}>Chiến dịch</span><br /><b style={{ fontSize: isMobile ? 11 : 13 }}>{lead.campaign || "-"}</b></div>}
        {isAdmin && <div><span style={{ color: "#6b7280", fontSize: 11 }}>Nhóm QC</span><br /><b style={{ fontSize: isMobile ? 11 : 13 }}>{lead.adsetName || "-"}</b></div>}
        <div><span style={{ color: "#6b7280", fontSize: 11 }}>Content</span><br />
          {lead.adName && lead.adName !== "-" ? (
            <b onClick={(e) => { e.stopPropagation(); handleViewAdPreview(lead.adName); }}
              style={{ fontSize: isMobile ? 11 : 13, color: "#2563eb", cursor: "pointer", textDecoration: "underline", textDecorationStyle: "dotted" }}
              title="Click để xem quảng cáo">{lead.adName}</b>
          ) : (
            <b style={{ fontSize: isMobile ? 11 : 13 }}>{lead.adName || "-"}</b>
          )}
        </div>
        {lead.regCount > 1 && (
          <div><span style={{ color: "#6b7280", fontSize: 11 }}>Số lần ĐK</span><br />
            <b style={{ fontSize: 13, color: "#d97706" }}>{lead.regCount} lần</b>
          </div>
        )}
      </div>

      {/* Registration history - show when customer registered multiple times */}
      {registrations.length > 1 && (
        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: 10, marginBottom: 12 }}>
          <div onClick={() => setShowRegHistory(!showRegHistory)}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
            <span style={{ fontWeight: 700, fontSize: 12, color: "#92400e", display: "flex", alignItems: "center", gap: 4 }}>
              🚩 Lịch sử đăng ký ({registrations.length} lần)
            </span>
            <span style={{ fontSize: 11, color: "#b45309" }}>{showRegHistory ? "Thu gọn ▲" : "Xem chi tiết ▼"}</span>
          </div>
          {showRegHistory && (
            <div style={{ marginTop: 8 }}>
              {registrations.map((reg, ri) => {
                const isCurrent = reg.leadId === lead.id;
                return (
                  <div key={ri} style={{
                    padding: "6px 10px", marginBottom: 4, borderRadius: 6, fontSize: 12,
                    background: isCurrent ? "#fef3c7" : "#fff",
                    border: isCurrent ? "1px solid #f59e0b" : "1px solid #f3f4f6",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, color: "#92400e" }}>
                        🚩 Đăng ký lần {ri + 1}{isCurrent && " (hiện tại)"}
                      </span>
                      <span style={{ fontSize: 10, color: "#9ca3af" }}>{reg.createdAt || "-"}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                      Dự án: <b>{reg.projectName}</b> | Chiến dịch: <b>{reg.campaign}</b> | Nhóm: <b>{reg.adsetName}</b> | Content: {reg.adName ? (
                        <b onClick={(e) => { e.stopPropagation(); handleViewAdPreview(reg.adName); }} style={{ color: "#2563eb", textDecoration: "underline", cursor: "pointer" }}>{reg.adName}</b>
                      ) : <b>{reg.adName}</b>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* === 2-COLUMN LAYOUT: Tương tác (left) | Chat (right) === */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, alignItems: "start" }}>
      {/* --- LEFT COLUMN: Tương tác --- */}
      <div>

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
              {Object.entries(STATUS_LABELS).filter(([k]) => !['called', 'lost', 'blocked'].includes(k)).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
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

      {/* Admin: Đổi Quản lý */}
      {isAdmin && managerNames.length > 0 && (
        <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: isMobile ? 14 : 12, marginBottom: 16, fontSize: 13 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <b style={{ fontSize: 12, color: "#1e40af", display: "flex", alignItems: "center", gap: 4 }}><Shield size={14} /> Quản lý phụ trách:</b>
            {lead.managerName
              ? <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600, background: "#dbeafe", color: "#1e40af" }}>{lead.managerName}</span>
              : <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600, background: "#fef2f2", color: "#dc2626" }}>Chưa gán</span>
            }
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <select value={editManager} onChange={(e) => setEditManager(e.target.value)}
              style={{ padding: isMobile ? "10px 12px" : "6px 8px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: isMobile ? 14 : 12, minWidth: 160, flex: isMobile ? "1 1 100%" : "none", minHeight: isMobile ? 44 : "auto", background: "#fff", color: editManager ? "#1f2937" : "#9ca3af" }}>
              <option value="">-- Chọn Quản lý --</option>
              {managerNames.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <button onClick={handleChangeManager} disabled={savingManager || !editManager || editManager === lead.managerName}
              style={{ ...btnPrimary, padding: isMobile ? "10px 16px" : "6px 12px", fontSize: isMobile ? 14 : 12, background: (!editManager || editManager === lead.managerName) ? "#93c5fd" : "linear-gradient(135deg, #3b82f6, #1d4ed8)", minHeight: isMobile ? 44 : "auto", width: isMobile ? "100%" : "auto" }}>
              {savingManager ? "Đang đổi..." : <><Shield size={14} /> Đổi quản lý</>}
            </button>
          </div>
        </div>
      )}

      {/* === Contact form (both sale and admin) === */}
      {(() => {
        const formVisible = !isAdmin || showForm;
        return (
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ margin: "0 0 12px", fontSize: 14, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <ClipboardList size={16} /> {isAdmin ? "Lịch sử đăng ký & Tương tác" : "Cập nhật thông tin khách hàng"}
                {isAdmin && lead.saleName && lead.saleName !== "Chưa chia" && (
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 8, background: "#dbeafe", color: "#1e40af", fontWeight: 600 }}>
                    Sale hiện tại: {lead.saleName}
                  </span>
                )}
              </span>
              {isAdmin && (
                <button onClick={() => setShowForm(!showForm)}
                  style={{ ...btnPrimary, padding: isMobile ? "8px 14px" : "4px 12px", fontSize: 12 }}>
                  {showForm ? "Hủy" : <><RefreshCw size={12} /> Cập nhật thông tin khách hàng</>}
                </button>
              )}
            </h4>
            {(!isAdmin || formVisible) && (!isAdmin || showForm) && (
              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: isMobile ? 16 : 12, marginBottom: 12 }}>
                <div style={{ display: "flex", gap: isMobile ? 12 : 8, flexDirection: "column" }}>
                  <div style={{ width: "100%" }}>
                    <label style={{ fontSize: 12, color: "#374151", fontWeight: 600, marginBottom: 6, display: "block" }}>Trạng thái khách</label>
                    <select value={histStatus} onChange={(e) => setHistStatus(e.target.value)}
                      style={{ ...inputStyle, marginBottom: 0, fontSize: isMobile ? 15 : 13, padding: isMobile ? "12px 14px" : "8px 10px", minHeight: isMobile ? 48 : "auto" }}>
                      <option value="">-- Chọn trạng thái --</option>
                      {Object.entries(STATUS_LABELS).filter(([k]) => !['called', 'lost', 'blocked'].includes(k)).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div style={{ width: "100%" }}>
                    <label style={{ fontSize: 12, color: "#374151", fontWeight: 600, marginBottom: 6, display: "block" }}>Ghi chú</label>
                    <textarea value={histFeedback} onChange={(e) => setHistFeedback(e.target.value)}
                      placeholder="Nội dung trao đổi với khách..."
                      rows={3}
                      style={{ ...inputStyle, marginBottom: 0, fontSize: isMobile ? 15 : 13, padding: isMobile ? "12px 14px" : "8px 10px", minHeight: isMobile ? 80 : 60, resize: "vertical" }} />
                  </div>
                  <button onClick={handleAddHistory} disabled={saving}
                    style={{ ...btnPrimary, padding: isMobile ? "14px 16px" : "10px 16px", whiteSpace: "nowrap", width: "100%", minHeight: isMobile ? 48 : 44, fontSize: isMobile ? 15 : 14, borderRadius: 10 }}>
                    {saving ? "Đang lưu..." : <><Save size={16} /> Lưu liên hệ</>}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* === CONTACT HISTORY === */}
      {(() => {
        // Parse Vietnamese date to sortable timestamp
        const parseVNDate = (s) => {
          if (!s) return 0;
          let m = s.match(/(\d{1,2}):(\d{2}):(\d{2})\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/);
          if (m) return new Date(+m[6], +m[5] - 1, +m[4], +m[1], +m[2], +m[3]).getTime() || 0;
          m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s*(\d{1,2}):(\d{2}):(\d{2})/);
          if (m) return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +m[6]).getTime() || 0;
          return 0;
        };

        // Collect registration events
        const regEvents = [];
        registrations.forEach((reg, ri) => {
          if (reg.leadId === lead.id) {
            regEvents.push({ regNum: ri + 1, totalRegs: registrations.length, date: reg.createdAt || "", campaign: reg.campaign, adsetName: reg.adsetName, adName: reg.adName, projectName: reg.projectName });
          }
        });

        // Collect all events from history and sort by date
        const allEvents = [];
        history.forEach((h) => {
          const isChia = (h.action || "").toLowerCase().includes("chia");
          const isRecall = (h.action || "").toLowerCase().includes("thu h");
          if (isChia) {
            const assignedBy = (h.feedback || "").replace(/^Admin\s+/, "").replace(/\s+chia lead$/, "") || "Admin";
            allEvents.push({ type: "chia", saleName: h.saleName, date: h.date, assignedBy, id: h.id, _ts: parseVNDate(h.date) });
          } else if (isRecall) {
            allEvents.push({ type: "recall", action: h.action, saleName: h.saleName, date: h.date, feedback: h.feedback, id: h.id, _ts: parseVNDate(h.date) });
          } else {
            allEvents.push({ type: "contact", saleName: h.saleName || "Không rõ", date: h.date, status: h.status, feedback: h.feedback, source: h.source, id: h.id, _ts: parseVNDate(h.date) });
          }
        });
        allEvents.sort((a, b) => (a._ts || 0) - (b._ts || 0));

        // === ADMIN/MANAGER VIEW: group by sale blocks ===
        if (isAdmin) {
          // Build sale assignment blocks
          const saleBlocks = []; // { saleName, chiaDate, chiaBy, chiaId, chiaIds: [], contacts: [], isImplicit }
          const recalls = [];
          let currentBlock = null;

          allEvents.forEach((evt) => {
            if (evt.type === "chia") {
              // Merge duplicate chia events for same sale into one block
              const existingBlock = [...saleBlocks].reverse().find(b => b.saleName === evt.saleName);
              if (existingBlock) {
                currentBlock = existingBlock;
                // Track all chia IDs but only keep latest date
                if (evt.id) existingBlock.chiaIds.push(evt.id);
                existingBlock.chiaDate = evt.date || existingBlock.chiaDate;
                existingBlock.chiaBy = evt.assignedBy || existingBlock.chiaBy;
              } else {
                currentBlock = { saleName: evt.saleName, chiaDate: evt.date, chiaBy: evt.assignedBy, chiaId: evt.id, chiaIds: evt.id ? [evt.id] : [], contacts: [], isImplicit: false };
                saleBlocks.push(currentBlock);
              }
            } else if (evt.type === "recall") {
              recalls.push(evt);
            } else {
              // Contact — attach to matching block or create implicit
              const sn = evt.saleName;
              let target = currentBlock && currentBlock.saleName === sn ? currentBlock : null;
              if (!target) {
                for (let i = saleBlocks.length - 1; i >= 0; i--) {
                  if (saleBlocks[i].saleName === sn) { target = saleBlocks[i]; break; }
                }
              }
              if (!target) {
                target = { saleName: sn, chiaDate: evt.date, chiaBy: null, chiaId: null, contacts: [], isImplicit: true };
                saleBlocks.push(target);
              }
              target.contacts.push(evt);
            }
          });

          // Sort contacts inside each block by date, then number them
          saleBlocks.forEach(blk => {
            blk.contacts.sort((a, b) => (a._ts || 0) - (b._ts || 0));
            blk.contacts.forEach((c, i) => { c.num = i + 1; });
          });

          const hasContent = regEvents.length > 0 || saleBlocks.length > 0 || recalls.length > 0;
          if (!hasContent) return <div style={{ color: "#9ca3af", fontSize: 13, paddingBottom: 8 }}>Chưa có lịch sử</div>;

          return (
            <div style={{ paddingBottom: 8 }}>
              {/* Registration events */}
              {regEvents.map((reg, ri) => (
                <div key={`reg-${ri}`} style={{ background: "#fffbeb", borderRadius: 8, padding: isMobile ? 10 : 12, border: "1px solid #fde68a", marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4, gap: 4, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 600, fontSize: isMobile ? 12 : 13, color: "#92400e" }}>
                      🚩 Đăng ký lần {reg.regNum}
                      {reg.totalRegs > 1 && <span style={{ marginLeft: 6, fontSize: 10, padding: "1px 6px", borderRadius: 8, background: "#fef3c7", color: "#b45309" }}>Khách cũ</span>}
                    </span>
                    <span style={{ fontSize: 10, color: "#9ca3af" }}>{reg.date || "-"}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>Dự án: <b>{reg.projectName}</b> | Chiến dịch: <b>{reg.campaign}</b></div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
                    Nhóm: {reg.adsetName} | Content: {reg.adName ? (
                      <span onClick={(e) => { e.stopPropagation(); handleViewAdPreview(reg.adName); }} style={{ color: "#2563eb", textDecoration: "underline", cursor: "pointer" }}>{reg.adName}</span>
                    ) : reg.adName}
                  </div>
                </div>
              ))}

              {/* Recall events */}
              {recalls.map((h, ri) => (
                <div key={`recall-${ri}`} style={{ display: "flex", alignItems: "center", gap: 8, margin: "6px 0" }}>
                  <div style={{ flex: 1, height: 1, background: "#fecaca" }} />
                  <span style={{ fontSize: 10, color: "#dc2626", fontWeight: 600, whiteSpace: "nowrap" }}>
                    🔄 {h.action} — {h.saleName} <span style={{ color: "#9ca3af", fontWeight: 400 }}>{h.date || ""}</span>
                  </span>
                  <div style={{ flex: 1, height: 1, background: "#fecaca" }} />
                  {h.id && (
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteHistory(h.id); }}
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#dc2626", padding: "2px 4px", flexShrink: 0 }}
                      title="Xóa"><Trash2 size={10} /></button>
                  )}
                </div>
              ))}

              {/* Sale blocks */}
              {saleBlocks.map((blk, blkIdx) => {
                const ct = blk.contacts;
                const lastCt = ct.length > 0 ? ct.reduce((l, c) => (!l || (c._ts || 0) > (l._ts || 0)) ? c : l, null) : null;
                const lastStLabel = lastCt ? (STATUS_LABELS[lastCt.status] || lastCt.status || "Chưa feedback") : "Chưa feedback";
                const lastStColor = lastCt ? (STATUS_COLORS[lastCt.status] || "#6b7280") : "#6b7280";
                const blockKey = `blk-${blkIdx}`;
                const isExpanded = expandedSaleContact === blockKey;

                return (
                  <div key={blockKey} style={{ marginBottom: 10, borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden", background: "#fff" }}>
                    {/* Block header */}
                    <div onClick={() => setExpandedSaleContact(isExpanded ? null : blockKey)}
                      style={{ padding: isMobile ? 12 : 14, cursor: "pointer", background: isExpanded ? "#f0fdf4" : "linear-gradient(135deg, #f8fafc, #f1f5f9)", borderBottom: isExpanded ? "1px solid #e5e7eb" : "none", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: isMobile ? 13 : 14, color: "#1f2937", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          {(() => { const saleUser = allUsers.find(u => u.displayName === blk.saleName); return saleUser?.avatarUrl ? (
                            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: "50%", background: `url(${saleUser.avatarUrl}) center/cover`, flexShrink: 0, border: "2px solid #e88a2e" }} />
                          ) : (
                            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: "50%", background: blk.isImplicit ? "#6b7280" : "#e88a2e", color: "#fff", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{(blk.saleName || "?")[0]?.toUpperCase()}</span>
                          ); })()}
                          <b style={{ color: "#e88a2e" }}>{blk.saleName}</b>
                          {blk.isImplicit && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 8, fontWeight: 600, background: "#f3f4f6", color: "#6b7280" }}>Giao ban đầu</span>}
                          {ct.length > 0 && (
                            <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 8, fontWeight: 600, background: lastStColor + "18", color: lastStColor }}>
                              {lastStLabel}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4, display: "flex", gap: 12, flexWrap: "wrap" }}>
                          {blk.chiaDate && <span>📅 {blk.chiaDate}</span>}
                          {blk.chiaBy && <span>Người chia: {blk.chiaBy}</span>}
                          <span>📞 {ct.length} lần gọi</span>
                        </div>
                      </div>
                      <span style={{ fontSize: 11, color: "#6b7280", flexShrink: 0, display: "flex", alignItems: "center", gap: 4 }}>
                        {isExpanded ? "Thu gọn ▲" : "Xem chi tiết ▼"}
                      </span>
                    </div>

                    {/* Expanded: calls inside this block */}
                    {isExpanded && (
                      <div style={{ padding: isMobile ? "8px 12px 12px 12px" : "8px 14px 14px 14px" }}>
                        {/* Chia lead info line */}
                        {blk.chiaId && (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                            <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
                            <span style={{ fontSize: 10, color: "#e88a2e", fontWeight: 600, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 4 }}>
                              <Share2 size={10} /> Chia lead cho <b>{blk.saleName}</b>
                              {blk.chiaBy && <span style={{ color: "#9ca3af", fontWeight: 400 }}>bởi {blk.chiaBy}</span>}
                              <span style={{ color: "#9ca3af", fontWeight: 400 }}>{blk.chiaDate || ""}</span>
                            </span>
                            <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteHistory(blk.chiaId); }}
                              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#dc2626", padding: "2px 4px", flexShrink: 0 }}
                              title="Xóa"><Trash2 size={10} /></button>
                          </div>
                        )}
                        {ct.length === 0 && (
                          <div style={{ color: "#9ca3af", fontSize: 12, fontStyle: "italic", padding: 8 }}>Chưa có lần gọi nào</div>
                        )}
                        {ct.map((c, ci) => {
                          const stLabel = STATUS_LABELS[c.status] || c.status || "Chưa feedback";
                          const stColor = STATUS_COLORS[c.status] || "#6b7280";
                          return (
                            <div key={ci} style={{ position: "relative", paddingLeft: isMobile ? 20 : 24, marginBottom: ci < ct.length - 1 ? 6 : 0 }}>
                              <div style={{ position: "absolute", left: 8, top: 0, bottom: ci < ct.length - 1 ? 0 : "50%", width: 2, background: "#e5e7eb" }} />
                              <div style={{ position: "absolute", left: 8, top: 14, width: isMobile ? 10 : 12, height: 2, background: "#e5e7eb" }} />
                              <div style={{ position: "absolute", left: 4, top: 10, width: 10, height: 10, borderRadius: "50%", background: stColor + "30", border: `2px solid ${stColor}` }} />
                              <div style={{ background: ci % 2 ? "#f9fafb" : "#fff", border: "1px solid #f3f4f6", borderRadius: 8, padding: isMobile ? "10px 12px" : "8px 10px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                  <span style={{ fontWeight: 600, fontSize: 12, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                    Gọi lần {c.num}
                                    <span style={{ fontSize: 10, padding: "1px 8px", borderRadius: 8, background: stColor + "18", color: stColor, fontWeight: 600 }}>{stLabel}</span>
                                    {c.source && (
                                      <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 6, fontWeight: 600,
                                        background: c.source === "telegram" ? "#dbeafe" : c.source === "sheet" ? "#fef9c3" : c.source === "schedule" ? "#f3e8ff" : c.source === "sale" ? "#f0fdf4" : "#e0e7ff",
                                        color: c.source === "telegram" ? "#1d4ed8" : c.source === "sheet" ? "#a16207" : c.source === "schedule" ? "#7c3aed" : c.source === "sale" ? "#16a34a" : "#4338ca",
                                      }}>
                                        {c.source === "telegram" ? "📱 Telegram" : c.source === "sheet" ? "📊 Sheet" : c.source === "schedule" ? "⏰ Tự động" : c.source === "sale" ? "👤 Sale" : "👤 Admin"}
                                      </span>
                                    )}
                                  </span>
                                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                                    <span style={{ fontSize: 10, color: "#9ca3af" }}>{c.date || "-"}</span>
                                    {c.id && (
                                      <button onClick={(e) => { e.stopPropagation(); handleDeleteHistory(c.id); }}
                                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#dc2626", padding: "2px 4px" }}
                                        title="Xóa"><Trash2 size={12} /></button>
                                    )}
                                  </div>
                                </div>
                                <div style={{ fontSize: isMobile ? 12 : 11, color: "#374151", marginTop: 4 }}>
                                  {c.feedback ? c.feedback : <span style={{ color: "#d97706", fontStyle: "italic" }}>Chưa có feedback</span>}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        }

        // === SALE VIEW: single consolidated list (unchanged) ===
        const saleContacts = allEvents.filter(e => e.type === "contact" && e.saleName === user?.displayName);
        let saleNum = 0;
        saleContacts.forEach(e => { saleNum++; e.num = saleNum; });

        const totalContacts = saleContacts.length;
        const lastContact = totalContacts > 0
          ? saleContacts.reduce((latest, c) => (!latest || (c._ts || 0) > (latest._ts || 0)) ? c : latest, null)
          : null;
        const lastStatusLabel = lastContact ? (STATUS_LABELS[lastContact.status] || lastContact.status || "Chưa feedback") : "Chưa feedback";
        const lastStatusColor = lastContact ? (STATUS_COLORS[lastContact.status] || "#6b7280") : "#6b7280";

        if (saleContacts.length === 0) return <div style={{ color: "#9ca3af", fontSize: 13, paddingBottom: 8 }}>Chưa có lịch sử</div>;

        const isExpanded = expandedSaleContact === "history";

        return (
          <div style={{ paddingBottom: 8 }}>
            <div style={{ borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden", background: "#fff" }}>
              <div onClick={() => setExpandedSaleContact(isExpanded ? null : "history")}
                style={{ padding: isMobile ? 12 : 14, cursor: "pointer", background: isExpanded ? "#f0fdf4" : "linear-gradient(135deg, #f8fafc, #f1f5f9)", borderBottom: isExpanded ? "1px solid #e5e7eb" : "none", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: isMobile ? 13 : 14, color: "#1f2937", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: "50%", background: "#e88a2e", color: "#fff", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>📞</span>
                    Lịch sử liên hệ
                    {lastContact && (
                      <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 8, fontWeight: 600, background: lastStatusColor + "18", color: lastStatusColor }}>
                        {lastStatusLabel}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4, display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <span>📞 {totalContacts} lần liên hệ</span>
                    {lastContact && <span>Gần nhất: {lastContact.date || "-"}</span>}
                  </div>
                </div>
                <span style={{ fontSize: 11, color: "#6b7280", flexShrink: 0, display: "flex", alignItems: "center", gap: 4 }}>
                  {isExpanded ? "Thu gọn ▲" : "Xem chi tiết ▼"}
                </span>
              </div>
              {isExpanded && (
                <div style={{ padding: isMobile ? "8px 12px 12px 12px" : "8px 14px 14px 14px" }}>
                  {saleContacts.map((evt, ei) => {
                    const stLabel = STATUS_LABELS[evt.status] || evt.status || "Chưa feedback";
                    const stColor = STATUS_COLORS[evt.status] || "#6b7280";
                    const isLast = ei === saleContacts.length - 1;
                    return (
                      <div key={ei} style={{ position: "relative", paddingLeft: isMobile ? 20 : 24, marginBottom: isLast ? 0 : 6 }}>
                        <div style={{ position: "absolute", left: 8, top: 0, bottom: isLast ? "50%" : 0, width: 2, background: "#e5e7eb" }} />
                        <div style={{ position: "absolute", left: 8, top: 14, width: isMobile ? 10 : 12, height: 2, background: "#e5e7eb" }} />
                        <div style={{ position: "absolute", left: 4, top: 10, width: 10, height: 10, borderRadius: "50%", background: stColor + "30", border: `2px solid ${stColor}` }} />
                        <div style={{ background: evt.num % 2 ? "#fff" : "#f9fafb", border: "1px solid #f3f4f6", borderRadius: 8, padding: isMobile ? "10px 12px" : "8px 10px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ fontWeight: 600, fontSize: 12, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                              Gọi lần {evt.num}
                              <span style={{ fontSize: 10, padding: "1px 8px", borderRadius: 8, background: stColor + "18", color: stColor, fontWeight: 600 }}>{stLabel}</span>
                              {evt.source && (
                                <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 6, fontWeight: 600,
                                  background: evt.source === "telegram" ? "#dbeafe" : evt.source === "sheet" ? "#fef9c3" : evt.source === "schedule" ? "#f3e8ff" : evt.source === "sale" ? "#f0fdf4" : "#e0e7ff",
                                  color: evt.source === "telegram" ? "#1d4ed8" : evt.source === "sheet" ? "#a16207" : evt.source === "schedule" ? "#7c3aed" : evt.source === "sale" ? "#16a34a" : "#4338ca",
                                }}>
                                  {evt.source === "telegram" ? "📱 Telegram" : evt.source === "sheet" ? "📊 Sheet" : evt.source === "schedule" ? "⏰ Tự động" : evt.source === "sale" ? "👤 Sale" : "👤 Admin"}
                                </span>
                              )}
                            </span>
                            <span style={{ fontSize: 10, color: "#9ca3af", flexShrink: 0 }}>{evt.date || "-"}</span>
                          </div>
                          <div style={{ fontSize: isMobile ? 12 : 11, color: "#374151", marginTop: 4 }}>
                            {evt.feedback ? evt.feedback : <span style={{ color: "#d97706", fontStyle: "italic" }}>Chưa có feedback</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      </div>
      {/* --- RIGHT COLUMN: Chat Messenger --- */}
      <div>

      {/* === MESSENGER CHAT SECTION (Admin only) === */}
      {!isAdmin ? (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 24, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
          <MessageSquare size={20} style={{ marginBottom: 8, opacity: 0.5 }} />
          <div>Tính năng Chat Messenger chỉ dành cho Admin</div>
        </div>
      ) : (
      <div style={{ border: "1px solid #dbeafe", borderRadius: 10, overflow: "hidden", position: isMobile ? "static" : "sticky", top: 16 }}>
        <div onClick={() => setMessengerOpen(!messengerOpen)}
          style={{ padding: "10px 14px", background: "linear-gradient(135deg, #eff6ff, #dbeafe)", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: "#1e40af", display: "flex", alignItems: "center", gap: 6 }}>
            <MessageSquare size={16} /> Chat Messenger với {lead.name}
            {messengerConvs.length > 0 && <span style={{ fontSize: 10, padding: "1px 8px", borderRadius: 10, background: "#3b82f6", color: "#fff", fontWeight: 600 }}>{messengerConvs.length}</span>}
          </span>
          <span style={{ fontSize: 11, color: "#3b82f6" }}>{messengerOpen ? "Thu gọn ▲" : "Mở xem ▼"}</span>
        </div>

        {messengerOpen && (
          <div style={{ padding: 12, background: "#f8fafc" }}>
            {messengerLoading && <div style={{ textAlign: "center", padding: 20, color: "#6b7280", fontSize: 13 }}><RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} /> Đang tìm cuộc hội thoại...</div>}
            {messengerError && !messengerConvs.length && <div style={{ textAlign: "center", padding: 16, color: "#9ca3af", fontSize: 12 }}>{messengerError}</div>}

            {/* Conversation list */}
            {!activeMessengerConv && messengerConvs.length > 0 && (
              <div>
                <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 8 }}>Tìm thấy {messengerConvs.length} cuộc hội thoại:</div>
                {messengerConvs.map((conv, ci) => {
                  const customer = conv.senders?.find(s => s.id !== conv.pageId);
                  return (
                    <div key={ci} onClick={() => loadMessengerMessages(conv)}
                      style={{ padding: "10px 12px", marginBottom: 6, background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb", cursor: "pointer", transition: "all .15s" }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = "#3b82f6"}
                      onMouseLeave={e => e.currentTarget.style.borderColor = "#e5e7eb"}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13, color: "#1f2937", display: "flex", alignItems: "center", gap: 4 }}>
                            {customer?.name || "Khách hàng"}
                            {(customer?.link || customer?.name) && <a href={customer?.link || `https://www.facebook.com/search/top/?q=${encodeURIComponent(customer?.name)}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} title={customer?.link ? "Xem Facebook" : "Tìm trên Facebook"} style={{ color: "#3b82f6", display: "inline-flex" }}><ExternalLink size={12} /></a>}
                          </div>
                          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{conv.snippet}</div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ fontSize: 10, color: "#9ca3af" }}>{conv.updatedTime ? new Date(conv.updatedTime).toLocaleDateString("vi-VN") : ""}</div>
                          <div style={{ fontSize: 10, color: "#3b82f6", marginTop: 2 }}>📘 {conv.pageName}</div>
                          {conv.unreadCount > 0 && <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 8, background: "#ef4444", color: "#fff", fontWeight: 600 }}>{conv.unreadCount}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Active conversation - message thread */}
            {activeMessengerConv && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <button onClick={() => { setActiveMessengerConv(null); setMessengerMsgs([]); }}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#3b82f6", display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                    <ChevronLeft size={14} /> Quay lại
                  </button>
                  {(() => { const cust = activeMessengerConv.senders?.find(s => s.id !== activeMessengerConv.pageId); return (
                    <span style={{ fontWeight: 600, fontSize: 13, color: "#1f2937", display: "flex", alignItems: "center", gap: 4 }}>
                      {cust?.name || "Khách hàng"}
                      {(cust?.link || cust?.name) && <a href={cust?.link || `https://www.facebook.com/search/top/?q=${encodeURIComponent(cust?.name)}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} title={cust?.link ? "Xem Facebook" : "Tìm trên Facebook"} style={{ color: "#3b82f6", display: "inline-flex" }}><ExternalLink size={12} /></a>}
                    </span>
                  ); })()}
                  <span style={{ fontSize: 10, color: "#6b7280" }}>— 📘 {activeMessengerConv.pageName}</span>
                </div>

                {/* Messages */}
                <div style={{ maxHeight: isMobile ? 350 : 500, overflowY: "auto", background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb", padding: 10, marginBottom: 8 }}>
                  {loadingMsgs && <div style={{ textAlign: "center", padding: 20, color: "#9ca3af", fontSize: 12 }}>Đang tải tin nhắn...</div>}
                  {!loadingMsgs && messengerMsgs.length === 0 && <div style={{ textAlign: "center", padding: 20, color: "#9ca3af", fontSize: 12 }}>Không có tin nhắn</div>}
                  {messengerMsgs.map((msg, mi) => {
                    const isPage = msg.from?.id === activeMessengerConv.pageId;
                    return (
                      <div key={mi} style={{ display: "flex", justifyContent: isPage ? "flex-end" : "flex-start", marginBottom: 6 }}>
                        <div style={{
                          maxWidth: "75%", padding: "8px 12px", borderRadius: 14,
                          background: isPage ? "linear-gradient(135deg, #3b82f6, #2563eb)" : "#f3f4f6",
                          color: isPage ? "#fff" : "#1f2937", fontSize: 13,
                          borderBottomRightRadius: isPage ? 4 : 14,
                          borderBottomLeftRadius: isPage ? 14 : 4,
                        }}>
                          {msg.message && <div style={{ wordBreak: "break-word" }}>{msg.message}</div>}
                          {msg.attachments?.map((att, ai) => (
                            <div key={ai} style={{ marginTop: 4 }}>
                              {att.type?.startsWith("image") && att.url && <img src={att.url} alt="" style={{ maxWidth: "100%", borderRadius: 8, marginTop: 4 }} />}
                              {!att.type?.startsWith("image") && att.url && <a href={att.url} target="_blank" rel="noreferrer" style={{ color: isPage ? "#dbeafe" : "#3b82f6", fontSize: 11 }}>📎 {att.name || "Tệp đính kèm"}</a>}
                            </div>
                          ))}
                          <div style={{ fontSize: 9, marginTop: 4, opacity: 0.7, textAlign: "right" }}>
                            {msg.createdTime ? new Date(msg.createdTime).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }) : ""}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messengerEndRef} />
                </div>

                {/* Reply input */}
                <div style={{ display: "flex", gap: 6 }}>
                  <input value={messengerDraft} onChange={e => setMessengerDraft(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessengerReply()}
                    placeholder="Nhập tin nhắn trả lời..."
                    style={{ flex: 1, padding: "10px 12px", borderRadius: 20, border: "1px solid #d1d5db", fontSize: 13, outline: "none" }}
                    disabled={sendingMsg} />
                  <button onClick={sendMessengerReply} disabled={sendingMsg || !messengerDraft.trim()}
                    style={{ padding: "8px 16px", borderRadius: 20, border: "none", background: messengerDraft.trim() ? "linear-gradient(135deg, #3b82f6, #2563eb)" : "#e5e7eb", color: messengerDraft.trim() ? "#fff" : "#9ca3af", cursor: messengerDraft.trim() ? "pointer" : "default", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
                    <Send size={14} /> {sendingMsg ? "..." : "Gửi"}
                  </button>
                </div>
                {messengerError && <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>{messengerError}</div>}
              </div>
            )}
          </div>
        )}
      </div>
      )}

      </div>
      {/* --- END 2-COLUMN LAYOUT --- */}
      </div>

      {/* Ad Preview Modal */}
      {showAdPreview && (
        <div onClick={() => setShowAdPreview(false)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 9999,
          display: "flex", justifyContent: "center", alignItems: isMobile ? "flex-end" : "center", padding: isMobile ? 0 : 16,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "#fff", borderRadius: isMobile ? "16px 16px 0 0" : 16, width: "100%", maxWidth: isMobile ? "100%" : 600, maxHeight: isMobile ? "92vh" : "90vh",
            overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,.3)",
            WebkitOverflowScrolling: "touch",
          }}>
            <div style={{ padding: isMobile ? "14px 16px" : "16px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "#fff", zIndex: 1 }}>
              <h3 style={{ margin: 0, fontSize: isMobile ? 15 : 16, display: "flex", alignItems: "center", gap: 8 }}>
                <Eye size={18} /> Xem quảng cáo
              </h3>
              <button onClick={() => setShowAdPreview(false)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><X size={18} /></button>
            </div>
            <div style={{ padding: isMobile ? 14 : 20 }}>
              {loadingAdPreview ? (
                <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>
                  <RefreshCw size={24} style={{ animation: "spin 1s linear infinite" }} />
                  <div style={{ marginTop: 8 }}>Đang tải quảng cáo...</div>
                </div>
              ) : adPreview?.error && !adPreview?.adId ? (
                <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>
                  <AlertCircle size={32} style={{ color: "#f59e0b", marginBottom: 8 }} />
                  <div>{adPreview.error}</div>
                </div>
              ) : adPreview?.adId ? (
                <div>
                  <div style={{ marginBottom: 12, padding: isMobile ? "10px 12px" : "8px 12px", background: "#f0fdf4", borderRadius: 8, border: "1px solid #bbf7d0" }}>
                    <div style={{ fontSize: isMobile ? 14 : 13, fontWeight: 600, color: "#166534", wordBreak: "break-word" }}>{adPreview.adName}</div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2, wordBreak: "break-all" }}>
                      Trạng thái: <span style={{ fontWeight: 600, color: adPreview.status === "ACTIVE" ? "#16a34a" : "#dc2626" }}>{adPreview.status}</span>
                      {" · "}Ad ID: {adPreview.adId}
                    </div>
                  </div>
                  {adPreview.imageUrl && (
                    <div style={{ marginBottom: 12, textAlign: "center" }}>
                      <img src={adPreview.imageUrl} alt="Ad Creative" style={{ maxWidth: "100%", borderRadius: 8, border: "1px solid #e5e7eb" }} />
                    </div>
                  )}
                  {adPreview.previews?.length > 0 && adPreview.previews.map((p, pi) => {
                    // Inject responsive CSS into the preview HTML for mobile
                    const responsiveHtml = isMobile
                      ? `<style>
                          * { max-width: 100% !important; box-sizing: border-box !important; }
                          body { margin: 0 !important; padding: 4px !important; overflow-x: hidden !important; width: 100% !important; }
                          img, video, iframe, canvas { max-width: 100% !important; height: auto !important; }
                          div, span, p, a, section, article { max-width: 100% !important; word-wrap: break-word !important; overflow-wrap: break-word !important; }
                          table { max-width: 100% !important; table-layout: fixed !important; }
                          td, th { word-wrap: break-word !important; }
                        </style>${p.html}`
                      : p.html;
                    return (
                      <div key={pi} style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>
                          {p.format === "DESKTOP_FEED_STANDARD" ? "📺 Desktop Feed" : "📱 Mobile Feed"}
                        </div>
                        <div style={{ width: "100%", overflow: "hidden", borderRadius: 8, border: "1px solid #e5e7eb" }}>
                          <iframe
                            srcDoc={responsiveHtml}
                            style={{ width: "100%", minHeight: isMobile ? 400 : (p.format === "DESKTOP_FEED_STANDARD" ? 500 : 600), border: "none", background: "#fff", display: "block" }}
                            sandbox="allow-scripts allow-same-origin allow-popups"
                            scrolling={isMobile ? "auto" : "no"}
                            onLoad={e => {
                              try {
                                const doc = e.target.contentDocument || e.target.contentWindow?.document;
                                if (doc?.body) {
                                  const h = doc.body.scrollHeight;
                                  if (h > 100) e.target.style.height = (h + 20) + "px";
                                }
                              } catch(err) {}
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {!adPreview.imageUrl && (!adPreview.previews || adPreview.previews.length === 0) && (
                    <div style={{ textAlign: "center", padding: 20, color: "#9ca3af", fontSize: 13 }}>
                      Không có preview cho quảng cáo này
                    </div>
                  )}
                  {adPreview.allAds?.length > 1 && (
                    <div style={{ marginTop: 12, padding: "8px 12px", background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 6 }}>Các ad liên quan ({adPreview.allAds.length})</div>
                      {adPreview.allAds.map((a, ai) => (
                        <div key={ai} style={{ fontSize: 12, padding: "2px 0", display: "flex", justifyContent: "space-between" }}>
                          <span>{a.name}</span>
                          <span style={{ fontSize: 10, color: a.status === "ACTIVE" ? "#16a34a" : "#9ca3af", fontWeight: 600 }}>{a.status}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>
                  <AlertCircle size={32} style={{ marginBottom: 8 }} />
                  <div>Không tìm thấy quảng cáo</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectsPage({ projects, openNewProject, openEditProject, deleteProject, apiFetch, applyApiData, isAdminOnly, openLegacyImport }) {
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
        {isAdminOnly && (
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={openLegacyImport} style={{ ...btnPrimary, background: "linear-gradient(135deg, #2563eb, #1d4ed8)" }}>+ Thêm Data Cũ</button>
            <button onClick={openNewProject} style={btnPrimary}>+ Thêm dự án</button>
          </div>
        )}
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
                boxShadow: "0 1px 3px rgba(0,0,0,.08)", borderTop: `3px solid ${p.isLegacy ? '#2563eb' : '#e88a2e'}`,
              }}
            >
              <h4 style={{ margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 }}>
                {p.name}
                {p.isLegacy && <span style={{ fontSize: 10, fontWeight: 700, background: "#dbeafe", color: "#1e40af", padding: "2px 8px", borderRadius: 10 }}>DATA CŨ</span>}
              </h4>
              <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>Chi phí: <b>{formatVND(c.totalSpent)}</b></div>
              <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>Lead: <b>{c.totalLeads || 0}</b> | Booking: <b>{c.totalBooking || 0}</b></div>
              <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>CPL: <b>{formatVND(c.cpLead)}</b></div>
              <div style={{ display: "flex", gap: 8 }}>
                {!p.isLegacy && <button
                  onClick={() => syncOne(p.id)}
                  disabled={!!syncingId}
                  style={{ ...btnPrimary, flex: 1, fontSize: 12, opacity: syncingId ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}
                >
                  {isSyncing && <span style={{ display: "inline-block", width: 12, height: 12, border: "2px solid #fff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />}
                  {isSyncing ? "Đồng bộ..." : <><RefreshCw size={14} /> Sync</>}
                </button>}
                {isAdminOnly && <button onClick={() => openEditProject(p)} style={{ ...btnSecondary, flex: 1, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}><Pencil size={12} /> Sửa</button>}
                {isAdminOnly && <button onClick={() => deleteProject(p.id)} style={{ ...btnDanger, flex: 1, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}><Trash2 size={12} /> Xóa</button>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function CampaignsPage({ leads, projects, isManager = false, isAdminOnly = false }) {
  const isMobile = useIsMobile();
  const [tab, setTab] = useState(isAdminOnly ? "market_intel" : "leads"); // "leads" | "fb_ads" | "settings" | "market_intel"
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [expandedCampaigns, setExpandedCampaigns] = React.useState({});
  const [expandedAdsets, setExpandedAdsets] = React.useState({});

  // FB Ads state
  const [adAccounts, setAdAccounts] = useState([]);
  const [selectedAccounts, setSelectedAccounts] = useState([]);
  const [showAcctDropdown, setShowAcctDropdown] = useState(false);
  const acctDropdownRef = useRef(null);
  const [fbInsights, setFbInsights] = useState([]);
  const [fbLoading, setFbLoading] = useState(false);
  const [fbError, setFbError] = useState("");
  const [fbLevel, setFbLevel] = useState("campaign");
  const [fbDateFrom, setFbDateFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10); });
  const [fbDateTo, setFbDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedFbProject, setSelectedFbProject] = useState(null);
  const [fbDatePreset, setFbDatePreset] = useState("7d");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [campSearch, setCampSearch] = useState("");
  const [campPage, setCampPage] = useState(1);
  const [campSort, setCampSort] = useState({ col: null, asc: true });
  const CAMP_PER_PAGE = 20;
  // Ad Account form
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [acctDraft, setAcctDraft] = useState({ name: "", accountId: "", accessToken: "" });
  const [savingAcct, setSavingAcct] = useState(false);

  // Market Intelligence state
  const [miSearch, setMiSearch] = useState("");
  const [miData, setMiData] = useState(null);
  const [miLoading, setMiLoading] = useState(false);
  const [miError, setMiError] = useState("");
  const [miActivityFeed, setMiActivityFeed] = useState([]);
  const [miWpPage, setMiWpPage] = useState(1);

  const WP_PER_PAGE = 12;

  const loadAdAccounts = async () => {
    try { const r = await apiFetch(`${API}/fb-ad-accounts`); if (r.ok) setAdAccounts(await r.json()); } catch {}
  };
  useEffect(() => { loadAdAccounts(); }, []);

  // Click-outside for account dropdown
  useEffect(() => {
    if (!showAcctDropdown) return;
    const handler = (e) => { if (acctDropdownRef.current && !acctDropdownRef.current.contains(e.target)) setShowAcctDropdown(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showAcctDropdown]);

  const toggleAccountSelection = (accountId) => {
    setSelectedAccounts(prev => prev.includes(accountId) ? prev.filter(id => id !== accountId) : [...prev, accountId]);
  };

  const loadInsights = async () => {
    if (!selectedAccounts.length) return;
    setFbLoading(true); setFbError(""); setSelectedFbProject(null); setCampSearch(""); setCampPage(1); setCampSort({ col: null, asc: true });
    try {
      const allInsights = [];
      const errors = [];
      await Promise.all(selectedAccounts.map(async (acctId) => {
        try {
          const [insightsRes, campaignsRes, adsetsRes] = await Promise.all([
            apiFetch(`${API}/fb-ads/insights/${acctId}?dateFrom=${fbDateFrom}&dateTo=${fbDateTo}&level=campaign`),
            apiFetch(`${API}/fb-ads/campaigns/${acctId}`),
            apiFetch(`${API}/fb-ads/adsets/${acctId}`)
          ]);
          const insightsData = await insightsRes.json();
          if (!insightsRes.ok) { errors.push(insightsData.error || `Lỗi tài khoản ${acctId}`); }
          else {
            let statusMap = {};
            let campBudgets = {};
            if (campaignsRes.ok) {
              const camps = await campaignsRes.json();
              camps.forEach(c => {
                statusMap[c.id] = { status: c.status, objective: c.objective };
                if (c.daily_budget) campBudgets[c.id] = Number(c.daily_budget);
              });
            }
            let budgetMap = { ...campBudgets };
            if (adsetsRes.ok) {
              const adsets = await adsetsRes.json();
              adsets.forEach(a => {
                if ((a.effective_status === "ACTIVE" || a.status === "ACTIVE") && a.daily_budget && !campBudgets[a.campaign_id]) {
                  budgetMap[a.campaign_id] = (budgetMap[a.campaign_id] || 0) + Number(a.daily_budget);
                }
              });
            }
            allInsights.push(...insightsData.map(row => ({
              ...row,
              _accountId: acctId,
              status: statusMap[row.campaign_id]?.status || "",
              objective: statusMap[row.campaign_id]?.objective || "",
              _dailyBudget: budgetMap[row.campaign_id] || 0
            })));
          }
        } catch (e) { errors.push(`Lỗi tài khoản ${acctId}: ${e.message}`); }
      }));
      if (errors.length && !allInsights.length) { setFbError(errors.join("; ")); setFbInsights([]); }
      else {
        if (errors.length) setFbError(errors.join("; "));
        setFbInsights(allInsights);
      }
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

  // Date presets
  const datePresets = [
    { key: "today", label: "Hôm nay" },
    { key: "yesterday", label: "Hôm qua" },
    { key: "3d", label: "3 ngày qua" },
    { key: "7d", label: "7 ngày qua" },
    { key: "14d", label: "14 ngày qua" },
    { key: "28d", label: "28 ngày qua" },
    { key: "30d", label: "30 ngày qua" },
    { key: "this_week", label: "Tuần này" },
    { key: "last_week", label: "Tuần trước" },
    { key: "this_month", label: "Tháng này" },
    { key: "last_month", label: "Tháng trước" },
    { key: "max", label: "Tối đa" },
  ];
  const applyDatePreset = (key) => {
    const now = new Date();
    const fmt = (d) => d.toISOString().slice(0, 10);
    let from, to = fmt(now);
    if (key === "today") { from = fmt(now); }
    else if (key === "yesterday") { const y = new Date(now); y.setDate(y.getDate() - 1); from = fmt(y); to = fmt(y); }
    else if (key === "3d") { const d = new Date(now); d.setDate(d.getDate() - 2); from = fmt(d); }
    else if (key === "7d") { const d = new Date(now); d.setDate(d.getDate() - 6); from = fmt(d); }
    else if (key === "14d") { const d = new Date(now); d.setDate(d.getDate() - 13); from = fmt(d); }
    else if (key === "28d") { const d = new Date(now); d.setDate(d.getDate() - 27); from = fmt(d); }
    else if (key === "30d") { const d = new Date(now); d.setDate(d.getDate() - 29); from = fmt(d); }
    else if (key === "this_week") { const d = new Date(now); d.setDate(d.getDate() - d.getDay()); from = fmt(d); }
    else if (key === "last_week") { const d = new Date(now); d.setDate(d.getDate() - d.getDay() - 7); from = fmt(d); const d2 = new Date(d); d2.setDate(d2.getDate() + 6); to = fmt(d2); }
    else if (key === "this_month") { from = fmt(new Date(now.getFullYear(), now.getMonth(), 1)); }
    else if (key === "last_month") { from = fmt(new Date(now.getFullYear(), now.getMonth() - 1, 1)); to = fmt(new Date(now.getFullYear(), now.getMonth(), 0)); }
    else if (key === "max") { const d = new Date(now); d.setFullYear(d.getFullYear() - 1); from = fmt(d); }
    else { from = fmt(now); }
    setFbDateFrom(from); setFbDateTo(to); setFbDatePreset(key); setShowDatePicker(false);
  };
  const datePickerRef = useRef(null);
  useEffect(() => {
    if (!showDatePicker) return;
    const handler = (e) => { if (datePickerRef.current && !datePickerRef.current.contains(e.target)) setShowDatePicker(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showDatePicker]);

  // Compute totals for a set of insights
  const calcFbTotals = (rows) => {
    if (!rows.length) return null;
    const t = { spend: 0, impressions: 0, reach: 0, clicks: 0, leads: 0, linkClicks: 0 };
    rows.forEach(r => {
      t.spend += Number(r.spend || 0);
      t.impressions += Number(r.impressions || 0);
      t.reach += Number(r.reach || 0);
      t.clicks += Number(r.clicks || 0);
      t.linkClicks += Number(r.inline_link_clicks || 0);
      const la = (r.actions || []).find(a => a.action_type === "lead" || a.action_type === "onsite_conversion.messaging_first_reply");
      if (la) t.leads += Number(la.value || 0);
    });
    t.cpm = t.impressions ? (t.spend / t.impressions * 1000) : 0;
    t.cpc = t.clicks ? (t.spend / t.clicks) : 0;
    t.ctr = t.impressions ? (t.clicks / t.impressions * 100) : 0;
    t.linkCtr = t.impressions ? (t.linkClicks / t.impressions * 100) : 0;
    t.cpl = t.leads ? (t.spend / t.leads) : 0;
    return t;
  };
  const fbTotals = useMemo(() => calcFbTotals(fbInsights), [fbInsights]);

  const calcDailyBudget = (rows) => {
    const seen = new Set();
    let total = 0;
    rows.forEach(r => {
      if (r.status === "ACTIVE" && r._dailyBudget && !seen.has(r.campaign_id)) {
        seen.add(r.campaign_id);
        total += r._dailyBudget;
      }
    });
    return total;
  };

  // Map insights to projects via fb_code matching + CRM lead campaign matching
  const fbProjectMap = useMemo(() => {
    if (!fbInsights.length) return {};
    // Build project code matchers from project fbCode/fbPerson
    const codeMatchers = [];
    (projects || []).forEach(p => {
      if (p.fbCode) {
        const codes = p.fbCode.split(",").map(c => c.trim().toUpperCase()).filter(Boolean);
        const person = (p.fbPerson || "").trim().toUpperCase();
        codes.forEach(code => codeMatchers.push({ pid: p.id, code, person }));
      }
    });
    // CRM lead campaign → project mapping (fallback)
    const campToProject = {};
    leads.forEach(l => { if (l.campaign) campToProject[l.campaign] = l.projectId || 0; });
    const map = {};
    fbInsights.forEach(row => {
      const campUpper = (row.campaign_name || "").toUpperCase();
      // Try fb_code match first
      let pid = -1;
      for (const m of codeMatchers) {
        if (campUpper.includes(m.code) && (!m.person || campUpper.includes(m.person))) {
          pid = m.pid; break;
        }
      }
      // Fallback to CRM lead matching
      if (pid === -1) pid = campToProject[row.campaign_name] ?? -1;
      if (!map[pid]) map[pid] = [];
      map[pid].push(row);
    });
    return map;
  }, [fbInsights, leads, projects]);

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
      {isAdminOnly && tabBtn("market_intel", "Phân tích thị trường", <Radar size={15} />)}
      {tabBtn("leads", "Lead theo chiến dịch", <Target size={15} />)}
      {tabBtn("fb_ads", "Hiệu quả quảng cáo FB", <Activity size={15} />)}
      {!isManager && tabBtn("settings", "Cài đặt tài khoản", <Settings size={15} />)}
    </div>
  );

  // === Market Intelligence Tab ===
  if (tab === "market_intel") {
    // Dark mode styles for this tab
    const darkBg = "#0f172a";
    const darkCard = "rgba(30,41,59,0.8)";
    const darkBorder = "rgba(71,85,105,0.5)";
    const neonBlue = "#3b82f6";
    const emerald = "#10b981";
    const amber = "#f59e0b";
    const rose = "#f43f5e";
    const slate300 = "#cbd5e1";
    const slate400 = "#94a3b8";
    const slate500 = "#64748b";
    const glassCard = { background: "rgba(30,41,59,0.7)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: `1px solid ${darkBorder}`, borderRadius: 16, padding: isMobile ? 16 : 20, transition: "transform .2s, box-shadow .2s" };
    const glassCardHover = { transform: "translateY(-2px)", boxShadow: "0 8px 32px rgba(0,0,0,.3)" };

    // No suggestion list — user types exactly what they want to search

    // Analyze a project
    const analyzeProject = async (projectName, location) => {
      setMiLoading(true); setMiError(""); setMiData(null);
      setMiActivityFeed([
        { msg: `🔗 Đang kết nối Facebook Ads Library API...`, time: new Date().toISOString() },
      ]);
      const feedTimer1 = setTimeout(() => setMiActivityFeed(f => [...f, { msg: `🔍 Đang quét quảng cáo của "${projectName}"...`, time: new Date().toISOString() }]), 3000);
      const feedTimer2 = setTimeout(() => setMiActivityFeed(f => [...f, { msg: `📊 Đang bóc tách dữ liệu pages & đối thủ...`, time: new Date().toISOString() }]), 8000);
      const feedTimer3 = setTimeout(() => setMiActivityFeed(f => [...f, { msg: `📋 Đang lấy tên page & thời gian chạy QC qua API...`, time: new Date().toISOString() }]), 15000);
      const feedTimer4 = setTimeout(() => setMiActivityFeed(f => [...f, { msg: `🏠 Đang thu thập giá từ Batdongsan.com.vn & Chợ Tốt...`, time: new Date().toISOString() }]), 25000);
      const feedTimer5 = setTimeout(() => setMiActivityFeed(f => [...f, { msg: `🧮 Đang tính toán CPL Pro 2026 & benchmark khu vực...`, time: new Date().toISOString() }]), 35000);
      const allTimers = [feedTimer1, feedTimer2, feedTimer3, feedTimer4, feedTimer5];
      const MAX_RETRIES = 2;
      let lastErr = "";
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          if (attempt > 0) {
            setMiActivityFeed(f => [...f, { msg: `Đang thử lại lần ${attempt}...`, time: new Date().toISOString() }]);
          }
          const r = await apiFetch(`${API}/market-intel/analyze?project=${encodeURIComponent(projectName)}&location=${encodeURIComponent(location || "")}`);
          const contentType = r.headers.get("content-type") || "";
          if (!contentType.includes("application/json")) {
            if (r.status === 504 && attempt < MAX_RETRIES) { lastErr = "Server đang xử lý lâu — thử lại..."; continue; }
            lastErr = r.status === 504 ? "Server đang xử lý lâu — vui lòng thử lại" : `Lỗi server (${r.status})`;
            break;
          }
          const data = await r.json();
          if (!r.ok) { lastErr = data.error || "Lỗi phân tích"; break; }
          setMiData(data);
          setMiWpPage(1);
          setMiActivityFeed(data.activity_feed || []);
          lastErr = "";
          break;
        } catch (e) {
          if (attempt < MAX_RETRIES) { lastErr = e.message; continue; }
          lastErr = "Lỗi kết nối: " + e.message;
        }
      }
      if (lastErr) setMiError(lastErr);
      allTimers.forEach(clearTimeout);
      setMiLoading(false);
    };



    // Build active project from API data or defaults
    const activeProject = miData ? {
      name: miData.project_name,
      location: miData.location,
      heatIndex: miData.heat_index,
      cplMin: miData.estimated_cpl_range.min,
      cplMax: miData.estimated_cpl_range.max,
      cplAvg: miData.estimated_cpl_range.avg,
      districtAvg: miData.district_avg_cpl,
      districtName: miData.district_name || "Khu vực",
      competitors: miData.competitor_count,
      uniqueAds: miData.unique_ad_count || miData.competitor_count,
      totalAds: miData.total_ad_count || miData.competitor_count,
      priceM2: miData.avg_price_m2,
      highRisePrice: miData.high_rise_price || miData.avg_price_m2,
      lowRisePrice: miData.low_rise_price || Math.round((miData.avg_price_m2 || 0) * 1.8),
      highRiseCount: miData.high_rise_count || 0,
      lowRiseCount: miData.low_rise_count || 0,
      leadPriceSources: miData.lead_price_sources || [],
      opportunityScore: miData.opportunity_score,
      opportunityLabel: miData.opportunity_label || "",
      opportunityReasons: miData.opportunity_reasons || [],
      opportunitySummary: miData.opportunity_summary || "",
      pageCount: miData.page_count || 0,
      searchTerm: miData.search_term || miData.project_name,
      officialPrice: miData.official_price || "",
      projectPhase: miData.project_phase || "",
      projectType: miData.project_type || "both",
      projectStatus: miData.project_status || "",
      locationFactor: miData.location_factor || 1.0,
      locationTier: miData.location_tier || "suburban",
      segmentFactor: miData.segment_factor || 1.0,
      competitionMultiplier: miData.competition_multiplier || 1.0,
      competitionLevel: miData.competition_level || "low",
      cplByType: miData.cpl_by_type || [],
      productTypes: miData.product_types || [],
      regionBenchmark: miData.region_benchmark || { percent: 0, label: "N/A", district: "" },
      centerBenchmark: miData.center_benchmark || { percent: 0, label: "N/A", centerAvg: 650000 },
      trend: (() => { const t = miData.ad_trend_30d || []; if (t.length < 2) return "down"; const last = typeof t[t.length-1] === "object" ? t[t.length-1].value : t[t.length-1]; const first = typeof t[0] === "object" ? t[0].value : t[0]; return last > first ? "up" : "down"; })(),
      adTrend: miData.ad_trend_30d || [],
      cplTrend: miData.cpl_trend_30d || [],
      segment: miData.segment,
      winningPages: miData.winning_pages || [],
      cached: miData.cached,
      scrapedAt: miData.scraped_at,
      apiFetchedAds: miData.api_fetched_ads || 0,
      apiError: miData.api_error || null,
      aiInsight: miData.ai_insight || "",
      aiConfirmedType: miData.ai_confirmed_type || null,
      aiConfirmedTypeReason: miData.ai_confirmed_type_reason || "",
      aiFilteredNote: miData.ai_filtered_note || "",
      aiLocation: miData.ai_location || null,
      aiVerified: miData.ai_verified || false,
      aiEnabled: miData.ai_enabled || false,
    } : null;

    // Mini line chart SVG
    const MiniChart = ({ data, color, width = 280, height = 80, fill = true }) => {
      if (!data || !data.length) return null;
      const vals = data.map(d => typeof d === "object" ? d.value : d);
      const labels = data.map(d => typeof d === "object" ? d.label : null);
      const hasLabels = labels.some(l => l);
      const chartH = hasLabels ? height - 18 : height;
      const max = Math.max(...vals);
      const min = Math.min(...vals);
      const range = max - min || 1;
      const points = vals.map((v, i) => `${(i / (vals.length - 1)) * width},${chartH - ((v - min) / range) * (chartH - 10) - 5}`).join(" ");
      const fillPoints = `0,${chartH} ${points} ${width},${chartH}`;
      return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
          {fill && <polygon points={fillPoints} fill={`${color}15`} />}
          <polyline points={points} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {(() => { const parts = points.split(" "); const last = parts[parts.length - 1].split(","); return <circle cx={last[0]} cy={last[1]} r="4" fill={color} stroke={darkBg} strokeWidth="2" />; })()}
          {hasLabels && vals.map((_, i) => {
            if (i % 5 !== 0 && i !== vals.length - 1) return null;
            const x = (i / (vals.length - 1)) * width;
            return <text key={i} x={x} y={height - 2} textAnchor={i === 0 ? "start" : i === vals.length - 1 ? "end" : "middle"} fill="#64748b" fontSize="9">{labels[i]}</text>;
          })}
        </svg>
      );
    };

    // Bar chart for CPL comparison
    const CplCompareChart = ({ projectCpl, districtAvg, districtLabel, width = 280, height = 120 }) => {
      const maxVal = Math.max(projectCpl, districtAvg) * 1.2;
      const barW = 60;
      const gap = 40;
      const startX = (width - barW * 2 - gap) / 2;
      const h1 = (projectCpl / maxVal) * (height - 30);
      const h2 = (districtAvg / maxVal) * (height - 30);
      const fmt = (n) => (n / 1000).toFixed(0) + "K";
      return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
          <defs>
            <linearGradient id="barGrad1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={neonBlue} /><stop offset="100%" stopColor={neonBlue} stopOpacity="0.4" /></linearGradient>
            <linearGradient id="barGrad2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={slate500} /><stop offset="100%" stopColor={slate500} stopOpacity="0.4" /></linearGradient>
          </defs>
          <rect x={startX} y={height - h1 - 20} width={barW} height={h1} rx="6" fill="url(#barGrad1)" />
          <text x={startX + barW / 2} y={height - h1 - 25} textAnchor="middle" fill={neonBlue} fontSize="11" fontWeight="700">{fmt(projectCpl)}</text>
          <text x={startX + barW / 2} y={height - 4} textAnchor="middle" fill={slate400} fontSize="10">Dự án</text>
          <rect x={startX + barW + gap} y={height - h2 - 20} width={barW} height={h2} rx="6" fill="url(#barGrad2)" />
          <text x={startX + barW + gap + barW / 2} y={height - h2 - 25} textAnchor="middle" fill={slate400} fontSize="11" fontWeight="700">{fmt(districtAvg)}</text>
          <text x={startX + barW + gap + barW / 2} y={height - 4} textAnchor="middle" fill={slate400} fontSize="10">{districtLabel || "TB Quận"}</text>
        </svg>
      );
    };

    // Heat index color
    const heatColor = (v) => v >= 80 ? "#ef4444" : v >= 60 ? amber : v >= 40 ? neonBlue : slate500;
    const heatLabel = (v) => v >= 80 ? "Rất nóng" : v >= 60 ? "Nóng" : v >= 40 ? "Ấm" : "Lạnh";
    const opportunityColor = (v) => v >= 80 ? emerald : v >= 60 ? neonBlue : v >= 40 ? amber : rose;

    const fmtVND = (n) => n != null ? Number(n).toLocaleString("vi-VN") + " ₫" : "—";
    const fmtShort = (n) => { if (n >= 1e9) return (n / 1e9).toFixed(1) + " tỷ"; if (n >= 1e6) return (n / 1e6).toFixed(1) + " tr"; if (n >= 1e3) return (n / 1e3).toFixed(0) + "K"; return String(n); };

    return (
      <div style={{ fontFamily: "'Montserrat', 'Inter', system-ui, sans-serif" }}>
        {tabBar}
        <div style={{ background: `linear-gradient(135deg, ${darkBg} 0%, #1e293b 50%, #0f172a 100%)`, borderRadius: 20, padding: isMobile ? 16 : 28, minHeight: 600 }}>

          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Radar size={24} color={neonBlue} />
              <h2 style={{ margin: 0, fontSize: isMobile ? 18 : 24, fontWeight: 800, background: `linear-gradient(135deg, ${neonBlue}, ${emerald})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Real Estate Market Intelligence</h2>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: slate400, letterSpacing: "0.03em" }}>Phân tích thị trường quảng cáo bất động sản · Powered by AI</p>
          </div>

          {/* Search Bar */}
          <div style={{ position: "relative", maxWidth: 600, margin: "0 auto 28px", zIndex: 20 }}>
            <div style={{ position: "relative" }}>
              <Search size={18} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: slate400 }} />
              <input
                type="text" placeholder="Tìm dự án... (VD: Masterise Cosmo, Global City)"
                className="mi-search-input"
                value={miSearch}
                onChange={(e) => { setMiSearch(e.target.value); }}
                onKeyDown={(e) => { if (e.key === "Enter" && miSearch.trim()) { analyzeProject(miSearch.trim(), ""); } }}
                style={{
                  width: "100%", padding: "14px 16px 14px 46px", fontSize: 15, fontWeight: 600,
                  background: "rgba(15,23,42,0.95)", border: `1px solid ${neonBlue}50`, borderRadius: 14,
                  color: "#ffffff", outline: "none", backdropFilter: "blur(8px)",
                  boxShadow: `0 0 20px ${neonBlue}15`, transition: "all .3s",
                  boxSizing: "border-box", caretColor: neonBlue, letterSpacing: "0.01em",
                }}
                onMouseEnter={(e) => { e.target.style.borderColor = neonBlue; e.target.style.boxShadow = `0 0 30px ${neonBlue}25`; }}
                onMouseLeave={(e) => { e.target.style.borderColor = `${neonBlue}40`; e.target.style.boxShadow = `0 0 20px ${neonBlue}15`; }}
              />
            </div>
          </div>

          {/* Live Activity Feed - bottom right corner */}
          {miActivityFeed.length > 0 && (
            <div style={{
              position: "fixed", bottom: isMobile ? 12 : 20, right: isMobile ? 12 : 20,
              width: isMobile ? "calc(100% - 24px)" : 360, maxHeight: 260, zIndex: 50,
              background: "rgba(15,23,42,0.95)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
              border: `1px solid ${darkBorder}`, borderRadius: 14, padding: "12px 14px",
              boxShadow: "0 10px 40px rgba(0,0,0,.5)", overflow: "hidden",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: miLoading ? amber : emerald, boxShadow: `0 0 8px ${miLoading ? amber : emerald}`, animation: "pulse 2s infinite" }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: miLoading ? amber : emerald, letterSpacing: "0.05em", textTransform: "uppercase" }}>{miLoading ? "Đang phân tích..." : "Live Activity"}</span>
                <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
              </div>
              {/* Progress bar during loading */}
              {miLoading && (
                <div style={{ width: "100%", height: 3, borderRadius: 2, background: "rgba(71,85,105,0.3)", marginBottom: 8, overflow: "hidden" }}>
                  <div style={{ width: "100%", height: "100%", borderRadius: 2, background: `linear-gradient(90deg, transparent, ${neonBlue}, transparent)`, animation: "progressSlide 2s infinite linear" }} />
                  <style>{`@keyframes progressSlide { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }`}</style>
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 200, overflowY: "auto" }}>
                {miActivityFeed.slice(-6).map((evt, i) => (
                  <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start", fontSize: 11, color: slate300, padding: "3px 0", borderBottom: `1px solid ${darkBorder}30`, animation: "fadeIn .3s ease" }}>
                    <span style={{ color: slate500, fontSize: 10, flexShrink: 0, marginTop: 1 }}>{new Date(evt.time).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                    <span>{evt.msg}</span>
                  </div>
                ))}
              </div>
              <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
            </div>
          )}

          {/* Loading State — elapsed timer counting up */}
          {miLoading && (
            <div style={{ ...glassCard, textAlign: "center", padding: 60 }}>
              <ElapsedTimer />
              <div style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9", marginTop: 16 }}>Đang phân tích dự án...</div>
              <div style={{ fontSize: 12, color: slate400, marginTop: 6 }}>Thu thập dữ liệu từ Facebook Ads Library & Batdongsan.com.vn</div>
            </div>
          )}

          {/* Error State */}
          {!miLoading && miError && (
            <div style={{ ...glassCard, textAlign: "center", padding: 40, borderColor: `${rose}40` }}>
              <AlertCircle size={36} color={rose} style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: rose, marginBottom: 6 }}>{miError}</div>
              <div style={{ fontSize: 12, color: slate400 }}>Vui lòng thử lại sau hoặc chọn dự án khác</div>
            </div>
          )}

          {/* Empty / Welcome State */}
          {!miLoading && !miError && !activeProject && (
            <div style={{ ...glassCard, textAlign: "center", padding: isMobile ? 40 : 60 }}>
              <Radar size={48} color={neonBlue} style={{ marginBottom: 16, opacity: 0.6 }} />
              <div style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9", marginBottom: 8 }}>Chọn dự án để phân tích</div>
              <div style={{ fontSize: 13, color: slate400, maxWidth: 400, margin: "0 auto" }}>Tìm kiếm tên dự án bất động sản ở thanh tìm kiếm phía trên để xem phân tích chi tiết về thị trường quảng cáo</div>
            </div>
          )}

          {/* Project Data */}
          {!miLoading && !miError && activeProject && (<>

          {/* Project Snapshot Header */}
          <div style={{ ...glassCard, marginBottom: 20, display: "flex", alignItems: isMobile ? "flex-start" : "center", gap: 16, flexWrap: "wrap", justifyContent: "space-between" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <Building2 size={20} color={neonBlue} />
                <h3 style={{ margin: 0, fontSize: isMobile ? 18 : 22, fontWeight: 800, color: "#f1f5f9" }}>{activeProject.name}</h3>
              </div>
              {/* Tag badges */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                {activeProject.projectType === "thap_tang" && (
                  <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: `${amber}20`, color: amber, fontWeight: 700, border: `1px solid ${amber}30` }}>🏠 Thấp tầng</span>
                )}
                {activeProject.projectType === "cao_tang" && (
                  <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: `${neonBlue}20`, color: neonBlue, fontWeight: 700, border: `1px solid ${neonBlue}30` }}>🏢 Cao tầng</span>
                )}
                {activeProject.projectType === "both" && (
                  <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: `${emerald}20`, color: emerald, fontWeight: 700, border: `1px solid ${emerald}30` }}>🏘️ Phức hợp</span>
                )}
                {activeProject.projectStatus && (
                  <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: activeProject.projectStatus === "Chưa mở bán" ? `${rose}20` : `${emerald}20`, color: activeProject.projectStatus === "Chưa mở bán" ? rose : emerald, fontWeight: 700, border: `1px solid ${activeProject.projectStatus === "Chưa mở bán" ? rose : emerald}30` }}>● {activeProject.projectStatus}</span>
                )}
                {activeProject.projectPhase && (
                  <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: `${neonBlue}20`, color: neonBlue, fontWeight: 700, border: `1px solid ${neonBlue}30` }}>📅 {activeProject.projectPhase}</span>
                )}
                {activeProject.segment && (
                  <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: "rgba(148,163,184,0.15)", color: slate300, fontWeight: 600 }}>
                    {activeProject.segment === "ultra_luxury" ? "💎 Ultra Luxury" : activeProject.segment === "luxury" ? "✨ Luxury" : activeProject.segment === "mid_high" ? "🏙️ Mid-High" : activeProject.segment === "mid" ? "📊 Mid" : "🏡 Affordable"}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: slate400 }}>
                <MapPin size={14} /> {activeProject.aiLocation || activeProject.location || activeProject.districtName}
              </div>
              {activeProject.aiVerified && activeProject.aiConfirmedType && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 4, background: `${emerald}15`, color: emerald, fontWeight: 700, border: `1px solid ${emerald}30`, display: "inline-flex", alignItems: "center", gap: 3 }}>
                    ✅ Perplexity đã xác minh: {activeProject.aiConfirmedType === "cao_tang" ? "Chỉ bán Cao tầng" : activeProject.aiConfirmedType === "thap_tang" ? "Chỉ bán Thấp tầng" : "Phức hợp (Cao tầng + Thấp tầng)"}
                  </span>
                  {activeProject.aiConfirmedTypeReason && <span style={{ fontSize: 9, color: slate400, fontStyle: "italic" }}>{activeProject.aiConfirmedTypeReason}</span>}
                </div>
              )}
              {!activeProject.aiVerified && activeProject.aiEnabled && (
                <div style={{ fontSize: 9, color: slate500, marginTop: 4, fontStyle: "italic" }}>⏳ Chưa xác minh được qua AI — hiển thị dữ liệu từ crawler</div>
              )}
              {activeProject.aiFilteredNote && (
                <div style={{ fontSize: 9, color: amber, marginTop: 3, padding: "2px 6px", borderRadius: 4, background: `${amber}08` }}>⚠ {activeProject.aiFilteredNote}</div>
              )}
            </div>
            <div style={{ textAlign: "center", minWidth: 120 }}>
              <div style={{ fontSize: 11, color: slate400, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 4 }}>Market Heat Index</div>
              <div style={{ position: "relative", width: 80, height: 80, margin: "0 auto" }}>
                <svg width="80" height="80" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" fill="none" stroke={`${heatColor(activeProject.heatIndex)}20`} strokeWidth="6" />
                  <circle cx="40" cy="40" r="34" fill="none" stroke={heatColor(activeProject.heatIndex)} strokeWidth="6"
                    strokeDasharray={`${(activeProject.heatIndex / 100) * 213.6} 213.6`}
                    strokeLinecap="round" transform="rotate(-90 40 40)" style={{ transition: "stroke-dasharray 1s ease" }} />
                </svg>
                <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: heatColor(activeProject.heatIndex), lineHeight: 1 }}>{activeProject.heatIndex}</div>
                  <div style={{ fontSize: 8, color: slate400, fontWeight: 600, marginTop: 1 }}>{heatLabel(activeProject.heatIndex)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Golden Metric Cards */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
            {/* CPL Card — segmented by product type */}
            <div style={glassCard} onMouseEnter={(e) => { e.currentTarget.style.transform = glassCardHover.transform; e.currentTarget.style.boxShadow = glassCardHover.boxShadow; }} onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: `${neonBlue}20`, display: "flex", alignItems: "center", justifyContent: "center" }}><DollarSign size={16} color={neonBlue} /></div>
                <span style={{ fontSize: 11, color: slate400, fontWeight: 600, letterSpacing: "0.03em" }}>CPL Ước tính</span>
              </div>
              {activeProject.cplByType.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {activeProject.cplByType.map((ct, ci) => (
                    <div key={ci} style={{ padding: "6px 8px", borderRadius: 8, background: ct.category === "cao_tang" ? `${neonBlue}08` : `${amber}08`, border: `1px solid ${ct.category === "cao_tang" ? neonBlue : amber}15` }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: ct.category === "cao_tang" ? neonBlue : amber }}>{ct.category === "cao_tang" ? "🏢" : "🏠"} {ct.type}</span>
                        <span style={{ fontSize: isMobile ? 14 : 16, fontWeight: 800, color: ct.category === "cao_tang" ? neonBlue : amber }}>{fmtShort(ct.cplAvg)}</span>
                      </div>
                      <div style={{ fontSize: 10, color: slate400 }}>
                        <span style={{ color: emerald }}>{fmtShort(ct.cplMin)}</span> — <span style={{ color: rose }}>{fmtShort(ct.cplMax)}</span>
                      </div>
                      <div style={{ fontSize: 9, color: slate500, marginTop: 2, fontStyle: "italic" }}>{ct.note}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 800, color: neonBlue, marginBottom: 4 }}>{fmtShort(activeProject.cplAvg)}</div>
                  <div style={{ fontSize: 11, color: slate400 }}>
                    <span style={{ color: emerald }}>{fmtShort(activeProject.cplMin)}</span> — <span style={{ color: rose }}>{fmtShort(activeProject.cplMax)}</span>
                  </div>
                </>
              )}
              <div style={{ fontSize: 9, color: slate500, marginTop: 6, lineHeight: 1.5, borderTop: `1px solid ${darkBorder}`, paddingTop: 4 }}>
                <div>Base 250K × Seg {activeProject.segmentFactor} × Loc {activeProject.locationFactor} × Comp {activeProject.competitionMultiplier}</div>
                {activeProject.cplByType.length > 1 && <div>Thấp tầng = Cao tầng × 2.2</div>}
              </div>
            </div>

            {/* Competition Density */}
            <div style={glassCard} onMouseEnter={(e) => { e.currentTarget.style.transform = glassCardHover.transform; e.currentTarget.style.boxShadow = glassCardHover.boxShadow; }} onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: `${amber}20`, display: "flex", alignItems: "center", justifyContent: "center" }}><Crosshair size={16} color={amber} /></div>
                <span style={{ fontSize: 11, color: slate400, fontWeight: 600, letterSpacing: "0.03em" }}>Mật độ cạnh tranh</span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontSize: isMobile ? 16 : 20, fontWeight: 800, color: amber }}>{activeProject.competitors > 100 ? `~${activeProject.competitors}` : activeProject.competitors}</span>
                <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, fontWeight: 700, background: activeProject.competitionLevel === "high" ? `${rose}20` : activeProject.competitionLevel === "medium" ? `${amber}20` : `${emerald}20`, color: activeProject.competitionLevel === "high" ? rose : activeProject.competitionLevel === "medium" ? amber : emerald }}>
                  {activeProject.competitionLevel === "high" ? "Cao" : activeProject.competitionLevel === "medium" ? "Vừa" : "Thấp"}
                </span>
              </div>
              <div style={{ fontSize: 11, color: slate400 }}>QC đang hoạt động trên Ads Library</div>
              {activeProject.pageCount > 0 && <div style={{ fontSize: 10, color: slate500, marginTop: 2 }}>{activeProject.pageCount} pages đang chạy QC</div>}
              {activeProject.competitors === 0 && activeProject.apiError && (
                <div style={{ fontSize: 9, color: rose, marginTop: 4, padding: "4px 6px", background: `${rose}15`, borderRadius: 6, lineHeight: 1.4 }}>
                  ⚠ {activeProject.apiError.length > 100 ? activeProject.apiError.substring(0, 100) + "…" : activeProject.apiError}
                </div>
              )}
              <a href={`https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=VN&q=${encodeURIComponent(activeProject.searchTerm || activeProject.name)}&search_type=keyword_unordered`} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 10, color: neonBlue, marginTop: 4, display: "inline-flex", alignItems: "center", gap: 3, textDecoration: "none" }}>
                <ExternalLink size={9} /> Xem trên Ads Library
              </a>
              {activeProject.searchTerm && activeProject.searchTerm !== activeProject.name && (
                <div style={{ fontSize: 9, color: slate500, marginTop: 2 }}>Tìm kiếm: "{activeProject.searchTerm}"</div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                {activeProject.trend === "up" ? <TrendingUp size={12} color={rose} /> : <TrendingDown size={12} color={emerald} />}
                <span style={{ fontSize: 10, color: activeProject.trend === "up" ? rose : emerald, fontWeight: 600 }}>{activeProject.trend === "up" ? "Tăng" : "Giảm"}</span>
              </div>
            </div>

            {/* Property Price — Detailed Product List */}
            <div style={glassCard} onMouseEnter={(e) => { e.currentTarget.style.transform = glassCardHover.transform; e.currentTarget.style.boxShadow = glassCardHover.boxShadow; }} onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: `${emerald}20`, display: "flex", alignItems: "center", justifyContent: "center" }}><Building size={16} color={emerald} /></div>
                <span style={{ fontSize: 11, color: slate400, fontWeight: 600, letterSpacing: "0.03em" }}>Bảng giá chi tiết</span>
              </div>
              {activeProject.productTypes && activeProject.productTypes.length > 0 ? (
                <div style={{ fontSize: 10 }}>
                  {/* Table header */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, padding: "4px 0", borderBottom: `1px solid ${darkBorder}`, marginBottom: 4 }}>
                    <span style={{ color: slate400, fontWeight: 700, fontSize: 9 }}>Loại hình</span>
                    <span style={{ color: slate400, fontWeight: 700, fontSize: 9, textAlign: "right" }}>triệu/m²</span>
                    <span style={{ color: slate400, fontWeight: 700, fontSize: 9, textAlign: "right" }}>Giá tổng (tỷ)</span>
                  </div>
                  {/* Cao tầng section */}
                  {(() => {
                    const ct = activeProject.productTypes.filter(p => p.category === "cao_tang");
                    if (ct.length === 0) return null;
                    return (<>
                      <div style={{ fontSize: 9, color: neonBlue, fontWeight: 700, padding: "3px 0", marginTop: 2 }}>🏢 CAO TẦNG</div>
                      {ct.map((p, i) => (
                        <div key={`ct-${i}`} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, padding: "2px 0", borderBottom: `1px solid ${darkBorder}30` }}>
                          <span style={{ color: slate300, fontSize: 10 }}>{p.name} <span style={{ color: slate500, fontSize: 8 }}>({p.typicalArea}m²)</span></span>
                          <span style={{ color: emerald, fontSize: 10, textAlign: "right", fontWeight: 600 }}>{(p.priceM2 / 1e6).toFixed(1)}</span>
                          <span style={{ color: "#f1f5f9", fontSize: 10, textAlign: "right", fontWeight: 700 }}>{p.totalPrice.toFixed(1)}</span>
                        </div>
                      ))}
                    </>);
                  })()}
                  {/* Thấp tầng section */}
                  {(() => {
                    const tt = activeProject.productTypes.filter(p => p.category === "thap_tang");
                    if (tt.length === 0) return null;
                    return (<>
                      <div style={{ fontSize: 9, color: amber, fontWeight: 700, padding: "3px 0", marginTop: 4 }}>🏠 THẤP TẦNG</div>
                      {tt.map((p, i) => (
                        <div key={`tt-${i}`} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, padding: "2px 0", borderBottom: `1px solid ${darkBorder}30` }}>
                          <span style={{ color: slate300, fontSize: 10 }}>{p.name} <span style={{ color: slate500, fontSize: 8 }}>({p.typicalArea}m²)</span></span>
                          <span style={{ color: amber, fontSize: 10, textAlign: "right", fontWeight: 600 }}>{(p.priceM2 / 1e6).toFixed(1)}</span>
                          <span style={{ color: "#f1f5f9", fontSize: 10, textAlign: "right", fontWeight: 700 }}>{p.totalPrice.toFixed(1)}</span>
                        </div>
                      ))}
                    </>);
                  })()}
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {activeProject.projectType !== "thap_tang" && (
                    <div>
                      <div style={{ fontSize: 9, color: slate500, fontWeight: 600, marginBottom: 2 }}>🏢 Cao tầng</div>
                      <div style={{ fontSize: isMobile ? 14 : 16, fontWeight: 800, color: activeProject.highRisePrice ? emerald : slate400 }}>{activeProject.highRisePrice ? fmtShort(activeProject.highRisePrice) : "N/A"}</div>
                    </div>
                  )}
                  {activeProject.projectType === "both" && <div style={{ width: 1, background: darkBorder }} />}
                  {activeProject.projectType !== "cao_tang" && (
                    <div>
                      <div style={{ fontSize: 9, color: slate500, fontWeight: 600, marginBottom: 2 }}>🏠 Thấp tầng</div>
                      <div style={{ fontSize: isMobile ? 14 : 16, fontWeight: 800, color: activeProject.lowRisePrice ? amber : slate400 }}>{activeProject.lowRisePrice ? fmtShort(activeProject.lowRisePrice) : "N/A"}</div>
                    </div>
                  )}
                </div>
              )}
              {activeProject.officialPrice && (
                <div style={{ fontSize: 10, color: neonBlue, marginTop: 4, fontWeight: 600 }}>🏷️ Giá chính thức: {activeProject.officialPrice}</div>
              )}
              <div style={{ fontSize: 9, color: slate500, marginTop: 3 }}>Batdongsan · Chợ Tốt · DT phổ biến</div>
            </div>

            {/* Opportunity Score */}
            <div style={glassCard} onMouseEnter={(e) => { e.currentTarget.style.transform = glassCardHover.transform; e.currentTarget.style.boxShadow = glassCardHover.boxShadow; }} onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: `${opportunityColor(activeProject.opportunityScore)}20`, display: "flex", alignItems: "center", justifyContent: "center" }}><Sparkles size={16} color={opportunityColor(activeProject.opportunityScore)} /></div>
                <span style={{ fontSize: 11, color: slate400, fontWeight: 600, letterSpacing: "0.03em" }}>Opportunity Score</span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontSize: isMobile ? 16 : 20, fontWeight: 800, color: opportunityColor(activeProject.opportunityScore) }}>{activeProject.opportunityScore}</span>
                <span style={{ fontSize: 12, color: slate400 }}>/100</span>
                {activeProject.opportunityLabel && <span style={{ fontSize: 10, color: opportunityColor(activeProject.opportunityScore), fontWeight: 600 }}>· {activeProject.opportunityLabel}</span>}
              </div>
              <div style={{ width: "100%", height: 6, borderRadius: 3, background: "rgba(71,85,105,0.3)", marginTop: 8 }}>
                <div style={{ width: `${activeProject.opportunityScore}%`, height: "100%", borderRadius: 3, background: `linear-gradient(90deg, ${opportunityColor(activeProject.opportunityScore)}, ${opportunityColor(activeProject.opportunityScore)}80)`, transition: "width .8s ease" }} />
              </div>
              {activeProject.opportunitySummary && (
                <div style={{ fontSize: 9, color: opportunityColor(activeProject.opportunityScore), marginTop: 6, fontWeight: 600, fontStyle: "italic", borderTop: `1px solid ${darkBorder}`, paddingTop: 4 }}>
                  {activeProject.opportunitySummary}
                </div>
              )}
              {activeProject.opportunityReasons && activeProject.opportunityReasons.length > 0 && (
                <div style={{ fontSize: 9, color: slate500, marginTop: 4, lineHeight: 1.5 }}>
                  {activeProject.opportunityReasons.slice(0, 3).map((r, i) => (
                    <div key={i}>• {r}</div>
                  ))}
                </div>
              )}
              {activeProject.heatIndex >= 70 && activeProject.opportunityScore <= 30 && (
                <div style={{ fontSize: 9, color: amber, marginTop: 6, padding: "4px 6px", borderRadius: 6, background: `${amber}08`, border: `1px solid ${amber}15`, lineHeight: 1.4 }}>
                  💡 Sức nóng cao do đối thủ cạnh tranh quá nhiều, dẫn đến chi phí lead đắt — cơ hội thấp cho nhà quảng cáo mới.
                </div>
              )}
              {activeProject.aiInsight && (
                <div style={{ fontSize: 10, color: "#e2e8f0", marginTop: 8, padding: "6px 8px", borderRadius: 8, background: `${neonBlue}08`, border: `1px solid ${neonBlue}20`, lineHeight: 1.5 }}>
                  <div style={{ fontSize: 9, color: neonBlue, fontWeight: 700, marginBottom: 3, display: "flex", alignItems: "center", gap: 4 }}>
                    <Sparkles size={10} /> Perplexity AI Insight
                  </div>
                  {activeProject.aiInsight}
                </div>
              )}
            </div>
          </div>

          {/* Charts Section */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 20 }}>
            {/* Ad Count Trend */}
            <div style={glassCard}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <BarChart3 size={16} color={neonBlue} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>Số lượng QC — 30 ngày</span>
                </div>
                <div style={{ fontSize: 9, color: slate500, fontWeight: 500 }}>
                  {(() => { const t = activeProject.adTrend; const s = typeof t[0] === "object" && t[0].date ? t[0].date.split("-").reverse().join("/") : ""; const e = typeof t[t.length-1] === "object" && t[t.length-1].date ? t[t.length-1].date.split("-").reverse().join("/") : ""; return s && e ? `Từ ${s} đến ${e}` : ""; })()}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <TrendingUp size={12} color={emerald} />
                  <span style={{ fontSize: 11, color: emerald, fontWeight: 600 }}>+{(() => { const t = activeProject.adTrend; const last = typeof t[t.length-1] === "object" ? t[t.length-1].value : t[t.length-1]; const first = typeof t[0] === "object" ? t[0].value : t[0]; return first ? ((last - first) / first * 100).toFixed(0) : 0; })()}%</span>
                </div>
              </div>
              <MiniChart data={activeProject.adTrend} color={neonBlue} width={isMobile ? 260 : 320} height={100} />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 10, color: slate500 }}>
                <span>{typeof activeProject.adTrend[0] === "object" && activeProject.adTrend[0].date ? activeProject.adTrend[0].date.split("-").reverse().join("/") : "30 ngày trước"}</span>
                <span>{typeof activeProject.adTrend[activeProject.adTrend.length-1] === "object" && activeProject.adTrend[activeProject.adTrend.length-1].date ? activeProject.adTrend[activeProject.adTrend.length-1].date.split("-").reverse().join("/") : "Hôm nay"}: {typeof activeProject.adTrend[activeProject.adTrend.length-1] === "object" ? activeProject.adTrend[activeProject.adTrend.length-1].value : activeProject.adTrend[activeProject.adTrend.length-1]} QC</span>
              </div>
            </div>

            {/* CPL Comparison */}
            <div style={glassCard}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
                <BarChart2 size={16} color={neonBlue} />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>So sánh CPL — {activeProject.districtName}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <CplCompareChart projectCpl={activeProject.projectType === "thap_tang" && activeProject.cplByType.find(c => c.category === "thap_tang") ? activeProject.cplByType.find(c => c.category === "thap_tang").cplAvg : activeProject.cplAvg} districtAvg={activeProject.districtAvg} districtLabel={`TB ${activeProject.districtName}`} width={isMobile ? 260 : 320} height={130} />
              </div>
              {activeProject.projectType === "thap_tang" && activeProject.cplByType.find(c => c.category === "thap_tang") && (
                <div style={{ fontSize: 9, color: amber, textAlign: "center", marginTop: 4, fontWeight: 600 }}>⚠ So sánh theo CPL Thấp tầng (Nhà phố/Biệt thự)</div>
              )}
              {/* Benchmark cards */}
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 100, padding: "8px 10px", borderRadius: 10, background: activeProject.regionBenchmark.percent <= 0 ? `${emerald}10` : `${rose}10`, border: `1px solid ${activeProject.regionBenchmark.percent <= 0 ? emerald : rose}25` }}>
                  <div style={{ fontSize: 9, color: slate400, fontWeight: 600, marginBottom: 4 }}>So với {activeProject.districtName}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: activeProject.regionBenchmark.percent <= 0 ? emerald : rose }}>
                    {activeProject.regionBenchmark.percent <= 0 ? "" : "+"}{activeProject.regionBenchmark.percent}%
                  </div>
                  <div style={{ fontSize: 9, color: activeProject.regionBenchmark.percent <= 0 ? emerald : rose, marginTop: 2, fontWeight: 600 }}>
                    {activeProject.regionBenchmark.percent <= 0 ? "✓ Chi phí tốt" : "⚠ Chi phí cao"}
                  </div>
                  <div style={{ fontSize: 9, color: slate500, marginTop: 1 }}>TB: {fmtShort(activeProject.districtAvg)}</div>
                </div>
                <div style={{ flex: 1, minWidth: 100, padding: "8px 10px", borderRadius: 10, background: activeProject.centerBenchmark.percent <= 0 ? `${emerald}10` : `${rose}10`, border: `1px solid ${activeProject.centerBenchmark.percent <= 0 ? emerald : rose}25` }}>
                  <div style={{ fontSize: 9, color: slate400, fontWeight: 600, marginBottom: 4 }}>So với Q1 / Thủ Thiêm</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: activeProject.centerBenchmark.percent <= 0 ? emerald : rose }}>
                    {activeProject.centerBenchmark.percent <= 0 ? "" : "+"}{activeProject.centerBenchmark.percent}%
                  </div>
                  <div style={{ fontSize: 9, color: activeProject.centerBenchmark.percent <= 0 ? emerald : rose, marginTop: 2, fontWeight: 600 }}>
                    {activeProject.centerBenchmark.percent <= 0 ? "✓ Chi phí tốt" : "⚠ Chi phí cao"}
                  </div>
                  <div style={{ fontSize: 9, color: slate500, marginTop: 1 }}>TB Q1-Q3: {fmtShort(activeProject.centerBenchmark.centerAvg)}</div>
                </div>
              </div>
              <div style={{ fontSize: 9, color: slate500, marginTop: 8, fontStyle: "italic", textAlign: "center" }}>
                💡 Xanh = CPL thấp hơn trung bình (tốt) · Đỏ = CPL cao hơn (cần tối ưu)
              </div>
            </div>
          </div>

          {/* CPL Trend + All Projects Overview */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 20 }}>
            {/* CPL Trend */}
            <div style={glassCard}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <TrendingDown size={16} color={emerald} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>Xu hướng CPL — 30 ngày</span>
                </div>
                <div style={{ fontSize: 9, color: slate500, fontWeight: 500 }}>
                  {(() => { const t = activeProject.cplTrend; const s = typeof t[0] === "object" && t[0].date ? t[0].date.split("-").reverse().join("/") : ""; const e = typeof t[t.length-1] === "object" && t[t.length-1].date ? t[t.length-1].date.split("-").reverse().join("/") : ""; return s && e ? `Từ ${s} đến ${e}` : ""; })()}
                </div>
              </div>
              <MiniChart data={activeProject.cplTrend} color={emerald} width={isMobile ? 260 : 320} height={100} />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 10, color: slate500 }}>
                <span>{typeof activeProject.cplTrend[0] === "object" && activeProject.cplTrend[0].date ? activeProject.cplTrend[0].date.split("-").reverse().join("/") : ""}: {fmtShort((typeof activeProject.cplTrend[0] === "object" ? activeProject.cplTrend[0].value : activeProject.cplTrend[0]) * 1000)}</span>
                <span>{typeof activeProject.cplTrend[activeProject.cplTrend.length-1] === "object" && activeProject.cplTrend[activeProject.cplTrend.length-1].date ? activeProject.cplTrend[activeProject.cplTrend.length-1].date.split("-").reverse().join("/") : "Hôm nay"}: {fmtShort((typeof activeProject.cplTrend[activeProject.cplTrend.length-1] === "object" ? activeProject.cplTrend[activeProject.cplTrend.length-1].value : activeProject.cplTrend[activeProject.cplTrend.length-1]) * 1000)}</span>
              </div>
            </div>

            {/* All Projects Ranking */}
            <div style={glassCard}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
                <Crown size={16} color={amber} />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>Bảng xếp hạng Pages — Chạy QC lâu nhất</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {(activeProject.winningPages || []).slice(0, 8).map((page, i) => (
                  <a key={i} href={page.adsLibraryUrl || page.fbPageUrl || "#"} target="_blank" rel="noopener noreferrer"
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10, cursor: "pointer", textDecoration: "none", background: i === 0 ? `${amber}10` : "transparent", border: i === 0 ? `1px solid ${amber}30` : "1px solid transparent", transition: "all .2s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(59,130,246,0.05)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = i === 0 ? `${amber}10` : "transparent"; }}>
                    <span style={{ width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: i < 3 ? darkBg : slate400, background: i === 0 ? "#fbbf24" : i === 1 ? "#94a3b8" : i === 2 ? "#cd7f32" : "rgba(71,85,105,0.3)", flexShrink: 0 }}>{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#f1f5f9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{page.name}</div>
                      <div style={{ fontSize: 10, color: slate500 }}>{page.ads} QC · {page.duration} ngày</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: i === 0 ? amber : emerald }}>{page.duration}</div>
                      <div style={{ fontSize: 9, color: slate500 }}>ngày</div>
                    </div>
                  </a>
                ))}
                {(!activeProject.winningPages || activeProject.winningPages.length === 0) && (
                  <div style={{ fontSize: 12, color: slate500, textAlign: "center", padding: 16 }}>Chưa có dữ liệu — thử tìm kiếm dự án</div>
                )}
              </div>
            </div>
          </div>

          {/* Competitor Insight - Winning Pages */}
          <div style={glassCard}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Award size={18} color={amber} />
                <span style={{ fontSize: 15, fontWeight: 800, color: "#f1f5f9" }}>Tất cả Pages đang chạy QC</span>
              </div>
              <span style={{ fontSize: 11, color: slate400 }}>{(activeProject.winningPages || []).length} pages · Sắp xếp theo thời gian chạy</span>
            </div>
            {(() => {
              const allWp = activeProject.winningPages || [];
              const totalWpPages = Math.ceil(allWp.length / WP_PER_PAGE);
              const wpSlice = allWp.slice((miWpPage - 1) * WP_PER_PAGE, miWpPage * WP_PER_PAGE);
              return (<>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
              {wpSlice.map((page, i) => {
                const globalIdx = (miWpPage - 1) * WP_PER_PAGE + i;
                return (
                <a key={globalIdx} href={page.adsLibraryUrl || page.fbPageUrl || "#"} target="_blank" rel="noopener noreferrer"
                  style={{ background: "rgba(15,23,42,0.6)", borderRadius: 14, padding: 16, border: `1px solid ${darkBorder}`, transition: "all .2s", cursor: "pointer", textDecoration: "none", display: "block" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${neonBlue}50`; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 24px rgba(0,0,0,.3)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = darkBorder; e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: globalIdx < 3 ? darkBg : slate400, background: globalIdx === 0 ? "#fbbf24" : globalIdx === 1 ? "#94a3b8" : globalIdx === 2 ? "#cd7f32" : "rgba(71,85,105,0.3)", flexShrink: 0 }}>{globalIdx + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{page.name}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: slate400, marginTop: 2 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Clock size={10} /> {page.duration} ngày</span>
                        <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Layers size={10} /> {page.ads} QC</span>
                      </div>
                    </div>
                    {globalIdx === 0 && <Crown size={18} color="#fbbf24" style={{ flexShrink: 0 }} />}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                    {page.fbPageUrl && (
                      <a href={page.fbPageUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                        style={{ fontSize: 10, padding: "3px 8px", borderRadius: 6, background: `${neonBlue}15`, color: neonBlue, fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 3 }}>
                        <ExternalLink size={9} /> FB Page
                      </a>
                    )}
                    {page.adsLibraryUrl && (
                      <a href={page.adsLibraryUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                        style={{ fontSize: 10, padding: "3px 8px", borderRadius: 6, background: `${amber}15`, color: amber, fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 3 }}>
                        <ExternalLink size={9} /> Ads Library
                      </a>
                    )}
                    {(page.platforms || []).map((plat, pi) => (
                      <span key={pi} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 6, background: `${emerald}15`, color: emerald, fontWeight: 600 }}>{plat}</span>
                    ))}
                  </div>
                </a>
                );
              })}
            </div>
            {totalWpPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 16 }}>
                <button onClick={() => setMiWpPage(Math.max(1, miWpPage - 1))} disabled={miWpPage <= 1}
                  style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${darkBorder}`, background: miWpPage <= 1 ? "transparent" : `${neonBlue}15`, color: miWpPage <= 1 ? slate500 : neonBlue, fontSize: 12, fontWeight: 600, cursor: miWpPage <= 1 ? "default" : "pointer" }}>← Trước</button>
                <span style={{ fontSize: 12, color: slate400 }}>Trang {miWpPage}/{totalWpPages}</span>
                <button onClick={() => setMiWpPage(Math.min(totalWpPages, miWpPage + 1))} disabled={miWpPage >= totalWpPages}
                  style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${darkBorder}`, background: miWpPage >= totalWpPages ? "transparent" : `${neonBlue}15`, color: miWpPage >= totalWpPages ? slate500 : neonBlue, fontSize: 12, fontWeight: 600, cursor: miWpPage >= totalWpPages ? "default" : "pointer" }}>Sau →</button>
              </div>
            )}
              </>);
            })()}
          </div>

          {/* Lead Price Sources */}
          {activeProject.leadPriceSources && activeProject.leadPriceSources.length > 0 && (
            <div style={{ ...glassCard, marginTop: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <DollarSign size={16} color={emerald} />
                <span style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>Giá lead công bố từ các sàn</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
                {activeProject.leadPriceSources.map((src, si) => (
                  <div key={si} style={{ background: "rgba(15,23,42,0.5)", borderRadius: 12, padding: 14, border: `1px solid ${darkBorder}` }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: slate300, marginBottom: 6 }}>{src.source}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: emerald }}>{fmtShort(src.avgPrice)}</div>
                    <div style={{ fontSize: 10, color: slate500, marginTop: 4 }}>{src.count} tin đăng</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer note */}
          <div style={{ textAlign: "center", marginTop: 20, fontSize: 11, color: slate500 }}>
            <Info size={12} style={{ verticalAlign: "middle", marginRight: 4 }} />
            Dữ liệu được tổng hợp từ Facebook Ads Library, Batdongsan.com.vn và các nguồn công khai · Cập nhật mỗi 24h
            {activeProject.cached && activeProject.scrapedAt && (
              <span> · Từ cache ({new Date(activeProject.scrapedAt).toLocaleString("vi-VN")})</span>
            )}
          </div>

          </>)}
        </div>
      </div>
    );
  }

  // === FB Ads Tab ===
  if (tab === "fb_ads") {
    // Controls bar (shared between views)
    const currentPresetLabel = datePresets.find(p => p.key === fbDatePreset)?.label || "Tùy chọn";
    const activeAccounts = adAccounts.filter(a => a.isActive);
    const selectedAcctNames = activeAccounts.filter(a => selectedAccounts.includes(a.accountId)).map(a => a.name || `act_${a.accountId}`);
    const fbControls = (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16, alignItems: "flex-end" }}>
        <div style={{ flex: "1 1 220px", minWidth: 180, position: "relative" }} ref={acctDropdownRef}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4, display: "block" }}>Tài khoản QC</label>
          <button onClick={() => setShowAcctDropdown(!showAcctDropdown)} style={{ ...inputStyle, marginBottom: 0, background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, width: "100%", justifyContent: "space-between", textAlign: "left", minHeight: 42 }}>
            <span style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
              {selectedAccounts.length === 0 ? "-- Chọn tài khoản --" : selectedAccounts.length === 1 ? selectedAcctNames[0] : `${selectedAccounts.length} tài khoản`}
            </span>
            <ChevronDown size={14} style={{ opacity: 0.5, flexShrink: 0, transform: showAcctDropdown ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
          </button>
          {showAcctDropdown && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 120, background: "#fff", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,.15)", border: "1px solid #e5e7eb", marginTop: 4, maxHeight: 240, overflowY: "auto" }}>
              {activeAccounts.length === 0 && <div style={{ padding: "12px 14px", color: "#9ca3af", fontSize: 13 }}>Chưa có tài khoản nào</div>}
              {activeAccounts.length > 1 && (
                <div onClick={() => { selectedAccounts.length === activeAccounts.length ? setSelectedAccounts([]) : setSelectedAccounts(activeAccounts.map(a => a.accountId)); }}
                  style={{ padding: "9px 14px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", gap: 8, fontWeight: 600, color: "#1a3c20" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#f0fdf4"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <span style={{ width: 18, height: 18, borderRadius: 4, border: selectedAccounts.length === activeAccounts.length ? "none" : "2px solid #d1d5db", background: selectedAccounts.length === activeAccounts.length ? "#1a3c20" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff", flexShrink: 0 }}>
                    {selectedAccounts.length === activeAccounts.length ? "✓" : ""}
                  </span>
                  Chọn tất cả
                </div>
              )}
              {activeAccounts.map(a => {
                const checked = selectedAccounts.includes(a.accountId);
                return (
                  <div key={a.id} onClick={() => toggleAccountSelection(a.accountId)}
                    style={{ padding: "9px 14px", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 8, color: "#374151", transition: "background .15s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <span style={{ width: 18, height: 18, borderRadius: 4, border: checked ? "none" : "2px solid #d1d5db", background: checked ? "#1a3c20" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff", flexShrink: 0 }}>
                      {checked ? "✓" : ""}
                    </span>
                    {a.name || `act_${a.accountId}`}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div style={{ flex: "0 1 auto", position: "relative" }} ref={datePickerRef}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4, display: "block" }}>Khoảng thời gian</label>
          <button onClick={() => setShowDatePicker(!showDatePicker)} style={{ ...inputStyle, marginBottom: 0, background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, minWidth: 180, justifyContent: "space-between", textAlign: "left" }}>
            <span style={{ fontSize: 13 }}>{currentPresetLabel}: {fbDateFrom} → {fbDateTo}</span>
            <ChevronDown size={14} style={{ opacity: 0.5, flexShrink: 0 }} />
          </button>
          {showDatePicker && (
            <div style={{ position: "absolute", top: "100%", left: 0, zIndex: 100, background: "#fff", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,.18)", border: "1px solid #e5e7eb", width: isMobile ? 280 : 340, marginTop: 4, overflow: "hidden" }}>
              <div style={{ display: "flex" }}>
                <div style={{ borderRight: "1px solid #e5e7eb", padding: "8px 0", minWidth: 130 }}>
                  {datePresets.map(p => (
                    <div key={p.key} onClick={() => applyDatePreset(p.key)}
                      style={{ padding: "7px 14px", cursor: "pointer", fontSize: 13, color: fbDatePreset === p.key ? "#1a3c20" : "#374151", fontWeight: fbDatePreset === p.key ? 700 : 400, background: fbDatePreset === p.key ? "#e88a2e15" : "transparent", transition: "background .15s" }}
                      onMouseEnter={(e) => { if (fbDatePreset !== p.key) e.currentTarget.style.background = "#f3f4f6"; }}
                      onMouseLeave={(e) => { if (fbDatePreset !== p.key) e.currentTarget.style.background = "transparent"; }}>
                      {p.label}
                    </div>
                  ))}
                </div>
                <div style={{ flex: 1, padding: 12 }}>
                  <div style={{ marginBottom: 8 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Từ ngày</label>
                    <input type="date" value={fbDateFrom} onChange={e => { setFbDateFrom(e.target.value); setFbDatePreset("custom"); }} style={{ ...inputStyle, marginBottom: 0, width: "100%" }} />
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Đến ngày</label>
                    <input type="date" value={fbDateTo} onChange={e => { setFbDateTo(e.target.value); setFbDatePreset("custom"); }} style={{ ...inputStyle, marginBottom: 0, width: "100%" }} />
                  </div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button onClick={() => setShowDatePicker(false)} style={{ padding: "6px 14px", border: "1px solid #d1d5db", borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#374151" }}>Đóng</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        <button onClick={loadInsights} disabled={!selectedAccounts.length || fbLoading} style={{ ...btnPrimary, height: 42, display: "flex", alignItems: "center", gap: 6 }}>
          {fbLoading ? <><RefreshCw size={14} className="spin" /> Đang tải...</> : <><RefreshCw size={14} /> Xem báo cáo</>}
        </button>
      </div>
    );

    // Scope data for selected project
    const scopedInsights = selectedFbProject !== null ? (fbProjectMap[selectedFbProject] || []) : fbInsights;
    const scopedTotals = calcFbTotals(scopedInsights);

    // CRM leads grouped by campaign name
    const crmByCamp = {};
    leads.forEach(l => { if (l.campaign) { if (!crmByCamp[l.campaign]) crmByCamp[l.campaign] = []; crmByCamp[l.campaign].push(l); } });

    // Best performing campaigns (cheapest CPL + highest interest)
    const totalSpendAll = scopedInsights.reduce((s, r) => s + Number(r.spend || 0), 0);
    const bestCampaigns = scopedInsights
        .map(row => {
          const cl = crmByCamp[row.campaign_name] || [];
          const interested = cl.filter(l => l.status === "interested").length;
          const closed = cl.filter(l => l.status === "closed").length;
          const la = (row.actions || []).find(a => a.action_type === "lead" || a.action_type === "onsite_conversion.messaging_first_reply");
          const fbLeads = la ? Number(la.value) : 0;
          const spend = Number(row.spend || 0);
          return {
            name: row.campaign_name, status: row.status, spend, fbLeads,
            crmLeads: cl.length, interested, closed,
            interestPct: cl.length ? (interested / cl.length * 100) : 0,
            closedPct: cl.length ? (closed / cl.length * 100) : 0,
            costPct: totalSpendAll ? (spend / totalSpendAll * 100) : 0,
            cpl: fbLeads ? spend / fbLeads : 0,
          };
        })
        .filter(c => c.crmLeads > 0 || c.fbLeads > 0)
        .sort((a, b) => {
          if (a.cpl && b.cpl) return a.cpl - b.cpl;
          if (a.cpl && !b.cpl) return -1;
          if (!a.cpl && b.cpl) return 1;
          return b.interestPct - a.interestPct;
        });

    if (selectedFbProject !== null) {
      const projName = selectedFbProject === -1 ? "Chưa phân loại" : (projects || []).find(p => p.id === selectedFbProject)?.name || "Dự án #" + selectedFbProject;
      const filteredInsights = campSearch ? scopedInsights.filter(r => (r.campaign_name || "").toLowerCase().includes(campSearch.toLowerCase())) : scopedInsights;
      // Sort
      const sortedInsights = [...filteredInsights].sort((a, b) => {
        if (!campSort.col) return 0;
        let va, vb;
        if (campSort.col === "status") { va = a.status === "ACTIVE" ? 1 : 0; vb = b.status === "ACTIVE" ? 1 : 0; }
        else if (campSort.col === "spend") { va = Number(a.spend || 0); vb = Number(b.spend || 0); }
        else if (campSort.col === "result") {
          const la1 = (a.actions || []).find(x => x.action_type === "lead" || x.action_type === "onsite_conversion.messaging_first_reply");
          const la2 = (b.actions || []).find(x => x.action_type === "lead" || x.action_type === "onsite_conversion.messaging_first_reply");
          va = la1 ? Number(la1.value) : 0; vb = la2 ? Number(la2.value) : 0;
        } else { va = 0; vb = 0; }
        return campSort.asc ? va - vb : vb - va;
      });
      const totalPages = Math.ceil(sortedInsights.length / CAMP_PER_PAGE);
      const pagedInsights = sortedInsights.slice((campPage - 1) * CAMP_PER_PAGE, campPage * CAMP_PER_PAGE);
      const filteredTotals = calcFbTotals(filteredInsights);
      // CRM interested for totals
      const totalCrmLeads = filteredInsights.reduce((s, r) => s + (crmByCamp[r.campaign_name] || []).length, 0);
      const totalInterested = filteredInsights.reduce((s, r) => s + (crmByCamp[r.campaign_name] || []).filter(l => l.status === "interested").length, 0);
      return (
        <div>
          {tabBar}
          {fbControls}
          {fbError && <div style={{ background: "#fef2f2", color: "#dc2626", padding: "10px 14px", borderRadius: 10, marginBottom: 12, fontSize: 13 }}>{fbError}</div>}

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            <button onClick={() => { setSelectedFbProject(null); setCampSearch(""); setCampPage(1); setCampSort({ col: null, asc: true }); }} style={{ background: "#f3f4f6", border: "none", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#374151" }}>← Dự án</button>
            <h3 style={{ margin: 0, fontSize: isMobile ? 14 : 16, display: "flex", alignItems: "center", gap: 6 }}><Building2 size={18} /> {projName}</h3>
            <span style={{ fontSize: 12, color: "#6b7280" }}>{scopedInsights.length} chiến dịch</span>
          </div>

          {/* Summary cards */}
          {scopedTotals && (
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(auto-fill, minmax(150px, 1fr))", gap: 10, marginBottom: 16 }}>
              <Card title="Tổng chi tiêu" value={fmtMoney(scopedTotals.spend)} color="#8b5cf6" compact />
              <Card title="Ngân sách/ngày" value={fmtMoney(calcDailyBudget(scopedInsights))} sub={`${scopedInsights.filter(r => r.status === "ACTIVE").length} CD đang bật`} color="#dc2626" compact />
              <Card title="Lượt hiển thị" value={fmtNum(scopedTotals.impressions)} color="#3b82f6" compact />
              <Card title="Lượt tiếp cận" value={fmtNum(scopedTotals.reach)} color="#06b6d4" compact />
              <Card title="Số click" value={fmtNum(scopedTotals.clicks)} color="#f59e0b" compact />
              <Card title="CPM" value={fmtMoney(scopedTotals.cpm)} color="#ec4899" compact />
              <Card title="CPC" value={fmtMoney(scopedTotals.cpc)} color="#e88a2e" compact />
              <Card title="CTR (liên kết)" value={fmtPct(scopedTotals.linkCtr)} color="#10b981" compact />
              <Card title="Tổng Leads" value={fmtNum(scopedTotals.leads)} sub={scopedTotals.leads ? `CPL: ${fmtMoney(scopedTotals.cpl)}` : ""} color="#1a3c20" compact />
            </div>
          )}

          {/* Campaign detail table */}
          {scopedInsights.length > 0 && (
            <div style={{ background: "#fff", borderRadius: 12, overflow: "auto", boxShadow: "0 1px 3px rgba(0,0,0,.08)", marginBottom: 20 }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "space-between" }}>
                <div style={{ fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}><Megaphone size={16} /> Danh sách chiến dịch</div>
                <div style={{ position: "relative", minWidth: 200 }}>
                  <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
                  <input type="text" placeholder="Tìm chiến dịch..." value={campSearch} onChange={(e) => { setCampSearch(e.target.value); setCampPage(1); }}
                    style={{ ...inputStyle, marginBottom: 0, paddingLeft: 32, fontSize: 12, height: 36 }} />
                </div>
              </div>
              {campSearch && <div style={{ padding: "6px 16px", fontSize: 12, color: "#6b7280", background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>Tìm thấy {filteredInsights.length}/{scopedInsights.length} chiến dịch</div>}
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, textAlign: "left", minWidth: 180 }}>Chiến dịch</th>
                    <th onClick={() => setCampSort(s => ({ col: "status", asc: s.col === "status" ? !s.asc : false }))} style={{ ...thStyle, textAlign: "center", minWidth: 80, cursor: "pointer", userSelect: "none" }}>Trạng thái {campSort.col === "status" ? (campSort.asc ? "↑" : "↓") : "⇅"}</th>
                    <th onClick={() => setCampSort(s => ({ col: "spend", asc: s.col === "spend" ? !s.asc : false }))} style={{ ...thStyle, textAlign: "right", cursor: "pointer", userSelect: "none" }}>Chi phí {campSort.col === "spend" ? (campSort.asc ? "↑" : "↓") : "⇅"}</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>NS/ngày</th>
                    <th onClick={() => setCampSort(s => ({ col: "result", asc: s.col === "result" ? !s.asc : false }))} style={{ ...thStyle, textAlign: "right", cursor: "pointer", userSelect: "none" }}>Kết quả {campSort.col === "result" ? (campSort.asc ? "↑" : "↓") : "⇅"}</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>CP/KQ</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>CPM</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>CTR (LK)</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Click LK</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Tiếp cận</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Lead CRM</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>CP/Lead QT</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedInsights.map((row, i) => {
                    const la = (row.actions || []).find(a => a.action_type === "lead" || a.action_type === "onsite_conversion.messaging_first_reply");
                    const resultCount = la ? Number(la.value) : 0;
                    const cpa = (row.cost_per_action_type || []).find(a => a.action_type === "lead" || a.action_type === "onsite_conversion.messaging_first_reply");
                    const costPerResult = cpa ? Number(cpa.value) : (resultCount ? Number(row.spend) / resultCount : 0);
                    const cl = crmByCamp[row.campaign_name] || [];
                    const interested = cl.filter(l => l.status === "interested").length;
                    const costPerQT = interested ? Number(row.spend) / interested : 0;
                    const isActive = row.status === "ACTIVE";
                    return (
                      <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#fafbfc" }}>
                        <td style={{ ...tdStyle, fontWeight: 600, fontSize: 12, maxWidth: 250 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <Megaphone size={13} color="#6b7280" />
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.campaign_name || "—"}</span>
                          </div>
                        </td>
                        <td style={{ ...tdStyle, textAlign: "center" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, padding: "2px 10px", borderRadius: 20, fontWeight: 700, color: isActive ? "#16a34a" : "#dc2626", background: isActive ? "#dcfce7" : "#fef2f2" }}>
                            <span style={{ width: 7, height: 7, borderRadius: "50%", background: isActive ? "#16a34a" : "#dc2626", display: "inline-block" }}></span>
                            {isActive ? "Bật" : "Tắt"}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600, color: "#8b5cf6" }}>{fmtMoney(row.spend)}</td>
                        <td style={{ ...tdStyle, textAlign: "right", fontSize: 12, color: "#dc2626", fontWeight: 600 }}>{row._dailyBudget ? fmtMoney(row._dailyBudget) : "—"}</td>
                        <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600 }}>{resultCount || "—"}</td>
                        <td style={{ ...tdStyle, textAlign: "right", color: "#e88a2e", fontWeight: 600 }}>{resultCount ? fmtMoney(costPerResult) : "—"}</td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>{fmtMoney(row.cpm)}</td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>{row.inline_link_click_ctr ? fmtPct(row.inline_link_click_ctr) : "—"}</td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>{row.inline_link_clicks ? fmtNum(row.inline_link_clicks) : "—"}</td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>{fmtNum(row.reach)}</td>
                        <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600 }}>{cl.length || "—"}</td>
                        <td style={{ ...tdStyle, textAlign: "right", color: "#1a3c20", fontWeight: 600 }}>{interested ? fmtMoney(costPerQT) : "—"}</td>
                      </tr>
                    );
                  })}
                  {/* Totals */}
                  {filteredTotals && (
                    <tr style={{ background: "#f0f4f1", fontWeight: 700 }}>
                      <td style={{ ...tdStyle, fontWeight: 700, fontSize: 13 }}>Tổng ({filteredInsights.length})</td>
                      <td style={tdStyle}></td>
                      <td style={{ ...tdStyle, textAlign: "right", color: "#8b5cf6" }}>{fmtMoney(filteredTotals.spend)}</td>
                      <td style={{ ...tdStyle, textAlign: "right", color: "#dc2626", fontWeight: 700 }}>{fmtMoney(calcDailyBudget(filteredInsights))}</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>{fmtNum(filteredTotals.leads)}</td>
                      <td style={{ ...tdStyle, textAlign: "right", color: "#e88a2e" }}>{filteredTotals.leads ? fmtMoney(filteredTotals.cpl) : "—"}</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>{fmtMoney(filteredTotals.cpm)}</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>{fmtPct(filteredTotals.linkCtr)}</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>{fmtNum(filteredTotals.linkClicks)}</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>{fmtNum(filteredTotals.reach)}</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>{totalCrmLeads || "—"}</td>
                      <td style={{ ...tdStyle, textAlign: "right", color: "#1a3c20" }}>{totalInterested ? fmtMoney(filteredTotals.spend / totalInterested) : "—"}</td>
                    </tr>
                  )}
                </tbody>
              </table>
              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderTop: "1px solid #e5e7eb", fontSize: 12 }}>
                  <span style={{ color: "#6b7280" }}>Trang {campPage}/{totalPages} · {filteredInsights.length} chiến dịch</span>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => setCampPage(Math.max(1, campPage - 1))} disabled={campPage <= 1} style={{ padding: "4px 10px", border: "1px solid #d1d5db", borderRadius: 6, background: "#fff", cursor: campPage <= 1 ? "default" : "pointer", opacity: campPage <= 1 ? 0.4 : 1, fontSize: 12 }}>← Trước</button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
                      let pg;
                      if (totalPages <= 5) pg = idx + 1;
                      else if (campPage <= 3) pg = idx + 1;
                      else if (campPage >= totalPages - 2) pg = totalPages - 4 + idx;
                      else pg = campPage - 2 + idx;
                      return (
                        <button key={pg} onClick={() => setCampPage(pg)} style={{ padding: "4px 10px", border: "1px solid #d1d5db", borderRadius: 6, background: pg === campPage ? "#1a3c20" : "#fff", color: pg === campPage ? "#fff" : "#374151", cursor: "pointer", fontWeight: pg === campPage ? 700 : 400, fontSize: 12 }}>{pg}</button>
                      );
                    })}
                    <button onClick={() => setCampPage(Math.min(totalPages, campPage + 1))} disabled={campPage >= totalPages} style={{ padding: "4px 10px", border: "1px solid #d1d5db", borderRadius: 6, background: "#fff", cursor: campPage >= totalPages ? "default" : "pointer", opacity: campPage >= totalPages ? 0.4 : 1, fontSize: 12 }}>Sau →</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Best performing campaigns */}
          {bestCampaigns.length > 0 && (() => {
            const BEST_PER_PAGE = 10;
            const bestTotalPages = Math.ceil(bestCampaigns.length / BEST_PER_PAGE);
            const bestPage = Math.min(campPage, bestTotalPages) || 1;
            const pagedBest = bestCampaigns.slice(0, BEST_PER_PAGE);
            return (
            <div style={{ background: "#fff", borderRadius: 12, overflow: "auto", boxShadow: "0 1px 3px rgba(0,0,0,.08)", marginBottom: 20 }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid #e5e7eb", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 6, color: "#1a3c20" }}>
                <Trophy size={16} color="#e88a2e" /> Chiến dịch hiệu quả (Lead rẻ nhất · Quan tâm cao)
              </div>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, textAlign: "left", minWidth: 180 }}>Chiến dịch</th>
                    <th style={{ ...thStyle, textAlign: "center" }}>Trạng thái</th>
                    <th style={{ ...thStyle, textAlign: "center" }}>Khách</th>
                    <th style={{ ...thStyle, textAlign: "center" }}>% Quan tâm</th>
                    <th style={{ ...thStyle, textAlign: "center" }}>% Chi phí</th>
                    <th style={{ ...thStyle, textAlign: "center" }}>% Chuyển đổi</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>CPL</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedBest.map((c, i) => {
                    const isActive = c.status === "ACTIVE";
                    return (
                    <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#fafbfc" }}>
                      <td style={{ ...tdStyle, fontWeight: 600, fontSize: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {i < 3 && <span style={{ color: "#e88a2e", fontWeight: 700 }}>#{i + 1}</span>}
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220, display: "inline-block" }}>{c.name}</span>
                        </div>
                      </td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, padding: "2px 10px", borderRadius: 20, fontWeight: 700, color: isActive ? "#16a34a" : "#dc2626", background: isActive ? "#dcfce7" : "#fef2f2" }}>
                          <span style={{ width: 7, height: 7, borderRadius: "50%", background: isActive ? "#16a34a" : "#dc2626", display: "inline-block" }}></span>
                          {isActive ? "Bật" : "Tắt"}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: "center", fontWeight: 600 }}>{c.crmLeads}</td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>
                        <span style={{ color: c.interestPct > 30 ? "#16a34a" : c.interestPct > 10 ? "#e88a2e" : "#6b7280", fontWeight: 600 }}>{c.interestPct.toFixed(1)}%</span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>{c.costPct.toFixed(1)}%</td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>
                        <span style={{ color: c.closedPct > 0 ? "#16a34a" : "#9ca3af", fontWeight: c.closedPct > 0 ? 700 : 400 }}>{c.closedPct.toFixed(1)}%</span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right", color: "#e88a2e", fontWeight: 700 }}>{c.cpl ? fmtMoney(c.cpl) : "—"}</td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            );
          })()}

          {/* Active Campaigns Efficiency - Cost optimization dashboard */}
          {(() => {
            const activeCamps = scopedInsights.filter(r => r.status === "ACTIVE").map(row => {
              const la = (row.actions || []).find(a => a.action_type === "lead" || a.action_type === "onsite_conversion.messaging_first_reply");
              const fbLeads = la ? Number(la.value) : 0;
              const spend = Number(row.spend || 0);
              const cl = crmByCamp[row.campaign_name] || [];
              const interested = cl.filter(l => l.status === "interested").length;
              const cpl = fbLeads ? spend / fbLeads : 0;
              // Calculate date range days for daily average
              const daysDiff = Math.max(1, Math.ceil((new Date(fbDateTo) - new Date(fbDateFrom)) / 86400000) + 1);
              const dailySpend = spend / daysDiff;
              // Estimate last 3 days vs previous period
              const recentDays = Math.min(3, daysDiff);
              const prevDays = daysDiff - recentDays;
              const avgDailyAll = spend / daysDiff;
              return {
                name: row.campaign_name, spend, fbLeads, cpl,
                crmLeads: cl.length, interested,
                cpm: Number(row.cpm || 0), ctr: Number(row.inline_link_click_ctr || 0),
                reach: Number(row.reach || 0), dailySpend: avgDailyAll,
                daysDiff,
                // Efficiency score: lower CPL + higher interested % = better
                efficiency: (interested > 0 && cpl > 0) ? (interested / cl.length * 100) / (cpl / 1000) : (cpl > 0 ? 1 / cpl * 100 : 0),
              };
            }).sort((a, b) => b.efficiency - a.efficiency);
            if (!activeCamps.length) return null;
            return (
              <div style={{ background: "#fff", borderRadius: 12, overflow: "auto", boxShadow: "0 1px 3px rgba(0,0,0,.08)", marginTop: 20 }}>
                <div style={{ padding: "12px 16px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 6 }}>
                  <Activity size={16} color="#16a34a" />
                  <span style={{ fontWeight: 700, fontSize: 14, color: "#1a3c20" }}>Chiến dịch đang bật — Tối ưu chi phí</span>
                  <span style={{ fontSize: 11, color: "#6b7280", marginLeft: "auto" }}>{activeCamps.length} chiến dịch đang chạy</span>
                </div>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={{ ...thStyle, textAlign: "left", minWidth: 180 }}>Chiến dịch</th>
                      <th style={{ ...thStyle, textAlign: "center" }}>Trạng thái</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Chi phí</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>CP/ngày</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Leads</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>CPL</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Lead CRM</th>
                      <th style={{ ...thStyle, textAlign: "center" }}>% QT</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>CPM</th>
                      <th style={{ ...thStyle, textAlign: "center" }}>Hiệu quả</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeCamps.map((c, i) => {
                      const qtPct = c.crmLeads ? (c.interested / c.crmLeads * 100) : 0;
                      const effLabel = c.efficiency > 5 ? "Tốt" : c.efficiency > 1 ? "TB" : "Thấp";
                      const effColor = c.efficiency > 5 ? "#16a34a" : c.efficiency > 1 ? "#e88a2e" : "#dc2626";
                      const effBg = c.efficiency > 5 ? "#dcfce7" : c.efficiency > 1 ? "#fef3c7" : "#fef2f2";
                      return (
                        <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#fafbfc" }}>
                          <td style={{ ...tdStyle, fontWeight: 600, fontSize: 12, maxWidth: 250 }}>
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>{c.name}</span>
                          </td>
                          <td style={{ ...tdStyle, textAlign: "center" }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, padding: "2px 10px", borderRadius: 20, fontWeight: 700, color: "#16a34a", background: "#dcfce7" }}>
                              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#16a34a", display: "inline-block" }}></span>Bật
                            </span>
                          </td>
                          <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600, color: "#8b5cf6" }}>{fmtMoney(c.spend)}</td>
                          <td style={{ ...tdStyle, textAlign: "right", fontSize: 12 }}>{fmtMoney(c.dailySpend)}</td>
                          <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600 }}>{c.fbLeads || "—"}</td>
                          <td style={{ ...tdStyle, textAlign: "right", color: "#e88a2e", fontWeight: 600 }}>{c.cpl ? fmtMoney(c.cpl) : "—"}</td>
                          <td style={{ ...tdStyle, textAlign: "right" }}>{c.crmLeads || "—"}</td>
                          <td style={{ ...tdStyle, textAlign: "center" }}>
                            <span style={{ color: qtPct > 30 ? "#16a34a" : qtPct > 10 ? "#e88a2e" : "#6b7280", fontWeight: 600 }}>{c.crmLeads ? qtPct.toFixed(1) + "%" : "—"}</span>
                          </td>
                          <td style={{ ...tdStyle, textAlign: "right" }}>{fmtMoney(c.cpm)}</td>
                          <td style={{ ...tdStyle, textAlign: "center" }}>
                            <span style={{ padding: "3px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, color: effColor, background: effBg }}>{effLabel}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()}

          {scopedInsights.length === 0 && !fbLoading && (
            <div style={{ textAlign: "center", padding: 30, color: "#9ca3af", fontSize: 13 }}>Không có dữ liệu chiến dịch cho dự án này</div>
          )}
        </div>
      );
    }

    // === Project list view (no project selected) ===
    return (
      <div>
        {tabBar}
        {fbControls}

        {!selectedAccounts.length && (
          <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>
            <Activity size={40} style={{ marginBottom: 8, opacity: 0.4 }} />
            <div style={{ fontSize: 14 }}>Chọn tài khoản quảng cáo và bấm "Xem báo cáo" để xem hiệu quả</div>
            {!isManager && <div style={{ fontSize: 12, marginTop: 4 }}>Chưa có tài khoản? Vào tab <b>"Cài đặt tài khoản"</b> để thêm</div>}
          </div>
        )}

        {fbError && <div style={{ background: "#fef2f2", color: "#dc2626", padding: "10px 14px", borderRadius: 10, marginBottom: 12, fontSize: 13 }}>{fbError}</div>}

        {fbLoading && (
          <div style={{ textAlign: "center", padding: 40 }}>
            <RefreshCw size={24} className="spin" style={{ color: "#e88a2e" }} />
            <div style={{ marginTop: 8, fontSize: 13, color: "#6b7280" }}>Đang tải dữ liệu...</div>
          </div>
        )}

        {/* Project cards */}
        {fbInsights.length > 0 && !fbLoading && (
          <>
            {/* Overall summary cards */}
            {fbTotals && (
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(auto-fill, minmax(150px, 1fr))", gap: 10, marginBottom: 16 }}>
                <Card title="Tổng chi tiêu" value={fmtMoney(fbTotals.spend)} color="#8b5cf6" compact />
                <Card title="Ngân sách/ngày" value={fmtMoney(calcDailyBudget(fbInsights))} sub={`${fbInsights.filter(r => r.status === "ACTIVE").length} CD đang bật`} color="#dc2626" compact />
                <Card title="Lượt hiển thị" value={fmtNum(fbTotals.impressions)} color="#3b82f6" compact />
                <Card title="Lượt tiếp cận" value={fmtNum(fbTotals.reach)} color="#06b6d4" compact />
                <Card title="Số click" value={fmtNum(fbTotals.clicks)} color="#f59e0b" compact />
                <Card title="CPM" value={fmtMoney(fbTotals.cpm)} color="#ec4899" compact />
                <Card title="CPC" value={fmtMoney(fbTotals.cpc)} color="#e88a2e" compact />
                <Card title="CTR (liên kết)" value={fmtPct(fbTotals.linkCtr)} color="#10b981" compact />
                <Card title="Tổng Leads" value={fmtNum(fbTotals.leads)} sub={fbTotals.leads ? `CPL: ${fmtMoney(fbTotals.cpl)}` : ""} color="#1a3c20" compact />
              </div>
            )}

            <div style={{ marginBottom: 12 }}>
              <h3 style={{ margin: "0 0 4px", fontSize: isMobile ? 14 : 16, display: "flex", alignItems: "center", gap: 6 }}><Building2 size={18} /> Chọn dự án để xem chiến dịch</h3>
              <span style={{ fontSize: 12, color: "#6b7280" }}>{fbInsights.length} chiến dịch · {Object.keys(fbProjectMap).length} dự án</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
              {Object.keys(fbProjectMap).sort((a, b) => {
                const spendA = fbProjectMap[a].reduce((s, r) => s + Number(r.spend || 0), 0);
                const spendB = fbProjectMap[b].reduce((s, r) => s + Number(r.spend || 0), 0);
                return spendB - spendA;
              }).map(pid => {
                const rows = fbProjectMap[pid];
                const pName = Number(pid) === -1 ? "Chưa phân loại" : (projects || []).find(p => p.id === Number(pid))?.name || "Dự án #" + pid;
                const pSpend = rows.reduce((s, r) => s + Number(r.spend || 0), 0);
                const pLeads = rows.reduce((s, r) => {
                  const la = (r.actions || []).find(a => a.action_type === "lead" || a.action_type === "onsite_conversion.messaging_first_reply");
                  return s + (la ? Number(la.value) : 0);
                }, 0);
                const activeCount = rows.filter(r => r.status === "ACTIVE").length;
                const pDailyBudget = calcDailyBudget(rows);
                return (
                  <div key={pid} onClick={() => { setSelectedFbProject(Number(pid)); setCampSearch(""); setCampPage(1); setCampSort({ col: null, asc: true }); }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,.12)"; e.currentTarget.style.borderColor = "#e88a2e"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,.08)"; e.currentTarget.style.borderColor = "#e5e7eb"; }}
                    style={{ background: "#fff", borderRadius: 14, padding: 20, cursor: "pointer", boxShadow: "0 1px 3px rgba(0,0,0,.08)", border: "1px solid #e5e7eb", transition: "all .25s ease", borderTop: "3px solid #e88a2e" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <span style={{ fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", gap: 6 }}><Building2 size={16} /> {pName}</span>
                      <span style={{ background: "#8b5cf622", color: "#8b5cf6", padding: "4px 12px", borderRadius: 8, fontWeight: 700, fontSize: 13 }}>{fmtMoney(pSpend)}</span>
                    </div>
                    {pDailyBudget > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, fontSize: 12 }}>
                        <span style={{ color: "#dc2626", fontWeight: 700 }}>NS/ngày:</span>
                        <span style={{ background: "#dc262615", color: "#dc2626", padding: "2px 8px", borderRadius: 6, fontWeight: 700 }}>{fmtMoney(pDailyBudget)}</span>
                      </div>
                    )}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 12 }}>
                      <span style={{ background: "#3b82f615", color: "#1d4ed8", padding: "3px 8px", borderRadius: 6 }}>{rows.length} chiến dịch</span>
                      <span style={{ background: "#16a34a15", color: "#16a34a", padding: "3px 8px", borderRadius: 6 }}>{activeCount} đang chạy</span>
                      {pLeads > 0 && <span style={{ background: "#e88a2e15", color: "#e88a2e", padding: "3px 8px", borderRadius: 6 }}>{pLeads} leads</span>}
                    </div>
                    <div style={{ marginTop: 8, fontSize: 11, color: "#9ca3af" }}>Click để xem chi tiết chiến dịch →</div>
                  </div>
                );
              })}
            </div>

            {/* Best performing campaigns (overview) */}
            {bestCampaigns.length > 0 && (
              <div style={{ background: "#fff", borderRadius: 12, overflow: "auto", boxShadow: "0 1px 3px rgba(0,0,0,.08)", marginTop: 20 }}>
                <div style={{ padding: "12px 16px", borderBottom: "1px solid #e5e7eb", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 6, color: "#1a3c20" }}>
                  <Trophy size={16} color="#e88a2e" /> Chiến dịch hiệu quả (Lead rẻ nhất · Quan tâm cao)
                </div>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={{ ...thStyle, textAlign: "left", minWidth: 180 }}>Chiến dịch</th>
                      <th style={{ ...thStyle, textAlign: "center" }}>Trạng thái</th>
                      <th style={{ ...thStyle, textAlign: "center" }}>Khách</th>
                      <th style={{ ...thStyle, textAlign: "center" }}>% Quan tâm</th>
                      <th style={{ ...thStyle, textAlign: "center" }}>% Chi phí</th>
                      <th style={{ ...thStyle, textAlign: "center" }}>% Chuyển đổi</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>CPL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bestCampaigns.slice(0, 10).map((c, i) => {
                      const isActive = c.status === "ACTIVE";
                      return (
                        <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#fafbfc" }}>
                          <td style={{ ...tdStyle, fontWeight: 600, fontSize: 12 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              {i < 3 && <span style={{ color: "#e88a2e", fontWeight: 700 }}>#{i + 1}</span>}
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220, display: "inline-block" }}>{c.name}</span>
                            </div>
                          </td>
                          <td style={{ ...tdStyle, textAlign: "center" }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, padding: "2px 10px", borderRadius: 20, fontWeight: 700, color: isActive ? "#16a34a" : "#dc2626", background: isActive ? "#dcfce7" : "#fef2f2" }}>
                              <span style={{ width: 7, height: 7, borderRadius: "50%", background: isActive ? "#16a34a" : "#dc2626", display: "inline-block" }}></span>
                              {isActive ? "Bật" : "Tắt"}
                            </span>
                          </td>
                          <td style={{ ...tdStyle, textAlign: "center", fontWeight: 600 }}>{c.crmLeads}</td>
                          <td style={{ ...tdStyle, textAlign: "center" }}>
                            <span style={{ color: c.interestPct > 30 ? "#16a34a" : c.interestPct > 10 ? "#e88a2e" : "#6b7280", fontWeight: 600 }}>{c.interestPct.toFixed(1)}%</span>
                          </td>
                          <td style={{ ...tdStyle, textAlign: "center" }}>{c.costPct.toFixed(1)}%</td>
                          <td style={{ ...tdStyle, textAlign: "center" }}>
                            <span style={{ color: c.closedPct > 0 ? "#16a34a" : "#9ca3af", fontWeight: c.closedPct > 0 ? 700 : 400 }}>{c.closedPct.toFixed(1)}%</span>
                          </td>
                          <td style={{ ...tdStyle, textAlign: "right", color: "#e88a2e", fontWeight: 700 }}>{c.cpl ? fmtMoney(c.cpl) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Active campaigns efficiency (overview) */}
            {(() => {
              const activeCampsAll = fbInsights.filter(r => r.status === "ACTIVE").map(row => {
                const la = (row.actions || []).find(a => a.action_type === "lead" || a.action_type === "onsite_conversion.messaging_first_reply");
                const fbLeads = la ? Number(la.value) : 0;
                const spend = Number(row.spend || 0);
                const cl = crmByCamp[row.campaign_name] || [];
                const interested = cl.filter(l => l.status === "interested").length;
                const cpl = fbLeads ? spend / fbLeads : 0;
                const daysDiff = Math.max(1, Math.ceil((new Date(fbDateTo) - new Date(fbDateFrom)) / 86400000) + 1);
                const avgDailyAll = spend / daysDiff;
                return {
                  name: row.campaign_name, spend, fbLeads, cpl,
                  crmLeads: cl.length, interested,
                  cpm: Number(row.cpm || 0), dailySpend: avgDailyAll,
                  efficiency: (interested > 0 && cpl > 0) ? (interested / cl.length * 100) / (cpl / 1000) : (cpl > 0 ? 1 / cpl * 100 : 0),
                };
              }).sort((a, b) => b.efficiency - a.efficiency);
              if (!activeCampsAll.length) return null;
              return (
                <div style={{ background: "#fff", borderRadius: 12, overflow: "auto", boxShadow: "0 1px 3px rgba(0,0,0,.08)", marginTop: 20 }}>
                  <div style={{ padding: "12px 16px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 6 }}>
                    <Activity size={16} color="#16a34a" />
                    <span style={{ fontWeight: 700, fontSize: 14, color: "#1a3c20" }}>Chiến dịch đang bật — Tối ưu chi phí</span>
                    <span style={{ fontSize: 11, color: "#6b7280", marginLeft: "auto" }}>{activeCampsAll.length} chiến dịch đang chạy</span>
                  </div>
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={{ ...thStyle, textAlign: "left", minWidth: 180 }}>Chiến dịch</th>
                        <th style={{ ...thStyle, textAlign: "center" }}>Trạng thái</th>
                        <th style={{ ...thStyle, textAlign: "right" }}>Chi phí</th>
                        <th style={{ ...thStyle, textAlign: "right" }}>CP/ngày</th>
                        <th style={{ ...thStyle, textAlign: "right" }}>Leads</th>
                        <th style={{ ...thStyle, textAlign: "right" }}>CPL</th>
                        <th style={{ ...thStyle, textAlign: "right" }}>Lead CRM</th>
                        <th style={{ ...thStyle, textAlign: "center" }}>% QT</th>
                        <th style={{ ...thStyle, textAlign: "right" }}>CPM</th>
                        <th style={{ ...thStyle, textAlign: "center" }}>Hiệu quả</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeCampsAll.map((c, i) => {
                        const qtPct = c.crmLeads ? (c.interested / c.crmLeads * 100) : 0;
                        const effLabel = c.efficiency > 5 ? "Tốt" : c.efficiency > 1 ? "TB" : "Thấp";
                        const effColor = c.efficiency > 5 ? "#16a34a" : c.efficiency > 1 ? "#e88a2e" : "#dc2626";
                        const effBg = c.efficiency > 5 ? "#dcfce7" : c.efficiency > 1 ? "#fef3c7" : "#fef2f2";
                        return (
                          <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#fafbfc" }}>
                            <td style={{ ...tdStyle, fontWeight: 600, fontSize: 12, maxWidth: 250 }}>
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>{c.name}</span>
                            </td>
                            <td style={{ ...tdStyle, textAlign: "center" }}>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, padding: "2px 10px", borderRadius: 20, fontWeight: 700, color: "#16a34a", background: "#dcfce7" }}>
                                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#16a34a", display: "inline-block" }}></span>Bật
                              </span>
                            </td>
                            <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600, color: "#8b5cf6" }}>{fmtMoney(c.spend)}</td>
                            <td style={{ ...tdStyle, textAlign: "right", fontSize: 12 }}>{fmtMoney(c.dailySpend)}</td>
                            <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600 }}>{c.fbLeads || "—"}</td>
                            <td style={{ ...tdStyle, textAlign: "right", color: "#e88a2e", fontWeight: 600 }}>{c.cpl ? fmtMoney(c.cpl) : "—"}</td>
                            <td style={{ ...tdStyle, textAlign: "right" }}>{c.crmLeads || "—"}</td>
                            <td style={{ ...tdStyle, textAlign: "center" }}>
                              <span style={{ color: qtPct > 30 ? "#16a34a" : qtPct > 10 ? "#e88a2e" : "#6b7280", fontWeight: 600 }}>{c.crmLeads ? qtPct.toFixed(1) + "%" : "—"}</span>
                            </td>
                            <td style={{ ...tdStyle, textAlign: "right" }}>{fmtMoney(c.cpm)}</td>
                            <td style={{ ...tdStyle, textAlign: "center" }}>
                              <span style={{ padding: "3px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, color: effColor, background: effBg }}>{effLabel}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </>
        )}

        {selectedAccounts.length > 0 && !fbLoading && fbInsights.length === 0 && !fbError && (
          <div style={{ textAlign: "center", padding: 30, color: "#9ca3af", fontSize: 13 }}>Bấm "Xem báo cáo" để tải dữ liệu từ Facebook</div>
        )}
      </div>
    );
  }

  // === Settings Tab ===
  if (tab === "settings" && !isManager) {
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
      if (!r.ok) { setPwdError(String(data.error || "Lỗi đổi mật khẩu")); return; }
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

function UsersPage({ projects, leads, isManager = false, isAdminOnly = false }) {
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
  const [showBulkCreate, setShowBulkCreate] = useState(false);
  const [bulkNames, setBulkNames] = useState("");
  const [bulkCreating, setBulkCreating] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);
  const [userSearch, setUserSearch] = useState("");
  const [userPage, setUserPage] = useState(1);
  const USERS_PER_PAGE = 10;
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
  const [botDraft, setBotDraft] = useState({ name: "", token: "", projectIds: [] });
  const [botError, setBotError] = useState("");

  // Bot chat users
  const [showBotChatUsers, setShowBotChatUsers] = useState(false);
  const [botChatUsers, setBotChatUsers] = useState([]);
  const [botChatBotName, setBotChatBotName] = useState("");
  const [botChatLoading, setBotChatLoading] = useState(false);
  const [botChatError, setBotChatError] = useState("");
  const [botChatSearch, setBotChatSearch] = useState("");

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
        if (!r.ok) { const d = await r.json(); setError(String(d.error || "Lỗi cập nhật")); return; }
        setUsers(await r.json());
      } else {
        if (!draft.username || !draft.password) { setError("Username và mật khẩu bắt buộc"); return; }
        const r = await apiFetch(`${API}/users`, {
          method: "POST",
          body: JSON.stringify(draft),
        });
        if (!r.ok) { const d = await r.json(); setError(String(d.error || "Lỗi tạo tài khoản")); return; }
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
      if (!r.ok) { const d = await r.json(); showToast(String(d.error || "Lỗi xóa tài khoản"), "error"); return; }
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

  const handleBulkCreate = async () => {
    const nameList = bulkNames.split("\n").map(n => n.trim()).filter(Boolean);
    if (nameList.length === 0) return;
    setBulkCreating(true);
    setBulkResult(null);
    try {
      const r = await apiFetch(`${API}/users/bulk-create-sales`, {
        method: "POST",
        body: JSON.stringify({ names: nameList }),
      });
      const data = await r.json();
      if (r.ok) {
        setUsers(data.users);
        setBulkResult(data);
        if (data.created > 0) setBulkNames("");
      } else {
        setBulkResult({ error: data.error || "Lỗi không xác định" });
      }
    } catch (e) {
      setBulkResult({ error: e.message });
    }
    setBulkCreating(false);
  };

  // Filtered + paginated users
  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return users;
    const q = userSearch.toLowerCase();
    return users.filter(u =>
      (u.username || "").toLowerCase().includes(q) ||
      (u.displayName || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q) ||
      (u.phone || "").toLowerCase().includes(q) ||
      (u.role || "").toLowerCase().includes(q)
    );
  }, [users, userSearch]);

  const totalUserPages = Math.max(1, Math.ceil(filteredUsers.length / USERS_PER_PAGE));
  const paginatedUsers = filteredUsers.slice((userPage - 1) * USERS_PER_PAGE, userPage * USERS_PER_PAGE);

  // Reset page when search changes
  useEffect(() => { setUserPage(1); }, [userSearch]);

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
    setBotDraft({ name: "", token: "", projectIds: [] });
    setBotError("");
    setShowBotForm(true);
  };

  const openEditBot = (b) => {
    setEditingBot(b);
    setBotDraft({ name: b.name, token: b.token, projectIds: b.projectIds || [] });
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
      const text = await r.text();
      let d;
      try { d = JSON.parse(text); } catch { setBotError(text.slice(0, 120) || "Server trả về lỗi không xác định"); setSavingBot(false); return; }
      if (!r.ok) { setBotError(String(d.error || "Lỗi")); setSavingBot(false); return; }
      setBots(d);
      setShowBotForm(false);
    } catch (e) { setBotError(e.message); }
    setSavingBot(false);
  };

  const handleDeleteBot = async (id) => {
    if (!(await showConfirm("Xóa bot này?"))) return;
    try {
      const r = await apiFetch(`${API}/telegram-bots/${id}`, { method: "DELETE" });
      if (!r.ok) { const d = await r.json(); showToast(String(d.error || "Lỗi"), "error"); return; }
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

  const handleShowBotChatUsers = async (bot) => {
    setShowBotChatUsers(true);
    setBotChatBotName(bot.name);
    setBotChatUsers([]);
    setBotChatError("");
    setBotChatSearch("");
    setBotChatLoading(true);
    try {
      const r = await apiFetch(`${API}/telegram-bots/${bot.id}/chat-users`);
      const data = await r.json();
      if (r.ok) {
        setBotChatUsers(data.users || []);
      } else {
        setBotChatError(data.error || "Lỗi không xác định");
      }
    } catch (e) {
      setBotChatError(e.message);
    }
    setBotChatLoading(false);
  };

  const filteredBotChatUsers = useMemo(() => {
    if (!botChatSearch.trim()) return botChatUsers;
    const q = botChatSearch.toLowerCase();
    return botChatUsers.filter(u =>
      u.fullName.toLowerCase().includes(q) ||
      u.telegramId.includes(q) ||
      (u.username || "").toLowerCase().includes(q)
    );
  }, [botChatUsers, botChatSearch]);

  return (
    <>
      {/* ===== TÀI KHOẢN ===== */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: 14, color: "#6b7280", display: "flex", alignItems: "center", gap: 6 }}><Users size={14} /> {users.length} tài khoản</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={handleAutoCreate} disabled={autoCreating} style={{ ...btnSecondary, minHeight: 40, fontSize: 12 }}>
            {autoCreating ? <><Hourglass size={14} className="spin" /> Đang tạo...</> : <><Bot size={14} /> Tự tạo TK Sale</>}
          </button>
          <button onClick={() => { setShowBulkCreate(true); setBulkResult(null); }} style={{ ...btnSecondary, minHeight: 40, fontSize: 12 }}>
            <ClipboardList size={14} /> Tạo DS Sale
          </button>
          <button onClick={openNew} style={{ ...btnPrimary, minHeight: 40 }}>+ Thêm tài khoản</button>
        </div>
      </div>

      {/* Thanh tìm kiếm tài khoản */}
      <div style={{ position: "relative", marginBottom: 12 }}>
        <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
        <input
          value={userSearch}
          onChange={(e) => setUserSearch(e.target.value)}
          placeholder="Tìm kiếm tài khoản (tên, username, email, SĐT...)"
          style={{ ...inputStyle, paddingLeft: 34, marginBottom: 0 }}
        />
        {userSearch && (
          <button onClick={() => setUserSearch("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: 2 }}>
            <X size={14} />
          </button>
        )}
      </div>
      {userSearch && <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>Tìm thấy {filteredUsers.length} tài khoản</div>}
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
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
          {paginatedUsers.map((u) => (
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
                      background: u.role === "admin" ? "#fef2f2" : u.role === "manager" ? "#eff6ff" : "#f0faf1",
                      color: u.role === "admin" ? "#dc2626" : u.role === "manager" ? "#2563eb" : "#1a3c20",
                    }}>{u.role === "admin" ? "Admin" : u.role === "manager" ? "Quản lý" : "Sale"}</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => openProfile(u)} title="Hồ sơ" style={{ ...btnSecondary, padding: "6px 12px", fontSize: 12, minHeight: 36 }}><IdCard size={14} /></button>
                  {(!isManager || u.role === "sale") && <button onClick={() => openEdit(u)} style={{ ...btnSecondary, padding: "6px 12px", fontSize: 12, minHeight: 36 }}><Pencil size={14} /></button>}
                  {(!isManager || u.role === "sale") && <button onClick={() => handleDelete(u.id)} style={{ ...btnDanger, padding: "6px 12px", fontSize: 12, minHeight: 36 }}><Trash2 size={14} /></button>}
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
      <div style={{ background: "#fff", borderRadius: 12, overflow: "auto", boxShadow: "0 1px 3px rgba(0,0,0,.08)", marginBottom: 12 }}>
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
            {paginatedUsers.map((u, i) => {
              const globalIdx = (userPage - 1) * USERS_PER_PAGE + i;
              return (
              <tr key={u.id} style={{ background: globalIdx % 2 ? "#f9fafb" : "#fff" }}>
                <td style={tdStyle}>{globalIdx + 1}</td>
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
                    background: u.role === "admin" ? "#fef2f2" : u.role === "manager" ? "#eff6ff" : "#f0faf1",
                    color: u.role === "admin" ? "#dc2626" : u.role === "manager" ? "#2563eb" : "#1a3c20",
                  }}>
                    {u.role === "admin" ? "Admin" : u.role === "manager" ? "Quản lý" : "Sale"}
                  </span>
                </td>
                <td style={{ ...tdStyle, fontSize: 11 }}>{u.createdAt || "-"}</td>
                <td style={tdStyle}>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => openProfile(u)} title="Hồ sơ" style={{ ...btnSecondary, padding: "2px 8px", fontSize: 11 }}><IdCard size={12} /></button>
                    {(!isManager || u.role === "sale") && <button onClick={() => openEdit(u)} style={{ ...btnSecondary, padding: "2px 8px", fontSize: 11 }}><Pencil size={12} /></button>}
                    {(!isManager || u.role === "sale") && <button onClick={() => handleDelete(u.id)} style={{ ...btnDanger, padding: "2px 8px", fontSize: 11 }}><Trash2 size={12} /></button>}
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}

      {/* Pagination */}
      {totalUserPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, marginBottom: 24 }}>
          <button
            onClick={() => setUserPage(p => Math.max(1, p - 1))}
            disabled={userPage === 1}
            style={{ ...btnSecondary, padding: "6px 10px", fontSize: 12, opacity: userPage === 1 ? 0.4 : 1 }}
          ><ChevronLeft size={14} /></button>
          {Array.from({ length: totalUserPages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === totalUserPages || Math.abs(p - userPage) <= 2)
            .reduce((acc, p, idx, arr) => {
              if (idx > 0 && p - arr[idx - 1] > 1) acc.push("...");
              acc.push(p);
              return acc;
            }, [])
            .map((p, idx) =>
              p === "..." ? (
                <span key={"dot" + idx} style={{ color: "#9ca3af", fontSize: 12, padding: "0 2px" }}>...</span>
              ) : (
                <button
                  key={p}
                  onClick={() => setUserPage(p)}
                  style={{
                    padding: "6px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                    border: userPage === p ? "2px solid #e88a2e" : "1px solid #d1d5db",
                    background: userPage === p ? "#fef6ee" : "#fff",
                    color: userPage === p ? "#e88a2e" : "#374151",
                    cursor: "pointer", minWidth: 36,
                  }}
                >{p}</button>
              )
            )}
          <button
            onClick={() => setUserPage(p => Math.min(totalUserPages, p + 1))}
            disabled={userPage === totalUserPages}
            style={{ ...btnSecondary, padding: "6px 10px", fontSize: 12, opacity: userPage === totalUserPages ? 0.4 : 1 }}
          ><ChevronRight size={14} /></button>
        </div>
      )}

      {/* ===== TELEGRAM BOT (Admin only) ===== */}
      {isAdminOnly && <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: 14, color: "#6b7280", display: "flex", alignItems: "center", gap: 6 }}><Bot size={14} /> Telegram Bot ({bots.length})</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={async () => {
            try {
              const r = await apiFetch(`${API}/telegram-bots/auto-assign`, { method: "POST" });
              const d = await r.json();
              if (d.bots) setBots(d.bots);
              showToast(d.msg, d.assigned > 0 ? "success" : "info");
            } catch (e) { showToast(e.message, "error"); }
          }} style={{ ...btnSecondary, fontSize: 12, padding: "8px 12px", minHeight: 40, display: "flex", alignItems: "center", gap: 4 }}><Zap size={14} /> Auto gán DA</button>
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
              <div style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace", marginBottom: 4, wordBreak: "break-all" }}>{b.token.slice(0, 12)}...{b.token.slice(-6)}</div>
              {(() => { const pNames = (b.projectIds || []).map(id => projects.find(pr => pr.id === id)).filter(Boolean).map(p => p.name); return pNames.length > 0 ? <div style={{ fontSize: 11, color: "#2563eb", marginBottom: 8, display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}><Building size={11} /> {pNames.join(", ")}</div> : <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 8 }}>Chưa gán dự án</div>; })()}
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => handleShowBotChatUsers(b)} style={{ ...btnSecondary, flex: 1, padding: "8px", fontSize: 12, minHeight: 36, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}><Users size={12} /> DS Chat</button>
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
                <th style={thStyle}>Dự án</th>
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
                  <td style={{ ...tdStyle, fontSize: 11 }}>
                    {(() => { const pNames = (b.projectIds || []).map(id => projects.find(pr => pr.id === id)).filter(Boolean).map(p => p.name); return pNames.length > 0 ? <span style={{ background: "#eff6ff", color: "#2563eb", padding: "2px 8px", borderRadius: 8, fontSize: 10, fontWeight: 600 }}>{pNames.join(", ")}</span> : <span style={{ color: "#9ca3af" }}>—</span>; })()}
                  </td>
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
                      <button onClick={() => handleShowBotChatUsers(b)} title="DS người chat" style={{ ...btnSecondary, padding: "2px 8px", fontSize: 11 }}><Users size={11} /></button>
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
      </>}

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
            {isAdminOnly && <option value="manager">Quản lý</option>}
            {isAdminOnly && <option value="admin">Admin</option>}
          </select>
          {(draft.role === "sale" || draft.role === "manager") && (
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

      {/* Modal tạo danh sách TK Sale */}
      {showBulkCreate && (
        <Modal onClose={() => setShowBulkCreate(false)} title="Tạo danh sách tài khoản Sale">
          <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 12, lineHeight: 1.6 }}>
            <Info size={13} style={{ display: "inline", verticalAlign: "middle" }} /> Nhập danh sách tên Sale, <strong>mỗi tên một dòng</strong>.
            <br />Mật khẩu mặc định: tên (không dấu) + 123. VD: <strong>thao123</strong>
            <br />Sale sẽ phải đổi mật khẩu khi đăng nhập lần đầu.
          </div>
          <label style={labelStyle}>Danh sách tên Sale</label>
          <textarea
            value={bulkNames}
            onChange={(e) => setBulkNames(e.target.value)}
            placeholder={"Nguyễn Văn A\nTrần Thị B\nLê Văn C\n..."}
            rows={8}
            style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", lineHeight: 1.6 }}
          />
          <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 12 }}>
            {bulkNames.split("\n").filter(n => n.trim()).length} tên trong danh sách
          </div>

          {bulkResult && !bulkResult.error && (
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: 12, fontSize: 13, marginBottom: 12, maxHeight: 200, overflowY: "auto" }}>
              {bulkResult.created > 0 ? (
                <>
                  <div style={{ fontWeight: 700, color: "#16a34a", marginBottom: 6 }}><Check size={13} style={{ display: "inline", verticalAlign: "middle" }} /> Đã tạo {bulkResult.created} tài khoản:</div>
                  {bulkResult.createdList.map((c, i) => (
                    <div key={i} style={{ fontSize: 12, color: "#1a3c20", padding: "2px 0" }}>• {c.displayName} → @{c.username} (MK: {c.defaultPassword})</div>
                  ))}
                </>
              ) : (
                <div style={{ color: "#6b7280" }}><Info size={13} style={{ display: "inline", verticalAlign: "middle" }} /> Không có tài khoản mới được tạo.</div>
              )}
              {bulkResult.skippedList && bulkResult.skippedList.length > 0 && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #d1fae5" }}>
                  <div style={{ fontWeight: 600, color: "#ca8a04", fontSize: 12, marginBottom: 4 }}>Bỏ qua ({bulkResult.skippedList.length}):</div>
                  {bulkResult.skippedList.map((s, i) => (
                    <div key={i} style={{ fontSize: 11, color: "#92400e", padding: "1px 0" }}>• {s.name}: {s.reason}</div>
                  ))}
                </div>
              )}
            </div>
          )}
          {bulkResult && bulkResult.error && (
            <div style={{ background: "#fef2f2", color: "#dc2626", padding: "8px 12px", borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
              <X size={13} style={{ display: "inline", verticalAlign: "middle" }} /> {bulkResult.error}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              onClick={handleBulkCreate}
              disabled={bulkCreating || bulkNames.split("\n").filter(n => n.trim()).length === 0}
              style={{ ...btnPrimary, flex: 1, opacity: (bulkCreating || bulkNames.split("\n").filter(n => n.trim()).length === 0) ? 0.6 : 1 }}
            >
              {bulkCreating ? <><Hourglass size={14} className="spin" /> Đang tạo...</> : <><ClipboardList size={14} /> Tạo tài khoản</>}
            </button>
            <button onClick={() => setShowBulkCreate(false)} disabled={bulkCreating} style={{ ...btnSecondary, flex: 1 }}>Đóng</button>
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
          <label style={labelStyle}><Building size={14} style={{ display: "inline", verticalAlign: "middle" }} /> Dự án liên kết</label>
          <div style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: 8, maxHeight: 160, overflowY: "auto", background: "#fff", marginBottom: 4 }}>
            {projects.map(p => (
              <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 4px", cursor: "pointer", fontSize: 13, borderRadius: 6, background: (botDraft.projectIds || []).includes(p.id) ? "#eff6ff" : "transparent" }}>
                <input type="checkbox" checked={(botDraft.projectIds || []).includes(p.id)}
                  onChange={(e) => {
                    const ids = botDraft.projectIds || [];
                    setBotDraft({ ...botDraft, projectIds: e.target.checked ? [...ids, p.id] : ids.filter(i => i !== p.id) });
                  }} />
                {p.name}
              </label>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 8 }}>
            <Info size={11} style={{ display: "inline", verticalAlign: "middle" }} /> Chọn các dự án bot sẽ gửi thông báo. Không chọn = dùng làm fallback cho tất cả.
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button onClick={handleSaveBot} disabled={savingBot} style={{ ...btnPrimary, flex: 1, opacity: savingBot ? 0.6 : 1 }}>{savingBot ? "Đang lưu..." : "Lưu"}</button>
            <button onClick={() => setShowBotForm(false)} disabled={savingBot} style={{ ...btnSecondary, flex: 1 }}>Hủy</button>
          </div>
        </Modal>
      )}

      {/* Modal danh sách người đã chat với bot */}
      {showBotChatUsers && (
        <Modal onClose={() => setShowBotChatUsers(false)} title={`Người đã chat — ${botChatBotName}`}>
          {botChatLoading ? (
            <div style={{ textAlign: "center", padding: 24, color: "#6b7280" }}>
              <Hourglass size={20} className="spin" style={{ marginBottom: 8 }} />
              <div style={{ fontSize: 13 }}>Đang tải danh sách từ Telegram...</div>
            </div>
          ) : botChatError ? (
            <div style={{ background: "#fef2f2", color: "#dc2626", padding: "10px 14px", borderRadius: 8, fontSize: 13 }}>
              <X size={13} style={{ display: "inline", verticalAlign: "middle" }} /> {botChatError}
            </div>
          ) : botChatUsers.length === 0 ? (
            <div style={{ textAlign: "center", padding: 24, color: "#9ca3af", fontSize: 13 }}>
              <Info size={16} style={{ marginBottom: 6 }} />
              <div>Chưa có ai chat với bot này.</div>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <div style={{ position: "relative", flex: 1 }}>
                  <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
                  <input
                    value={botChatSearch}
                    onChange={(e) => setBotChatSearch(e.target.value)}
                    placeholder="Tìm tên, ID, username..."
                    style={{ ...inputStyle, paddingLeft: 32, marginBottom: 0 }}
                  />
                </div>
                <div style={{ fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" }}>{filteredBotChatUsers.length} / {botChatUsers.length}</div>
              </div>
              <div style={{ maxHeight: 400, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 10, background: "#fafafa" }}>
                {filteredBotChatUsers.map((u, i) => (
                  <div key={u.telegramId} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 14px", borderBottom: i < filteredBotChatUsers.length - 1 ? "1px solid #e5e7eb" : "none",
                    background: i % 2 ? "#f9fafb" : "#fff",
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{u.fullName || "Không có tên"}</div>
                      <div style={{ fontSize: 11, color: "#6b7280", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><Hash size={10} /> {u.telegramId}</span>
                        {u.username && <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><User size={10} /> @{u.username}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => { navigator.clipboard.writeText(u.telegramId); showToast(`Đã copy ID: ${u.telegramId}`, "success"); }}
                      title="Copy Telegram ID"
                      style={{ ...btnSecondary, padding: "4px 10px", fontSize: 11, flexShrink: 0 }}
                    ><ClipboardList size={12} /></button>
                  </div>
                ))}
              </div>
            </>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button onClick={() => setShowBotChatUsers(false)} style={{ ...btnSecondary, flex: 1 }}>Đóng</button>
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
            <span style={{ width: 24, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", color: "#6b7280" }}>{React.isValidElement(IconComp) ? IconComp : <IconComp size={16} />}</span>
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

/* ===== Facebook Messenger Inbox (Admin) ===== */
function MessengerInboxPage() {
  const isMobile = useIsMobile();
  const [pages, setPages] = useState([]);
  const [selectedPageId, setSelectedPageId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [convPaging, setConvPaging] = useState(null);
  const [msgPaging, setMsgPaging] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchText, setSearchText] = useState("");
  const msgEndRef = useRef(null);
  const inputRef = useRef(null);
  const pollRef = useRef(null);

  // Load Facebook pages
  useEffect(() => {
    (async () => {
      try {
        const r = await apiFetch(`${API}/fb-pages`);
        if (r.ok) {
          const data = await r.json();
          const active = data.filter(p => p.isActive && p.pageId && p.accessToken);
          setPages(active);
          if (active.length > 0 && !selectedPageId) setSelectedPageId(active[0].id);
        }
      } catch (e) { /* ignore */ }
    })();
  }, []);

  // Load conversations when page selected
  const loadConversations = useCallback(async (pageId, after) => {
    if (!pageId) return;
    if (!after) setLoading(true);
    else setLoadingMore(true);
    setError("");
    try {
      let url = `${API}/fb-messenger/conversations?pageId=${pageId}`;
      if (after) url += `&after=${encodeURIComponent(after)}`;
      const r = await apiFetch(url);
      const data = await r.json();
      if (!r.ok) { setError(data.error || "Lỗi tải hội thoại"); setLoading(false); setLoadingMore(false); return; }
      if (after) {
        setConversations(prev => [...prev, ...data.conversations]);
      } else {
        setConversations(data.conversations || []);
      }
      setConvPaging(data.paging);
    } catch (e) { setError("Không thể kết nối Facebook API"); }
    setLoading(false);
    setLoadingMore(false);
  }, []);

  useEffect(() => {
    if (selectedPageId) {
      setConversations([]);
      setActiveConv(null);
      setMessages([]);
      loadConversations(selectedPageId);
    }
  }, [selectedPageId, loadConversations]);

  // Auto refresh conversations every 15s
  useEffect(() => {
    if (!selectedPageId) return;
    const iv = setInterval(() => loadConversations(selectedPageId), 15000);
    return () => clearInterval(iv);
  }, [selectedPageId, loadConversations]);

  // Load messages for a conversation
  const loadMessages = useCallback(async (conv) => {
    if (!selectedPageId || !conv) return;
    setLoadingMsgs(true);
    setMessages([]);
    setMsgPaging(null);
    try {
      const r = await apiFetch(`${API}/fb-messenger/messages?pageId=${selectedPageId}&conversationId=${conv.id}`);
      const data = await r.json();
      if (r.ok) {
        // FB returns newest first, reverse for chat display
        setMessages((data.messages || []).reverse());
        setMsgPaging(data.paging);
        setTimeout(() => msgEndRef.current?.scrollIntoView({ behavior: "smooth" }), 150);
      }
    } catch (e) { /* ignore */ }
    setLoadingMsgs(false);
  }, [selectedPageId]);

  // Load older messages
  const loadOlderMessages = async () => {
    if (!msgPaging?.next || !activeConv || loadingMore) return;
    setLoadingMore(true);
    try {
      const afterCursor = msgPaging.cursors?.after;
      if (!afterCursor) { setLoadingMore(false); return; }
      const r = await apiFetch(`${API}/fb-messenger/messages?pageId=${selectedPageId}&conversationId=${activeConv.id}&after=${encodeURIComponent(afterCursor)}`);
      const data = await r.json();
      if (r.ok) {
        // Older messages prepended (FB returns newest first, so reverse and prepend)
        setMessages(prev => [...(data.messages || []).reverse(), ...prev]);
        setMsgPaging(data.paging);
      }
    } catch (e) { /* ignore */ }
    setLoadingMore(false);
  };

  const openConversation = (conv) => {
    setActiveConv(conv);
    setDraft("");
    loadMessages(conv);
  };

  // Poll new messages every 5s when conversation is open
  useEffect(() => {
    if (!activeConv || !selectedPageId) return;
    const iv = setInterval(() => loadMessages(activeConv), 5000);
    pollRef.current = iv;
    return () => clearInterval(iv);
  }, [activeConv, selectedPageId, loadMessages]);

  // Send reply
  const sendReply = async () => {
    if (!draft.trim() || !activeConv || sending) return;
    const text = draft.trim();
    // Get the customer (non-page) sender ID
    const selectedPage = pages.find(p => p.id === selectedPageId);
    const customer = activeConv.senders?.find(s => s.id !== selectedPage?.pageId);
    if (!customer) { setError("Không tìm thấy người nhận"); return; }

    setSending(true);
    setDraft("");
    try {
      const r = await apiFetch(`${API}/fb-messenger/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId: selectedPageId, recipientId: customer.id, message: text }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error || "Gửi tin nhắn thất bại");
        setDraft(text);
      } else {
        // Refresh messages
        loadMessages(activeConv);
      }
    } catch (e) { setError("Lỗi kết nối"); setDraft(text); }
    setSending(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const getCustomerName = (conv) => {
    const selectedPage = pages.find(p => p.id === selectedPageId);
    const customer = conv.senders?.find(s => s.id !== selectedPage?.pageId);
    return customer?.name || "Khách hàng";
  };

  const getCustomerId = (conv) => {
    const selectedPage = pages.find(p => p.id === selectedPageId);
    const customer = conv.senders?.find(s => s.id !== selectedPage?.pageId);
    return customer?.id || "";
  };

  const getCustomerLink = (conv) => {
    const selectedPage = pages.find(p => p.id === selectedPageId);
    const customer = conv.senders?.find(s => s.id !== selectedPage?.pageId);
    return customer?.link || "";
  };

  const isFromPage = (msg) => {
    const selectedPage = pages.find(p => p.id === selectedPageId);
    return msg.from?.id === selectedPage?.pageId;
  };

  const formatTime = (ts) => {
    if (!ts) return "";
    const d = new Date(ts);
    const now = new Date();
    const diff = Math.floor((now - d) / 60000);
    if (diff < 1) return "Vừa xong";
    if (diff < 60) return `${diff} phút trước`;
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Hôm qua " + d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) + " " + d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  };

  const filteredConvs = searchText
    ? conversations.filter(c => getCustomerName(c).toLowerCase().includes(searchText.toLowerCase()) || (c.snippet || "").toLowerCase().includes(searchText.toLowerCase()))
    : conversations;

  const selectedPage = pages.find(p => p.id === selectedPageId);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: isMobile ? 18 : 22, display: "flex", alignItems: "center", gap: 8 }}>
          <MessageSquare size={22} /> Hộp thư Messenger
        </h2>
        <select
          value={selectedPageId || ""}
          onChange={e => setSelectedPageId(Number(e.target.value))}
          style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, background: "#fff" }}
        >
          {pages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button onClick={() => loadConversations(selectedPageId)} disabled={loading}
          style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}>
          <RefreshCw size={14} style={loading ? { animation: "spin 1s linear infinite" } : {}} /> Làm mới
        </button>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", marginBottom: 12, color: "#dc2626", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
          <AlertCircle size={16} /> {error}
          <button onClick={() => setError("")} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#dc2626" }}><X size={14} /></button>
        </div>
      )}

      {pages.length === 0 && !loading && (
        <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>
          <MessageSquare size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
          <p>Chưa có Facebook Page nào được cấu hình.</p>
          <p style={{ fontSize: 13 }}>Vào <strong>Quản lý bài đăng</strong> → thêm Page với Access Token có quyền <code>pages_messaging</code></p>
        </div>
      )}

      {pages.length > 0 && (
        <div style={{ display: "flex", gap: 0, height: isMobile ? "calc(100vh - 180px)" : "calc(100vh - 200px)", background: "#fff", borderRadius: 12, overflow: "hidden", border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
          {/* Conversation list */}
          {(!isMobile || !activeConv) && (
            <div style={{ width: isMobile ? "100%" : 340, borderRight: "1px solid #e5e7eb", display: "flex", flexDirection: "column", flexShrink: 0 }}>
              <div style={{ padding: "12px", borderBottom: "1px solid #f3f4f6" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#f3f4f6", borderRadius: 20, padding: "6px 12px" }}>
                  <Search size={14} style={{ color: "#9ca3af" }} />
                  <input
                    value={searchText} onChange={e => setSearchText(e.target.value)}
                    placeholder="Tìm kiếm hội thoại..."
                    style={{ border: "none", background: "transparent", outline: "none", flex: 1, fontSize: 13 }}
                  />
                </div>
              </div>
              <div style={{ flex: 1, overflowY: "auto" }}>
                {loading && conversations.length === 0 && (
                  <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>
                    <RefreshCw size={24} style={{ animation: "spin 1s linear infinite", marginBottom: 8 }} />
                    <p style={{ fontSize: 13 }}>Đang tải hội thoại...</p>
                  </div>
                )}
                {!loading && filteredConvs.length === 0 && (
                  <div style={{ textAlign: "center", padding: 40, color: "#9ca3af", fontSize: 13 }}>
                    Không có hội thoại nào
                  </div>
                )}
                {filteredConvs.map(conv => {
                  const isActive = activeConv?.id === conv.id;
                  const custName = getCustomerName(conv);
                  const custId = getCustomerId(conv);
                  return (
                    <div
                      key={conv.id}
                      onClick={() => openConversation(conv)}
                      style={{
                        display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", cursor: "pointer",
                        background: isActive ? "#eff6ff" : "transparent",
                        borderLeft: isActive ? "3px solid #2563eb" : "3px solid transparent",
                        transition: "background .15s",
                      }}
                      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "#f9fafb"; }}
                      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                    >
                      <div style={{
                        width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                        display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 16, flexShrink: 0,
                      }}>
                        {custName.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <span style={{ fontWeight: conv.unreadCount > 0 ? 700 : 500, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 4 }}>
                            {custName}
                            {(() => { const custLink = getCustomerLink(conv); return (custLink || custName) ? <a href={custLink || `https://www.facebook.com/search/top/?q=${encodeURIComponent(custName)}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} title={custLink ? "Xem Facebook" : "Tìm trên Facebook"} style={{ color: "#3b82f6", display: "inline-flex", flexShrink: 0 }}><ExternalLink size={12} /></a> : null; })()}
                          </span>
                          <span style={{ fontSize: 11, color: "#9ca3af", whiteSpace: "nowrap", flexShrink: 0 }}>
                            {formatTime(conv.updatedTime)}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{
                            fontSize: 12, color: conv.unreadCount > 0 ? "#1f2937" : "#6b7280",
                            fontWeight: conv.unreadCount > 0 ? 600 : 400,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
                          }}>
                            {conv.snippet || "..."}
                          </span>
                          {conv.unreadCount > 0 && (
                            <span style={{
                              minWidth: 18, height: 18, borderRadius: 9, background: "#2563eb", color: "#fff",
                              fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px",
                            }}>{conv.unreadCount}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {convPaging?.next && (
                  <button onClick={() => loadConversations(selectedPageId, convPaging.cursors?.after)} disabled={loadingMore}
                    style={{ width: "100%", padding: "10px", background: "none", border: "none", color: "#2563eb", cursor: "pointer", fontSize: 13 }}>
                    {loadingMore ? "Đang tải..." : "Tải thêm hội thoại"}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Message area */}
          {(!isMobile || activeConv) && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
              {!activeConv ? (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>
                  <div style={{ textAlign: "center" }}>
                    <MessageSquare size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
                    <p style={{ fontSize: 15 }}>Chọn một hội thoại để xem tin nhắn</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Chat header */}
                  <div style={{
                    padding: "10px 16px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 10, background: "#fafbfc",
                  }}>
                    {isMobile && (
                      <button onClick={() => setActiveConv(null)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                        <ArrowLeft size={20} />
                      </button>
                    )}
                    <div style={{
                      width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                      display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 14,
                    }}>
                      {getCustomerName(activeConv).charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 4 }}>
                        {getCustomerName(activeConv)}
                        {(() => { const custLink = getCustomerLink(activeConv); const custN = getCustomerName(activeConv); return (custLink || custN !== "Khách hàng") ? <a href={custLink || `https://www.facebook.com/search/top/?q=${encodeURIComponent(custN)}`} target="_blank" rel="noopener noreferrer" title={custLink ? "Xem Facebook" : "Tìm trên Facebook"} style={{ color: "#3b82f6", display: "inline-flex" }}><ExternalLink size={14} /></a> : null; })()}
                      </div>
                      <div style={{ fontSize: 11, color: "#9ca3af" }}>
                        via {selectedPage?.name || "Facebook Page"}
                      </div>
                    </div>
                  </div>

                  {/* Messages */}
                  <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 4 }}>
                    {msgPaging?.next && (
                      <button onClick={loadOlderMessages} disabled={loadingMore}
                        style={{ alignSelf: "center", padding: "6px 16px", borderRadius: 16, border: "1px solid #e5e7eb", background: "#f9fafb", cursor: "pointer", fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
                        {loadingMore ? "Đang tải..." : "Tải tin nhắn cũ hơn"}
                      </button>
                    )}
                    {loadingMsgs && messages.length === 0 && (
                      <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>
                        <RefreshCw size={20} style={{ animation: "spin 1s linear infinite" }} />
                      </div>
                    )}
                    {messages.map((msg, idx) => {
                      const fromPage = isFromPage(msg);
                      const showTime = idx === 0 || (new Date(msg.createdTime) - new Date(messages[idx - 1]?.createdTime)) > 300000;
                      return (
                        <React.Fragment key={msg.id}>
                          {showTime && (
                            <div style={{ textAlign: "center", fontSize: 11, color: "#9ca3af", margin: "8px 0 4px" }}>
                              {formatTime(msg.createdTime)}
                            </div>
                          )}
                          <div style={{ display: "flex", justifyContent: fromPage ? "flex-end" : "flex-start", marginBottom: 2 }}>
                            <div style={{
                              maxWidth: "70%", padding: "8px 12px", borderRadius: fromPage ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                              background: fromPage ? "#2563eb" : "#f3f4f6",
                              color: fromPage ? "#fff" : "#1f2937",
                              fontSize: 14, lineHeight: 1.45, wordBreak: "break-word",
                            }}>
                              {msg.message}
                              {msg.attachments?.length > 0 && (
                                <div style={{ marginTop: 6 }}>
                                  {msg.attachments.map((att, ai) => (
                                    att.url ? (
                                      att.type?.startsWith("image") ? (
                                        <img key={ai} src={att.url} alt="" style={{ maxWidth: "100%", borderRadius: 8, marginTop: 4 }} />
                                      ) : (
                                        <a key={ai} href={att.url} target="_blank" rel="noopener noreferrer"
                                          style={{ color: fromPage ? "#dbeafe" : "#2563eb", fontSize: 12, textDecoration: "underline" }}>
                                          {att.name || "Tệp đính kèm"}
                                        </a>
                                      )
                                    ) : null
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </React.Fragment>
                      );
                    })}
                    <div ref={msgEndRef} />
                  </div>

                  {/* Input area */}
                  <div style={{ padding: "10px 16px", borderTop: "1px solid #e5e7eb", display: "flex", gap: 8, alignItems: "flex-end", background: "#fafbfc" }}>
                    <textarea
                      ref={inputRef}
                      value={draft}
                      onChange={e => setDraft(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                      placeholder="Nhập tin nhắn..."
                      rows={1}
                      style={{
                        flex: 1, resize: "none", border: "1px solid #e5e7eb", borderRadius: 20, padding: "8px 14px",
                        fontSize: 14, outline: "none", maxHeight: 100, fontFamily: "inherit",
                      }}
                      onInput={e => { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px"; }}
                    />
                    <button
                      onClick={sendReply}
                      disabled={!draft.trim() || sending}
                      style={{
                        width: 38, height: 38, borderRadius: "50%", border: "none",
                        background: draft.trim() ? "#2563eb" : "#e5e7eb", color: "#fff",
                        cursor: draft.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "background .2s",
                      }}
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
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
      if (!r.ok) { setError(String(data.error || "Lỗi tải dữ liệu")); setLoading(false); return; }
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

/* ===== FB Pages Management Page ===== */
function FbPagesPage() {
  const isMobile = useIsMobile();
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingPage, setEditingPage] = useState(null); // null=closed, {}=new, {id,...}=edit
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", pageId: "", accessToken: "", avatarUrl: "" });

  const loadPages = async () => {
    setLoading(true);
    try {
      const r = await apiFetch(`${API}/fb-pages`);
      if (r.ok) setPages(await r.json());
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadPages(); }, []);

  const openNew = () => { setForm({ name: "", pageId: "", accessToken: "", avatarUrl: "" }); setEditingPage({}); };
  const openEdit = (p) => { setForm({ name: p.name, pageId: p.pageId, accessToken: p.accessToken, avatarUrl: p.avatarUrl || "" }); setEditingPage(p); };
  const closeModal = () => { if (!saving) setEditingPage(null); };

  const handleSave = async () => {
    if (!form.name.trim()) return showToast("Tên Page là bắt buộc", "error");
    setSaving(true);
    try {
      const isNew = !editingPage?.id;
      const url = isNew ? `${API}/fb-pages` : `${API}/fb-pages/${editingPage.id}`;
      const r = await apiFetch(url, {
        method: isNew ? "POST" : "PUT",
        body: JSON.stringify({ name: form.name.trim(), pageId: form.pageId.trim(), accessToken: form.accessToken.trim(), avatarUrl: form.avatarUrl.trim(), isActive: editingPage?.isActive !== false }),
      });
      if (r.ok) { setPages(await r.json()); setEditingPage(null); showToast(isNew ? "Đã thêm Page" : "Đã cập nhật Page"); }
      else { const d = await r.json().catch(() => ({})); showToast(d.error || "Lỗi", "error"); }
    } catch { showToast("Lỗi kết nối", "error"); }
    setSaving(false);
  };

  const handleToggleActive = async (p) => {
    try {
      const r = await apiFetch(`${API}/fb-pages/${p.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: p.name, pageId: p.pageId, accessToken: p.accessToken, avatarUrl: p.avatarUrl || "", isActive: !p.isActive }),
      });
      if (r.ok) setPages(await r.json());
    } catch {}
  };

  const handleDelete = async (p) => {
    if (!(await showConfirm(`Xóa Page "${p.name}"?`))) return;
    try {
      const r = await apiFetch(`${API}/fb-pages/${p.id}`, { method: "DELETE" });
      if (r.ok) { setPages(await r.json()); showToast("Đã xóa"); }
    } catch {}
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: isMobile ? 16 : 20, display: "flex", alignItems: "center", gap: 8 }}>
          <Globe size={20} /> Quản lý Page Facebook
        </h2>
        <button onClick={openNew} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #3b82f6, #2563eb)", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <Plus size={14} /> Thêm Page mới
        </button>
      </div>

      <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 12, color: "#1e40af" }}>
        <b>💡 Hướng dẫn:</b> Để lấy Access Token, truy cập{" "}
        <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noreferrer" style={{ color: "#2563eb" }}>Graph API Explorer</a>
        {" → "}chọn Page → Generate Token → Copy. Cần quyền: <code>pages_manage_posts</code>, <code>pages_messaging</code>.
        {" "}Chi tiết xem tài liệu hướng dẫn.
      </div>

      {loading && <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}><RefreshCw size={20} style={{ animation: "spin 1s linear infinite" }} /> Đang tải...</div>}

      {!loading && pages.length === 0 && (
        <div style={{ textAlign: "center", padding: 40, color: "#9ca3af", background: "#f9fafb", borderRadius: 12, border: "1px dashed #d1d5db" }}>
          <Globe size={48} style={{ opacity: 0.3, marginBottom: 8 }} />
          <p style={{ fontSize: 14 }}>Chưa có Page nào.</p>
          <p style={{ fontSize: 12 }}>Bấm <b>"Thêm Page mới"</b> để bắt đầu.</p>
        </div>
      )}

      {!loading && pages.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e5e7eb" }}>
                <th style={{ padding: "10px 12px", textAlign: "left" }}>Ảnh</th>
                <th style={{ padding: "10px 12px", textAlign: "left" }}>Tên Page</th>
                <th style={{ padding: "10px 12px", textAlign: "left" }}>Facebook Page ID</th>
                <th style={{ padding: "10px 12px", textAlign: "center" }}>Token</th>
                <th style={{ padding: "10px 12px", textAlign: "center" }}>Active</th>
                <th style={{ padding: "10px 12px", textAlign: "center" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {pages.map(p => (
                <tr key={p.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "8px 12px" }}>
                    {p.avatarUrl ? <img src={p.avatarUrl} alt="" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }} /> : <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>📘</div>}
                  </td>
                  <td style={{ padding: "8px 12px", fontWeight: 600 }}>{p.name}</td>
                  <td style={{ padding: "8px 12px", color: "#6b7280", fontSize: 12 }}>{p.pageId || <span style={{ color: "#d97706" }}>Chưa nhập</span>}</td>
                  <td style={{ padding: "8px 12px", textAlign: "center" }}>
                    {p.accessToken ? <span style={{ color: "#059669", fontWeight: 600, fontSize: 11 }}>🟢 Đã kết nối</span> : <span style={{ color: "#dc2626", fontWeight: 600, fontSize: 11 }}>🔴 Chưa cập nhật</span>}
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "center" }}>
                    <button onClick={() => handleToggleActive(p)}
                      style={{ padding: "4px 12px", borderRadius: 12, border: "none", background: p.isActive ? "#dcfce7" : "#f3f4f6", color: p.isActive ? "#059669" : "#9ca3af", fontWeight: 600, fontSize: 11, cursor: "pointer" }}>
                      {p.isActive ? "🟢 ON" : "⚪ OFF"}
                    </button>
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "center" }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                      <button onClick={() => openEdit(p)} style={{ background: "none", border: "none", cursor: "pointer", color: "#3b82f6", padding: 4 }} title="Sửa"><Pencil size={14} /></button>
                      <button onClick={() => handleDelete(p)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", padding: 4 }} title="Xóa"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {editingPage !== null && (
        <div onClick={closeModal} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 9999, display: "flex", justifyContent: "center", alignItems: "center", padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 480, boxShadow: "0 20px 60px rgba(0,0,0,.3)" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>{editingPage?.id ? "Sửa Page" : "Thêm Page mới"}</h3>
              <button onClick={closeModal} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={18} /></button>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4, display: "block" }}>Tên Page <span style={{ color: "#dc2626" }}>*</span></label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="VD: Vinhomes Grand Park Official"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4, display: "block" }}>Facebook Page ID</label>
                <input value={form.pageId} onChange={e => setForm(f => ({ ...f, pageId: e.target.value }))}
                  placeholder="VD: 105432789012345"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4, display: "block" }}>Access Token</label>
                <textarea value={form.accessToken} onChange={e => setForm(f => ({ ...f, accessToken: e.target.value }))}
                  placeholder="Dán Page Access Token từ Graph API Explorer vào đây..."
                  rows={3}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 12, boxSizing: "border-box", resize: "vertical", fontFamily: "monospace" }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4, display: "block" }}>URL ảnh đại diện (tuỳ chọn)</label>
                <input value={form.avatarUrl} onChange={e => setForm(f => ({ ...f, avatarUrl: e.target.value }))}
                  placeholder="https://..."
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, boxSizing: "border-box" }} />
              </div>
            </div>
            <div style={{ padding: "12px 20px", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={closeModal} disabled={saving} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", fontSize: 13, cursor: "pointer" }}>Hủy</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #3b82f6, #2563eb)", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                {saving ? "Đang lưu..." : "Lưu"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
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
        else setError(String(data.error || "Lỗi tải dữ liệu"));
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

/* ===== Điểm tin BĐS & Học tập ===== */
function DailyNewsPage({ isAdmin }) {
  const [news, setNews] = useState([]);
  const [latest, setLatest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedId, setExpandedId] = useState(null);
  const [tab, setTab] = useState("latest"); // latest | history | settings
  const [msg, setMsg] = useState(null);
  // Settings
  const [apiKey, setApiKey] = useState("");
  const [autoFetchTime, setAutoFetchTime] = useState("07:00");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const loadLatest = async () => {
    try {
      const res = await apiFetch(`${API}/daily-news/latest`);
      const d = await res.json();
      setLatest(d.item);
    } catch {}
  };

  const loadHistory = async (p = 1) => {
    try {
      const res = await apiFetch(`${API}/daily-news?page=${p}&limit=10`);
      const d = await res.json();
      setNews(d.items || []);
      setTotalPages(d.totalPages || 1);
      setPage(d.page || 1);
    } catch {}
  };

  const loadSettings = async () => {
    try {
      const res = await apiFetch(`${API}/daily-news/settings`);
      const d = await res.json();
      setHasApiKey(d.hasApiKey);
      setAutoFetchTime(d.autoFetchTime || "07:00");
    } catch {}
  };

  useEffect(() => {
    Promise.all([loadLatest(), loadHistory(), isAdmin ? loadSettings() : Promise.resolve()])
      .finally(() => setLoading(false));
  }, []);

  const handleFetchNow = async () => {
    setFetching(true);
    setMsg(null);
    try {
      const res = await apiFetch(`${API}/daily-news/fetch`, { method: "POST" });
      if (res.ok) {
        setMsg({ type: "ok", text: "Đã lấy tin tức thành công!" });
        await loadLatest();
        await loadHistory(1);
      } else {
        let errMsg = "Lỗi không xác định";
        try { const e = await res.json(); errMsg = e.error || errMsg; } catch { try { errMsg = await res.text(); } catch {} }
        setMsg({ type: "err", text: errMsg });
      }
    } catch (err) {
      setMsg({ type: "err", text: `Lỗi kết nối: ${err.message}` });
    }
    setFetching(false);
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setMsg(null);
    try {
      const body = { autoFetchTime };
      if (apiKey) body.apiKey = apiKey;
      const res = await apiFetch(`${API}/daily-news/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setMsg({ type: "ok", text: "Đã lưu cài đặt" });
        setApiKey("");
        setHasApiKey(true);
        await loadSettings();
      } else {
        let errMsg = `Lỗi lưu cài đặt (${res.status})`;
        try { const e = await res.json(); errMsg = e.error || errMsg; } catch { try { const t = await res.text(); if (t) errMsg += ": " + t.slice(0, 100); } catch {} }
        setMsg({ type: "err", text: errMsg });
      }
    } catch (err) {
      setMsg({ type: "err", text: `Lỗi kết nối: ${err.message}` });
    }
    setSavingSettings(false);
  };

  const handleDelete = async (id) => {
    if (!confirm("Xóa bản tin này?")) return;
    try {
      await apiFetch(`${API}/daily-news/${id}`, { method: "DELETE" });
      await loadHistory(page);
      if (latest?.id === id) await loadLatest();
    } catch {}
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Đang tải...</div>;

  const cardStyle = {
    background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb",
    padding: 20, marginBottom: 16,
  };

  const renderNewsCard = (item, expanded = false) => {
    if (!item) return null;
    const newsSummary = Array.isArray(item.news_summary) ? item.news_summary : [];
    const vocab = typeof item.vocabulary === "object" && item.vocabulary ? item.vocabulary : null;
    const sources = Array.isArray(item.source_links) ? item.source_links : [];
    const isExpanded = expanded || expandedId === item.id;

    return (
      <div key={item.id} style={cardStyle}>
        {/* Header */}
        <div
          onClick={() => !expanded && setExpandedId(isExpanded ? null : item.id)}
          style={{ cursor: expanded ? "default" : "pointer", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}
        >
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1f2937", margin: 0 }}>
              📰 {item.title || "Điểm tin BĐS"}
            </h3>
            <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
              {new Date(item.created_at).toLocaleString("vi-VN")}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {!expanded && (
              <span style={{ fontSize: 12, color: "#6b7280", cursor: "pointer" }}>
                {isExpanded ? "Thu gọn ▲" : "Xem chi tiết ▼"}
              </span>
            )}
            {isAdmin && (
              <button onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#ef4444" }}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        {isExpanded && (
          <div style={{ marginTop: 16 }}>
            {/* Tin chính */}
            {newsSummary.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ fontSize: 14, fontWeight: 700, color: "#1d4ed8", margin: "0 0 10px 0", display: "flex", alignItems: "center", gap: 6 }}>
                  <Newspaper size={16} /> Tin chính hôm nay
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {newsSummary.map((n, i) => (
                    <div key={i} style={{
                      padding: "12px 14px", borderRadius: 8, background: "#f0f9ff",
                      borderLeft: "3px solid #3b82f6",
                    }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "#1e40af", marginBottom: 4 }}>
                        {i + 1}. {n.headline}
                      </div>
                      <div style={{ fontSize: 12, color: "#4b5563", lineHeight: 1.5 }}>{n.summary}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Xu hướng thị trường */}
            {item.market_trend && (
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ fontSize: 14, fontWeight: 700, color: "#059669", margin: "0 0 8px 0", display: "flex", alignItems: "center", gap: 6 }}>
                  <TrendingUp size={16} /> Xu hướng thị trường
                </h4>
                <div style={{
                  padding: "12px 14px", borderRadius: 8, background: "#f0fdf4",
                  borderLeft: "3px solid #10b981", fontSize: 13, color: "#374151", lineHeight: 1.6,
                }}>
                  {item.market_trend}
                </div>
              </div>
            )}

            {/* Bài học Marketing */}
            {item.marketing_lesson && (
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ fontSize: 14, fontWeight: 700, color: "#d97706", margin: "0 0 8px 0", display: "flex", alignItems: "center", gap: 6 }}>
                  <Lightbulb size={16} /> Bài học Marketing
                </h4>
                <div style={{
                  padding: "12px 14px", borderRadius: 8, background: "#fffbeb",
                  borderLeft: "3px solid #f59e0b", fontSize: 13, color: "#374151", lineHeight: 1.6,
                }}>
                  {item.marketing_lesson}
                </div>
              </div>
            )}

            {/* Thuật ngữ */}
            {vocab && vocab.term && (
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ fontSize: 14, fontWeight: 700, color: "#7c3aed", margin: "0 0 8px 0", display: "flex", alignItems: "center", gap: 6 }}>
                  <BookOpen size={16} /> Thuật ngữ hôm nay
                </h4>
                <div style={{
                  padding: "12px 14px", borderRadius: 8, background: "#f5f3ff",
                  borderLeft: "3px solid #8b5cf6",
                }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#6d28d9" }}>📖 {vocab.term}</div>
                  <div style={{ fontSize: 12, color: "#4b5563", marginTop: 4, lineHeight: 1.5 }}>{vocab.definition}</div>
                </div>
              </div>
            )}

            {/* Nguồn */}
            {sources.length > 0 && (
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: "#6b7280", margin: "0 0 6px 0" }}>🔗 Nguồn tham khảo</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {sources.map((link, i) => (
                    <a key={i} href={link} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 12, color: "#3b82f6", wordBreak: "break-all", textDecoration: "none" }}
                      onMouseEnter={e => e.target.style.textDecoration = "underline"}
                      onMouseLeave={e => e.target.style.textDecoration = "none"}
                    >
                      {link}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
        <Newspaper size={22} color="#2563eb" /> Điểm tin BĐS & Học tập
      </h2>
      <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
        Tin tức bất động sản Việt Nam được AI tổng hợp hàng ngày
      </p>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: "2px solid #e5e7eb", paddingBottom: 0 }}>
        {[
          { key: "latest", label: "Hôm nay", icon: Sparkles },
          { key: "history", label: "Lịch sử", icon: Clock },
          ...(isAdmin ? [{ key: "settings", label: "Cài đặt", icon: Settings }] : []),
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              padding: "8px 16px", fontSize: 13, fontWeight: tab === t.key ? 700 : 500,
              color: tab === t.key ? "#2563eb" : "#6b7280",
              background: "none", border: "none", cursor: "pointer",
              borderBottom: tab === t.key ? "2px solid #2563eb" : "2px solid transparent",
              marginBottom: -2, display: "flex", alignItems: "center", gap: 4,
            }}>
            {React.createElement(t.icon, { size: 14 })} {t.label}
          </button>
        ))}
      </div>

      {msg && (
        <div style={{
          padding: "8px 14px", borderRadius: 8, marginBottom: 12, fontSize: 13, fontWeight: 600,
          background: msg.type === "ok" ? "#d1fae5" : "#fee2e2",
          color: msg.type === "ok" ? "#065f46" : "#991b1b",
        }}>
          {msg.text}
        </div>
      )}

      {/* Tab: Hôm nay */}
      {tab === "latest" && (
        <div>
          {isAdmin && (
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
              <button onClick={handleFetchNow} disabled={fetching}
                style={{
                  padding: "8px 16px", borderRadius: 8, border: "none", cursor: fetching ? "default" : "pointer",
                  background: fetching ? "#d1d5db" : "#2563eb", color: "#fff", fontWeight: 600, fontSize: 13,
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                <RefreshCw size={14} className={fetching ? "spin" : ""} />
                {fetching ? "Đang lấy tin..." : "Lấy tin ngay"}
              </button>
              {!hasApiKey && (
                <span style={{ fontSize: 12, color: "#ef4444", fontWeight: 600 }}>
                  ⚠️ Chưa cấu hình API key Perplexity. Vào tab Cài đặt để thêm.
                </span>
              )}
            </div>
          )}

          {latest ? renderNewsCard(latest, true) : (
            <div style={cardStyle}>
              <div style={{ textAlign: "center", padding: "40px 20px", color: "#9ca3af" }}>
                <Newspaper size={48} style={{ marginBottom: 8, opacity: 0.3 }} />
                <div style={{ fontSize: 14, fontWeight: 600 }}>Chưa có tin tức hôm nay</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>
                  {isAdmin ? "Bấm \"Lấy tin ngay\" hoặc chờ hệ thống tự động lấy" : "Tin tức sẽ được cập nhật tự động hàng ngày"}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Lịch sử */}
      {tab === "history" && (
        <div>
          {news.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: "center", padding: 40, color: "#9ca3af" }}>
              Chưa có lịch sử tin tức
            </div>
          ) : (
            <>
              {news.map(item => renderNewsCard(item))}
              {totalPages > 1 && (
                <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 12 }}>
                  <button onClick={() => { setPage(p => p - 1); loadHistory(page - 1); }} disabled={page <= 1}
                    style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff", cursor: page <= 1 ? "default" : "pointer", color: page <= 1 ? "#d1d5db" : "#374151", fontSize: 13 }}>
                    ← Trước
                  </button>
                  <span style={{ padding: "6px 12px", fontSize: 13, color: "#6b7280" }}>
                    Trang {page}/{totalPages}
                  </span>
                  <button onClick={() => { setPage(p => p + 1); loadHistory(page + 1); }} disabled={page >= totalPages}
                    style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff", cursor: page >= totalPages ? "default" : "pointer", color: page >= totalPages ? "#d1d5db" : "#374151", fontSize: 13 }}>
                    Sau →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Tab: Cài đặt (admin) */}
      {tab === "settings" && isAdmin && (
        <div>
          <div style={cardStyle}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
              <Settings size={16} /> Cấu hình Perplexity AI
            </h3>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>
                API Key Perplexity
              </label>
              <input
                type="password" placeholder={hasApiKey ? "••••••••• (đã lưu, nhập mới để thay đổi)" : "pplx-xxxxxxxx"}
                value={apiKey} onChange={e => setApiKey(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, boxSizing: "border-box" }}
              />
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
                Lấy API key tại <a href="https://www.perplexity.ai/settings/api" target="_blank" rel="noopener noreferrer" style={{ color: "#3b82f6" }}>perplexity.ai/settings/api</a>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>
                Thời gian tự động lấy tin
              </label>
              <input
                type="time" value={autoFetchTime} onChange={e => setAutoFetchTime(e.target.value)}
                style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
              />
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
                Hệ thống sẽ tự động lấy tin mỗi ngày vào giờ này (mặc định 07:00)
              </div>
            </div>

            <button onClick={handleSaveSettings} disabled={savingSettings}
              style={{
                padding: "8px 20px", borderRadius: 8, border: "none", cursor: savingSettings ? "default" : "pointer",
                background: savingSettings ? "#d1d5db" : "#2563eb", color: "#fff", fontWeight: 600, fontSize: 13,
                display: "flex", alignItems: "center", gap: 6,
              }}>
              <Save size={14} /> {savingSettings ? "Đang lưu..." : "Lưu cài đặt"}
            </button>
          </div>

          {/* Hướng dẫn */}
          <div style={{ ...cardStyle, background: "#f8fafc" }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: "#374151" }}>📖 Hướng dẫn lấy API Key Perplexity</h4>
            <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "#4b5563", lineHeight: 2 }}>
              <li>Truy cập <a href="https://www.perplexity.ai" target="_blank" rel="noopener noreferrer" style={{ color: "#3b82f6" }}>perplexity.ai</a> và đăng ký/đăng nhập</li>
              <li>Vào <strong>Settings → API</strong> hoặc truy cập trực tiếp <a href="https://www.perplexity.ai/settings/api" target="_blank" rel="noopener noreferrer" style={{ color: "#3b82f6" }}>perplexity.ai/settings/api</a></li>
              <li>Click <strong>"Generate API Key"</strong> để tạo key mới</li>
              <li>Copy key (bắt đầu bằng <code style={{ background: "#e5e7eb", padding: "1px 4px", borderRadius: 4 }}>pplx-</code>) và dán vào ô phía trên</li>
              <li>Perplexity tính phí theo lượt gọi API (~$5/1000 lượt). Với 1 lượt/ngày thì rất tiết kiệm</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===== CAPI Settings Page ===== */
function CapiSettingsPage() {
  const [pixelId, setPixelId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [events, setEvents] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testCode, setTestCode] = useState("");
  const [logs, setLogs] = useState([]);
  const [showLogs, setShowLogs] = useState(false);
  const [msg, setMsg] = useState(null);

  const defaultEvents = {
    closed: "Purchase",
    booked: "InitiateCheckout",
    booking_other: "InitiateCheckout",
    appointment: "Schedule",
    interested: "Lead",
  };

  const fbEventOptions = ["Purchase", "Lead", "InitiateCheckout", "Schedule", "CompleteRegistration", "ViewContent", "AddToCart", "AddToWishlist", "Contact", "Subscribe", ""];

  useEffect(() => {
    apiFetch(`${API}/capi-settings`).then(r => r.json()).then(d => {
      setPixelId(d.pixelId || "");
      setEvents(d.events || defaultEvents);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true); setMsg(null);
    try {
      const body = { pixelId, events };
      if (accessToken) body.accessToken = accessToken;
      const res = await apiFetch(`${API}/capi-settings`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) { setMsg({ type: "ok", text: "Đã lưu cấu hình CAPI" }); setAccessToken(""); }
      else { const e = await res.json(); setMsg({ type: "err", text: e.error || "Lỗi" }); }
    } catch { setMsg({ type: "err", text: "Lỗi kết nối" }); }
    setSaving(false);
  };

  const handleTest = async () => {
    setTesting(true); setTestResult(null);
    try {
      const res = await apiFetch(`${API}/capi-test`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ testCode }) });
      const d = await res.json();
      if (res.ok) setTestResult({ ok: true, text: `Thành công! Events received: ${d.events_received}` });
      else setTestResult({ ok: false, text: d.error || "Lỗi" });
    } catch { setTestResult({ ok: false, text: "Lỗi kết nối" }); }
    setTesting(false);
  };

  const loadLogs = async () => {
    try {
      const res = await apiFetch(`${API}/capi-log`);
      const d = await res.json();
      setLogs(Array.isArray(d) ? d : []);
      setShowLogs(true);
    } catch { setLogs([]); setShowLogs(true); }
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Đang tải...</div>;

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
        <Zap size={22} color="#f59e0b" /> Facebook Conversions API (CAPI)
      </h2>
      <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>
        Tự động gửi sự kiện về Meta khi lead thay đổi trạng thái. Facebook ghi nhận để tối ưu quảng cáo — khách hàng <strong>không thấy gì</strong>.
      </p>

      {msg && <div style={{ padding: "8px 14px", borderRadius: 8, marginBottom: 12, fontSize: 13, background: msg.type === "ok" ? "#f0fdf4" : "#fef2f2", color: msg.type === "ok" ? "#16a34a" : "#dc2626", border: `1px solid ${msg.type === "ok" ? "#bbf7d0" : "#fca5a5"}` }}>{msg.text}</div>}

      {/* Hướng dẫn chi tiết */}
      <div style={{ background: "#fffbeb", borderRadius: 12, padding: 20, border: "1px solid #fde68a", marginBottom: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: "#92400e" }}>📖 Hướng dẫn lấy Pixel ID & Access Token</h3>

        <div style={{ fontSize: 13, color: "#78350f", lineHeight: 1.8 }}>
          <p style={{ fontWeight: 700, marginBottom: 4 }}>Bước 1: Lấy Pixel ID</p>
          <ol style={{ paddingLeft: 20, margin: "0 0 12px 0" }}>
            <li>Mở <a href="https://business.facebook.com/events_manager" target="_blank" rel="noreferrer" style={{ color: "#2563eb", fontWeight: 600 }}>Meta Events Manager</a></li>
            <li>Ở cột bên trái, chọn <strong>Data Sources</strong> (Nguồn dữ liệu)</li>
            <li>Nếu chưa có Pixel, bấm <strong>"Connect Data Sources"</strong> → chọn <strong>"Web"</strong> → đặt tên → bấm <strong>"Create"</strong></li>
            <li>Click vào Pixel đã tạo → <strong>Pixel ID</strong> là dãy số hiện ngay dưới tên (ví dụ: <code style={{ background: "#fef3c7", padding: "1px 6px", borderRadius: 4 }}>881080645083795</code>)</li>
            <li>Copy dãy số đó dán vào ô <strong>"Pixel ID"</strong> bên dưới</li>
          </ol>

          <p style={{ fontWeight: 700, marginBottom: 4 }}>Bước 2: Lấy Access Token</p>
          <ol style={{ paddingLeft: 20, margin: "0 0 12px 0" }}>
            <li>Trong Events Manager, click vào Pixel của bạn</li>
            <li>Bấm tab <strong>"Settings"</strong> (Cài đặt) ở thanh ngang phía trên</li>
            <li>Kéo xuống phần <strong>"Conversions API"</strong></li>
            <li>Bấm <strong>"Generate access token"</strong> (Tạo token truy cập)</li>
            <li>Một chuỗi dài sẽ hiện ra → <strong>copy ngay</strong> vì nó chỉ hiện 1 lần duy nhất</li>
            <li>Dán vào ô <strong>"Access Token"</strong> bên dưới</li>
          </ol>

          <p style={{ fontWeight: 700, marginBottom: 4 }}>Bước 3: Kiểm tra kết nối (Test Event)</p>
          <ol style={{ paddingLeft: 20, margin: "0 0 8px 0" }}>
            <li>Trong Events Manager → click Pixel → bấm tab <strong>"Test Events"</strong> (Kiểm tra sự kiện)</li>
            <li>Sẽ thấy mã <strong>Test Event Code</strong> dạng <code style={{ background: "#fef3c7", padding: "1px 6px", borderRadius: 4 }}>TEST12345</code></li>
            <li>Copy mã đó dán vào ô "Test Event Code" ở phần <strong>Kiểm tra kết nối</strong> bên dưới</li>
            <li>Bấm <strong>"Gửi test event"</strong> → nếu thành công, quay lại Events Manager sẽ thấy event hiện trong tab Test Events</li>
          </ol>

          <p style={{ fontSize: 12, color: "#92400e", background: "#fef3c7", padding: "6px 10px", borderRadius: 6, marginTop: 8 }}>
            💡 <strong>Lưu ý:</strong> Pixel ID là từ trang "Trung tâm khách hàng tiềm năng" (Lead Center) mà bạn đang dùng. 
            Số trên URL của bạn (<code style={{ fontWeight: 600 }}>asset_id=881080645083795</code>) chính là Pixel/Dataset ID. Bạn có thể dùng luôn số đó.
          </p>
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, padding: 20, border: "1px solid #e5e7eb", marginBottom: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>🔧 Cấu hình cơ bản</h3>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Pixel ID</label>
          <input value={pixelId} onChange={e => setPixelId(e.target.value)} placeholder="Ví dụ: 123456789012345"
            style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, boxSizing: "border-box" }} />
          <span style={{ fontSize: 11, color: "#9ca3af" }}>Dãy số 15 chữ số từ Events Manager (xem hướng dẫn Bước 1 ở trên)</span>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Access Token (CAPI)</label>
          <input value={accessToken} onChange={e => setAccessToken(e.target.value)} placeholder="Nhập token mới (bỏ trống = giữ nguyên token cũ)" type="password"
            style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, boxSizing: "border-box" }} />
          <span style={{ fontSize: 11, color: "#9ca3af" }}>Chuỗi dài từ Events Manager → Settings → Generate access token (xem Bước 2)</span>
        </div>
        <button onClick={handleSave} disabled={saving}
          style={{ padding: "8px 20px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13, opacity: saving ? 0.6 : 1 }}>
          {saving ? "Đang lưu..." : "💾 Lưu cấu hình"}
        </button>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, padding: 20, border: "1px solid #e5e7eb", marginBottom: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>📡 Mapping sự kiện</h3>
        <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 12 }}>Khi lead chuyển sang trạng thái nào → gửi event gì về Meta. Bỏ trống = không gửi.</p>
        <div style={{ display: "grid", gap: 8 }}>
          {Object.entries(STATUS_LABELS).filter(([k]) => !["new", "called", "spam", "wrong_phone", "wrong_number", "hung_up", "blocked", "lost"].includes(k)).map(([key, label]) => (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 500, minWidth: 180, color: STATUS_COLORS[key] || "#374151" }}>{label}</span>
              <span style={{ color: "#9ca3af", fontSize: 12 }}>→</span>
              <select value={events[key] || ""} onChange={e => setEvents(prev => ({ ...prev, [key]: e.target.value }))}
                style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 12, minWidth: 160 }}>
                <option value="">Không gửi</option>
                {fbEventOptions.filter(Boolean).map(ev => <option key={ev} value={ev}>{ev}</option>)}
              </select>
            </div>
          ))}
        </div>
        <button onClick={handleSave} disabled={saving} style={{ marginTop: 12, padding: "6px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 12 }}>
          💾 Lưu mapping
        </button>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, padding: 20, border: "1px solid #e5e7eb", marginBottom: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>🧪 Kiểm tra kết nối</h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <input value={testCode} onChange={e => setTestCode(e.target.value)} placeholder="Test Event Code (tùy chọn, từ Events Manager)"
            style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }} />
          <button onClick={handleTest} disabled={testing}
            style={{ padding: "8px 16px", background: "#059669", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13, whiteSpace: "nowrap" }}>
            {testing ? "Đang test..." : "⚡ Gửi test event"}
          </button>
        </div>
        {testResult && (
          <div style={{ padding: "8px 14px", borderRadius: 8, fontSize: 13, background: testResult.ok ? "#f0fdf4" : "#fef2f2", color: testResult.ok ? "#16a34a" : "#dc2626" }}>
            {testResult.text}
          </div>
        )}
        <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 8 }}>
          Mở <a href="https://business.facebook.com/events_manager" target="_blank" rel="noreferrer" style={{ color: "#2563eb" }}>Events Manager</a> → Test Events → lấy Test Event Code để xác minh sự kiện đã nhận đúng.
        </p>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, padding: 20, border: "1px solid #e5e7eb" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600 }}>📊 Lịch sử gửi events</h3>
          <button onClick={loadLogs} style={{ padding: "6px 14px", background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 500 }}>
            🔄 Tải log
          </button>
        </div>
        {showLogs && (
          logs.length === 0 ? <p style={{ fontSize: 13, color: "#9ca3af" }}>Chưa có event nào được gửi.</p> : (
            <div style={{ maxHeight: 300, overflowY: "auto" }}>
              <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f9fafb" }}>
                    <th style={{ padding: "6px 8px", textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>Thời gian</th>
                    <th style={{ padding: "6px 8px", textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>Event</th>
                    <th style={{ padding: "6px 8px", textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>Lead</th>
                    <th style={{ padding: "6px 8px", textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>Dự án</th>
                    <th style={{ padding: "6px 8px", textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>Kết quả</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(l => {
                    const result = (() => { try { return JSON.parse(l.result || "{}"); } catch { return {}; } })();
                    const ok = result.events_received > 0;
                    return (
                      <tr key={l.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>{l.created_at || "-"}</td>
                        <td style={{ padding: "6px 8px" }}><span style={{ padding: "2px 8px", borderRadius: 8, background: "#eff6ff", color: "#2563eb", fontWeight: 600, fontSize: 11 }}>{l.event_name}</span></td>
                        <td style={{ padding: "6px 8px" }}>{l.lead_name || "-"}</td>
                        <td style={{ padding: "6px 8px" }}>{l.project || "-"}</td>
                        <td style={{ padding: "6px 8px" }}><span style={{ color: ok ? "#16a34a" : "#dc2626", fontWeight: 600 }}>{ok ? "✅" : "❌"}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
}
/* ===== Guide Page ===== */
function GuidePage() {
  const [openSection, setOpenSection] = useState(null);
  const toggle = (key) => setOpenSection(prev => prev === key ? null : key);

  const sections = [
    {
      key: "overview",
      icon: "🏠",
      title: "Tổng quan hệ thống",
      content: [
        { type: "text", value: "CRM IQI là hệ thống quản lý khách hàng tiềm năng (lead) tích hợp Google Sheet, Telegram Bot và Facebook Messenger." },
        { type: "mindmap", items: [
          { label: "CRM IQI", level: 0 },
          { label: "Quản lý Lead (Khách hàng)", level: 1 },
          { label: "Chia lead tự động & thủ công", level: 1 },
          { label: "Đồng bộ Google Sheet", level: 1 },
          { label: "Telegram Bot thông báo", level: 1 },
          { label: "Backup & Khôi phục", level: 1 },
          { label: "Quản lý dự án đa dự án", level: 1 },
          { label: "Dashboard & Báo cáo", level: 1 },
          { label: "Chat nội bộ", level: 1 },
          { label: "Quản lý bài đăng & Lịch", level: 1 },
        ]},
        { type: "roles", items: [
          { role: "Admin", color: "#dc2626", desc: "Toàn quyền: quản lý dự án, user, chia lead, backup, cấu hình Sheet/Telegram" },
          { role: "Manager", color: "#d97706", desc: "Xem lead dự án được gán, quản lý sale, không thấy nút backup/khôi phục" },
          { role: "Sale", color: "#059669", desc: "Chỉ xem lead được chia cho mình, cập nhật trạng thái/feedback" },
        ]},
      ]
    },
    {
      key: "leads",
      icon: "👥",
      title: "Quản lý khách hàng (Lead)",
      content: [
        { type: "text", value: "Lead được import từ Google Sheet hoặc thêm thủ công. Mỗi lead có trạng thái, sale phụ trách, quản lý, và lịch sử liên hệ." },
        { type: "steps", title: "Quy trình xử lý lead", items: [
          "Lead mới từ Sheet → trạng thái \"Mới\"",
          "Admin chia lead cho Sale (thủ công hoặc lịch tự động)",
          "Sale nhận thông báo Telegram với nút feedback",
          "Sale bấm nút trạng thái trên Telegram → CRM tự cập nhật",
          "Hoặc Sale vào CRM cập nhật trạng thái & ghi chú",
        ]},
        { type: "statuses", title: "21 trạng thái lead", items: [
          { key: "new", label: "Mới", color: "#e88a2e" },
          { key: "called", label: "Đã gọi", color: "#3b82f6" },
          { key: "interested", label: "Quan tâm", color: "#8b5cf6" },
          { key: "low_interest", label: "QT hời hợt", color: "#a78bfa" },
          { key: "other_project", label: "QT DA khác", color: "#6366f1" },
          { key: "appointment", label: "Hẹn xem", color: "#0ea5e9" },
          { key: "booked", label: "Giữ chỗ", color: "#14b8a6" },
          { key: "closed", label: "Chốt", color: "#059669" },
          { key: "not_interested", label: "Không QT", color: "#6b7280" },
          { key: "spam", label: "Phá/rác", color: "#ef4444" },
          { key: "weak_finance", label: "TC yếu", color: "#f59e0b" },
          { key: "unreachable", label: "Chưa LLĐ", color: "#94a3b8" },
          { key: "callback", label: "Gọi lại sau", color: "#f97316" },
          { key: "wrong_number", label: "Sai số", color: "#9ca3af" },
          { key: "blocked", label: "Chặn", color: "#991b1b" },
          { key: "has_sale", label: "Có sale khác", color: "#7c3aed" },
          { key: "lost", label: "Mất", color: "#374151" },
        ]},
        { type: "tip", value: "💡 Lead có badge nhiệt độ: Cực nóng (≤24h), Nóng (≤72h), Ấm (≤7 ngày), Lạnh (>7 ngày) — dựa trên ngày tạo lead." },
      ]
    },
    {
      key: "distribution",
      icon: "🔀",
      title: "Chia lead cho Sale",
      content: [
        { type: "text", value: "Có 2 cách chia lead: Thủ công (chia ngay) và Lịch tự động (chia theo khung giờ hàng ngày)." },
        { type: "mindmap", items: [
          { label: "Chia Lead", level: 0 },
          { label: "Thủ công (Shuffle)", level: 1 },
          { label: "Chọn dự án → filter → chọn lead → chọn sale → Chia ngay", level: 2 },
          { label: "Round-robin đều cho mỗi sale", level: 2 },
          { label: "Lịch tự động (Schedule)", level: 1 },
          { label: "Set số lead/ngày/người + khung giờ", level: 2 },
          { label: "Hệ thống tự chia đúng giờ", level: 2 },
          { label: "Tour xoay vòng sale qua nhiều ngày", level: 2 },
        ]},
        { type: "steps", title: "Cách tạo lịch chia tự động", items: [
          "Vào tab Khách hàng → mở panel Chia Lead",
          "Chọn dự án, filter trạng thái/nhu cầu/ngày",
          "Chọn số lượng lead hoặc chọn tất cả",
          "Chọn danh sách Sale tham gia",
          "Set: Ngày bắt đầu, ngày kết thúc, số lead/ngày/người",
          "Thêm khung giờ chia (VD: 08:00, 14:00, 18:00)",
          "Bấm \"Tạo lịch chia\" → hệ thống tự chạy",
        ]},
        { type: "warning", value: "⚠️ Phân phối chính xác: VD 5 lead/ngày chia 3 khung giờ → slot 1: 2 lead, slot 2: 2 lead, slot 3: 1 lead. Không bao giờ vượt số được set." },
        { type: "tip", value: "💡 Nếu chạy 2 lịch song song cùng dự án, lead đã chia cho sale A sẽ không chia trùng lại cho sale A — hệ thống tự bỏ qua." },
        { type: "steps", title: "Tăng hiệu suất (sửa lịch đang chạy)", items: [
          "Bấm xem chi tiết lịch chia → bấm nút \"Tăng hiệu suất\"",
          "Sửa số lead/ngày/người hoặc thêm/bớt khung giờ",
          "Bấm Lưu → áp dụng ngay từ slot tiếp theo",
        ]},
      ]
    },
    {
      key: "telegram",
      icon: "📱",
      title: "Telegram Bot",
      content: [
        { type: "text", value: "Telegram Bot gửi thông báo lead mới cho Sale kèm nút feedback trạng thái trực tiếp." },
        { type: "steps", title: "Cách cài đặt Telegram Bot", items: [
          "Tạo bot trên @BotFather → lấy Token",
          "Vào CRM → Cấu hình Sheet → tab Telegram Bots",
          "Thêm bot: nhập tên + token + chọn dự án",
          "Bấm \"Thiết lập Webhook\" → copy URL webhook",
          "Sale nhắn /start cho bot → hệ thống tự nhận diện",
        ]},
        { type: "mindmap", items: [
          { label: "Telegram Flow", level: 0 },
          { label: "Lead được chia → Bot gửi tin nhắn cho Sale", level: 1 },
          { label: "Tin nhắn có 16 nút trạng thái", level: 2 },
          { label: "Sale bấm nút → CRM cập nhật trạng thái", level: 2 },
          { label: "Bot hỏi feedback → Sale nhập text → CRM lưu", level: 2 },
          { label: "Thu hồi lead → Bot xóa tin nhắn cũ + gửi thông báo", level: 1 },
        ]},
        { type: "warning", value: "⚠️ Mỗi sale cần nhắn /start cho bot trước khi nhận thông báo. Telegram ID phải khớp với tài khoản CRM." },
      ]
    },
    {
      key: "sync",
      icon: "🔄",
      title: "Đồng bộ Google Sheet",
      content: [
        { type: "text", value: "Hệ thống tự đồng bộ dữ liệu lead từ Google Sheet mỗi 3 phút. Có thể đồng bộ thủ công bất cứ lúc nào." },
        { type: "steps", title: "Cách cấu hình Sheet", items: [
          "Vào Cấu hình Sheet → chọn dự án",
          "Dán URL Google Sheet (phải publish ra web: File → Share → Publish to web)",
          "Sheet lead: chứa cột Họ tên, SĐT, Nhu cầu, Trạng thái",
          "Sheet chi phí (tuỳ chọn): cột Ngày, Tổng tiền chi tiêu, Tổng số lead",
          "Bấm Lưu → Đồng bộ ngay",
        ]},
        { type: "tip", value: "💡 Khi đồng bộ, CRM luôn giữ nguyên trạng thái + sale đã sửa trên CRM. Sheet chỉ thêm lead mới, không ghi đè dữ liệu CRM." },
        { type: "warning", value: "⚠️ Trước mỗi lần đồng bộ, hệ thống tự backup dữ liệu cũ. Nếu có lỗi, dùng chức năng Khôi phục để lấy lại." },
      ]
    },
    {
      key: "backup",
      icon: "💾",
      title: "Backup & Khôi phục",
      content: [
        { type: "text", value: "Hệ thống có 3 lớp backup tự động + nhiều cách khôi phục dữ liệu." },
        { type: "mindmap", items: [
          { label: "Backup & Recovery", level: 0 },
          { label: "Auto Backup", level: 1 },
          { label: "Backup trước mỗi lần đồng bộ Sheet (settings table)", level: 2 },
          { label: "Backup file DB mỗi 8 giờ + khi khởi động server", level: 2 },
          { label: "Giữ backup 7 ngày gần nhất", level: 2 },
          { label: "Khôi phục", level: 1 },
          { label: "Khôi phục chọn lọc: chọn file backup + dự án cụ thể", level: 2 },
          { label: "Khôi phục từ lịch sử: lấy lại sale/trạng thái từ history", level: 2 },
          { label: "Khôi phục từ DB backup: toàn bộ dữ liệu từ file .db", level: 2 },
        ]},
        { type: "steps", title: "Cách khôi phục chọn lọc", items: [
          "Vào Khách hàng → mở panel Khôi phục (chỉ Admin thấy)",
          "Bấm \"Khôi phục chọn lọc từ backup\"",
          "Bước 1: Chọn dự án cần khôi phục",
          "Bước 2: Chọn file backup (hiển thị ngày + dung lượng)",
          "Bấm Khôi phục → chỉ khôi phục sale + trạng thái cho dự án đó",
        ]},
        { type: "tip", value: "💡 Khôi phục là additive (cộng dồn), không xoá dữ liệu hiện tại. Có thể khôi phục nhiều lần từ các backup khác nhau." },
      ]
    },
    {
      key: "schedule_detail",
      icon: "📅",
      title: "Lịch chia lead - Chi tiết",
      content: [
        { type: "text", value: "Mỗi lịch chia có: dự án, danh sách sale, pool lead, số lead/ngày/người, khung giờ, và hệ thống Tour xoay vòng." },
        { type: "mindmap", items: [
          { label: "Lịch chia lead", level: 0 },
          { label: "Cấu hình", level: 1 },
          { label: "leads_per_day: số lead mỗi sale nhận/ngày", level: 2 },
          { label: "distribute_time: khung giờ chia (VD: 08:00, 14:00)", level: 2 },
          { label: "start_date → end_date: khoảng ngày hoạt động", level: 2 },
          { label: "sale_names: danh sách sale tham gia", level: 2 },
          { label: "Tour System", level: 1 },
          { label: "Tour 1: Sale A nhận lead 1-5, Sale B nhận 6-10...", level: 2 },
          { label: "Tour 2: Sale B nhận lead 1-5, Sale C nhận 6-10... (xoay)", level: 2 },
          { label: "Đảm bảo công bằng qua nhiều ngày", level: 2 },
          { label: "Bảo vệ", level: 1 },
          { label: "Không vượt quá số lead/ngày/người đã set", level: 2 },
          { label: "Không chia trùng lead cho cùng 1 sale", level: 2 },
          { label: "Chia đều khi lead không đủ (chênh lệch max 1)", level: 2 },
        ]},
        { type: "table", title: "Ví dụ: 50 lead/ngày, 8 slot, 27 sale", headers: ["Tham số", "Giá trị", "Giải thích"], rows: [
          ["leads_per_day", "50", "Mỗi sale nhận 50 lead/ngày"],
          ["Số slot", "8", "Chia làm 8 đợt trong ngày"],
          ["Lead/slot/sale", "6 hoặc 7", "floor(50/8)=6, 2 slot đầu nhận 7"],
          ["Tổng/ngày/sale", "Đúng 50", "6×6 + 7×2 = 50 ✓"],
          ["Nếu còn 455 lead / 27 sale", "16-17/sale", "Chia đều, chênh max 1"],
        ]},
      ]
    },
    {
      key: "projects",
      icon: "🏗️",
      title: "Quản lý dự án",
      content: [
        { type: "text", value: "Mỗi dự án có sheet lead riêng, sheet chi phí riêng, và quản lý riêng. Admin gán manager vào dự án qua bảng user_projects." },
        { type: "steps", title: "Tạo dự án mới", items: [
          "Vào Dự án → Thêm dự án",
          "Nhập tên, URL Google Sheet lead, URL Sheet chi phí (tuỳ chọn)",
          "Lưu → Đồng bộ lần đầu",
          "Gán manager: Vào Quản lý tài khoản → sửa user → chọn dự án",
        ]},
        { type: "warning", value: "⚠️ Xoá dự án sẽ xoá TOÀN BỘ lead + lịch sử + lịch chia. Không thể hoàn tác. Hãy backup trước!" },
      ]
    },
    {
      key: "users_mgmt",
      icon: "👤",
      title: "Quản lý tài khoản",
      content: [
        { type: "text", value: "Admin tạo tài khoản cho Manager và Sale. Sale đăng nhập lần đầu phải đổi mật khẩu." },
        { type: "steps", title: "Tạo tài khoản sale nhanh", items: [
          "Vào Quản lý tài khoản → Tạo tự động từ lead",
          "Hệ thống quét tên sale trong Sheet → tạo tài khoản với mật khẩu mặc định",
          "Sale đăng nhập → bắt buộc đổi mật khẩu (8+ ký tự, có hoa/thường/số/đặc biệt)",
        ]},
        { type: "tip", value: "💡 Có thể gán Telegram ID cho sale trong phần sửa tài khoản. Sale cũng có thể tự cập nhật bằng cách nhắn /start cho bot." },
      ]
    },
    {
      key: "revoke",
      icon: "🚫",
      title: "Thu hồi lead",
      content: [
        { type: "text", value: "Admin có thể thu hồi lead đã chia bằng cách xoá entry \"Chia lead\" trong lịch sử." },
        { type: "steps", title: "Cách thu hồi lead", items: [
          "Click vào lead → mở lịch sử",
          "Tìm entry \"Chia lead\" → bấm nút xoá (🗑️)",
          "Hệ thống tự động: xoá tin nhắn Telegram của sale + gửi thông báo thu hồi",
          "Lead trở về sale trước đó (nếu có) hoặc về trạng thái chưa chia",
        ]},
        { type: "warning", value: "⚠️ Huỷ lịch chia (nút Huỷ) chỉ dừng lịch, KHÔNG thu hồi lead đã chia. Muốn thu hồi phải xoá từng entry lịch sử." },
      ]
    },
    {
      key: "filters",
      icon: "🔍",
      title: "Bộ lọc & Tìm kiếm",
      content: [
        { type: "text", value: "CRM hỗ trợ nhiều kiểu lọc: text search, trạng thái, nhu cầu (sản phẩm), ngày, quản lý." },
        { type: "mindmap", items: [
          { label: "Bộ lọc", level: 0 },
          { label: "Tìm kiếm text: tên, SĐT, chiến dịch, sale, nhu cầu", level: 1 },
          { label: "Tab trạng thái: 22 tab nhanh (tất cả + 21 trạng thái)", level: 1 },
          { label: "Nhu cầu: multi-select checkbox", level: 1 },
          { label: "Ngày: từ ngày → đến ngày", level: 1 },
          { label: "Quản lý: dropdown (chỉ admin/manager thấy)", level: 1 },
          { label: "Sắp xếp: click header cột", level: 1 },
        ]},
      ]
    },
  ];

  const renderContent = (items) => items.map((item, idx) => {
    if (item.type === "text") return <p key={idx} style={{ margin: "8px 0", lineHeight: 1.7, color: "#374151", fontSize: 14 }}>{item.value}</p>;
    if (item.type === "tip") return <div key={idx} style={{ margin: "10px 0", padding: "12px 16px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, fontSize: 13, color: "#166534", lineHeight: 1.6 }}>{item.value}</div>;
    if (item.type === "warning") return <div key={idx} style={{ margin: "10px 0", padding: "12px 16px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, fontSize: 13, color: "#92400e", lineHeight: 1.6 }}>{item.value}</div>;
    if (item.type === "steps") return (
      <div key={idx} style={{ margin: "12px 0" }}>
        {item.title && <div style={{ fontWeight: 700, fontSize: 13, color: "#1a3c20", marginBottom: 8 }}>{item.title}</div>}
        <div style={{ background: "#f8fafb", borderRadius: 8, padding: "12px 16px", border: "1px solid #e5e7eb" }}>
          {item.items.map((step, si) => (
            <div key={si} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: si < item.items.length - 1 ? 8 : 0 }}>
              <span style={{ minWidth: 24, height: 24, borderRadius: "50%", background: "#e88a2e", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{si + 1}</span>
              <span style={{ fontSize: 13, lineHeight: 1.6, color: "#374151", paddingTop: 2 }}>{step}</span>
            </div>
          ))}
        </div>
      </div>
    );
    if (item.type === "mindmap") return (
      <div key={idx} style={{ margin: "12px 0", background: "#f8fafb", borderRadius: 10, padding: 16, border: "1px solid #e5e7eb" }}>
        {item.items.map((node, ni) => {
          const colors = ["#1a3c20", "#e88a2e", "#6b7280"];
          const sizes = [16, 14, 12.5];
          const weights = [800, 600, 400];
          const ml = node.level * 28;
          return (
            <div key={ni} style={{ marginLeft: ml, marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: node.level === 0 ? 10 : 7, height: node.level === 0 ? 10 : 7, borderRadius: "50%", background: colors[node.level] || "#9ca3af", flexShrink: 0 }} />
              <span style={{ fontSize: sizes[node.level] || 12, fontWeight: weights[node.level] || 400, color: colors[node.level] || "#6b7280" }}>{node.label}</span>
            </div>
          );
        })}
      </div>
    );
    if (item.type === "roles") return (
      <div key={idx} style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "12px 0" }}>
        {item.items.map((r, ri) => (
          <div key={ri} style={{ flex: "1 1 200px", minWidth: 200, background: "#fff", border: `2px solid ${r.color}22`, borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: r.color, marginBottom: 4 }}>{r.role}</div>
            <div style={{ fontSize: 12.5, color: "#374151", lineHeight: 1.5 }}>{r.desc}</div>
          </div>
        ))}
      </div>
    );
    if (item.type === "statuses") return (
      <div key={idx} style={{ margin: "12px 0" }}>
        {item.title && <div style={{ fontWeight: 700, fontSize: 13, color: "#1a3c20", marginBottom: 8 }}>{item.title}</div>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {item.items.map((s, si) => (
            <span key={si} style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11.5, fontWeight: 600, background: s.color + "18", color: s.color, border: `1px solid ${s.color}33` }}>{s.label}</span>
          ))}
        </div>
      </div>
    );
    if (item.type === "table") return (
      <div key={idx} style={{ margin: "12px 0", overflowX: "auto" }}>
        {item.title && <div style={{ fontWeight: 700, fontSize: 13, color: "#1a3c20", marginBottom: 8 }}>{item.title}</div>}
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead><tr>{item.headers.map((h, hi) => <th key={hi} style={{ padding: "8px 12px", background: "#f0f4f1", borderBottom: "2px solid #c5d9c8", textAlign: "left", fontWeight: 700, color: "#1a3c20" }}>{h}</th>)}</tr></thead>
          <tbody>{item.rows.map((row, ri) => <tr key={ri}>{row.map((cell, ci) => <td key={ci} style={{ padding: "8px 12px", borderBottom: "1px solid #e5e7eb", color: "#374151" }}>{cell}</td>)}</tr>)}</tbody>
        </table>
      </div>
    );
    return null;
  });

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1a3c20", display: "flex", alignItems: "center", gap: 10, margin: 0 }}>
          <BookOpen size={24} /> Hướng dẫn sử dụng CRM
        </h1>
        <p style={{ color: "#6b7280", fontSize: 13, margin: "6px 0 0" }}>Tài liệu hướng dẫn chi tiết các tính năng và cơ chế hoạt động của hệ thống CRM IQI.</p>
      </div>

      {sections.map(sec => (
        <div key={sec.key} style={{ marginBottom: 8, borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden", background: openSection === sec.key ? "#fff" : "#fafbfc", transition: "background .2s" }}>
          <button
            onClick={() => toggle(sec.key)}
            style={{
              width: "100%", padding: "16px 20px", border: "none", background: "transparent",
              display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left",
            }}
          >
            <span style={{ fontSize: 22 }}>{sec.icon}</span>
            <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: "#1a3c20" }}>{sec.title}</span>
            <ChevronDown size={18} style={{ color: "#9ca3af", transition: "transform .2s", transform: openSection === sec.key ? "rotate(180deg)" : "rotate(0)" }} />
          </button>
          {openSection === sec.key && (
            <div style={{ padding: "0 20px 20px", borderTop: "1px solid #e5e7eb" }}>
              {renderContent(sec.content)}
            </div>
          )}
        </div>
      ))}
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
