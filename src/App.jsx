import React, { useState, useEffect, useMemo, useCallback } from "react";

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

  if (!user || !token) {
    return <LoginPage onLogin={(u, t) => { setUser(u); setToken(t); }} />;
  }

  return <CRMApp user={user} onLogout={() => {
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
        <input style={inputStyle} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" />
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

function CRMApp({ user, onLogout }) {
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
        // First load: set all current IDs as seen
        if (data.leads) {
          setSeenLeadIds(prev => {
            if (prev.size === 0) {
              const ids = new Set(data.leads.map(l => l.id));
              localStorage.setItem("crm_seen_ids", JSON.stringify([...ids]));
              return ids;
            }
            return prev;
          });
        }
        applyApiData(data);
      })
      .catch(console.error);
  }, [applyApiData]);

  // Auto-sync every 30 seconds + countdown
  useEffect(() => {
    setSyncCountdown(30);
    const tick = setInterval(() => setSyncCountdown(c => c <= 1 ? 30 : c - 1), 1000);
    const interval = setInterval(() => {
      setSyncing(true);
      apiFetch(`${API}/sync`, { method: "POST" })
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(applyApiData)
        .catch(() => apiFetch(`${API}/data`).then(r => r.json()).then(applyApiData).catch(() => {}))
        .finally(() => setSyncing(false));
      setSyncCountdown(30);
    }, 30000);
    return () => { clearInterval(interval); clearInterval(tick); };
  }, [applyApiData]);

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
  ];

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

        <nav style={{ flex: 1 }}>
          {visibleNav.map((n) => (
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
          ))}
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
        {page === "users" && isAdmin && <UsersPage projects={projects} />}
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

  const getProjectSaleNames = (projectId) => {
    const assignedNames = allUsers
      .filter(u => u.role === "sale" && u.projectIds && u.projectIds.includes(projectId))
      .map(u => u.displayName)
      .filter(Boolean);
    const fromLeads = saleNames;
    const merged = new Set([...assignedNames, ...fromLeads]);
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
                    placeholder="🔍 Tìm sale..."
                    style={{ ...inputStyle, marginBottom: 0, marginTop: 4, width: "100%", fontSize: 13 }} />
                  {(() => {
                    const q = shuffleSaleSearch.toLowerCase();
                    const saleList = allUsers.filter(u => u.role === "sale" && u.displayName).filter(u => !q || u.displayName.toLowerCase().includes(q));
                    if (!shuffleSale && saleList.length > 0) return (
                      <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #d1d5db", borderRadius: 8, maxHeight: 200, overflowY: "auto", zIndex: 50, boxShadow: "0 4px 12px rgba(0,0,0,.1)" }}>
                        {saleList.map(u => (
                          <div key={u.id} onClick={() => { setShuffleSale(u.displayName); setShuffleSaleSearch(u.displayName); }}
                            style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid #f3f4f6", transition: "background .1s" }}
                            onMouseEnter={e => e.currentTarget.style.background = "#eff6ff"}
                            onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
                            👤 {u.displayName}
                          </div>
                        ))}
                        {saleList.length === 0 && <div style={{ padding: "8px 12px", color: "#9ca3af", fontSize: 12 }}>Không tìm thấy sale</div>}
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
                <th style={thStyle}>Chiến dịch</th>
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
                    <td style={{ ...tdStyle, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.campaign}</td>
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

function UsersPage({ projects }) {
  const isMobile = useIsMobile();
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [draft, setDraft] = useState({ username: "", password: "", displayName: "", role: "sale", telegramId: "", projectIds: [] });
  const [error, setError] = useState("");
  const [projectSearch, setProjectSearch] = useState("");

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
    setDraft({ username: "", password: "", displayName: "", role: "sale", telegramId: "", projectIds: [] });
    setError("");
    setProjectSearch("");
    setShowForm(true);
  };

  const openEdit = (u) => {
    setEditingUser(u);
    setDraft({ username: u.username, password: "", displayName: u.displayName, role: u.role, telegramId: u.telegramId || "", projectIds: u.projectIds || [] });
    setError("");
    setProjectSearch("");
    setShowForm(true);
  };

  const handleSave = async () => {
    setError("");
    try {
      if (editingUser) {
        const body = { displayName: draft.displayName, role: draft.role, telegramId: draft.telegramId, projectIds: draft.projectIds };
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 14, color: "#6b7280" }}>👤 {users.length} tài khoản</div>
        <button onClick={openNew} style={{ ...btnPrimary, minHeight: 40 }}>+ Thêm tài khoản</button>
      </div>

      {isMobile ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 32 }}>
          {users.map((u) => (
            <div key={u.id} style={{ background: "#fff", borderRadius: 10, padding: 14, boxShadow: "0 1px 3px rgba(0,0,0,.06)", border: "1px solid #e5e7eb" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{u.displayName || u.username}</span>
                  <span style={{
                    marginLeft: 8, padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                    background: u.role === "admin" ? "#fef2f2" : "#eff6ff",
                    color: u.role === "admin" ? "#dc2626" : "#2563eb",
                  }}>{u.role === "admin" ? "Admin" : "Sale"}</span>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => openEdit(u)} style={{ ...btnSecondary, padding: "6px 12px", fontSize: 12, minHeight: 36 }}>✏️</button>
                  <button onClick={() => handleDelete(u.id)} style={{ ...btnDanger, padding: "6px 12px", fontSize: 12, minHeight: 36 }}>🗑️</button>
                </div>
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", display: "flex", flexDirection: "column", gap: 3 }}>
                <div>👤 @{u.username}</div>
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
                <td style={tdStyle}>{u.displayName}</td>
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
          <input style={inputStyle} type="password" value={draft.password}
            onChange={(e) => setDraft({ ...draft, password: e.target.value })} placeholder="••••••" />
          <label style={labelStyle}>Tên hiển thị</label>
          <input style={inputStyle} value={draft.displayName}
            onChange={(e) => setDraft({ ...draft, displayName: e.target.value })} placeholder="VD: Nguyễn Văn A" />
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
    </>
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
