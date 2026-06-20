export const STATUS_LABELS = {
  new: "Chưa feedback",
  called: "Đã gọi",
  interested: "Quan tâm",
  low_interest: "Quan tâm hời hợt",
  other_project: "Quan tâm DA khác",
  consulting: "Đang tư vấn",
  appointment: "Hẹn gặp/hẹn xem dự án",
  booked: "Booking/Cọc",
  booking_other: "Booking sản khác",
  closed: "Chốt",
  not_interested: "Không quan tâm",
  spam: "Phá/rác",
  sale: "Sale",
  weak_finance: "Tài chính yếu",
  unreachable: "Chưa liên lạc được",
  callback: "Liên lạc lại sau",
  wrong_phone: "Thuê bao",
  wrong_number: "Sai số",
  hung_up: "Tắt máy ngang",
  blocked: "Chặn",
  has_sale: "Đang có sale khác chăm",
  lost: "Mất",
};

export const STATUS_COLORS = {
  new: "#f59e0b",
  called: "#4ade80",
  interested: "#22c55e",
  low_interest: "#38bdf8",
  other_project: "#92400e",
  consulting: "#6366f1",
  appointment: "#8b5cf6",
  booked: "#10b981",
  booking_other: "#14b8a6",
  closed: "#059669",
  not_interested: "#ef4444",
  spam: "#eab308",
  sale: "#2563eb",
  weak_finance: "#f97316",
  unreachable: "#6b7280",
  callback: "#e88a2e",
  wrong_phone: "#9ca3af",
  wrong_number: "#78716c",
  hung_up: "#a1a1aa",
  blocked: "#1f2937",
  has_sale: "#0284c7",
  lost: "#dc2626",
};

export function getStatusLabel(status) {
  return STATUS_LABELS[status] || status || "—";
}

export function getStatusColor(status) {
  return STATUS_COLORS[status] || "#6b7280";
}
