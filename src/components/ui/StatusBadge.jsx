import React from "react";
import { getStatusColor, getStatusLabel } from "../../constants/leadStatus.js";

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
