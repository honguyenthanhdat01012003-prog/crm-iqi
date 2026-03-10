import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";

const API = "/api";

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
  callback: "#3b82f6",
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
  if (!d) return { label: "❄️ Lạnh", bg: "#f0f9ff", color: "#3b82f6", icon: "❄️" };
  const hours = (Date.now() - d.getTime()) / (1000 * 60 * 60);
  if (hours <= 24) return { label: "🔥🔥 Cực nóng", bg: "#fef2f2", color: "#dc2626", icon: "🔥🔥" };
  if (hours <= 72) return { label: "🔥 Nóng", bg: "#fff7ed", color: "#ea580c", icon: "🔥" };
  if (hours <= 168) return { label: "🌤️ Ấm", bg: "#fffbeb", color: "#d97706", icon: "🌤️" };
  return { label: "❄️ Lạnh", bg: "#f0f9ff", color: "#3b82f6", icon: "❄️" };
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
      background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      padding: 16,
    }}>
      <form onSubmit={handleSubmit} style={{
        background: "#fff", borderRadius: 16, padding: "32px 24px", width: 380, maxWidth: "100%",
        boxShadow: "0 20px 60px rgba(0,0,0,.3)",
      }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🏠</div>
          <h2 style={{ margin: 0, color: "#1a1a2e" }}>RealCRM</h2>
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
          }}>{showPwd ? "🙈" : "👁️"}</button>
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
      <span>{ok ? "✅" : "❌"}</span> {text}
    </div>
  );

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      padding: 16,
    }}>
      <form onSubmit={handleSubmit} style={{
        background: "#fff", borderRadius: 16, padding: "32px 24px", width: 420, maxWidth: "100%",
        boxShadow: "0 20px 60px rgba(0,0,0,.3)",
      }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🔐</div>
          <h2 style={{ margin: 0, color: "#1a1a2e" }}>Đổi mật khẩu</h2>
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
          }}>{showNew ? "🙈" : "👁️"}</button>
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
          }}>{showConfirm ? "🙈" : "👁️"}</button>
        </div>
        {confirmPwd && newPwd !== confirmPwd && (
          <div style={{ fontSize: 12, color: "#dc2626", marginBottom: 8 }}>❌ Mật khẩu xác nhận không khớp</div>
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
  const [page, setPage] = useState(isAdmin ? "dashboard" : "leads");
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
        alert("Đồng bộ thất bại: " + (err.error || r.statusText));
        return;
      }
      const data = await r.json();
      applyApiData(data);
      if (data.syncErrors && data.syncErrors.length) {
        alert("Đồng bộ hoàn tất nhưng có lỗi:\n\n" + data.syncErrors.join("\n"));
      }
    } catch (e) {
      console.error("Sync failed", e);
      alert("Đồng bộ thất bại: " + e.message);
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
        alert(err.error || "Lỗi khi lưu dự án");
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
      alert("Lỗi khi lưu dự án");
    } finally {
      setSavingProject(false);
      setProjectProgress("");
    }
  };

  const deleteProject = async (id) => {
    if (!confirm("Xóa dự án này?")) return;
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
    { key: "dashboard", label: "📊 Dashboard", adminOnly: true },
    { key: "leads", label: "👥 Khách hàng", adminOnly: false },
    { key: "projects", label: "🏗️ Dự án", adminOnly: true },
    { key: "campaigns", label: "📢 Chiến dịch", adminOnly: true },
    { key: "sales", label: "🏆 Sale", adminOnly: true },
    { key: "users", label: "👤 Quản lý tài khoản", adminOnly: true },
    { key: "profile", label: "🪪 Hồ sơ cá nhân", adminOnly: false },
    { key: "post_mgmt", label: "📝 Quản lý bài đăng", adminOnly: true, children: [
      { key: "posts", label: "📋 Tất cả bài" },
      { key: "calendar", label: "📅 Lịch đăng bài" },
      { key: "sheet_config", label: "⚙️ Cấu hình Sheet" },
    ]},
  ];

  const [openSubmenu, setOpenSubmenu] = useState("post_mgmt");

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
          width: isMobile ? 280 : (sidebarOpen ? 220 : 56),
          background: "linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)",
          color: "#fff",
          transition: isMobile ? "transform .25s ease" : "width .2s",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          ...(isMobile ? {
            position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 999,
            transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
            boxShadow: sidebarOpen ? "4px 0 20px rgba(0,0,0,.3)" : "none",
          } : {}),
        }}
      >
        <div
          style={{ padding: "16px 12px", cursor: "pointer", fontWeight: 700, fontSize: 18, whiteSpace: "nowrap", display: "flex", justifyContent: "space-between", alignItems: "center" }}
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          <span>{(isMobile || sidebarOpen) ? "🏠 RealCRM" : "☰"}</span>
          {isMobile && sidebarOpen && <span style={{ fontSize: 20, padding: 4 }}>✕</span>}
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
              return (
                <div key={n.key}>
                  <div
                    onClick={() => setOpenSubmenu(isOpen ? null : n.key)}
                    style={{
                      padding: isMobile ? "14px 16px" : "12px 16px",
                      cursor: "pointer",
                      background: isChildActive ? "rgba(255,255,255,.08)" : "transparent",
                      borderLeft: isChildActive ? "3px solid #3b82f6" : "3px solid transparent",
                      whiteSpace: "nowrap",
                      fontSize: isMobile ? 15 : 14,
                      transition: "background .15s",
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                    }}
                  >
                    <span>{(isMobile || sidebarOpen) ? n.label : n.label.slice(0, 2)}</span>
                    {(isMobile || sidebarOpen) && (
                      <span style={{ fontSize: 10, opacity: 0.6, transition: "transform .2s", transform: isOpen ? "rotate(180deg)" : "rotate(0)" }}>▼</span>
                    )}
                  </div>
                  {isOpen && (isMobile || sidebarOpen) && n.children.map(c => (
                    <div
                      key={c.key}
                      onClick={() => { setPage(c.key); if (isMobile) setSidebarOpen(false); }}
                      style={{
                        padding: isMobile ? "10px 16px 10px 36px" : "8px 16px 8px 36px",
                        cursor: "pointer",
                        background: page === c.key ? "rgba(255,255,255,.15)" : "transparent",
                        borderLeft: page === c.key ? "3px solid #60a5fa" : "3px solid transparent",
                        whiteSpace: "nowrap",
                        fontSize: isMobile ? 13 : 12,
                        transition: "background .15s",
                        opacity: 0.9,
                      }}
                    >
                      {c.label}
                    </div>
                  ))}
                </div>
              );
            }
            return (
              <div
                key={n.key}
                onClick={() => { setPage(n.key); if (isMobile) setSidebarOpen(false); }}
                style={{
                  padding: isMobile ? "14px 16px" : "12px 16px",
                  cursor: "pointer",
                  background: page === n.key ? "rgba(255,255,255,.12)" : "transparent",
                  borderLeft: page === n.key ? "3px solid #3b82f6" : "3px solid transparent",
                  whiteSpace: "nowrap",
                  fontSize: isMobile ? 15 : 14,
                  transition: "background .15s",
                }}
              >
                {(isMobile || sidebarOpen) ? n.label : n.label.slice(0, 2)}
              </div>
            );
          })}
        </nav>

        {(isMobile || sidebarOpen) && (
          <div style={{ padding: "12px", borderTop: "1px solid rgba(255,255,255,.1)" }}>
            <div style={{ fontSize: 13, marginBottom: 6, opacity: 0.9 }}>
              {user.displayName} <span style={{
                fontSize: 10, padding: "1px 6px", borderRadius: 8,
                background: user.role === "admin" ? "#ef4444" : "#3b82f6", color: "#fff",
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
              🚪 Đăng xuất
            </button>
            <div style={{ fontSize: 10, opacity: 0.5, marginTop: 6 }}>
              {lastSync ? `Sync: ${new Date(lastSync).toLocaleString("vi-VN")}` : "Chưa sync"}
            </div>
          </div>
        )}
      </aside>

      {/* Main */}
      <main style={{ flex: 1, padding: isMobile ? 12 : 24, overflow: "auto", minWidth: 0 }}>
        {/* Top bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: isMobile ? 12 : 20, gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            {isMobile && (
              <button onClick={() => setSidebarOpen(true)} style={{
                background: "#1a1a2e", color: "#fff", border: "none", borderRadius: 8,
                width: 40, height: 40, fontSize: 18, cursor: "pointer", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>☰</button>
            )}
            <h2 style={{ margin: 0, color: "#1a1a2e", fontSize: isMobile ? 16 : 20, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {visibleNav.find((n) => n.key === page)?.label || "Dashboard"}
            </h2>
          </div>
          {isAdmin && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* Notification bell + countdown */}
              <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <button onClick={() => setShowNotif(!showNotif)} style={{
                  background: notifications.length > 0 ? "#fef3c7" : "#f3f4f6", border: "1px solid #d1d5db",
                  borderRadius: 8, width: 40, height: 40, fontSize: 18, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
                }}>
                  🔔
                  {notifications.length > 0 && (
                    <span style={{
                      position: "absolute", top: -4, right: -4, background: "#ef4444", color: "#fff",
                      borderRadius: 10, padding: "0 5px", fontSize: 10, fontWeight: 700, minWidth: 18,
                      textAlign: "center", lineHeight: "18px", animation: "fadeIn .3s ease",
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
                        <b style={{ fontSize: 14 }}>🔔 Thông báo</b>
                        {notifications.length > 0 && (
                          <button onClick={markAllSeen} style={{ background: "none", border: "none", color: "#3b82f6", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
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
                                background: "#eff6ff", border: "1px solid #dbeafe", transition: "background .15s",
                              }} onClick={() => { setHighlightLeadId(n.id); setPage("leads"); setShowNotif(false); }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                                  <span style={{ background: "#10b981", color: "#fff", padding: "1px 8px", borderRadius: 8, fontSize: 10, fontWeight: 700, animation: "fadeIn .5s ease" }}>MỚI</span>
                                  <span style={{ fontWeight: 700, fontSize: 13 }}>{n.name}</span>
                                </div>
                                <div style={{ fontSize: 11, color: "#6b7280", display: "flex", gap: 8, flexWrap: "wrap" }}>
                                  <span>📱 {n.phone || "-"}</span>
                                  {proj && <span>🏗️ {proj.name}</span>}
                                  <span>📅 {n.createdAt || "-"}</span>
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
                }}>⏳</span>
                <span style={{
                  fontSize: 10, fontWeight: 700, marginTop: 1,
                  color: syncing ? "#3b82f6" : (syncCountdown <= 5 ? "#ef4444" : "#6b7280"),
                  fontVariantNumeric: "tabular-nums",
                }}>{syncing ? "..." : `${syncCountdown}s`}</span>
              </button>
            </div>
          )}
        </div>

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
        {page === "campaigns" && isAdmin && <CampaignsPage leads={filteredLeads} />}
        {page === "sales" && isAdmin && <SalesPage ranking={saleRanking} />}
        {page === "users" && isAdmin && <UsersPage projects={projects} leads={leads} />}
        {page === "profile" && <ProfilePage user={user} updateUser={updateUser} />}
        {page === "posts" && isAdmin && <PostsPage projects={projects} />}
        {page === "calendar" && isAdmin && <CalendarPage projects={projects} />}
        {page === "sheet_config" && isAdmin && <SheetConfigPage />}
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
      <ChatPopup currentUser={user} />
    </div>
  );
}

/* ===== Chat Popup - Facebook Style ===== */
function ChatPopup({ currentUser }) {
  const [open, setOpen] = useState(false);
  const [chatUsers, setChatUsers] = useState([]);
  const [activeChat, setActiveChat] = useState(null); // user object
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [totalUnread, setTotalUnread] = useState(0);
  const [sending, setSending] = useState(false);
  const msgEndRef = useRef(null);
  const pollRef = useRef(null);
  const inputRef = useRef(null);

  // Load chat users list
  const loadUsers = useCallback(async () => {
    try {
      const r = await apiFetch(`${API}/chat/users`);
      if (r.ok) {
        const data = await r.json();
        setChatUsers(data);
        setTotalUnread(data.reduce((s, u) => s + (u.unread || 0), 0));
      }
    } catch (e) { /* ignore */ }
  }, []);

  // Load messages for active chat
  const loadMessages = useCallback(async (userId) => {
    try {
      const r = await apiFetch(`${API}/chat/messages/${userId}`);
      if (r.ok) {
        const data = await r.json();
        setMessages(data);
        setTimeout(() => msgEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      }
    } catch (e) { /* ignore */ }
  }, []);

  // Poll for new messages in active chat
  const pollNew = useCallback(async () => {
    if (!activeChat) return;
    const lastId = messages.length > 0 ? messages[messages.length - 1].id : 0;
    try {
      const r = await apiFetch(`${API}/chat/new/${activeChat.id}?after=${lastId}`);
      if (r.ok) {
        const newMsgs = await r.json();
        if (newMsgs.length > 0) {
          setMessages(prev => [...prev, ...newMsgs]);
          setTimeout(() => msgEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        }
      }
    } catch (e) { /* ignore */ }
  }, [activeChat, messages]);

  // Load users on open
  useEffect(() => {
    if (open) { loadUsers(); }
  }, [open, loadUsers]);

  // Poll users list every 10 seconds when open
  useEffect(() => {
    if (!open) return;
    const iv = setInterval(loadUsers, 10000);
    return () => clearInterval(iv);
  }, [open, loadUsers]);

  // Poll new messages every 3 seconds when chatting
  useEffect(() => {
    if (!activeChat) return;
    pollRef.current = setInterval(pollNew, 3000);
    return () => clearInterval(pollRef.current);
  }, [activeChat, pollNew]);

  // Open a chat
  const openChat = (chatUser) => {
    setActiveChat(chatUser);
    setMessages([]);
    setDraft("");
    loadMessages(chatUser.id);
  };

  // Send message
  const sendMessage = async () => {
    if (!draft.trim() || !activeChat || sending) return;
    setSending(true);
    try {
      const r = await apiFetch(`${API}/chat/send`, {
        method: "POST",
        body: JSON.stringify({ receiverId: activeChat.id, content: draft.trim() }),
      });
      if (r.ok) {
        const msg = await r.json();
        setMessages(prev => [...prev, msg]);
        setDraft("");
        setTimeout(() => msgEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    } catch (e) { /* ignore */ }
    setSending(false);
  };

  const formatTime = (ts) => {
    if (!ts) return "";
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Vừa xong";
    if (diffMin < 60) return `${diffMin}p trước`;
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }) + " " + d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  };

  const isOnline = (u) => u.lastActive && (Date.now() - new Date(u.lastActive).getTime() < 5 * 60 * 1000);

  const onlineStatus = (u) => {
    if (isOnline(u)) return "Online";
    if (!u.lastActive) return "Offline";
    const diff = Math.floor((Date.now() - new Date(u.lastActive).getTime()) / 60000);
    if (diff < 60) return `${diff} phút trước`;
    if (diff < 1440) return `${Math.floor(diff / 60)} giờ trước`;
    return `${Math.floor(diff / 1440)} ngày trước`;
  };

  // Fixed button style
  const fabStyle = {
    position: "fixed", bottom: 20, right: 20, width: 52, height: 52,
    borderRadius: "50%", background: "linear-gradient(135deg, #0084ff, #0066cc)",
    color: "#fff", border: "none", cursor: "pointer", fontSize: 24,
    display: "flex", alignItems: "center", justifyContent: "center",
    boxShadow: "0 4px 16px rgba(0,0,0,.25)", zIndex: 9998,
    transition: "transform .2s",
  };

  // Popup container
  const popupStyle = {
    position: "fixed", bottom: 80, right: 20, width: 340, maxHeight: 500,
    background: "#fff", borderRadius: 16, boxShadow: "0 8px 32px rgba(0,0,0,.2)",
    display: "flex", flexDirection: "column", zIndex: 9999,
    animation: "fadeIn .2s ease", overflow: "hidden",
  };

  // Chat window style
  const chatWindowStyle = {
    position: "fixed", bottom: 80, right: 20, width: 340, height: 460,
    background: "#fff", borderRadius: 16, boxShadow: "0 8px 32px rgba(0,0,0,.2)",
    display: "flex", flexDirection: "column", zIndex: 9999,
    animation: "fadeIn .2s ease", overflow: "hidden",
  };

  // Render active chat window
  if (activeChat) {
    return (
      <>
        <div style={chatWindowStyle}>
          {/* Chat header */}
          <div style={{
            padding: "10px 12px", background: "linear-gradient(135deg, #0084ff, #0066cc)", color: "#fff",
            display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
          }}>
            <button onClick={() => { setActiveChat(null); loadUsers(); }} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 18, padding: 0 }}>←</button>
            <div style={{
              width: 32, height: 32, borderRadius: "50%", flexShrink: 0, position: "relative",
              background: activeChat.avatarUrl ? `url(${activeChat.avatarUrl}) center/cover` : "rgba(255,255,255,.2)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#fff",
            }}>
              {!activeChat.avatarUrl && (activeChat.displayName || "?")[0]?.toUpperCase()}
              <div style={{
                position: "absolute", bottom: -1, right: -1, width: 10, height: 10, borderRadius: "50%",
                background: isOnline(activeChat) ? "#44b700" : "#9ca3af", border: "2px solid #0084ff",
              }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{activeChat.displayName}</div>
              <div style={{ fontSize: 10, opacity: .85 }}>{onlineStatus(activeChat)}</div>
            </div>
            <button onClick={() => { setActiveChat(null); setOpen(false); }} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 16, padding: 0 }}>✕</button>
          </div>

          {/* Messages area */}
          <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px", background: "#f0f2f5", display: "flex", flexDirection: "column", gap: 4 }}>
            {messages.length === 0 && (
              <div style={{ textAlign: "center", color: "#9ca3af", fontSize: 12, marginTop: 40 }}>Bắt đầu cuộc trò chuyện 👋</div>
            )}
            {messages.map((msg, i) => {
              const isMine = msg.senderId === currentUser.id;
              const showDate = i === 0 || new Date(msg.createdAt).toDateString() !== new Date(messages[i - 1].createdAt).toDateString();
              return (
                <React.Fragment key={msg.id}>
                  {showDate && (
                    <div style={{ textAlign: "center", fontSize: 10, color: "#9ca3af", margin: "8px 0 4px" }}>
                      {new Date(msg.createdAt).toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit" })}
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: isMine ? "flex-end" : "flex-start" }}>
                    <div style={{
                      maxWidth: "75%", padding: "8px 12px", borderRadius: isMine ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                      background: isMine ? "#0084ff" : "#fff", color: isMine ? "#fff" : "#1c1e21",
                      fontSize: 13, lineHeight: 1.4, wordBreak: "break-word",
                      boxShadow: isMine ? "none" : "0 1px 2px rgba(0,0,0,.1)",
                    }}>
                      {msg.content}
                      <div style={{ fontSize: 9, opacity: .6, textAlign: "right", marginTop: 2 }}>
                        {new Date(msg.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
            <div ref={msgEndRef} />
          </div>

          {/* Input area */}
          <div style={{ padding: "8px 10px", borderTop: "1px solid #e4e6eb", display: "flex", gap: 8, alignItems: "center", background: "#fff", flexShrink: 0 }}>
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage())}
              placeholder="Aa..."
              style={{
                flex: 1, border: "1px solid #e4e6eb", borderRadius: 20, padding: "8px 14px",
                fontSize: 13, outline: "none", background: "#f0f2f5",
              }}
              autoFocus
            />
            <button
              onClick={sendMessage}
              disabled={!draft.trim() || sending}
              style={{
                width: 34, height: 34, borderRadius: "50%", border: "none",
                background: draft.trim() ? "#0084ff" : "#e4e6eb", color: draft.trim() ? "#fff" : "#bcc0c4",
                cursor: draft.trim() ? "pointer" : "default", fontSize: 16,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}
            >➤</button>
          </div>
        </div>
        {/* FAB hidden when chat is open */}
      </>
    );
  }

  return (
    <>
      {/* Floating Action Button */}
      <button onClick={() => setOpen(!open)} style={fabStyle} title="Chat">
        💬
        {totalUnread > 0 && (
          <span style={{
            position: "absolute", top: -4, right: -4, minWidth: 20, height: 20,
            borderRadius: 10, background: "#dc2626", color: "#fff", fontSize: 11,
            fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center",
            padding: "0 5px", border: "2px solid #fff",
          }}>{totalUnread > 99 ? "99+" : totalUnread}</span>
        )}
      </button>

      {/* Users list popup */}
      {open && (
        <div style={popupStyle}>
          <div style={{
            padding: "14px 16px 10px", borderBottom: "1px solid #e4e6eb",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span style={{ fontWeight: 700, fontSize: 18 }}>Chat</span>
            <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#65676b" }}>✕</button>
          </div>
          <div style={{ overflowY: "auto", maxHeight: 400 }}>
            {chatUsers.length === 0 && (
              <div style={{ textAlign: "center", color: "#9ca3af", fontSize: 13, padding: 30 }}>Không có người dùng nào</div>
            )}
            {chatUsers.map(u => (
              <div
                key={u.id}
                onClick={() => { openChat(u); }}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                  cursor: "pointer", transition: "background .15s",
                  background: u.unread > 0 ? "#eff6ff" : "transparent",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "#f0f2f5"}
                onMouseLeave={(e) => e.currentTarget.style.background = u.unread > 0 ? "#eff6ff" : "transparent"}
              >
                {/* Avatar with online dot */}
                <div style={{
                  width: 44, height: 44, borderRadius: "50%", flexShrink: 0, position: "relative",
                  background: u.avatarUrl ? `url(${u.avatarUrl}) center/cover` : "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#fff",
                }}>
                  {!u.avatarUrl && (u.displayName || "?")[0]?.toUpperCase()}
                  <div style={{
                    position: "absolute", bottom: 1, right: 1, width: 12, height: 12, borderRadius: "50%",
                    background: isOnline(u) ? "#44b700" : "#9ca3af", border: "2px solid #fff",
                  }} />
                </div>
                {/* Name + last message */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: u.unread > 0 ? 700 : 500, fontSize: 14,
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    color: "#1c1e21",
                  }}>{u.displayName} <span style={{ fontSize: 10, color: "#9ca3af", fontWeight: 400 }}>• {u.role === "admin" ? "Admin" : "Sale"}</span></div>
                  <div style={{
                    fontSize: 12, color: u.unread > 0 ? "#1c1e21" : "#65676b",
                    fontWeight: u.unread > 0 ? 600 : 400,
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {u.lastMessage ? (u.lastMessage.length > 30 ? u.lastMessage.slice(0, 30) + "..." : u.lastMessage) : <span style={{ fontStyle: "italic", color: "#bcc0c4" }}>Chưa có tin nhắn</span>}
                  </div>
                </div>
                {/* Unread badge + time */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                  {u.lastMessageTime && <span style={{ fontSize: 10, color: "#65676b" }}>{formatTime(u.lastMessageTime)}</span>}
                  {u.unread > 0 && (
                    <span style={{
                      minWidth: 18, height: 18, borderRadius: 9, background: "#0084ff", color: "#fff",
                      fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px",
                    }}>{u.unread}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

/* ===== Components ===== */

function Modal({ onClose, title, children }) {
  const isMobile = useIsMobile();
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,.45)",
        display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", zIndex: 999,
        animation: "fadeIn .2s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: isMobile ? "16px 16px 0 0" : 12,
          padding: isMobile ? "20px 16px 32px" : 24,
          width: isMobile ? "100%" : 460,
          maxWidth: "100%",
          maxHeight: isMobile ? "90vh" : "85vh",
          overflowY: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,.3)",
          animation: isMobile ? "slideUp .25s ease" : "fadeIn .2s ease",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: isMobile ? 17 : 16 }}>{title}</h3>
          {isMobile && <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, color: "#6b7280", cursor: "pointer", padding: 4 }}>✕</button>}
        </div>
        {children}
      </div>
    </div>
  );
}

function Card({ title, value, sub, color = "#3b82f6", percent, compact }) {
  return (
    <div
      style={{
        background: "#fff", borderRadius: compact ? 10 : 12, padding: compact ? 12 : 20,
        boxShadow: "0 1px 3px rgba(0,0,0,.08)",
        borderTop: `3px solid ${color}`,
      }}
    >
      <div style={{ fontSize: compact ? 11 : 12, color: "#6b7280", marginBottom: 2 }}>{title}</div>
      <div style={{ fontSize: compact ? 18 : 24, fontWeight: 700, color }}>{value}</div>
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
        <Card title="Tổng Lead" value={stats.total} color="#3b82f6" compact={isMobile} />
        {allCards.map((c) => (
          <Card key={c.title} title={c.title} value={c.value} color={c.color} percent={pct(c.value)} compact={isMobile} />
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fill, minmax(160px, 1fr))", gap: isMobile ? 8 : 16, marginBottom: isMobile ? 16 : 24 }}>
        <Card title="Chi phí" value={formatVND(cost.totalSpent)} sub={`CPL: ${formatVND(stats.total ? Math.round(cost.totalSpent / stats.total) : 0)}`} color="#8b5cf6" compact={isMobile} />
        <Card title="Booking" value={cost.totalBooking || 0} color="#ec4899" compact={isMobile} />
      </div>

      <div style={{ background: "#fff", borderRadius: 12, padding: isMobile ? 16 : 24, marginBottom: isMobile ? 16 : 24, boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
        <h4 style={{ margin: "0 0 16px", fontSize: isMobile ? 14 : 16, color: "#1f2937" }}>📊 Biểu đồ phân bổ trạng thái</h4>
        <DonutChart segments={donutSegments} size={isMobile ? 160 : 220} />
      </div>

      <div style={{ background: "#fff", borderRadius: 12, padding: isMobile ? 12 : 20, boxShadow: "0 1px 3px rgba(0,0,0,.08)", overflowX: "auto" }}>
        <h4 style={{ margin: "0 0 12px", fontSize: isMobile ? 14 : 16 }}>🏆 Bảng xếp hạng Sale</h4>
        {isMobile ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {saleRanking.map((s, i) => (
              <div key={s.name} style={{ background: i % 2 ? "#f9fafb" : "#fff", borderRadius: 10, padding: 12, border: "1px solid #e5e7eb" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i+1}`} {s.name}</span>
                  <span style={{ fontWeight: 700, fontSize: 16, color: "#3b82f6" }}>{s.total} lead</span>
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
                <td style={tdStyle}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</td>
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
    { key: "all", label: "Tất cả", icon: "📋", filter: () => true },
    { key: "new", label: "Chưa feedback", icon: "🆕", filter: (l) => l.status === "new" || !l.status },
    { key: "interested", label: "Quan tâm", icon: "⭐", filter: (l) => l.status === "interested" },
    { key: "low_interest", label: "QT hời hợt", icon: "💫", filter: (l) => l.status === "low_interest" },
    { key: "other_project", label: "QT DA khác", icon: "🔄", filter: (l) => l.status === "other_project" },
    { key: "appointment", label: "Hẹn xem", icon: "📅", filter: (l) => l.status === "appointment" },
    { key: "booked", label: "Giữ chỗ", icon: "✅", filter: (l) => l.status === "booked" },
    { key: "closed", label: "Chốt", icon: "🏆", filter: (l) => l.status === "closed" },
    { key: "not_interested", label: "Không quan tâm", icon: "👎", filter: (l) => l.status === "not_interested" },
    { key: "spam", label: "Phá/rác", icon: "🚫", filter: (l) => l.status === "spam" },
    { key: "weak_finance", label: "Tài chính yếu", icon: "💸", filter: (l) => l.status === "weak_finance" },
    { key: "unreachable", label: "Chưa liên lạc được", icon: "📵", filter: (l) => l.status === "unreachable" },
    { key: "callback", label: "Liên lạc lại sau", icon: "📲", filter: (l) => l.status === "callback" },
    { key: "wrong_number", label: "Thuê bao/Sai số", icon: "❌", filter: (l) => l.status === "wrong_number" },
    { key: "blocked", label: "Chặn", icon: "🚷", filter: (l) => l.status === "blocked" },
    { key: "has_sale", label: "Có sale khác", icon: "👥", filter: (l) => l.status === "has_sale" },
    { key: "called", label: "Đã gọi", icon: "📞", filter: (l) => l.status === "called" },
    { key: "lost", label: "Mất", icon: "💀", filter: (l) => l.status === "lost" },
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
      if (data.error) { setShuffleMsg("❌ " + data.error); }
      else { setShuffleMsg("✅ " + data.msg); applyApiData(data); setShuffleSelected(new Set()); }
    } catch (e) {
      setShuffleMsg("❌ Lỗi: " + e.message);
    } finally {
      setShuffling(false);
    }
  };

  return (
    <>
      {/* Sale header */}
      {!isAdmin && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>👋 Xin chào, {user.displayName}</div>
          <button onClick={onLogout} style={{ padding: "6px 16px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
            🚪 Đăng xuất
          </button>
        </div>
      )}

      {/* Admin chia lead */}
      {isAdmin && (
        <div style={{ marginBottom: 12 }}>
          <button onClick={() => setShuffleOpen(!shuffleOpen)}
            style={{ ...btnPrimary, padding: "6px 16px", fontSize: 13 }}>
            🔀 Chia Lead cho Sale
          </button>
          {shuffleOpen && (
            <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 12, padding: 16, marginTop: 8, fontSize: 13 }}>
              <div style={{ fontWeight: 700, marginBottom: 12, color: "#9a3412", fontSize: 15 }}>🔀 Chia Lead cho Sale</div>

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
                    placeholder="🔍 Tìm sale..."
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
                            onMouseEnter={e => e.currentTarget.style.background = "#eff6ff"}
                            onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
                            👤 {s}
                          </div>
                        )) : <div style={{ padding: "8px 12px", color: "#9ca3af", fontSize: 12 }}>Không tìm thấy sale nào</div>}
                      </div>
                    );
                    return null;
                  })()}
                  {shuffleSale && (
                    <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ background: "#dbeafe", color: "#1d4ed8", padding: "2px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600 }}>✅ {shuffleSale}</span>
                      <button onClick={() => { setShuffleSale(""); setShuffleSaleSearch(""); }}
                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#ef4444" }}>✕</button>
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
                        <option value="unassigned">📌 Chưa chia (chưa có sale)</option>
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
                        Đã chọn: <span style={{ color: "#2563eb" }}>{shuffleSelected.size}</span> / {shuffleFilteredLeads.length} lead
                      </span>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => setShuffleSelected(new Set(shuffleFilteredLeads.map(l => l.id)))}
                          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#2563eb", fontWeight: 600 }}>Chọn tất cả</button>
                        <button onClick={() => setShuffleSelected(new Set())}
                          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#ef4444", fontWeight: 600 }}>Bỏ tất cả</button>
                      </div>
                    </div>
                    {shuffleFilteredLeads.length === 0 && <div style={{ padding: 16, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>Không có lead nào</div>}
                    {shuffleFilteredLeads.map(l => (
                      <label key={l.id} style={{
                        display: "flex", alignItems: "center", gap: 8, padding: "6px 12px",
                        borderBottom: "1px solid #f3f4f6", cursor: "pointer",
                        background: shuffleSelected.has(l.id) ? "#eff6ff" : "#fff",
                        transition: "background .1s",
                      }}>
                        <input type="checkbox" checked={shuffleSelected.has(l.id)}
                          onChange={() => {
                            const next = new Set(shuffleSelected);
                            next.has(l.id) ? next.delete(l.id) : next.add(l.id);
                            setShuffleSelected(next);
                            setShufflePickCount("manual");
                          }}
                          style={{ width: 16, height: 16, accentColor: "#2563eb" }} />
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
                      {shuffling ? "Đang chia..." : `📤 Chia ${shuffleSelected.size} lead cho ${shuffleSale}`}
                    </button>
                  </div>
                </>
              )}

              {shuffleMsg && <div style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: shuffleMsg.startsWith("✅") ? "#059669" : "#dc2626" }}>{shuffleMsg}</div>}
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
                border: isActive ? "2px solid #3b82f6" : "1px solid #e5e7eb",
                background: isActive ? "#eff6ff" : "#fff", color: isActive ? "#1d4ed8" : "#374151",
                cursor: "pointer", fontSize: 12, fontWeight: isActive ? 700 : 500,
                display: "flex", alignItems: "center", gap: 4, transition: "all .15s",
                whiteSpace: "nowrap", flexShrink: 0,
              }}>
              <span>{t.icon}</span>
              <span>{t.label}</span>
              <span style={{
                background: isActive ? "#3b82f6" : "#e5e7eb", color: isActive ? "#fff" : "#6b7280",
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
          placeholder="🔍 Tìm tên, SĐT, chiến dịch, sale..."
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
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#ef4444" }} title="Xóa lọc ngày">✕</button>
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
              <div key={l.id} id={`lead-${l.id}`} style={{ background: "#fff", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,.06)", border: isOpen ? "2px solid #3b82f6" : "1px solid #e5e7eb", overflow: "hidden" }}>
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
                      {l.isHot && <span style={{ fontSize: 11 }}>{getLeadTemp(l.createdAt).icon}</span>}
                    </div>
                    <div style={{ display: "flex", gap: isMobile ? 8 : 16, fontSize: 12, color: "#6b7280", flexWrap: "wrap" }}>
                      <span>📱 {l.phone || "-"}</span>
                      <span>📅 {l.createdAt || "-"}</span>
                      {histCount > 0 && <span>📋 {histCount}</span>}
                      {isAdmin && l.saleName && <span>👤 {l.saleName}</span>}
                      {isAdmin && <span style={{ fontSize: 11 }}>{projectMap[l.projectId] || "-"}</span>}
                    </div>
                  </div>
                  <span style={{ fontSize: 14, color: "#9ca3af", flexShrink: 0 }}>{isOpen ? "▼" : "▶"}</span>
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
                    style={{ background: isOpen ? "#eff6ff" : globalIdx % 2 ? "#f9fafb" : "#fff", cursor: "pointer", transition: "background .15s" }}>
                    <td style={tdStyle}>{globalIdx + 1}</td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{isOpen ? "▼ " : "▶ "}{isRecentLead(l) && <span style={{ background: "#10b981", color: "#fff", padding: "1px 6px", borderRadius: 8, fontSize: 10, fontWeight: 700, marginRight: 4 }}>MỚI</span>}{l.name}</td>
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
                      <td colSpan={9} style={{ padding: 0, background: "#f8fafc", borderBottom: "2px solid #3b82f6" }}>
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
    if (!confirm("Xóa lịch sử liên hệ này?")) return;
    try {
      const r = await apiFetch(`${API}/leads/${lead.id}/history/${histId}`, { method: "DELETE" });
      if (r.ok) applyApiData(await r.json());
      else alert("Xóa thất bại");
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
            <b style={{ fontSize: 12, color: "#9a3412" }}>🔧 Trạng thái:</b>
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
              {savingStatus ? "Đang cập nhật..." : "✅ Cập nhật"}
            </button>
          </div>
        </div>
      )}

      {/* Admin: Chia lead cho Sale */}
      {isAdmin && (
        <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: isMobile ? 14 : 12, marginBottom: 16, fontSize: 13 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <b style={{ fontSize: 12, color: "#1e40af" }}>📤 Sale phụ trách:</b>
            {lead.saleName
              ? <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600, background: "#dbeafe", color: "#1d4ed8" }}>{lead.saleName}</span>
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
              style={{ ...btnPrimary, padding: isMobile ? "10px 16px" : "6px 12px", fontSize: isMobile ? 14 : 12, background: !editSale ? "#93c5fd" : "#2563eb", minHeight: isMobile ? 44 : "auto", width: isMobile ? "100%" : "auto" }}>
              {savingSale ? "Đang chia..." : "📤 Chia lead"}
            </button>
          </div>
        </div>
      )}

      <h4 style={{ margin: "0 0 12px", fontSize: 14, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <span>📋 Lịch sử ({history.length})</span>
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
              {saving ? "Đang lưu..." : "💾 Lưu"}
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
            const dotColor = recalled ? "#ef4444" : isUpdate ? "#10b981" : "#3b82f6";
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
                        background: recalled ? "#fef2f2" : isUpdate ? "#f0fdf4" : "#eff6ff",
                        color: recalled ? "#dc2626" : isUpdate ? "#059669" : "#2563eb",
                      }}>{h.action}</span>
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      <span style={{ fontSize: 10, color: "#9ca3af" }}>{h.date || "-"}</span>
                      {isAdmin && h.id && (
                        <button onClick={() => handleDeleteHistory(h.id)}
                          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#dc2626", padding: "2px 4px" }}
                          title="Xóa lịch sử này">🗑️</button>
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
        alert("Đồng bộ thất bại: " + (err.error || r.statusText));
      } else {
        const data = await r.json();
        applyApiData(data);
      }
    } catch (e) {
      alert("Đồng bộ thất bại: " + e.message);
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
                boxShadow: "0 1px 3px rgba(0,0,0,.08)", borderTop: "3px solid #3b82f6",
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
                  {isSyncing ? "Đồng bộ..." : "🔄 Sync"}
                </button>
                <button onClick={() => openEditProject(p)} style={{ ...btnSecondary, flex: 1, fontSize: 12 }}>✏️ Sửa</button>
                <button onClick={() => deleteProject(p.id)} style={{ ...btnDanger, flex: 1, fontSize: 12 }}>🗑️ Xóa</button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function CampaignsPage({ leads }) {
  const isMobile = useIsMobile();
  const [expandedCampaigns, setExpandedCampaigns] = React.useState({});
  const [expandedAdsets, setExpandedAdsets] = React.useState({});

  // Build campaign → adset → ad tree with stats
  const tree = React.useMemo(() => {
    const map = {};
    leads.forEach((l) => {
      const cName = l.campaign || "Khác";
      const asName = l.adsetName || "-";
      const adName = l.adName || "-";
      if (!map[cName]) map[cName] = { leads: [], adsets: {} };
      map[cName].leads.push(l);
      if (!map[cName].adsets[asName]) map[cName].adsets[asName] = { leads: [], ads: {} };
      map[cName].adsets[asName].leads.push(l);
      if (!map[cName].adsets[asName].ads[adName]) map[cName].adsets[asName].ads[adName] = { leads: [] };
      map[cName].adsets[asName].ads[adName].leads.push(l);
    });
    return map;
  }, [leads]);

  const calcStats = (arr) => {
    const total = arr.length;
    if (!total) return { total: 0, interested: 0, bad: 0, remaining: 0, pInterested: 0, pBad: 0, pRemaining: 0, closed: 0, booked: 0, pClosed: 0, pBooked: 0 };
    const interested = arr.filter((l) => l.status === "interested").length;
    const bad = arr.filter((l) => l.status === "unreachable" || l.status === "not_interested").length;
    const closed = arr.filter((l) => l.status === "closed").length;
    const booked = arr.filter((l) => l.status === "booked").length;
    const remaining = total - interested - bad - closed - booked;
    return {
      total, interested, bad, remaining, closed, booked,
      pInterested: ((interested / total) * 100).toFixed(1),
      pBad: ((bad / total) * 100).toFixed(1),
      pRemaining: ((remaining / total) * 100).toFixed(1),
      pClosed: ((closed / total) * 100).toFixed(1),
      pBooked: ((booked / total) * 100).toFixed(1),
    };
  };

  const toggleCampaign = (name) => setExpandedCampaigns((p) => ({ ...p, [name]: !p[name] }));
  const toggleAdset = (key) => setExpandedAdsets((p) => ({ ...p, [key]: !p[key] }));

  const campaignNames = Object.keys(tree).sort((a, b) => tree[b].leads.length - tree[a].leads.length);

  const statCellStyle = { ...tdStyle, textAlign: "center", minWidth: 60 };
  const pctStyle = (v) => ({ fontSize: 11, color: "#6b7280", fontWeight: 400 });
  const headerBg = "#f0f4ff";
  const adsetBg = "#f9fafb";
  const adBg = "#fff";

  return (
    <div style={{ background: "#fff", borderRadius: 12, overflow: "auto", boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
      <div style={{ padding: isMobile ? "12px" : "16px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: isMobile ? 14 : 16 }}>📊 Thống kê chiến dịch</h3>
        <span style={{ fontSize: isMobile ? 11 : 13, color: "#6b7280" }}>{leads.length} lead · {campaignNames.length} chiến dịch</span>
      </div>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={{ ...thStyle, width: 36 }}></th>
            <th style={{ ...thStyle, textAlign: "left" }}>Tên</th>
            <th style={{ ...thStyle, textAlign: "center" }}>Tổng Lead</th>
            <th style={{ ...thStyle, textAlign: "center" }}>Quan tâm</th>
            <th style={{ ...thStyle, textAlign: "center" }}>Giữ chỗ</th>
            <th style={{ ...thStyle, textAlign: "center" }}>Chốt</th>
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
                {/* Campaign row */}
                <tr style={{ background: headerBg, cursor: "pointer" }} onClick={() => toggleCampaign(cName)}>
                  <td style={{ ...tdStyle, textAlign: "center", fontSize: 14 }}>{isExpanded ? "▼" : "▶"}</td>
                  <td style={{ ...tdStyle, fontWeight: 700, fontSize: 13 }}>📢 {cName}</td>
                  <td style={statCellStyle}><strong>{cStats.total}</strong></td>
                  <td style={statCellStyle}>{cStats.interested} <span style={pctStyle()}>({cStats.pInterested}%)</span></td>
                  <td style={statCellStyle}>{cStats.booked} <span style={pctStyle()}>({cStats.pBooked}%)</span></td>
                  <td style={statCellStyle}>{cStats.closed} <span style={pctStyle()}>({cStats.pClosed}%)</span></td>
                  <td style={statCellStyle}>{cStats.bad} <span style={pctStyle()}>({cStats.pBad}%)</span></td>
                  <td style={statCellStyle}>{cStats.remaining} <span style={pctStyle()}>({cStats.pRemaining}%)</span></td>
                </tr>
                {/* Adset rows */}
                {isExpanded && adsetNames.map((asName) => {
                  const asKey = cName + "|" + asName;
                  const asStats = calcStats(tree[cName].adsets[asName].leads);
                  const asExpanded = expandedAdsets[asKey];
                  const adNames = Object.keys(tree[cName].adsets[asName].ads).sort((a, b) => tree[cName].adsets[asName].ads[b].leads.length - tree[cName].adsets[asName].ads[a].leads.length);
                  return (
                    <React.Fragment key={asKey}>
                      <tr style={{ background: adsetBg, cursor: "pointer" }} onClick={() => toggleAdset(asKey)}>
                        <td style={{ ...tdStyle, textAlign: "center", fontSize: 12, paddingLeft: 20 }}>{asExpanded ? "▽" : "▷"}</td>
                        <td style={{ ...tdStyle, paddingLeft: 28, fontWeight: 600, fontSize: 12, color: "#4b5563" }}>📁 {asName}</td>
                        <td style={statCellStyle}>{asStats.total}</td>
                        <td style={statCellStyle}>{asStats.interested} <span style={pctStyle()}>({asStats.pInterested}%)</span></td>
                        <td style={statCellStyle}>{asStats.booked} <span style={pctStyle()}>({asStats.pBooked}%)</span></td>
                        <td style={statCellStyle}>{asStats.closed} <span style={pctStyle()}>({asStats.pClosed}%)</span></td>
                        <td style={statCellStyle}>{asStats.bad} <span style={pctStyle()}>({asStats.pBad}%)</span></td>
                        <td style={statCellStyle}>{asStats.remaining} <span style={pctStyle()}>({asStats.pRemaining}%)</span></td>
                      </tr>
                      {/* Ad rows */}
                      {asExpanded && adNames.map((adN) => {
                        const adStats = calcStats(tree[cName].adsets[asName].ads[adN].leads);
                        return (
                          <tr key={adN} style={{ background: adBg }}>
                            <td style={{ ...tdStyle, textAlign: "center" }}></td>
                            <td style={{ ...tdStyle, paddingLeft: 52, fontSize: 12, color: "#6b7280" }}>🔹 {adN}</td>
                            <td style={statCellStyle}>{adStats.total}</td>
                            <td style={statCellStyle}>{adStats.interested} <span style={pctStyle()}>({adStats.pInterested}%)</span></td>
                            <td style={statCellStyle}>{adStats.booked} <span style={pctStyle()}>({adStats.pBooked}%)</span></td>
                            <td style={statCellStyle}>{adStats.closed} <span style={pctStyle()}>({adStats.pClosed}%)</span></td>
                            <td style={statCellStyle}>{adStats.bad} <span style={pctStyle()}>({adStats.pBad}%)</span></td>
                            <td style={statCellStyle}>{adStats.remaining} <span style={pctStyle()}>({adStats.pRemaining}%)</span></td>
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
            <tr><td colSpan={8} style={{ ...tdStyle, textAlign: "center", color: "#9ca3af" }}>Không có dữ liệu chiến dịch</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function SalesPage({ ranking }) {
  const isMobile = useIsMobile();
  return isMobile ? (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {ranking.map((s, i) => (
        <div key={s.name} style={{ background: "#fff", borderRadius: 10, padding: 14, boxShadow: "0 1px 3px rgba(0,0,0,.06)", border: "1px solid #e5e7eb" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i+1}`} {s.name}</span>
            <span style={{ fontWeight: 700, fontSize: 18, color: "#3b82f6" }}>{s.total}</span>
          </div>
          <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#6b7280" }}>
            <span>⭐ {s.interested || 0}</span>
            <span>✅ {s.booked || 0}</span>
            <span>🏆 {s.closed || 0}</span>
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
            <th style={thStyle}>Giữ chỗ</th>
            <th style={thStyle}>Chốt</th>
          </tr>
        </thead>
        <tbody>
          {ranking.map((s, i) => (
            <tr key={s.name} style={{ background: i % 2 ? "#f9fafb" : "#fff" }}>
              <td style={tdStyle}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</td>
              <td style={{ ...tdStyle, fontWeight: 600 }}>{s.name}</td>
              <td style={tdStyle}>{s.total}</td>
              <td style={tdStyle}>{s.interested}</td>
              <td style={tdStyle}>{s.booked}</td>
              <td style={tdStyle}>{s.closed}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
      }}>✕</button>
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
            overflow: "hidden", cursor: "grab", border: "3px solid #3b82f6",
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
          <span style={{ fontSize: 14 }}>➖</span>
          <input type="range" min="50" max="300" value={sliderVal}
            onChange={(e) => handleZoom(Number(e.target.value))}
            style={{ width: 160, accentColor: "#3b82f6" }} />
          <span style={{ fontSize: 14 }}>➕</span>
          <span style={{ fontSize: 11, color: "#6b7280", minWidth: 36 }}>{sliderVal}%</span>
        </div>
        <canvas ref={canvasRef} style={{ display: "none" }} />
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button onClick={handleConfirm} style={{ ...btnPrimary, flex: 1 }}>✅ Xác nhận</button>
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
    if (file.size > 5 * 1024 * 1024) { alert("Ảnh tối đa 5MB"); return; }
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
        setMsg("✅ Đã cập nhật hồ sơ");
        setTimeout(() => setMsg(""), 3000);
      } else {
        setMsg("❌ Lỗi: " + (data.error || "Không thể cập nhật"));
      }
    } catch (e) {
      setMsg("❌ Lỗi kết nối: " + e.message);
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
      setPwdMsg("✅ Đổi mật khẩu thành công!");
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
      <span>{ok ? "✅" : "⬜"}</span> {text}
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
            background: draft.avatarUrl ? `url(${draft.avatarUrl}) center/cover` : "linear-gradient(135deg, #3b82f6, #8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 36, color: "#fff", border: "3px solid #e5e7eb",
            cursor: draft.avatarUrl ? "pointer" : "default", transition: "border-color .2s",
          }}
          onMouseEnter={e => { if (draft.avatarUrl) e.currentTarget.style.borderColor = "#3b82f6"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "#e5e7eb"; }}
          title={draft.avatarUrl ? "Bấm để xem ảnh lớn" : ""}
        >
          {!draft.avatarUrl && (profile?.displayName || user?.displayName || "?")[0]?.toUpperCase()}
        </div>
        <h3 style={{ margin: "0 0 4px", fontSize: 20 }}>{profile?.displayName || user?.displayName}</h3>
        {(() => { const r = profile?.role || user?.role; return (
          <span style={{
            padding: "2px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600,
            background: r === "admin" ? "#fef2f2" : "#eff6ff",
            color: r === "admin" ? "#dc2626" : "#2563eb",
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
        <h4 style={{ margin: "0 0 16px", fontSize: 15, color: "#374151" }}>📋 Thông tin cá nhân</h4>
        {msg && <div style={{ background: "#f0fdf4", color: "#16a34a", padding: "8px 12px", borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{msg}</div>}

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
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#3b82f6"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#e5e7eb"; }}
              title="Bấm để xem ảnh lớn"
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{
                display: "inline-flex", alignItems: "center", gap: 4, padding: "6px 12px",
                background: "#eff6ff", color: "#2563eb", borderRadius: 8, cursor: "pointer",
                fontSize: 12, fontWeight: 600, border: "1px solid #bfdbfe",
              }}>
                📷 Đổi ảnh
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleAvatarFile(e.target.files?.[0])} />
              </label>
              <button type="button" onClick={() => setDraft(d => ({ ...d, avatarUrl: "" }))} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 12, textAlign: "left", padding: "2px 0" }}>✕ Xóa ảnh</button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => avatarFileRef.current?.click()}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleAvatarFile(e.dataTransfer.files?.[0]); }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            style={{
              border: `2px dashed ${dragOver ? "#3b82f6" : "#d1d5db"}`, borderRadius: 12,
              padding: "20px 16px", textAlign: "center", cursor: "pointer", marginBottom: 8,
              transition: "all .2s", background: dragOver ? "#eff6ff" : "#fafafa",
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 4 }}>📷</div>
            <div style={{ fontSize: 13, color: "#6b7280", fontWeight: 500 }}>Kéo thả ảnh vào đây hoặc <span style={{ color: "#3b82f6", fontWeight: 600 }}>bấm để chọn</span></div>
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
          {saving ? "Đang lưu..." : "💾 Cập nhật thông tin"}
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
          <h4 style={{ margin: 0, fontSize: 15, color: "#374151" }}>🔑 Đổi mật khẩu</h4>
          <span style={{ fontSize: 12, color: "#6b7280" }}>{showPwdSection ? "▲ Thu gọn" : "▼ Mở rộng"}</span>
        </div>
        {showPwdSection && (
          <div style={{ marginTop: 16 }}>
            {pwdMsg && <div style={{ background: "#f0fdf4", color: "#16a34a", padding: "8px 12px", borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{pwdMsg}</div>}
            {pwdError && <div style={{ background: "#fef2f2", color: "#dc2626", padding: "8px 12px", borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{pwdError}</div>}

            <label style={{ ...labelStyle, marginTop: 0 }}>Mật khẩu hiện tại</label>
            <div style={{ position: "relative" }}>
              <input style={{ ...inputStyle, paddingRight: 40 }} type={showCurrentPwd ? "text" : "password"} value={currentPwd}
                onChange={(e) => setCurrentPwd(e.target.value)} placeholder="Nhập mật khẩu hiện tại" />
              <button type="button" onClick={() => setShowCurrentPwd(!showCurrentPwd)} style={{
                position: "absolute", right: 8, top: 8, background: "none", border: "none",
                cursor: "pointer", fontSize: 16, color: "#6b7280", padding: 2,
              }}>{showCurrentPwd ? "🙈" : "👁️"}</button>
            </div>

            <label style={labelStyle}>Mật khẩu mới</label>
            <div style={{ position: "relative" }}>
              <input style={{ ...inputStyle, paddingRight: 40 }} type={showNewPwd ? "text" : "password"} value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)} placeholder="Nhập mật khẩu mới" />
              <button type="button" onClick={() => setShowNewPwd(!showNewPwd)} style={{
                position: "absolute", right: 8, top: 8, background: "none", border: "none",
                cursor: "pointer", fontSize: 16, color: "#6b7280", padding: 2,
              }}>{showNewPwd ? "🙈" : "👁️"}</button>
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
              }}>{showConfirmPwd ? "🙈" : "👁️"}</button>
            </div>
            {confirmPwd && newPwd !== confirmPwd && (
              <div style={{ fontSize: 12, color: "#dc2626", marginBottom: 8 }}>❌ Mật khẩu xác nhận không khớp</div>
            )}

            <button onClick={handleChangePwd} disabled={changingPwd || !allPwdValid || newPwd !== confirmPwd || !currentPwd} style={{
              ...btnPrimary, width: "100%", marginTop: 8,
              opacity: (changingPwd || !allPwdValid || newPwd !== confirmPwd || !currentPwd) ? 0.6 : 1,
            }}>
              {changingPwd ? "Đang xử lý..." : "🔐 Đổi mật khẩu"}
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
    setError("");
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
  };

  const handleDelete = async (id) => {
    if (!confirm("Xóa tài khoản này?")) return;
    try {
      const r = await apiFetch(`${API}/users/${id}`, { method: "DELETE" });
      if (!r.ok) { const d = await r.json(); alert(d.error); return; }
      setUsers(await r.json());
    } catch (e) { console.error(e); }
  };

  const handleAutoCreate = async () => {
    if (!confirm("Tự động tạo tài khoản cho các Sale có tên trong dữ liệu lead?\n\nMật khẩu mặc định: tên + 123 (VD: thao123)\nSale sẽ phải đổi mật khẩu khi đăng nhập lần đầu.")) return;
    setAutoCreating(true); setAutoCreateMsg("");
    try {
      const r = await apiFetch(`${API}/users/auto-create-sales`, { method: "POST" });
      const data = await r.json();
      if (r.ok) {
        setUsers(data.users);
        if (data.created > 0) {
          const list = data.createdList.map(c => `• ${c.displayName} → @${c.username} (MK: ${c.defaultPassword})`).join("\n");
          setAutoCreateMsg(`✅ Đã tạo ${data.created} tài khoản:\n${list}`);
        } else {
          setAutoCreateMsg("ℹ️ Không có sale mới cần tạo tài khoản.");
        }
      } else {
        setAutoCreateMsg("❌ Lỗi: " + (data.error || "Unknown"));
      }
    } catch (e) { setAutoCreateMsg("❌ " + e.message); }
    setAutoCreating(false);
  };

  const openProfile = (u) => {
    setShowProfileModal(u);
    setProfileDraft({ avatarUrl: u.avatarUrl || "", email: u.email || "", phone: u.phone || "" });
  };

  const handleUserAvatarFile = (file, target) => {
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) { alert("Ảnh tối đa 5MB"); return; }
    const reader = new FileReader();
    reader.onload = () => { setUserCropSrc(reader.result); setUserCropTarget(target); };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    if (!showProfileModal) return;
    try {
      const r = await apiFetch(`${API}/users/${showProfileModal.id}/profile`, {
        method: "PUT", body: JSON.stringify(profileDraft),
      });
      if (r.ok) { setUsers(await r.json()); setShowProfileModal(null); }
    } catch (e) { console.error(e); }
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
    setBotError("");
    if (!botDraft.name || !botDraft.token) { setBotError("Tên bot và token bắt buộc"); return; }
    try {
      const url = editingBot ? `${API}/telegram-bots/${editingBot.id}` : `${API}/telegram-bots`;
      const r = await apiFetch(url, {
        method: editingBot ? "PUT" : "POST",
        body: JSON.stringify(botDraft),
      });
      if (!r.ok) { const d = await r.json(); setBotError(d.error); return; }
      setBots(await r.json());
      setShowBotForm(false);
    } catch (e) { setBotError(e.message); }
  };

  const handleDeleteBot = async (id) => {
    if (!confirm("Xóa bot này?")) return;
    try {
      const r = await apiFetch(`${API}/telegram-bots/${id}`, { method: "DELETE" });
      if (!r.ok) { const d = await r.json(); alert(d.error); return; }
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
        <div style={{ fontSize: 14, color: "#6b7280" }}>👤 {users.length} tài khoản</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={handleAutoCreate} disabled={autoCreating} style={{ ...btnSecondary, minHeight: 40, fontSize: 12 }}>
            {autoCreating ? "⏳ Đang tạo..." : "🤖 Tự tạo TK Sale"}
          </button>
          <button onClick={openNew} style={{ ...btnPrimary, minHeight: 40 }}>+ Thêm tài khoản</button>
        </div>
      </div>
      {autoCreateMsg && (
        <div style={{
          background: autoCreateMsg.startsWith("✅") ? "#f0fdf4" : autoCreateMsg.startsWith("ℹ️") ? "#eff6ff" : "#fef2f2",
          color: autoCreateMsg.startsWith("✅") ? "#16a34a" : autoCreateMsg.startsWith("ℹ️") ? "#2563eb" : "#dc2626",
          padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 12, whiteSpace: "pre-line",
        }}>
          {autoCreateMsg}
          <button onClick={() => setAutoCreateMsg("")} style={{ marginLeft: 8, background: "none", border: "none", cursor: "pointer", fontSize: 14 }}>✕</button>
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
                    background: u.avatarUrl ? `url(${u.avatarUrl}) center/cover` : "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, color: "#fff",
                  }}>
                    {!u.avatarUrl && (u.displayName || "?")[0]?.toUpperCase()}
                  </div>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{u.displayName || u.username}</span>
                    <span style={{
                      marginLeft: 8, padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                      background: u.role === "admin" ? "#fef2f2" : "#eff6ff",
                      color: u.role === "admin" ? "#dc2626" : "#2563eb",
                    }}>{u.role === "admin" ? "Admin" : "Sale"}</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => openProfile(u)} title="Hồ sơ" style={{ ...btnSecondary, padding: "6px 12px", fontSize: 12, minHeight: 36 }}>🪪</button>
                  <button onClick={() => openEdit(u)} style={{ ...btnSecondary, padding: "6px 12px", fontSize: 12, minHeight: 36 }}>✏️</button>
                  <button onClick={() => handleDelete(u.id)} style={{ ...btnDanger, padding: "6px 12px", fontSize: 12, minHeight: 36 }}>🗑️</button>
                </div>
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", display: "flex", flexDirection: "column", gap: 3 }}>
                <div>👤 @{u.username}</div>
                {u.email && <div>📧 {u.email}</div>}
                {u.phone && <div>📱 {u.phone}</div>}
                {u.telegramId && <div>✈️ {u.telegramId}</div>}
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
                      background: u.avatarUrl ? `url(${u.avatarUrl}) center/cover` : "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, color: "#fff",
                    }}>
                      {!u.avatarUrl && (u.displayName || "?")[0]?.toUpperCase()}
                    </div>
                    {u.displayName}
                  </div>
                </td>
                <td style={{ ...tdStyle, fontSize: 11 }}>
                  {u.email && <div>📧 {u.email}</div>}
                  {u.phone && <div>📱 {u.phone}</div>}
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
                    ? <span style={{ background: "#eff6ff", color: "#2563eb", padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600 }}>✈️ {u.telegramId}</span>
                    : <span style={{ color: "#9ca3af", fontSize: 11 }}>Chưa cập nhật</span>
                  }
                </td>
                <td style={tdStyle}>
                  <span style={{
                    padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                    background: u.role === "admin" ? "#fef2f2" : "#eff6ff",
                    color: u.role === "admin" ? "#dc2626" : "#2563eb",
                  }}>
                    {u.role === "admin" ? "Admin" : "Sale"}
                  </span>
                </td>
                <td style={{ ...tdStyle, fontSize: 11 }}>{u.createdAt || "-"}</td>
                <td style={tdStyle}>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => openProfile(u)} title="Hồ sơ" style={{ ...btnSecondary, padding: "2px 8px", fontSize: 11 }}>🪪</button>
                    <button onClick={() => openEdit(u)} style={{ ...btnSecondary, padding: "2px 8px", fontSize: 11 }}>✏️</button>
                    <button onClick={() => handleDelete(u.id)} style={{ ...btnDanger, padding: "2px 8px", fontSize: 11 }}>🗑️</button>
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
        <div style={{ fontSize: 14, color: "#6b7280" }}>🤖 Telegram Bot ({bots.length})</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={async () => {
            try {
              const r = await apiFetch(`${API}/telegram-webhook/setup`, { method: "POST" });
              const d = await r.json();
              alert(d.ok ? `✅ ${d.msg}` : `❌ ${d.error}`);
            } catch (e) { alert("❌ " + e.message); }
          }} style={{ ...btnSecondary, fontSize: 12, padding: "8px 12px", minHeight: 40 }}>🔗 Webhook</button>
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
                <span style={{ fontWeight: 700, fontSize: 14 }}>🤖 {b.name}</span>
                <button onClick={() => toggleBot(b)} style={{
                  padding: "4px 12px", borderRadius: 12, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", minHeight: 32,
                  background: b.isActive ? "#f0fdf4" : "#fef2f2", color: b.isActive ? "#16a34a" : "#dc2626",
                }}>{b.isActive ? "✅ On" : "⛔ Off"}</button>
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace", marginBottom: 8, wordBreak: "break-all" }}>{b.token.slice(0, 12)}...{b.token.slice(-6)}</div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => openEditBot(b)} style={{ ...btnSecondary, flex: 1, padding: "8px", fontSize: 12, minHeight: 36 }}>✏️ Sửa</button>
                <button onClick={() => handleDeleteBot(b.id)} style={{ ...btnDanger, flex: 1, padding: "8px", fontSize: 12, minHeight: 36 }}>🗑️ Xóa</button>
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
                  <td style={{ ...tdStyle, fontWeight: 600 }}>🤖 {b.name}</td>
                  <td style={{ ...tdStyle, fontSize: 11, fontFamily: "monospace", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {b.token.slice(0, 12)}...{b.token.slice(-6)}
                  </td>
                  <td style={tdStyle}>
                    <button onClick={() => toggleBot(b)} style={{
                      padding: "2px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer",
                      background: b.isActive ? "#f0fdf4" : "#fef2f2",
                      color: b.isActive ? "#16a34a" : "#dc2626",
                    }}>
                      {b.isActive ? "✅ Hoạt động" : "⛔ Tắt"}
                    </button>
                  </td>
                  <td style={{ ...tdStyle, fontSize: 11 }}>{b.createdAt || "-"}</td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={() => openEditBot(b)} style={{ ...btnSecondary, padding: "2px 8px", fontSize: 11 }}>✏️</button>
                      <button onClick={() => handleDeleteBot(b.id)} style={{ ...btnDanger, padding: "2px 8px", fontSize: 11 }}>🗑️</button>
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
            }}>{showDraftPwd ? "🙈" : "👁️"}</button>
          </div>
          {!editingUser && (
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: -4, marginBottom: 8 }}>
              💡 MK mặc định: tên (không dấu) + 123. VD: <strong>thao123</strong>
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
                <label style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 10px", background: "#eff6ff", color: "#2563eb", borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: 600, border: "1px solid #bfdbfe" }}>
                  📷 Đổi ảnh
                  <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleUserAvatarFile(e.target.files?.[0], "draft")} />
                </label>
                <button type="button" onClick={() => setDraft(d => ({ ...d, avatarUrl: "" }))} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 11, textAlign: "left", padding: 0 }}>✕ Xóa</button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => userAvatarFileRef.current?.click()}
              onDrop={(e) => { e.preventDefault(); setUserDragOver(false); handleUserAvatarFile(e.dataTransfer.files?.[0], "draft"); }}
              onDragOver={(e) => { e.preventDefault(); setUserDragOver(true); }}
              onDragLeave={() => setUserDragOver(false)}
              style={{ border: `2px dashed ${userDragOver ? "#3b82f6" : "#d1d5db"}`, borderRadius: 10, padding: "14px 12px", textAlign: "center", cursor: "pointer", marginBottom: 8, background: userDragOver ? "#eff6ff" : "#fafafa" }}
            >
              <div style={{ fontSize: 24, marginBottom: 2 }}>📷</div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>Kéo thả hoặc <span style={{ color: "#3b82f6", fontWeight: 600 }}>bấm chọn ảnh</span></div>
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
              <label style={labelStyle}>🏗️ Dự án được phép truy cập</label>
              {projects.length > 5 && (
                <input
                  style={{ ...inputStyle, marginBottom: 6 }}
                  placeholder="🔍 Tìm dự án..."
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
                      background: draft.projectIds.includes(p.id) ? "#eff6ff" : "transparent",
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
                        style={{ accentColor: "#3b82f6" }}
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
            <button onClick={handleSave} style={{ ...btnPrimary, flex: 1 }}>Lưu</button>
            <button onClick={() => setShowForm(false)} style={{ ...btnSecondary, flex: 1 }}>Hủy</button>
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
            <button onClick={handleSaveBot} style={{ ...btnPrimary, flex: 1 }}>Lưu</button>
            <button onClick={() => setShowBotForm(false)} style={{ ...btnSecondary, flex: 1 }}>Hủy</button>
          </div>
        </Modal>
      )}

      {/* Modal hồ sơ user - đầy đủ thông tin */}
      {showProfileModal && (() => {
        const u = showProfileModal;
        const userProjects = (u.projectIds || []).map(pid => projects.find(p => p.id === pid)).filter(Boolean);
        const isOnline = u.lastActive && (Date.now() - new Date(u.lastActive).getTime() < 5 * 60 * 1000);
        const lastSeenText = u.lastActive ? (() => {
          const diff = Math.floor((Date.now() - new Date(u.lastActive).getTime()) / 60000);
          if (diff < 1) return "Vừa mới";
          if (diff < 60) return `${diff} phút trước`;
          if (diff < 1440) return `${Math.floor(diff / 60)} giờ trước`;
          return `${Math.floor(diff / 1440)} ngày trước`;
        })() : "Chưa hoạt động";
        const infoRow = (icon, label, value) => value ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid #f3f4f6" }}>
            <span style={{ fontSize: 16, width: 24, textAlign: "center" }}>{icon}</span>
            <span style={{ fontSize: 12, color: "#6b7280", minWidth: 80 }}>{label}</span>
            <span style={{ fontSize: 13, color: "#111827", fontWeight: 500, flex: 1, wordBreak: "break-word" }}>{value}</span>
          </div>
        ) : null;
        return (
          <Modal onClose={() => setShowProfileModal(null)} title={`Hồ sơ - ${u.displayName}`}>
            {/* Avatar + Header */}
            <div style={{ textAlign: "center", marginBottom: 16, position: "relative" }}>
              <div
                onClick={() => profileDraft.avatarUrl && setLightboxSrc(profileDraft.avatarUrl)}
                style={{
                  width: 90, height: 90, borderRadius: "50%", margin: "0 auto 8px",
                  background: profileDraft.avatarUrl ? `url(${profileDraft.avatarUrl}) center/cover` : "linear-gradient(135deg, #3b82f6, #8b5cf6)",
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
                  background: u.role === "admin" ? "#fef2f2" : "#eff6ff",
                  color: u.role === "admin" ? "#dc2626" : "#2563eb",
                }}>{u.role === "admin" ? "Admin" : "Sale"}</span>
                <span style={{ fontSize: 11, color: isOnline ? "#22c55e" : "#9ca3af" }}>
                  {isOnline ? "● Online" : `○ ${lastSeenText}`}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>@{u.username}</div>
            </div>

            {/* Thông tin chi tiết - Chỉ đọc */}
            <div style={{ background: "#f9fafb", borderRadius: 12, padding: "4px 12px", marginBottom: 12 }}>
              {infoRow("📧", "Email", u.email)}
              {infoRow("📱", "SĐT", u.phone)}
              {infoRow("✈️", "Telegram", u.telegramId)}
              {infoRow("📅", "Ngày tạo", u.createdAt ? new Date(u.createdAt).toLocaleDateString("vi-VN") : "")}
              {infoRow("🕑", "Hoạt động", lastSeenText)}
              {!u.email && !u.phone && !u.telegramId && (
                <div style={{ padding: "12px 0", color: "#9ca3af", fontSize: 12, textAlign: "center" }}>Chưa cập nhật thông tin liên hệ</div>
              )}
            </div>

            {/* Dự án */}
            {u.role !== "admin" && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>🏗️ Dự án được phân công</div>
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
              <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#374151", padding: "8px 0", userSelect: "none" }}>✏️ Chỉnh sửa thông tin</summary>
              <div style={{ marginTop: 8 }}>
                <label style={{ ...labelStyle, marginTop: 0 }}>Ảnh đại diện</label>
                {profileDraft.avatarUrl ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                    <div onClick={() => setLightboxSrc(profileDraft.avatarUrl)} style={{
                      width: 48, height: 48, borderRadius: "50%", flexShrink: 0, cursor: "pointer",
                      background: `url(${profileDraft.avatarUrl}) center/cover`, border: "2px solid #e5e7eb",
                    }} title="Xem ảnh lớn" />
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <label style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 10px", background: "#eff6ff", color: "#2563eb", borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: 600, border: "1px solid #bfdbfe" }}>
                        📷 Đổi ảnh
                        <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleUserAvatarFile(e.target.files?.[0], "profile")} />
                      </label>
                      <button type="button" onClick={() => setProfileDraft(d => ({ ...d, avatarUrl: "" }))} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 11, textAlign: "left", padding: 0 }}>✕ Xóa</button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => profileAvatarFileRef.current?.click()}
                    onDrop={(e) => { e.preventDefault(); handleUserAvatarFile(e.dataTransfer.files?.[0], "profile"); }}
                    onDragOver={(e) => e.preventDefault()}
                    style={{ border: "2px dashed #d1d5db", borderRadius: 10, padding: "12px 10px", textAlign: "center", cursor: "pointer", marginBottom: 8, background: "#fafafa" }}
                  >
                    <div style={{ fontSize: 20, marginBottom: 2 }}>📷</div>
                    <div style={{ fontSize: 11, color: "#6b7280" }}>Kéo thả hoặc <span style={{ color: "#3b82f6", fontWeight: 600 }}>bấm chọn</span></div>
                    <input ref={profileAvatarFileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleUserAvatarFile(e.target.files?.[0], "profile")} />
                  </div>
                )}
                <label style={labelStyle}>Email</label>
                <input style={inputStyle} type="email" value={profileDraft.email} onChange={(e) => setProfileDraft({ ...profileDraft, email: e.target.value })} placeholder="email@example.com" />
                <label style={labelStyle}>Số điện thoại</label>
                <input style={inputStyle} value={profileDraft.phone} onChange={(e) => setProfileDraft({ ...profileDraft, phone: e.target.value })} placeholder="0909 xxx xxx" />
                <label style={labelStyle}>Telegram ID</label>
                <input style={inputStyle} value={profileDraft.telegramId} onChange={(e) => setProfileDraft({ ...profileDraft, telegramId: e.target.value })} placeholder="123456789" />
                <button onClick={handleSaveProfile} style={{ ...btnPrimary, width: "100%", marginTop: 8 }}>💾 Lưu thông tin</button>
              </div>
            </details>
          </Modal>
        );
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
      const q = filterProject.toLowerCase();
      list = list.filter(p => ((getProject(p) || "").toLowerCase().includes(q) || (p._sheetProject || "").toLowerCase().includes(q)));
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
      const proj = getProject(p);
      if (proj) set.add(proj);
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
        alert(err.error || "Lỗi cập nhật trạng thái");
      }
    } catch (e) { alert("Lỗi kết nối"); }
    setTogglingRow(null);
  };

  if (loading) return <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>Đang tải dữ liệu từ Google Sheet...</div>;

  if (error) return (
    <div style={{ textAlign: "center", padding: 40 }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
      <div style={{ color: "#ef4444", fontWeight: 600, marginBottom: 8 }}>{error}</div>
      <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 16 }}>
        Vui lòng vào <strong>⚙️ Cấu hình Sheet</strong> để thiết lập kết nối Google Sheet.
      </p>
      <button onClick={loadSheetData} style={{ ...btnPrimary }}>🔄 Thử lại</button>
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: isMobile ? 16 : 20 }}>📋 Quản lý bài đăng</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => { setShowAll(!showAll); setCurrentPage(1); }}
            style={{
              ...(!showAll ? btnPrimary : btnSecondary),
              display: "flex", alignItems: "center", gap: 6,
            }}>
            {showAll ? "📅 Chỉ hôm nay" : "📋 Xem tất cả"}
          </button>
          <button onClick={loadSheetData} style={{ ...btnSecondary, display: "flex", alignItems: "center", gap: 6 }}>
            🔄 Tải lại từ Sheet
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
          placeholder="🔍 Tìm kiếm..."
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
                      <span style={{ padding: "4px 12px", borderRadius: 12, background: st.bg, color: st.color, fontWeight: 700, fontSize: 11 }}>
                        ✅ POSTED
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
                        {status === "STOP" ? "⏸️" : "▶️"} {isToggling ? "..." : status}
                      </button>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <span style={{ background: "#eff6ff", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, color: "#3b82f6" }}>
                      {getProject(post) || "-"}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, maxWidth: 350 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 340, cursor: "pointer", color: "#1e40af" }}
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
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, padding: 4 }}>👁️</button>
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
              ...btnSecondary, padding: "4px 10px", background: pg === currentPage ? "#3b82f6" : "#f3f4f6",
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
    <Modal onClose={onClose} title="📄 Chi tiết bài viết">
      <div style={{ maxHeight: "70vh", overflow: "auto" }}>
        <div style={{ marginBottom: 16, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ padding: "4px 14px", borderRadius: 12, background: st.bg, color: st.color, fontWeight: 700, fontSize: 12 }}>
            {status}
          </span>
          {getProject(post) && (
            <span style={{ padding: "4px 14px", borderRadius: 12, background: "#eff6ff", color: "#3b82f6", fontWeight: 600, fontSize: 12 }}>
              🏗️ {getProject(post)}
            </span>
          )}
          {getPage(post) && (
            <span style={{ padding: "4px 14px", borderRadius: 12, background: "#f0fdf4", color: "#16a34a", fontWeight: 600, fontSize: 12 }}>
              📘 {getPage(post)}
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
              <label style={{ ...labelStyle }}>📅 Lịch viết</label>
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
              <label style={labelStyle}>🎯 Nhu cầu</label>
              <div style={{ background: "#f8fafc", padding: 8, borderRadius: 6, fontSize: 13 }}>{getNeed(post)}</div>
            </div>
          )}
          {getStage(post) && (
            <div>
              <label style={labelStyle}>📊 Giai đoạn</label>
              <div style={{ background: "#f8fafc", padding: 8, borderRadius: 6, fontSize: 13 }}>{getStage(post)}</div>
            </div>
          )}
          {getPurpose(post) && (
            <div>
              <label style={labelStyle}>🎯 Mục đích content</label>
              <div style={{ background: "#f8fafc", padding: 8, borderRadius: 6, fontSize: 13 }}>{getPurpose(post)}</div>
            </div>
          )}
          {getOffice(post) && (
            <div>
              <label style={labelStyle}>🏢 Văn phòng</label>
              <div style={{ background: "#f8fafc", padding: 8, borderRadius: 6, fontSize: 13 }}>{getOffice(post)}</div>
            </div>
          )}
        </div>

        <details style={{ marginTop: 16 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 13, color: "#6b7280", padding: "8px 0" }}>
            📋 Xem tất cả dữ liệu từ Sheet ({allFields.length} cột)
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
        alert(e.error || "Lỗi thêm");
      }
    } catch { alert("Lỗi kết nối"); }
    setAdding(false);
  };

  const handleDelete = async (id) => {
    if (!confirm("Xóa cấu hình Sheet này?")) return;
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
        setTestResults(prev => ({ ...prev, [id]: { ok: true, msg: `✅ Kết nối thành công! ${data.count} bài viết.` } }));
      } else {
        setTestResults(prev => ({ ...prev, [id]: { ok: false, msg: data.error || "Lỗi" } }));
      }
    } catch { setTestResults(prev => ({ ...prev, [id]: { ok: false, msg: "Lỗi kết nối server" } })); }
    setTestingId(null);
  };

  if (loading) return <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>Đang tải...</div>;

  return (
    <div>
      <h2 style={{ margin: "0 0 16px", fontSize: 20 }}>⚙️ Cấu hình Google Sheet</h2>

      <div style={{ background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,.08)", maxWidth: 800 }}>
        <div style={{ background: "#eff6ff", padding: 16, borderRadius: 8, marginBottom: 20, fontSize: 13, lineHeight: 1.6 }}>
          <div style={{ fontWeight: 700, marginBottom: 8, color: "#1e40af" }}>📌 Hướng dẫn kết nối Google Sheet</div>
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
          <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 14, color: "#3b82f6", padding: "8px 0" }}>
            📋 Xem code Apps Script (bấm để mở)
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
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>➕ Thêm Sheet dự án mới</div>
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
              {adding ? "Đang thêm..." : "➕ Thêm"}
            </button>
          </div>
        </div>

        {/* List existing configs */}
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>📊 Danh sách Sheet đã cấu hình ({configs.length})</div>
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
              <div style={{ fontWeight: 700, fontSize: 14, color: "#1e40af" }}>🏗️ {cfg.name}</div>
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
                {testingId === cfg.id ? "..." : "🔗 Test"}
              </button>
              <button onClick={() => handleDelete(cfg.id)} style={{ ...btnDanger, padding: "4px 12px", fontSize: 12 }}>
                🗑️ Xóa
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
      const proj = getProject(p);
      if (proj) set.add(proj);
    });
    return [...set].sort();
  }, [sheetPosts]);

  const filteredPosts = useMemo(() => {
    if (filterProject === "all") return sheetPosts;
    const q = filterProject.toLowerCase();
    return sheetPosts.filter(p => (getProject(p) || "").toLowerCase().includes(q));
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
        <h2 style={{ margin: 0, fontSize: isMobile ? 16 : 20 }}>📅 Lịch đăng bài</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select style={{ ...inputStyle, width: 160, marginBottom: 0, fontSize: 12 }}
            value={filterProject} onChange={e => setFilterProject(e.target.value)}>
            <option value="all">Tất cả dự án</option>
            {uniqueProjects.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <button onClick={prevMonth} style={{ ...btnSecondary, padding: "6px 12px" }}>◀</button>
          <span style={{ fontWeight: 700, fontSize: 15, minWidth: 140, textAlign: "center" }}>
            {monthNames[month]} {year}
          </span>
          <button onClick={nextMonth} style={{ ...btnSecondary, padding: "6px 12px" }}>▶</button>
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
                background: isToday(d) ? "#eff6ff" : (d ? "#fff" : "#fafafa"),
              }}>
                {d && (
                  <>
                    <div style={{ fontSize: 12, fontWeight: isToday(d) ? 700 : 400, color: isToday(d) ? "#3b82f6" : "#374151", marginBottom: 2 }}>{d}</div>
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
const tableStyle = { width: "100%", borderCollapse: "collapse", fontSize: 13 };
const thStyle = {
  padding: "10px 12px", textAlign: "left", background: "#f8fafc",
  borderBottom: "2px solid #e5e7eb", fontSize: 12, fontWeight: 600, color: "#374151", whiteSpace: "nowrap",
};
const tdStyle = { padding: "8px 12px", borderBottom: "1px solid #f3f4f6" };
const labelStyle = { display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4, marginTop: 12 };
const inputStyle = {
  width: "100%", padding: "8px 12px", borderRadius: 8,
  border: "1px solid #d1d5db", fontSize: 13, marginBottom: 8, boxSizing: "border-box",
};
const btnPrimary = {
  padding: "8px 20px", background: "#3b82f6", color: "#fff",
  border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13,
};
const btnSecondary = {
  padding: "8px 16px", background: "#f3f4f6", color: "#374151",
  border: "1px solid #d1d5db", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13,
};
const btnDanger = {
  padding: "8px 16px", background: "#fee2e2", color: "#dc2626",
  border: "1px solid #fca5a5", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13,
};
