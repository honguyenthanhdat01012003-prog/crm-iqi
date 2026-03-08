import React, { useState, useEffect, useMemo, useCallback } from "react";

const API = "/api";

const STATUS_LABELS = {
  new: "Mới",
  called: "Đã gọi",
  interested: "Quan tâm",
  appointment: "Hẹn xem",
  booked: "Giữ chỗ",
  closed: "Chốt",
  not_interested: "Không quan tâm",
  unreachable: "Không liên lạc được",
  lost: "Mất",
};

const STATUS_COLORS = {
  new: "#6b7280",
  called: "#3b82f6",
  interested: "#f59e0b",
  appointment: "#8b5cf6",
  booked: "#10b981",
  closed: "#059669",
  not_interested: "#ef4444",
  unreachable: "#9ca3af",
  lost: "#dc2626",
};

function formatVND(n) {
  if (!n && n !== 0) return "0 ₫";
  return Number(n).toLocaleString("vi-VN") + " ₫";
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
      fontFamily: "'Segoe UI', system-ui, sans-serif",
    }}>
      <form onSubmit={handleSubmit} style={{
        background: "#fff", borderRadius: 16, padding: 40, width: 380, maxWidth: "90vw",
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
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Project modal state
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [draftProject, setDraftProject] = useState({ name: "", leadUrl: "", costUrl: "" });

  const applyApiData = useCallback((data) => {
    if (data.leads) setLeads(data.leads);
    if (data.campaigns) setCampaigns(data.campaigns);
    if (data.projects) setProjects(data.projects);
    if (data.lastSync) setLastSync(data.lastSync);
  }, []);

  useEffect(() => {
    apiFetch(`${API}/data`)
      .then((r) => r.json())
      .then(applyApiData)
      .catch(console.error);
  }, [applyApiData]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const r = await apiFetch(`${API}/sync`, { method: "POST" });
      const data = await r.json();
      applyApiData(data);
    } catch (e) {
      console.error("Sync failed", e);
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

  const saveProject = async () => {
    const body = draftProject;
    const url = editingProject ? `${API}/projects/${editingProject.id}` : `${API}/projects`;
    const method = editingProject ? "PUT" : "POST";
    try {
      const r = await apiFetch(url, { method, body: JSON.stringify(body) });
      const data = await r.json();
      applyApiData(data);
      setShowProjectModal(false);
    } catch (e) {
      console.error("Save project failed", e);
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
      statusCounts[l.status] = (statusCounts[l.status] || 0) + 1;
    });
    return { total: filteredLeads.length, ...statusCounts };
  }, [filteredLeads]);

  // --- Sale ranking ---
  const saleRanking = useMemo(() => {
    const map = {};
    filteredLeads.forEach((l) => {
      const sale = l.saleName || "Chưa chia";
      if (!map[sale]) map[sale] = { name: sale, total: 0, interested: 0, booked: 0, closed: 0 };
      map[sale].total++;
      if (l.status === "interested") map[sale].interested++;
      if (l.status === "booked") map[sale].booked++;
      if (l.status === "closed") map[sale].closed++;
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
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "'Segoe UI', system-ui, sans-serif", background: "#f0f2f5" }}>
      {/* Sidebar */}
      <aside
        style={{
          width: sidebarOpen ? 220 : 56,
          background: "linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)",
          color: "#fff",
          transition: "width .2s",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
        }}
      >
        <div
          style={{ padding: "16px 12px", cursor: "pointer", fontWeight: 700, fontSize: 18, whiteSpace: "nowrap" }}
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? "☰ RealCRM" : "☰"}
        </div>

        {/* Project selector */}
        {sidebarOpen && (
          <div style={{ padding: "0 12px 12px" }}>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              style={{ width: "100%", padding: "6px", borderRadius: 6, border: "none", fontSize: 13 }}
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
              onClick={() => setPage(n.key)}
              style={{
                padding: "12px 16px",
                cursor: "pointer",
                background: page === n.key ? "rgba(255,255,255,.12)" : "transparent",
                borderLeft: page === n.key ? "3px solid #3b82f6" : "3px solid transparent",
                whiteSpace: "nowrap",
                fontSize: 14,
                transition: "background .15s",
              }}
            >
              {sidebarOpen ? n.label : n.label.slice(0, 2)}
            </div>
          ))}
        </nav>

        {sidebarOpen && (
          <div style={{ padding: "12px", borderTop: "1px solid rgba(255,255,255,.1)" }}>
            <div style={{ fontSize: 12, marginBottom: 6, opacity: 0.9 }}>
              {user.displayName} <span style={{
                fontSize: 10, padding: "1px 6px", borderRadius: 8,
                background: user.role === "admin" ? "#ef4444" : "#3b82f6", color: "#fff",
              }}>{user.role === "admin" ? "Admin" : "Sale"}</span>
            </div>
            <button
              onClick={onLogout}
              style={{
                width: "100%", padding: "6px", background: "rgba(255,255,255,.1)",
                border: "1px solid rgba(255,255,255,.2)", borderRadius: 6,
                color: "#fff", cursor: "pointer", fontSize: 12,
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
      <main style={{ flex: 1, padding: 24, overflow: "auto" }}>
        {/* Top bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, color: "#1a1a2e" }}>
            {visibleNav.find((n) => n.key === page)?.label || "Dashboard"}
          </h2>
          {isAdmin && (
            <button
              onClick={handleSync}
              disabled={syncing}
              style={{
                padding: "8px 20px",
                background: syncing ? "#94a3b8" : "#3b82f6",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                cursor: syncing ? "not-allowed" : "pointer",
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              {syncing ? "Đang đồng bộ..." : "🔄 Đồng bộ"}
            </button>
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
          />
        )}
        {page === "projects" && isAdmin && (
          <ProjectsPage
            projects={projects}
            openNewProject={openNewProject}
            openEditProject={openEditProject}
            deleteProject={deleteProject}
          />
        )}
        {page === "campaigns" && isAdmin && <CampaignsPage leads={filteredLeads} />}
        {page === "sales" && isAdmin && <SalesPage ranking={saleRanking} />}
        {page === "users" && isAdmin && <UsersPage />}
      </main>

      {/* Project Modal */}
      {showProjectModal && (
        <Modal onClose={() => setShowProjectModal(false)} title={editingProject ? "Sửa dự án" : "Thêm dự án"}>
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
            <button onClick={saveProject} style={{ ...btnPrimary, flex: 1 }}>Lưu</button>
            <button onClick={() => setShowProjectModal(false)} style={{ ...btnSecondary, flex: 1 }}>Hủy</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ===== Components ===== */

function Modal({ onClose, title, children }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,.45)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 12, padding: 24, width: 460, maxWidth: "90vw",
          boxShadow: "0 20px 60px rgba(0,0,0,.3)",
        }}
      >
        <h3 style={{ margin: "0 0 16px" }}>{title}</h3>
        {children}
      </div>
    </div>
  );
}

function Card({ title, value, sub, color = "#3b82f6" }) {
  return (
    <div
      style={{
        background: "#fff", borderRadius: 12, padding: 20,
        boxShadow: "0 1px 3px rgba(0,0,0,.08)",
        borderTop: `3px solid ${color}`, minWidth: 160, flex: "1 1 160px",
      }}
    >
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function DashboardPage({ stats, cost, saleRanking }) {
  return (
    <>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <Card title="Tổng Lead" value={stats.total} color="#3b82f6" />
        <Card title="Quan tâm" value={stats.interested || 0} color="#f59e0b" />
        <Card title="Giữ chỗ" value={stats.booked || 0} color="#10b981" />
        <Card title="Chốt" value={stats.closed || 0} color="#059669" />
        <Card title="Chi phí" value={formatVND(cost.totalSpent)} sub={`CPL: ${formatVND(cost.cpLead)}`} color="#8b5cf6" />
        <Card title="Tổng lead (sheet)" value={cost.totalLeads || 0} sub={`Booking: ${cost.totalBooking || 0}`} color="#ec4899" />
      </div>

      <div style={{ background: "#fff", borderRadius: 12, padding: 20, marginBottom: 24, boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
        <h4 style={{ margin: "0 0 12px" }}>Phân bổ trạng thái</h4>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <span
              key={key}
              style={{
                padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                background: STATUS_COLORS[key] + "18", color: STATUS_COLORS[key],
              }}
            >
              {label}: {stats[key] || 0}
            </span>
          ))}
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
        <h4 style={{ margin: "0 0 12px" }}>🏆 Bảng xếp hạng Sale</h4>
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
            {saleRanking.map((s, i) => (
              <tr key={s.name} style={{ background: i % 2 ? "#f9fafb" : "#fff" }}>
                <td style={tdStyle}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</td>
                <td style={tdStyle}>{s.name}</td>
                <td style={tdStyle}>{s.total}</td>
                <td style={tdStyle}>{s.interested}</td>
                <td style={tdStyle}>{s.booked}</td>
                <td style={tdStyle}>{s.closed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function LeadsPage({ leads, searchText, setSearchText, statusFilter, setStatusFilter, dateFrom, setDateFrom, dateTo, setDateTo, projects, user, applyApiData, onLogout }) {
  const [expandedId, setExpandedId] = useState(null);
  const [activeTab, setActiveTab] = useState("all");
  const [shuffleOpen, setShuffleOpen] = useState(false);
  const [shuffleSales, setShuffleSales] = useState("");
  const [shuffleProject, setShuffleProject] = useState("1");
  const [shuffling, setShuffling] = useState(false);
  const [shuffleMsg, setShuffleMsg] = useState("");
  const isAdmin = user.role === "admin";
  const projectMap = useMemo(() => {
    const m = {};
    projects.forEach((p) => (m[p.id] = p.name));
    return m;
  }, [projects]);

  // Bitrix-style lead categories
  const LEAD_TABS = useMemo(() => [
    { key: "all", label: "Tất cả", icon: "📋", filter: () => true },
    { key: "new", label: "Chưa liên hệ", icon: "🆕", filter: (l) => l.status === "new" },
    { key: "interested", label: "Quan tâm", icon: "⭐", filter: (l) => l.status === "interested" },
    { key: "appointment", label: "Hẹn xem", icon: "📅", filter: (l) => l.status === "appointment" },
    { key: "booked", label: "Giữ chỗ", icon: "✅", filter: (l) => l.status === "booked" },
    { key: "closed", label: "Chốt", icon: "🏆", filter: (l) => l.status === "closed" },
    { key: "unreachable", label: "KLH / Thuê bao", icon: "📵", filter: (l) => l.status === "unreachable" },
    { key: "not_interested", label: "Không quan tâm", icon: "👎", filter: (l) => l.status === "not_interested" },
    { key: "called", label: "Đã gọi", icon: "📞", filter: (l) => l.status === "called" },
  ], []);

  const tabCounts = useMemo(() => {
    const counts = {};
    LEAD_TABS.forEach((t) => { counts[t.key] = leads.filter(t.filter).length; });
    return counts;
  }, [leads, LEAD_TABS]);

  const tabFiltered = useMemo(() => {
    const tab = LEAD_TABS.find((t) => t.key === activeTab);
    return tab ? leads.filter(tab.filter) : leads;
  }, [leads, activeTab, LEAD_TABS]);

  const handleShuffle = async () => {
    const names = shuffleSales.split(",").map((s) => s.trim()).filter(Boolean);
    if (!names.length) return;
    setShuffling(true);
    setShuffleMsg("");
    try {
      const r = await apiFetch(`${API}/leads/shuffle`, {
        method: "POST",
        body: JSON.stringify({ projectId: Number(shuffleProject), saleNames: names }),
      });
      const data = await r.json();
      if (data.error) { setShuffleMsg("❌ " + data.error); }
      else { setShuffleMsg("✅ " + data.msg); applyApiData(data); }
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

      {/* Admin shuffle */}
      {isAdmin && (
        <div style={{ marginBottom: 12 }}>
          <button onClick={() => setShuffleOpen(!shuffleOpen)}
            style={{ ...btnPrimary, padding: "6px 16px", fontSize: 13 }}>
            🔀 Xáo Lead cho Sale
          </button>
          {shuffleOpen && (
            <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8, padding: 12, marginTop: 8, fontSize: 13 }}>
              <div style={{ fontWeight: 600, marginBottom: 8, color: "#9a3412" }}>🔀 Xáo Lead (chia đều cho sale)</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
                <div>
                  <label style={{ fontSize: 11, color: "#6b7280" }}>Dự án</label>
                  <select value={shuffleProject} onChange={(e) => setShuffleProject(e.target.value)}
                    style={{ display: "block", padding: "6px 8px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 12, marginTop: 4 }}>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, color: "#6b7280" }}>Tên Sale (phân cách bằng dấu phẩy)</label>
                  <input value={shuffleSales} onChange={(e) => setShuffleSales(e.target.value)}
                    placeholder="VD: Nguyễn Văn A, Trần Văn B, Lê Văn C"
                    style={{ ...inputStyle, marginBottom: 0, marginTop: 4, width: "100%" }} />
                </div>
                <button onClick={handleShuffle} disabled={shuffling}
                  style={{ ...btnPrimary, padding: "8px 16px", whiteSpace: "nowrap" }}>
                  {shuffling ? "Đang xáo..." : "🔀 Xáo ngay"}
                </button>
              </div>
              {shuffleMsg && <div style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: shuffleMsg.startsWith("✅") ? "#059669" : "#dc2626" }}>{shuffleMsg}</div>}
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>Chỉ xáo lead "Chưa chia" — lead đã có sale sẽ không bị thay đổi</div>
            </div>
          )}
        </div>
      )}

      {/* Bitrix-style tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {LEAD_TABS.map((t) => {
          const isActive = activeTab === t.key;
          const count = tabCounts[t.key] || 0;
          return (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              style={{
                padding: "8px 14px", borderRadius: 20, border: isActive ? "2px solid #3b82f6" : "1px solid #e5e7eb",
                background: isActive ? "#eff6ff" : "#fff", color: isActive ? "#1d4ed8" : "#374151",
                cursor: "pointer", fontSize: 12, fontWeight: isActive ? 700 : 500,
                display: "flex", alignItems: "center", gap: 4, transition: "all .15s",
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
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input
          style={{ ...inputStyle, flex: "1 1 200px", marginBottom: 0 }}
          placeholder="🔍 Tìm tên, SĐT, chiến dịch, sale..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
          <span style={{ color: "#6b7280" }}>Từ:</span>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 12 }} />
          <span style={{ color: "#6b7280", marginLeft: 4 }}>Đến:</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 12 }} />
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(""); setDateTo(""); }}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#ef4444" }} title="Xóa lọc ngày">✕</button>
          )}
        </div>
      </div>

      <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 8 }}>
        Hiển thị {tabFiltered.length} khách hàng — click vào dòng để xem chi tiết & lịch sử
      </div>

      {/* Lead cards (Bitrix-style for sale) / table for admin */}
      {!isAdmin ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {tabFiltered.map((l) => {
            const isOpen = expandedId === l.id;
            const histCount = (l.saleHistory || []).length;
            return (
              <div key={l.id} style={{ background: "#fff", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,.06)", border: isOpen ? "2px solid #3b82f6" : "1px solid #e5e7eb", overflow: "hidden" }}>
                <div onClick={() => setExpandedId(isOpen ? null : l.id)}
                  style={{ padding: "12px 16px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{l.name}</span>
                      <span style={{
                        padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                        background: (STATUS_COLORS[l.status] || "#6b7280") + "18",
                        color: STATUS_COLORS[l.status] || "#6b7280",
                      }}>
                        {STATUS_LABELS[l.status] || l.status}
                      </span>
                      {l.isHot && <span style={{ fontSize: 11 }}>🔥</span>}
                    </div>
                    <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#6b7280", flexWrap: "wrap" }}>
                      <span>📱 {l.phone || "-"}</span>
                      <span>📅 {l.createdAt || "-"}</span>
                      {histCount > 0 && <span>📋 {histCount} lần LH</span>}
                      <span style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📢 {l.campaign}</span>
                    </div>
                  </div>
                  <span style={{ fontSize: 16, color: "#9ca3af" }}>{isOpen ? "▼" : "▶"}</span>
                </div>
                {isOpen && (
                  <div style={{ borderTop: "1px solid #e5e7eb" }}>
                    <LeadDetail lead={l} projectName={projectMap[l.projectId] || "-"} isAdmin={false} user={user} applyApiData={applyApiData} />
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
                <th style={thStyle}>Loại</th>
              </tr>
            </thead>
            <tbody>
              {tabFiltered.flatMap((l, i) => {
                const isOpen = expandedId === l.id;
                const rows = [
                  <tr key={l.id} onClick={() => setExpandedId(isOpen ? null : l.id)}
                    style={{ background: isOpen ? "#eff6ff" : i % 2 ? "#f9fafb" : "#fff", cursor: "pointer", transition: "background .15s" }}>
                    <td style={tdStyle}>{i + 1}</td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{isOpen ? "▼ " : "▶ "}{l.name}</td>
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
                      {l.isHot
                        ? <span style={{ background: "#fef2f2", color: "#dc2626", padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600 }}>🔥 Nóng</span>
                        : <span style={{ background: "#f0f9ff", color: "#3b82f6", padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600 }}>❄️ Cũ</span>
                      }
                    </td>
                  </tr>,
                ];
                if (isOpen) {
                  rows.push(
                    <tr key={`${l.id}-detail`}>
                      <td colSpan={9} style={{ padding: 0, background: "#f8fafc", borderBottom: "2px solid #3b82f6" }}>
                        <LeadDetail lead={l} projectName={projectMap[l.projectId] || "-"} isAdmin={isAdmin} user={user} applyApiData={applyApiData} />
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
    </>
  );
}

function LeadDetail({ lead, projectName, isAdmin, user, applyApiData }) {
  const history = lead.saleHistory || [];
  const [showForm, setShowForm] = useState(false);
  const [histStatus, setHistStatus] = useState("");
  const [histFeedback, setHistFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const [editStatus, setEditStatus] = useState(lead.status);
  const [editSale, setEditSale] = useState(lead.saleName || "");
  const [savingAdmin, setSavingAdmin] = useState(false);

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

  const handleAdminUpdate = async () => {
    setSavingAdmin(true);
    try {
      const body = { status: editStatus };
      if (isAdmin) body.saleName = editSale;
      const r = await apiFetch(`${API}/leads/${lead.id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      const data = await r.json();
      applyApiData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setSavingAdmin(false);
    }
  };

  return (
    <div style={{ padding: "16px 24px" }}>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 16, fontSize: 13 }}>
        <div><span style={{ color: "#6b7280", fontSize: 11 }}>Khách hàng</span><br /><b>{lead.name}</b></div>
        <div><span style={{ color: "#6b7280", fontSize: 11 }}>SĐT</span><br /><b>{lead.phone || "-"}</b></div>
        <div><span style={{ color: "#6b7280", fontSize: 11 }}>Dự án</span><br /><b>{projectName}</b></div>
        <div><span style={{ color: "#6b7280", fontSize: 11 }}>Sản phẩm</span><br /><b>{lead.product || "-"}</b></div>
        <div><span style={{ color: "#6b7280", fontSize: 11 }}>Ngày nhận lead</span><br /><b>{lead.createdAt || "-"}</b></div>
        <div>
          <span style={{ color: "#6b7280", fontSize: 11 }}>Loại</span><br />
          {lead.isHot
            ? <span style={{ color: "#dc2626", fontWeight: 700 }}>🔥 Lead nóng (≤ 7 ngày, chưa chia)</span>
            : <span style={{ color: "#3b82f6", fontWeight: 700 }}>❄️ Lead cũ (đã chia hoặc {'>'} 7 ngày)</span>
          }
        </div>
      </div>

      {/* Admin controls */}
      {isAdmin && (
        <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13 }}>
          <b style={{ fontSize: 12, color: "#9a3412" }}>🔧 Quản trị</b>
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
            <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)}
              style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 12 }}>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input value={editSale} onChange={(e) => setEditSale(e.target.value)}
              placeholder="Tên sale" style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 12, width: 140 }} />
            <button onClick={handleAdminUpdate} disabled={savingAdmin}
              style={{ ...btnPrimary, padding: "4px 12px", fontSize: 12 }}>
              {savingAdmin ? "..." : "Cập nhật"}
            </button>
          </div>
        </div>
      )}

      <h4 style={{ margin: "0 0 12px", fontSize: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>📋 Lịch sử liên hệ ({history.length} lần)</span>
        <button onClick={() => setShowForm(!showForm)}
          style={{ ...btnPrimary, padding: "4px 12px", fontSize: 12 }}>
          {showForm ? "Hủy" : "+ Thêm cập nhật"}
        </button>
      </h4>

      {/* Add history form */}
      {showForm && (
        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: "1 1 200px" }}>
              <label style={{ fontSize: 11, color: "#374151", fontWeight: 600 }}>Trạng thái</label>
              <input value={histStatus} onChange={(e) => setHistStatus(e.target.value)}
                placeholder="VD: Quan tâm, Hẹn xem..."
                style={{ ...inputStyle, marginBottom: 0, marginTop: 4 }} />
            </div>
            <div style={{ flex: "2 1 300px" }}>
              <label style={{ fontSize: 11, color: "#374151", fontWeight: 600 }}>Feedback</label>
              <input value={histFeedback} onChange={(e) => setHistFeedback(e.target.value)}
                placeholder="Ghi chú về khách hàng..."
                style={{ ...inputStyle, marginBottom: 0, marginTop: 4 }} />
            </div>
            <button onClick={handleAddHistory} disabled={saving}
              style={{ ...btnPrimary, padding: "8px 16px", whiteSpace: "nowrap" }}>
              {saving ? "Đang lưu..." : "💾 Lưu"}
            </button>
          </div>
        </div>
      )}

      {history.length === 0 ? (
        <div style={{ color: "#9ca3af", fontSize: 13, paddingBottom: 8 }}>Chưa có lịch sử liên hệ</div>
      ) : (
        <div style={{ position: "relative", paddingLeft: 24, paddingBottom: 8 }}>
          <div style={{ position: "absolute", left: 8, top: 4, bottom: 4, width: 2, background: "#e5e7eb" }} />
          {history.map((h, idx) => {
            const recalled = (h.action || "").toLowerCase().includes("thu h");
            const isUpdate = (h.action || "").toLowerCase().includes("cập nhật") || (h.action || "").toLowerCase().includes("cap nhat");
            const dotColor = recalled ? "#ef4444" : isUpdate ? "#10b981" : "#3b82f6";
            return (
              <div key={idx} style={{ position: "relative", marginBottom: 12, paddingLeft: 16 }}>
                <div style={{
                  position: "absolute", left: -16, top: 6, width: 10, height: 10,
                  borderRadius: "50%", background: dotColor,
                  border: "2px solid #fff", boxShadow: `0 0 0 2px ${dotColor}33`,
                }} />
                <div style={{ background: "#fff", borderRadius: 8, padding: 12, border: "1px solid #e5e7eb" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>
                      Lần {idx + 1}: {h.saleName}
                      <span style={{
                        marginLeft: 8, fontSize: 11, padding: "1px 6px", borderRadius: 8,
                        background: recalled ? "#fef2f2" : isUpdate ? "#f0fdf4" : "#eff6ff",
                        color: recalled ? "#dc2626" : isUpdate ? "#059669" : "#2563eb",
                      }}>{h.action}</span>
                    </span>
                    <span style={{ fontSize: 11, color: "#9ca3af" }}>{h.date || "-"}</span>
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

function ProjectsPage({ projects, openNewProject, openEditProject, deleteProject }) {
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 14, color: "#6b7280" }}>{projects.length} dự án</div>
        <button onClick={openNewProject} style={btnPrimary}>+ Thêm dự án</button>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {projects.map((p) => {
          const c = p.costData || {};
          return (
            <div
              key={p.id}
              style={{
                background: "#fff", borderRadius: 12, padding: 20, width: 320,
                boxShadow: "0 1px 3px rgba(0,0,0,.08)", borderTop: "3px solid #3b82f6",
              }}
            >
              <h4 style={{ margin: "0 0 12px" }}>{p.name}</h4>
              <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>Chi phí: <b>{formatVND(c.totalSpent)}</b></div>
              <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>Lead: <b>{c.totalLeads || 0}</b> | Booking: <b>{c.totalBooking || 0}</b></div>
              <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>CPL: <b>{formatVND(c.cpLead)}</b></div>
              <div style={{ display: "flex", gap: 8 }}>
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
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>📊 Thống kê chiến dịch</h3>
        <span style={{ fontSize: 13, color: "#6b7280" }}>Tổng: {leads.length} lead · {campaignNames.length} chiến dịch · Kênh: Facebook</span>
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
  return (
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

function UsersPage() {
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [draft, setDraft] = useState({ username: "", password: "", displayName: "", role: "sale" });
  const [error, setError] = useState("");

  const loadUsers = async () => {
    try {
      const r = await apiFetch(`${API}/users`);
      setUsers(await r.json());
    } catch (e) { console.error(e); }
  };

  useEffect(() => { loadUsers(); }, []);

  const openNew = () => {
    setEditingUser(null);
    setDraft({ username: "", password: "", displayName: "", role: "sale" });
    setError("");
    setShowForm(true);
  };

  const openEdit = (u) => {
    setEditingUser(u);
    setDraft({ username: u.username, password: "", displayName: u.displayName, role: u.role });
    setError("");
    setShowForm(true);
  };

  const handleSave = async () => {
    setError("");
    try {
      if (editingUser) {
        const body = { displayName: draft.displayName, role: draft.role };
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

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 14, color: "#6b7280" }}>{users.length} tài khoản</div>
        <button onClick={openNew} style={btnPrimary}>+ Thêm tài khoản</button>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, overflow: "auto", boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>#</th>
              <th style={thStyle}>Username</th>
              <th style={thStyle}>Tên hiển thị</th>
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
          <label style={labelStyle}>Quyền</label>
          <select value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })}
            style={{ ...inputStyle }}>
            <option value="sale">Sale</option>
            <option value="admin">Admin</option>
          </select>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button onClick={handleSave} style={{ ...btnPrimary, flex: 1 }}>Lưu</button>
            <button onClick={() => setShowForm(false)} style={{ ...btnSecondary, flex: 1 }}>Hủy</button>
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
