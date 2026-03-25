function Sidebar() {
  return (
    <div style={styles.sidebar}>
      <h2>🛡️ Deepfake Shield</h2>

      <ul>
        <li>Dashboard</li>
        <li>Detect Media</li>
        <li>Reports</li>
        <li>Settings</li>
        <li>Logout</li>
      </ul>
    </div>
  );
}

const styles = {
  sidebar: {
    width: "220px",
    background: "#1e293b",
    padding: "20px"
  }
};

export default Sidebar;