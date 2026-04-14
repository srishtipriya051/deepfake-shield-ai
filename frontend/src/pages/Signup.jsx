import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { registerUser, formatApiDetail } from "../services/api";
import "./AuthPages.css";

function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agree, setAgree] = useState(false);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    setMessage("");

    if (!email.trim() || !password.trim()) {
      setMessage("Please enter email and password.");
      return;
    }
    if (!email.includes("@")) {
      setMessage("Please enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setMessage("Password must be at least 6 characters.");
      return;
    }
    if (!agree) {
      setMessage("Please accept the terms to continue.");
      return;
    }

    setIsSubmitting(true);
    try {
      await registerUser({ email: email.trim(), password });
      navigate("/login", { state: { signupOk: true, email: email.trim() } });
    } catch (err) {
      setMessage(formatApiDetail(err, "Signup failed. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={styles.container} className="auth-signup-page">
      <div style={styles.card} className="auth-signup-card">
        <h2>DeepFake Shield AI</h2>
        <p>Create your account</p>

        <form onSubmit={handleSignup}>
          <input
            type="email"
            placeholder="Email"
            style={styles.input}
            value={email}
            autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            placeholder="Password (min. 6 characters)"
            style={styles.input}
            value={password}
            autoComplete="new-password"
            onChange={(e) => setPassword(e.target.value)}
          />

          <div style={styles.checkboxContainer}>
            <input
              type="checkbox"
              checked={agree}
              onChange={() => setAgree(!agree)}
            />
            <span style={{ marginLeft: "8px" }}>I agree to the terms</span>
          </div>

          {message ? <p style={styles.error}>{message}</p> : null}

          <button style={styles.button} type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating account…" : "Sign up"}
          </button>
        </form>

        <p style={{ marginTop: "10px" }}>
          Already have an account?{" "}
          <span style={styles.link} onClick={() => navigate("/login")} role="button">
            Login
          </span>
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "100vh",
    backgroundColor: "#111",
  },

  card: {
    backgroundColor: "#1e1e1e",
    padding: "clamp(20px, 4vw, 30px)",
    borderRadius: "12px",
    textAlign: "center",
    width: "100%",
    maxWidth: "400px",
    color: "white",
  },

  input: {
    width: "100%",
    padding: "10px",
    margin: "10px 0",
    borderRadius: "5px",
    border: "none",
    boxSizing: "border-box",
  },

  checkboxContainer: {
    display: "flex",
    alignItems: "center",
    marginTop: "10px",
    color: "white",
  },

  button: {
    width: "100%",
    padding: "10px",
    backgroundColor: "#4CAF50",
    color: "white",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    marginTop: "10px",
  },

  link: {
    color: "#4CAF50",
    cursor: "pointer",
    textDecoration: "underline",
  },

  error: {
    color: "#f87171",
    fontSize: "14px",
    marginTop: "8px",
    marginBottom: 0,
  },
};

export default Signup;
