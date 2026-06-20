import React from "react";
import { Lock, MessageSquare, Phone, UserPlus } from "lucide-react";
import { StatusBadge, NewLeadBadge, TempBadge } from "../ui/StatusBadge.jsx";

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
                    {idx + 1}
                    {locked && <Lock size={11} className="crm-inline-icon crm-text-danger" />}
                  </td>
                  <td className="crm-data-grid-name">
                    <div className="crm-data-grid-name-inner">
                      {isRecentLead(lead) && <NewLeadBadge />}
                      {isAdmin && lead.regCount > 1 && (
                        <span className="crm-status-badge crm-status-badge--reg">ĐK {lead.regIndex}</span>
                      )}
                      <span>{lead.name}</span>
                    </div>
                  </td>
                  <td>{lead.phone || "—"}</td>
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
