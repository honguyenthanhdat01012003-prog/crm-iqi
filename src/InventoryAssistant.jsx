import React, { useEffect, useMemo, useRef, useState } from "react";
import { getApiBase } from "./httpClient.js";

const API = getApiBase();

const MENU_ITEMS = [
  { key: "project", label: "Chọn dự án", icon: "📁" },
  { key: "code", label: "Tìm mã căn", icon: "🔑" },
  { key: "price", label: "Lọc theo giá", icon: "💰" },
  { key: "type", label: "Loại căn", icon: "🛏️" },
  { key: "stock", label: "Còn hàng", icon: "✅" },
  { key: "drive", label: "Link Drive", icon: "🔗" },
];

function formatVnd(n) {
  return Number(n || 0).toLocaleString("vi-VN") + " ₫";
}

function toCardUnit(u) {
  return {
    key: `${u.id || u.unitCode}-${u.source || ""}`,
    id: u.unitCode || u.id || "?",
    project: u.projectName || "",
    source: u.source || "",
    building: u.building || "",
    type: u.layout || u.unitType || "",
    direction: u.direction || "",
    view: u.view || "",
    price: u.price || 0,
    driveUrl: u.driveUrl || "",
    status: u.status || "",
  };
}

function statusLabel(s) {
  if (s === "sold") return "Đã bán";
  if (s === "booking") return "Booking";
  if (s === "available") return "Còn trống";
  return s || "";
}

function UnitCard({ u }) {
  return (
    <div className="iqi-asst-unit">
      <div className="iqi-asst-unit__head">
        <strong>{u.id}</strong>
        <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {u.status ? <span className="iqi-asst-unit__src" style={{
            background: u.status === "sold" ? "#fee2e2" : u.status === "booking" ? "#fef9c3" : "#dcfce7",
            color: u.status === "sold" ? "#b91c1c" : u.status === "booking" ? "#a16207" : "#166534",
          }}>{statusLabel(u.status)}</span> : null}
          {u.source ? <span className="iqi-asst-unit__src">{u.source}</span> : null}
        </span>
      </div>
      <div className="iqi-asst-unit__meta">
        {[u.project, u.building && `Tòa ${u.building}`, u.type, u.direction, u.view].filter(Boolean).join(" · ")}
      </div>
      <div className="iqi-asst-unit__price">{formatVnd(u.price)}</div>
      {u.driveUrl ? (
        <a className="iqi-asst-unit__drive" href={u.driveUrl} target="_blank" rel="noopener noreferrer">
          Mở link Drive / PTG
        </a>
      ) : (
        <div className="iqi-asst-unit__drive" style={{ opacity: 0.55, pointerEvents: "none" }}>Chưa có link Drive</div>
      )}
    </div>
  );
}

/**
 * Widget trợ lý giỏ hàng — tra cứu từ DB (đã sync Sheet).
 */
