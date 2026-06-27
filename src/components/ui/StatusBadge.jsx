import React from "react";
import { CalendarClock } from "lucide-react";
import { getStatusColor, getStatusLabel } from "../../constants/leadStatus.js";

export const DISTRIBUTION_KIND_LABELS = {
  scheduled: "Lead đặt lịch",
  manual: "Chia thủ công",
  shuffle: "Xáo lead",
  rotate: "Xáo tự động",
};

export function StatusBadge({ status, size = "md", className = "" }) {
  const color = getStatusColor(status);
  const label = getStatusLabel(status);
  return (
    <span
      className={`crm-status-badge crm-status-badge--${size} ${className}`.trim()}
      style={{ "--status-color": color }}
    >
      {label}
    </span>
  );
}

export function TempBadge({ label, bg, color }) {
  return (
    <span className="crm-status-badge crm-status-badge--sm" style={{ background: bg, color }}>
      {label}
    </span>
  );
}

export function NewLeadBadge() {
  return <span className="crm-status-badge crm-status-badge--new">NEW</span>;
}

export function ScheduledLeadBadge({ compact = false }) {
  return (
    <span
      className="crm-status-badge crm-status-badge--sm"
      style={{ background: "#ede9fe", color: "#6d28d9", border: "1px solid #c4b5fd", display: "inline-flex", alignItems: "center", gap: 4 }}
      title={DISTRIBUTION_KIND_LABELS.scheduled}
    >
      <CalendarClock size={compact ? 10 : 11} />
      {!compact && DISTRIBUTION_KIND_LABELS.scheduled}
    </span>
  );
}
