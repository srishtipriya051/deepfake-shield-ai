import { useNavigate } from "react-router-dom";

function Sidebar() {
    const navigate = useNavigate();

    return (
        <div style={styles.sidebar}>
            <h2>🛡️ Deepfake</h2>

            <button style={styles.button} onClick={() => navigate("/")}>Dashboard</button>
            <button style={styles.button} onClick={() => alert("Detect Media")}>Detect Media</button>
            <button style={styles.button} onClick={() => alert("Reports")}>Reports</button>
            <button style={styles.button} onClick={() => alert("Settings")}>Settings</button>
            <button style={styles.button} onClick={() => alert("Logout")}>Logout</button>
        </div>
    );
}

const styles = {
    sidebar: {
        width: "220px",
        background: "#1e293b",
        padding: "15px",
        display: "flex",
        flexDirection: "column",
        gap: "10px"
    },
    button: {
        padding: "10px",
        background: "#334155",
        color: "white",
        border: "none",
        borderRadius: "8px",
        cursor: "pointer"
    }
};

export default Sidebar;