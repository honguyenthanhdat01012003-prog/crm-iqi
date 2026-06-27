import React from "react";
import { Lock, MessageSquare, Phone, UserPlus } from "lucide-react";
import { StatusBadge, NewLeadBadge, TempBadge } from "../ui/StatusBadge.jsx";
import { telHref, zaloHref } from "../../utils/phoneLinks.js";

export function LeadDataGrid({
  leads,
  selectedId,
  onSelectLead,
  isAdmin,
  isSale,
  isRecentLead,
  getLeadProjectName,
  getLeadTemp,
  startIndex = 0,
  emptyMessage = "Không có khách hàng nào",
}) {
  if (!leads.length) {
    return (
      <div className="crm-card crm-data-grid-shell">
        <div className="crm-empty-state">{emptyMessage}</div>
      </div>
    );
  }

  return (
    <div className="crm-card crm-data-grid-shell">
      <div className="crm-data-grid-scroll">
        <table className="crm-data-grid">
          <colgroup>
            <col className="crm-data-grid-col-index" />
            <col className="crm-data-grid-col-name" />
            <col className="crm-data-grid-col-phone" />
            <col className="crm-data-grid-col-product" />
            <col className="crm-data-grid-col-status" />
            <col className="crm-data-grid-col-manager" />
            <col className="crm-data-grid-col-sale" />
            <col className="crm-data-grid-col-project" />
            {!isSale && <col className="crm-data-grid-col-date" />}
            {!isSale && <col className="crm-data-grid-col-temp" />}
            <col className="crm-data-grid-col-actions" />
          </colgroup>
          <thead>
            <tr>
              <th>#</th>
              <th>Tên khách hàng</th>
              <th>SĐT</th>
              <th>Nhu cầu</th>
              <th>Trạng thái</th>
              <th>Quản lý</th>
              <th>Sale</th>
              <th>Dự án</th>
              {!isSale && <th>Ngày nhận</th>}
              {!isSale && <th>Nhiệt độ</th>}
              <th className="crm-data-grid-actions-col">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead, i) => {
              const idx = startIndex + i;
              const selected = selectedId === lead.id;
              const locked = lead.status === "booked" || lead.status === "booking_other" || lead.isLocked;
              const temp = !isSale ? getLeadTemp(lead.createdAt) : null;
              const phone = String(lead.phone || "").replace(/[^\d+]/g, "");
              const zaloLink = zaloHref(lead.phone);

              return (
                <tr
                  key={lead.id}
                  id={`lead-${lead.id}`}
                  className={[
                    "crm-data-grid-row",
                    selected ? "crm-data-grid-row--selected" : "",
                    locked ? "crm-data-grid-row--locked" : "",
                    idx % 2 === 1 ? "crm-data-grid-row--alt" : "",
                  ].filter(Boolean).join(" ")}
                  onClick={() => onSelectLead(selected ? null : lead.id)}
                >
                  <td className="crm-data-grid-index">
                    <span className="crm-data-grid-index-inner">
                      <span>{idx + 1}</span>
                      {locked && <Lock size={11} className="crm-text-danger" aria-label="Lead đã khóa" />}
                    </span>
                  </td>
                  <td className="crm-data-grid-name">
                    <div className="crm-data-grid-name-inner">
                      {isRecentLead(lead) && <NewLeadBadge />}
                      {isAdmin && lead.regCount > 1 && (
                        <span className="crm-status-badge crm-status-badge--reg">ĐK {lead.regIndex}</span>
                      )}
                      <span className="crm-data-grid-name-text" title={lead.name || ""}>{lead.name}</span>
                    </div>
                  </td>
                  <td className="crm-data-grid-truncate" title={lead.phone || ""}>{lead.phone || "—"}</td>
                  <td className="crm-data-grid-truncate" title={lead.product || ""}>{lead.product || "—"}</td>
                  <td><StatusBadge status={lead.status} size="sm" /></td>
                  <td className="crm-data-grid-muted">{lead.managerName || "—"}</td>
                  <td>{lead.saleName || <span className="crm-text-muted">Chưa chia</span>}</td>
                  <td className="crm-data-grid-muted crm-data-grid-truncate">{getLeadProjectName(lead)}</td>
                  {!isSale && <td className="crm-data-grid-muted crm-data-grid-nowrap">{lead.createdAt || "—"}</td>}
                  {!isSale && temp && (
                    <td><TempBadge label={temp.label} bg={temp.bg} color={temp.color} /></td>
                  )}
                  <td className="crm-data-grid-actions-col">
                    <div className="crm-row-actions" onClick={(e) => e.stopPropagation()}>
                      {phone && (
                        <a href={`tel:${phone}`} className="crm-row-action-btn" title="Gọi">
                          <Phone size={14} />
                        </a>
                      )}
                      {zaloLink && (
                        <a href={zaloLink} target="_blank" rel="noopener noreferrer" className="crm-row-action-btn crm-row-action-btn--zalo" title="Nhắn Zalo">
                          <span className="crm-zalo-mark">Z</span>
                        </a>
                      )}
                      {lead.customerFbUrl && (
                        <a href={lead.customerFbUrl} target="_blank" rel="noopener noreferrer" className="crm-row-action-btn" title="Nhắn tin">
                          <MessageSquare size={14} />
                        </a>
                      )}
                      {isAdmin && (
                        <button
                          type="button"
                          className="crm-row-action-btn"
                          title="Chia / phân công"
                          onClick={() => onSelectLead(lead.id)}
                        >
                          <UserPlus size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
