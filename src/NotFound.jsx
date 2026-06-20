import React from "react";

export function MaintenancePage({ message, onRetry }) {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(160deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      overflow: "hidden",
      position: "relative",
    }}>
      {/* Animated background particles */}
      <style>{`
        @keyframes float { 0%,100%{transform:translateY(0) rotate(0deg);opacity:.3} 50%{transform:translateY(-20px) rotate(180deg);opacity:.6} }
        @keyframes pulse { 0%,100%{transform:scale(1);opacity:.8} 50%{transform:scale(1.05);opacity:1} }
        @keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
        @keyframes fadeInUp { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
        .mtn-particle{position:absolute;border-radius:50%;pointer-events:none}
      `}</style>
      <div className="mtn-particle" style={{ width:6,height:6,background:"#e88a2e",top:"15%",left:"20%",animation:"float 6s ease-in-out infinite" }}/>
      <div className="mtn-particle" style={{ width:4,height:4,background:"#f59e0b",top:"25%",right:"25%",animation:"float 8s ease-in-out infinite 1s" }}/>
      <div className="mtn-particle" style={{ width:8,height:8,background:"#e88a2e40",top:"60%",left:"10%",animation:"float 7s ease-in-out infinite 2s" }}/>
      <div className="mtn-particle" style={{ width:5,height:5,background:"#f59e0b60",top:"70%",right:"15%",animation:"float 5s ease-in-out infinite 0.5s" }}/>
      <div className="mtn-particle" style={{ width:3,height:3,background:"#fff",top:"40%",left:"40%",animation:"float 9s ease-in-out infinite 3s" }}/>

      {/* Main card */}
      <div style={{
        background: "rgba(255,255,255,0.05)",
        backdropFilter: "blur(20px)",
        borderRadius: 24,
        padding: "48px 40px",
        maxWidth: 480,
        width: "90%",
        textAlign: "center",
        border: "1px solid rgba(232,138,46,0.2)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)",
        animation: "fadeInUp 0.6s ease-out",
      }}>
        {/* IQI Logo */}
        <div style={{ marginBottom: 24, animation: "pulse 3s ease-in-out infinite" }}>
          <div style={{
            width: 80, height: 80, margin: "0 auto", borderRadius: 20,
            background: "linear-gradient(135deg, #e88a2e, #d97706)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 8px 32px rgba(232,138,46,0.4)",
          }}>
            <span style={{ color: "#fff", fontSize: 28, fontWeight: 800, letterSpacing: 2 }}>IQI</span>
          </div>
        </div>

        {/* Icon */}
        <div style={{ marginBottom: 20 }}>
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none" style={{ opacity: 0.9 }}>
            <circle cx="32" cy="32" r="28" stroke="#e88a2e" strokeWidth="2" strokeDasharray="6 4" style={{ animation: "spin 20s linear infinite" }}/>
            <path d="M24 26h16M24 32h12M24 38h8" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="44" cy="44" r="8" fill="#1a1a2e" stroke="#e88a2e" strokeWidth="2"/>
            <path d="M42 44l2 2 4-4" stroke="#e88a2e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        <h1 style={{ color: "#fff", fontWeight: 800, fontSize: 24, margin: "0 0 8px", letterSpacing: 0.5 }}>
          Hệ thống đang bảo trì
        </h1>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, margin: "0 0 24px", lineHeight: 1.6 }}>
          {message || "Hệ thống CRM đang được nâng cấp để phục vụ bạn tốt hơn. Vui lòng quay lại sau ít phút."}
        </p>

        {/* Loading indicator */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 28 }}>
          <div style={{
            width: 36, height: 36,
            border: "3px solid rgba(232,138,46,0.2)",
            borderTop: "3px solid #e88a2e",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
          }}/>
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>Đang kết nối lại...</span>
        </div>

        <button
          onClick={() => (onRetry ? onRetry() : window.location.reload())}
          style={{
            background: "linear-gradient(135deg, #e88a2e, #d97706)",
            color: "#fff", border: "none", borderRadius: 12,
            padding: "14px 36px", fontSize: 15, fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 4px 16px rgba(232,138,46,0.4)",
            transition: "transform .2s, box-shadow .2s",
            width: "100%",
          }}
          onMouseEnter={e => { e.target.style.transform = "translateY(-2px)"; e.target.style.boxShadow = "0 6px 24px rgba(232,138,46,0.5)"; }}
          onMouseLeave={e => { e.target.style.transform = "translateY(0)"; e.target.style.boxShadow = "0 4px 16px rgba(232,138,46,0.4)"; }}
        >
          Tải lại trang
        </button>

        <div style={{ marginTop: 24, fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
          IQI CRM System &bull; Liên hệ quản trị viên nếu cần hỗ trợ
        </div>
      </div>
    </div>
  );
}

export default function NotFound() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(160deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      position: "relative",
      overflow: "hidden",
    }}>
      <style>{`
        @keyframes pulse { 0%,100%{transform:scale(1);opacity:.8} 50%{transform:scale(1.05);opacity:1} }
        @keyframes fadeInUp { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      <div style={{
        background: "rgba(255,255,255,0.05)",
        backdropFilter: "blur(20px)",
        borderRadius: 24,
        padding: "48px 40px",
        maxWidth: 480,
        width: "90%",
        textAlign: "center",
        border: "1px solid rgba(232,138,46,0.2)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        animation: "fadeInUp 0.6s ease-out",
      }}>
        <div style={{ marginBottom: 24, animation: "pulse 3s ease-in-out infinite" }}>
          <div style={{
            width: 80, height: 80, margin: "0 auto", borderRadius: 20,
            background: "linear-gradient(135deg, #e88a2e, #d97706)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 8px 32px rgba(232,138,46,0.4)",
          }}>
            <span style={{ color: "#fff", fontSize: 28, fontWeight: 800, letterSpacing: 2 }}>IQI</span>
          </div>
        </div>

        <h1 style={{ color: "#e88a2e", fontWeight: 800, fontSize: 72, margin: "0 0 8px", letterSpacing: -2 }}>404</h1>
        <h2 style={{ color: "#fff", fontWeight: 700, fontSize: 20, margin: "0 0 12px" }}>Không tìm thấy trang</h2>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, margin: "0 0 28px", lineHeight: 1.6 }}>
          Trang bạn tìm không tồn tại hoặc đã bị di chuyển.<br/>
          Vui lòng kiểm tra lại đường dẫn.
        </p>

        <button
          onClick={() => window.location.reload()}
          style={{
            background: "linear-gradient(135deg, #e88a2e, #d97706)",
            color: "#fff", border: "none", borderRadius: 12,
            padding: "14px 36px", fontSize: 15, fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 4px 16px rgba(232,138,46,0.4)",
            transition: "transform .2s, box-shadow .2s",
            width: "100%",
          }}
          onMouseEnter={e => { e.target.style.transform = "translateY(-2px)"; }}
          onMouseLeave={e => { e.target.style.transform = "translateY(0)"; }}
        >
          Tải lại trang
        </button>

        <div style={{ marginTop: 24, fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
          IQI CRM System
        </div>
      </div>
    </div>
  );
}