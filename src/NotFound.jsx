import React from "react";

export default function NotFound() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "#f7f7fb"
    }}>
      <div style={{ marginBottom: 32 }}>
        <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
          <circle cx="60" cy="60" r="50" fill="#e0e7ff" />
          <ellipse cx="60" cy="80" rx="30" ry="10" fill="#c7d2fe" />
          <rect x="40" y="40" width="40" height="30" rx="8" fill="#fff" stroke="#6366f1" strokeWidth="2" />
          <rect x="55" y="55" width="10" height="10" rx="3" fill="#6366f1" />
          <rect x="50" y="70" width="20" height="5" rx="2" fill="#a5b4fc" />
        </svg>
      </div>
      <h2 style={{ color: "#6366f1", fontWeight: 700, fontSize: 28 }}>Không tìm thấy dữ liệu</h2>
      <p style={{ color: "#6b7280", margin: "12px 0 24px" }}>
        Trang này không tồn tại hoặc dữ liệu đang bị lỗi.<br />
        Vui lòng thử lại hoặc liên hệ quản trị viên.
      </p>
      <button
        onClick={() => window.location.reload()}
        style={{
          background: "#6366f1",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          padding: "12px 32px",
          fontSize: 18,
          fontWeight: 600,
          cursor: "pointer",
          boxShadow: "0 2px 8px #6366f133"
        }}
      >
        Tải lại trang
      </button>
      <div style={{ marginTop: 32 }}>
        <div className="loader" style={{
          width: 48,
          height: 48,
          border: "6px solid #c7d2fe",
          borderTop: "6px solid #6366f1",
          borderRadius: "50%",
          animation: "spin 1s linear infinite"
        }} />
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}