import { useNavigate } from "react-router-dom";

function Reports() {
  const navigate = useNavigate();
  return (
    <div style={{ minHeight: "100vh", padding: 22, background: "#f1f5f9" }}>
      <h2 style={{ margin: 0, color: "#0f172a" }}>Reports</h2>
      <p style={{ marginTop: 8, color: "rgba(15, 23, 42, 0.72)", fontWeight: 700 }}>
        This page is ready for wiring to stored analysis history.
      </p>

      <button
        type="button"
        onClick={() => navigate("/dashboard")}
        style={{
          marginTop: 14,
          padding: "10px 12px",
          borderRadius: 10,
          border: "1px solid rgba(30,58,138,0.16)",
          background: "#ffffff",
          cursor: "pointer",
          fontWeight: 900,
        }}
      >
        Back to Dashboard
      </button>
    </div>
  );
}

export default Reports;

