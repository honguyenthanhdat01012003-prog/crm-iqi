import React, { useEffect } from "react";
import { X } from "lucide-react";

export function LeadDetailDrawer({ open, lead, onClose, subtitle, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || !lead) return null;

  return (
    <div className="crm-drawer-backdrop" onClick={onClose} role="presentation">
      <aside
        className="crm-drawer"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={lead.name || "Chi tiết khách hàng"}
      >
        <header className="crm-drawer-header">
          <div className="crm-drawer-header-text">
            <h3>{lead.name || "Chi tiết khách hàng"}</h3>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" className="crm-icon-btn" onClick={onClose} aria-label="Đóng">
            <X size={18} />
          </button>
        </header>
        <div className="crm-drawer-body">{children}</div>
      </aside>
    </div>
  );
}
