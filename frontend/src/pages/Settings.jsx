import { useNavigate } from "react-router-dom";

function Settings() {
  const navigate = useNavigate();
  const logout = () => {
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <div style={{ minHeight: "100vh", padding: 22, background: "#f1f5f9" }}>
      <h2 style={{ margin: 0, color: "#0f172a" }}>Settings</h2>
      <p style={{ marginTop: 8, color: "rgba(15, 23, 42, 0.72)", fontWeight: 700 }}>
        Basic controls for this demo.
      </p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 14 }}>
        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          style={{
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

        <button
          type="button"
          onClick={logout}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(185,28,28,0.2)",
            background: "rgba(185,28,28,0.08)",
            cursor: "pointer",
            fontWeight: 900,
            color: "#991b1b",
          }}
        >
          Log out
        </button>
      </div>
    </div>
  );
}

export default Settings;

