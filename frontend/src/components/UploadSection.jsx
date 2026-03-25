function UploadSection() {
  return (
    <div style={styles.container}>
      <h1>Detect Deepfake Media</h1>
      <p>Upload files you want to analyze</p>

      <div style={styles.cards}>
        <div style={styles.card}>
          <h3>📹 Upload Video</h3>
          <button>Browse Files</button>
        </div>

        <div style={styles.card}>
          <h3>🖼️ Upload Image</h3>
          <button>Browse Files</button>
        </div>
      </div>

      <button style={styles.mainBtn}>Start Analysis</button>
    </div>
  );
}

const styles = {
  container: {
    marginTop: "20px",
    padding: "20px",
    background: "#1e293b",
    borderRadius: "10px",
    textAlign: "center"
  },
  cards: {
    display: "flex",
    justifyContent: "center",
    gap: "20px",
    marginTop: "20px"
  },
  card: {
    background: "#0f172a",
    padding: "20px",
    borderRadius: "10px",
    width: "200px"
  },
  mainBtn: {
    marginTop: "20px",
    padding: "10px 20px",
    background: "#3b82f6",
    border: "none",
    borderRadius: "6px",
    color: "white"
  }
};

export default UploadSection;