export default function InventoryAssistant({ user, projects = [], isMobile = false, apiFetch }) {
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(true);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState([]);
  const [projectFilterId, setProjectFilterId] = useState(null);
  const [projectFilterName, setProjectFilterName] = useState("");
  const [busy, setBusy] = useState(false);
  const [summaryProjects, setSummaryProjects] = useState([]);
  const endRef = useRef(null);
  const isPreviewOnly = user?.role === "sale" || user?.role === "manager";
  const roleLabel = user?.role === "admin" ? "Admin" : user?.role === "manager" ? "Quản lý" : "Sale";

  const projectOptions = useMemo(() => {
    const fromSummary = (summaryProjects || []).map((p) => ({ id: p.id, name: p.name, unitCount: p.unitCount || 0 }));
    if (fromSummary.length) return fromSummary;
    return (projects || []).map((p) => ({ id: p.id, name: p.name, unitCount: 0 }));
  }, [projects, summaryProjects]);

  const resetChat = () => {
    setMessages([
      {
        id: "hi",
        role: "bot",
        text: "Chào Anh/Chị! Hỏi tự nhiên (VD: căn rẻ nhất, 2BR dưới 5 tỷ) hoặc gõ mã căn.\nAdmin gắn giỏ + OpenAI key tại: Dự án → Giỏ hàng.",
      },
    ]);
    setMenuOpen(true);
    setProjectFilterId(null);
    setProjectFilterName("");
    setDraft("");
  };

  useEffect(() => {
    if (open && messages.length === 0) resetChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open, menuOpen]);

  useEffect(() => {
    if (!open || !apiFetch || isPreviewOnly) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await apiFetch(`${API}/inventory/summary`);
        const d = await r.json().catch(() => ({}));
        if (!cancelled && r.ok) setSummaryProjects(d.projects || []);
      } catch (_) {}
    })();
    return () => { cancelled = true; };
  }, [open, apiFetch, isPreviewOnly]);

  const pushBot = (payload) => {
    setMessages((prev) => [...prev, { id: `b-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, role: "bot", ...payload }]);
  };

  const pushUser = (text) => {
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", text }]);
  };

  const searchInventory = async ({ q = "", layout = "", limit = 20 } = {}) => {
    if (!apiFetch) return { units: [], error: "Chưa kết nối API" };
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (projectFilterId) params.set("projectId", String(projectFilterId));
    if (layout) params.set("layout", layout);
    params.set("limit", String(limit));
    const r = await apiFetch(`${API}/inventory/search?${params}`);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || "Tra cứu thất bại");
    return { units: (d.units || []).map(toCardUnit), total: d.total || 0 };
  };

  const askInventory = async (question) => {
    if (!apiFetch) return { units: [], reply: "Chưa kết nối API", error: "Chưa kết nối API" };
    const r = await apiFetch(`${API}/inventory/ask`, {
      method: "POST",
      body: JSON.stringify({
        question,
        projectId: projectFilterId || undefined,
        projectHint: projectFilterName || undefined,
      }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || "GPT tra cứu thất bại");
    return {
      units: (d.units || []).map(toCardUnit),
      total: d.total || 0,
      reply: d.reply || "",
      usedGpt: !!d.usedGpt,
      intent: d.intent || "",
    };
  };

  const handleMenuPick = async (item) => {
    setMenuOpen(false);
    pushUser(item.label);

    if (item.key === "project") {
      if (!projectOptions.length) {
        pushBot({ text: "Chưa có dự án nào. Admin cần gắn giỏ hàng tại trang Dự án." });
        return;
      }
      pushBot({
        text: "Chọn dự án:",
        selectOptions: projectOptions.map((p) => ({
          value: String(p.id),
          label: p.unitCount ? `${p.name} (${p.unitCount} căn)` : p.name,
        })),
        selectKind: "project",
      });
      return;
    }

    if (item.key === "code") {
      pushBot({ text: "Gõ mã căn vào ô chat (VD: E11711) rồi gửi." });
      return;
    }

    if (item.key === "type") {
      pushBot({
        text: "Chọn loại căn:",
        selectOptions: [
          { value: "1BR", label: "1BR / 1PN" },
          { value: "2BR", label: "2BR / 2PN" },
          { value: "3BR", label: "3BR / 3PN" },
          { value: "Studio", label: "Studio" },
        ],
        selectKind: "layout",
      });
      return;
    }

    setBusy(true);
    try {
      if (item.key === "price" || item.key === "stock") {
        const { units } = await searchInventory({ limit: 15 });
        if (!units.length) {
          pushBot({ text: "Chưa có căn trong DB. Admin vào Dự án → Giỏ hàng → thêm Sheet & Sync." });
        } else {
          pushBot({
            text: item.key === "price" ? "Căn theo giá tăng dần:" : "Căn đang có trong giỏ:",
            units,
          });
        }
        return;
      }
      if (item.key === "drive") {
        const { units } = await searchInventory({ limit: 30 });
        const withDrive = units.filter((u) => u.driveUrl);
        if (!withDrive.length) {
          pushBot({ text: "Chưa có căn nào có link Drive trong giỏ đã sync." });
        } else {
          pushBot({ text: `Có ${withDrive.length} căn kèm Drive/PTG:`, units: withDrive.slice(0, 15) });
        }
      }
    } catch (e) {
      pushBot({ text: e.message || "Lỗi tra cứu" });
    } finally {
      setBusy(false);
    }
  };

  const runQuery = async (raw, { asUser = true, layout = "" } = {}) => {
    const text = String(raw || "").trim();
    if (!text && !layout) return;
    if (asUser && text) pushUser(text);
    setDraft("");
    setMenuOpen(false);
    setBusy(true);
    try {
      // Chọn loại căn từ menu → search thẳng, không cần GPT
      if (layout && !text) {
        const { units } = await searchInventory({ layout, limit: 20 });
        if (!units.length) {
          pushBot({ text: `Không thấy căn loại “${layout}”. Thử loại khác hoặc chọn dự án.` });
          return;
        }
        pushBot({ text: `Các căn ${layout}:`, units });
        return;
      }

      const { units, reply } = await askInventory(text);
      if (!units.length) {
        pushBot({ text: reply || `Không thấy căn khớp “${text}”.` });
        return;
      }
      pushBot({ text: reply || (units.length === 1 ? `Thông tin căn ${units[0].id}:` : `Tìm thấy ${units.length} căn:`), units });
    } catch (e) {
      pushBot({ text: e.message || "Lỗi tra cứu" });
    } finally {
      setBusy(false);
    }
  };

  const onSelectOption = async (opt, kind) => {
    if (kind === "project") {
      const id = Number(opt.value);
      const name = (projectOptions.find((p) => String(p.id) === String(opt.value))?.name) || opt.label;
      setProjectFilterId(id);
      setProjectFilterName(name);
      pushUser(opt.label);
      setBusy(true);
      try {
        const params = new URLSearchParams({ projectId: String(id), limit: "12" });
        const r = await apiFetch(`${API}/inventory/search?${params}`);
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "Lỗi tải giỏ dự án");
        const cards = (d.units || []).map(toCardUnit);
        if (!cards.length) {
          pushBot({
            text: `Đã chọn “${name}”. Chưa có căn sync — Admin mở Dự án → Giỏ hàng để gắn Sheet.`,
          });
        } else {
          pushBot({ text: `Đã chọn “${name}”. Một số căn:`, units: cards });
        }
      } catch (e) {
        pushBot({ text: e.message || "Lỗi tải giỏ dự án" });
      } finally {
        setBusy(false);
      }
      return;
    }
    if (kind === "layout") {
      pushUser(opt.label);
      await runQuery(opt.value, { asUser: false, layout: opt.value });
      return;
    }
    await runQuery(opt.value);
  };

  return (
    <>
      {open && (
        <div className={`iqi-asst-panel${isMobile ? " iqi-asst-panel--mobile" : ""}`} role="dialog" aria-label="IQI Sales Assistant">
          <div className="iqi-asst-header">
            <img src="/assistants/iqi-sales-bot.png?v=8" alt="" className="iqi-asst-header__bot" />
            <div className="iqi-asst-header__meta">
              <div className="iqi-asst-header__title">IQI Sales Assistant</div>
              <div className="iqi-asst-header__sub">
                <span className="iqi-asst-online" /> {isPreviewOnly ? "Đang xây dựng" : "Online · GPT + Giỏ hàng"} · {roleLabel}
                {!isPreviewOnly && projectFilterName ? ` · ${projectFilterName}` : ""}
                {!isPreviewOnly && busy ? " · đang tìm…" : ""}
              </div>
            </div>
            <button type="button" className="iqi-asst-icon-btn" onClick={() => setOpen(false)} aria-label="Thu nhỏ">–</button>
          </div>

          {isPreviewOnly ? (
            <div className="iqi-asst-body" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
              <div className="iqi-asst-msg iqi-asst-msg--bot" style={{ width: "100%", marginBottom: 0 }}>
                <img src="/assistants/iqi-sales-bot.png?v=8" alt="" className="iqi-asst-msg__avatar" />
                <div className="iqi-asst-msg__bubble" style={{ maxWidth: "100%" }}>
                  <div style={{ fontWeight: 800, marginBottom: 8 }}>Trợ lý ảo đang được xây dựng</div>
                  <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                    Hiện tại trợ lý ảo đang được build. Mọi người đợi một thời gian nhé — sẽ có thông báo về cách dùng khi sẵn sàng.
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
          <div className="iqi-asst-body">
            {messages.map((m) => (
              <div key={m.id} className={`iqi-asst-msg iqi-asst-msg--${m.role}`}>
                {m.role === "bot" && <img src="/assistants/iqi-sales-bot.png?v=8" alt="" className="iqi-asst-msg__avatar" />}
                <div className="iqi-asst-msg__bubble">
                  {m.text && <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>}
                  {m.selectOptions?.length > 0 && (
                    <div className="iqi-asst-select">
                      <div className="iqi-asst-select__label">Chọn bên dưới</div>
                      {m.selectOptions.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          className="iqi-asst-select__item"
                          onClick={() => onSelectOption(opt, m.selectKind)}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {m.units?.map((u) => <UnitCard key={u.key} u={u} />)}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>

          {menuOpen && (
            <div className="iqi-asst-menu">
              <div className="iqi-asst-menu__title">Chọn chức năng hỗ trợ</div>
              <div className="iqi-asst-menu__grid">
                {MENU_ITEMS.map((item) => (
                  <button key={item.key} type="button" onClick={() => handleMenuPick(item)} disabled={busy}>
                    <span className="iqi-asst-menu__ico">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <form
            className="iqi-asst-footer"
            onSubmit={(e) => {
              e.preventDefault();
              if (!busy) runQuery(draft);
            }}
          >
            <button
              type="button"
              className="iqi-asst-footer__menu"
              title="Mở menu"
              aria-label="Mở menu"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span /><span /><span />
            </button>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="VD: giá căn E11711"
              onFocus={() => setMenuOpen(false)}
              disabled={busy}
            />
            <button
              type="button"
              className="iqi-asst-footer__clear"
              title="Xóa hội thoại"
              aria-label="Xóa hội thoại"
              onClick={resetChat}
            >
              ⌫
            </button>
            <button type="submit" aria-label="Gửi" disabled={busy}>➤</button>
          </form>
            </>
          )}
        </div>
      )}

      <button
        type="button"
        className={`iqi-asst-fab${isMobile ? " iqi-asst-fab--mobile" : ""}${open ? " iqi-asst-fab--hidden" : ""}`}
        onClick={() => setOpen((v) => !v)}
        title="IQI Sales Assistant"
        aria-label="Mở IQI Sales Assistant"
        aria-hidden={open}
        tabIndex={open ? -1 : 0}
      >
        <span className="iqi-asst-fab__wave" aria-hidden="true" />
        <span className="iqi-asst-fab__wave iqi-asst-fab__wave--2" aria-hidden="true" />
        <span className="iqi-asst-fab__core">
          <img src="/assistants/iqi-sales-bot.png?v=8" alt="IQI Assistant" className="iqi-asst-fab__img" />
        </span>
      </button>
    </>
  );
}
