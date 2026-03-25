import { useContext } from "react";
import { ThemeContext } from "../contexts/ThemeContext";

function Navbar() {
    const { toggleTheme } = useContext(ThemeContext);

    return (
        <div style={styles.nav}>
            <h2>Deepfake Shield AI</h2>

            <div>
                <span>Dashboard</span>
                <span>Reports</span>
                <span>Settings</span>
                <button onClick={toggleTheme} style={styles.themeButton}>
                    Toggle Theme 🌙☀️
                </button>
            </div>
        </div>
    );
}
<div style={{ display: "flex", gap: "15px", alignItems: "center" }}></div>
const styles = {
  nav: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 20px",
    background: "var(--card)",   // 🔥 dynamic
    color: "var(--text)",        // 🔥 dynamic
    borderRadius: "10px"
  },
  themeButton: {
    background: "var(--primary)", // 🔥 dynamic
    color: "white",
    border: "none",
    padding: "5px 10px",
    borderRadius: "5px",
    cursor: "pointer"
  }
};


export default Navbar;