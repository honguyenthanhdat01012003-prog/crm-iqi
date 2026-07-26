import React, { useCallback, useEffect, useState } from "react";
import { Plus, RefreshCw, Trash2, X, Link as LinkIcon } from "lucide-react";

/**
 * Modal quản lý nguồn giỏ hàng (Google Sheet) theo dự án.
 */
export default function InventorySourcesModal({
  project,
  apiFetch,
  API,
  onClose,
  showToast,
  btnPrimary,
  btnSecondary,
  btnDanger,
  inputStyle,
}) {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncingId, setSyncingId] = useState(null);
  const [draft, setDraft] = useState({ code: "", name: "", sheetUrl: "" });

  const load = useCallback(async () => {
    if (!project?.id) return;
    setLoading(true);
    try {
      const r = await apiFetch(`${API}/projects/${project.id}/inventory-sources`);
      const d = await r.json().catch(() => ([]));
      if (!r.ok) throw new Error(d.error || "Không tải được giỏ hàng");
      setSources(Array.isArray(d) ? d : (d.sources || []));
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }, [API, apiFetch, project?.id, showToast]);

  useEffect(() => { load(); }, [load]);

  const addSource = async () => {
    if (!draft.code.trim() || !draft.sheetUrl.trim()) {
      showToast("Nhập mã nguồn (STH/IQI…) và link Sheet", "warning");
      return;
    }
    setSaving(true);
    try {
      const r = await apiFetch(`${API}/projects/${project.id}/inventory-sources`, {
        method: "POST",
        body: JSON.stringify({
          code: draft.code.trim(),
          name: draft.name.trim() || draft.code.trim(),
          sheetUrl: draft.sheetUrl.trim(),
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        const hint = r.status === 404
          ? "API giỏ hàng chưa có trên server (cần deploy bản inventory)."
          : (d.error || `Thêm thất bại (HTTP ${r.status})`);
        throw new Error(hint);
      }
      setDraft({ code: "", name: "", sheetUrl: "" });
      if (d.sync?.ok) showToast(`Đã thêm & sync ${d.sync.count} căn (${d.sync.code})`, "success");
      else if (d.sync?.error) showToast(`Đã lưu nguồn nhưng sync lỗi: ${d.sync.error}`, "warning");
      else showToast("Đã thêm nguồn giỏ hàng", "success");
      await load();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const syncOne = async (id) => {
    setSyncingId(id);
    try {
      const r = await apiFetch(`${API}/inventory-sources/${id}/sync`, { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Sync thất bại");
      showToast(`Sync OK: ${d.count} căn`, "success");
      await load();
    } catch (e) {
      showToast(e.message, "error");
      await load();
    } finally {
      setSyncingId(null);
    }
  };

  const removeOne = async (s) => {
    if (!window.confirm(`Xóa nguồn ${s.code}? Toàn bộ căn đã sync của nguồn này sẽ bị xóa.`)) return;
    try {
      const r = await apiFetch(`${API}/inventory-sources/${s.id}`, { method: "DELETE" });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || "Xóa thất bại");
      }
      showToast("Đã xóa nguồn", "success");
      await load();
    } catch (e) {
      showToast(e.message, "error");
    }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.45)", zIndex: 2100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ width: "min(560px, 100%)", maxHeight: "90vh", overflow: "auto", background: "#fff", borderRadius: 14, boxShadow: "0 20px 60px rgba(15,23,42,.25)", border: "1px solid #e2e8f0" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "14px 16px", borderBottom: "1px solid #eef2f7", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "#fff", zIndex: 1 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 900, color: "#0f3d1e" }}>Giỏ hàng / Inventory</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Dự án: <b>{project?.name}</b> — mỗi đại lý 1 Sheet</div>
          </div>
          <button type="button" onClick={onClose} style={{ border: "none", background: "#f8fafc", width: 32, height: 32, borderRadius: 8, cursor: "pointer", color: "#64748b" }}><X size={18} /></button>
        </div>

        <div style={{ padding: 16 }}>
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#334155", marginBottom: 8 }}>Thêm nguồn (STH, IQI, LUX…)</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 8, marginBottom: 8 }}>
              <input
                style={{ ...inputStyle, marginBottom: 0 }}
                placeholder="Mã nguồn (STH)"
                value={draft.code}
                onChange={(e) => setDraft({ ...draft, code: e.target.value })}
              />
              <input
                style={{ ...inputStyle, marginBottom: 0 }}
                placeholder="Tên hiển thị (tuỳ chọn)"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>
            <input
              style={{ ...inputStyle, marginBottom: 8, width: "100%" }}
              placeholder="Link Google Sheet (Publish to web → CSV hoặc /pub?…)"
              value={draft.sheetUrl}
              onChange={(e) => setDraft({ ...draft, sheetUrl: e.target.value })}
            />
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>
              Dán link Sheet (share hoặc Publish CSV). Sheet cần cột: <b>Mã căn</b>, giá, loại căn, hướng, view, link Drive…
              <br />Quyền xem: Anyone with the link / Publish to web.
            </div>
            <button type="button" onClick={addSource} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.65 : 1, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Plus size={14} /> {saving ? "Đang thêm & sync..." : "Thêm + Sync ngay"}
            </button>
          </div>

          {loading ? (
            <div style={{ fontSize: 13, color: "#64748b", padding: 12 }}>Đang tải...</div>
          ) : sources.length === 0 ? (
            <div style={{ fontSize: 13, color: "#94a3b8", padding: 12, textAlign: "center" }}>Chưa có nguồn giỏ hàng nào.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {sources.map((s) => (
                <div key={s.id} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, background: "#fff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11, fontWeight: 900, background: "#ede9fe", color: "#6d28d9", padding: "2px 8px", borderRadius: 999 }}>{s.code}</span>
                        <b style={{ fontSize: 13, color: "#0f172a" }}>{s.name || s.code}</b>
                        <span style={{ fontSize: 11, color: "#64748b" }}>{s.unitCount || s.lastSyncCount || 0} căn</span>
                      </div>
                      {s.sheetUrl && (
                        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 4 }}>
                          <LinkIcon size={11} /> {s.sheetUrl}
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: s.lastSyncError ? "#dc2626" : "#64748b", marginTop: 4 }}>
                        {s.lastSyncError
                          ? `Lỗi sync: ${s.lastSyncError}`
                          : (s.lastSyncAt ? `Sync lần cuối: ${s.lastSyncAt}` : "Chưa sync")}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button type="button" onClick={() => syncOne(s.id)} disabled={!!syncingId} style={{ ...btnSecondary, padding: "6px 10px", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                        <RefreshCw size={12} /> {syncingId === s.id ? "..." : "Sync"}
                      </button>
                      <button type="button" onClick={() => removeOne(s)} style={{ ...btnDanger, padding: "6px 10px", fontSize: 12 }}><Trash2 size={12} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
