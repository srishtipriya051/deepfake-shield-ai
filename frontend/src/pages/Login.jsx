function Login() {
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2>DeepFake Shield AI</h2>
        <p>Login to your account</p>

        <input type="email" placeholder="Email" style={styles.input} />
        <input type="password" placeholder="Password" style={styles.input} />

        <button style={styles.button}>Login</button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    height: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#111827",
  },
  card: {
    background: "#1f2937",
    padding: "40px",
    borderRadius: "10px",
    textAlign: "center",
    width: "300px",
    color: "white",
  },
  input: {
    width: "100%",
    padding: "10px",
    margin: "10px 0",
    borderRadius: "5px",
    border: "none",
  },
  button: {
    width: "100%",
    padding: "10px",
    marginTop: "10px",
    background: "#3b82f6",
    color: "white",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
  },
};

export default Login;
