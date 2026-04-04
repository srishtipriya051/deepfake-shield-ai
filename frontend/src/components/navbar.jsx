import { useContext } from "react";
import { ThemeContext } from "../contexts/ThemeContextBase";
import { useNavigate } from "react-router-dom";

function Navbar() {
    const { toggleTheme } = useContext(ThemeContext);
    const navigate = useNavigate();

    return (
        <div style={styles.nav}>
            <h2>Deepfake Shield AI</h2>

            <div style={styles.menu}>
                <button style={styles.btn} onClick={() => navigate("/")}>Dashboard</button>
                <button style={styles.btn} onClick={() => alert("Reports")}>Reports</button>
                <button style={styles.btn} onClick={() => alert("Settings")}>Settings</button>

                <button onClick={toggleTheme} style={styles.themeButton}>
                    🌙☀️
                </button>
            </div>
        </div>
    );
}

const styles = {
    nav: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 20px",
        background: "var(--card)",
        color: "var(--text)",
        borderRadius: "10px",
        flexWrap: "wrap"
    },
    menu: {
        display: "flex",
        gap: "10px",
        flexWrap: "wrap",
        alignItems: "center"
    },
    btn: {
        padding: "6px 12px",
        background: "#334155",
        color: "white",
        border: "none",
        borderRadius: "6px",
        cursor: "pointer"
    },
    themeButton: {
        background: "var(--primary)",
        color: "white",
        border: "none",
        padding: "6px 10px",
        borderRadius: "6px",
        cursor: "pointer"
    }
};

export default Navbar;