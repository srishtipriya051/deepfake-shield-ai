function ResultsSection() {
  return (
    <div style={styles.container}>
      <h2>Analysis Results</h2>

      <div style={styles.grid}>
        <div style={styles.card}>
          <h3>Deepfake Detected ❌</h3>
          <p>Confidence: 92%</p>
        </div>

        <div style={styles.card}>
          <h3>Probability</h3>
          <p>High Risk</p>
        </div>

        <div style={styles.card}>
          <h3>Face Manipulation</h3>
          <p>Detected</p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    marginTop: "20px",
    padding: "20px",
    background: "#1e293b",
    borderRadius: "10px"
  },
  grid: {
    display: "flex",
    gap: "20px",
    marginTop: "10px"
  },
  card: {
    background: "#0f172a",
    padding: "15px",
    borderRadius: "10px",
    flex: 1
  }
};

export default ResultsSection;