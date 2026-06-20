import React from "react";

export function SkeletonLine({ width = "100%", height = 14, className = "" }) {
  return (
    <div
      className={`crm-skeleton crm-skeleton-line ${className}`.trim()}
      style={{ width, height }}
    />
  );
}

export function LeadGridSkeleton({ rows = 8, columns = 6 }) {
  return (
    <div className="crm-card crm-data-grid-shell">
      <div className="crm-skeleton-grid-header">
        {Array.from({ length: columns }).map((_, i) => (
          <SkeletonLine key={i} height={12} width={`${60 + (i % 3) * 20}%`} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="crm-skeleton-grid-row">
          {Array.from({ length: columns }).map((_, col) => (
            <SkeletonLine key={col} height={14} width={col === 1 ? "85%" : "70%"} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function LeadCardsSkeleton({ count = 5 }) {
  return (
    <div className="crm-lead-cards-skeleton">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="crm-card crm-lead-card-skeleton">
          <SkeletonLine width="55%" height={16} />
          <SkeletonLine width="40%" height={12} className="crm-mt-8" />
          <SkeletonLine width="30%" height={20} className="crm-mt-12" />
        </div>
      ))}
    </div>
  );
}
