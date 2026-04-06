import { useState } from "react";
import { forgotPasswordUser, loginUser, signupUser } from "../services/api";
import { useNavigate } from "react-router-dom";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("idle");
  const [mode, setMode] = useState("login");

  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!email.trim() || !password.trim()) {
      setMessageType("error");
      setMessage("Please enter both email and password.");
      return;
    }

    if (!email.includes("@")) {
      setMessageType("error");
      setMessage("Please enter a valid email address.");
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    try {
      if (mode === "signup") {
        await signupUser({ email, password });
        setMessageType("success");
        setMessage("Signup successful. Please sign in.");
        setMode("login");
      } else if (mode === "forgot") {
        await forgotPasswordUser({ email, new_password: password });
        setMessageType("success");
        setMessage("Password reset successful. Please sign in.");
        setMode("login");
      } else {
        const response = await loginUser({ email, password });
        const token = response.data.access_token;

        if (rememberMe) {
          localStorage.setItem("token", token);
        } else {
          sessionStorage.setItem("token", token);
        }

        setMessageType("success");
        setMessage("Login successful. Redirecting...");
        navigate("/dashboard");
      }
    } catch (error) {
      console.error("Login error:", error);
      setMessageType("error");
      const fallback = {
        signup: "Signup failed. Try another email.",
        forgot: "Password reset failed. Check your email and try again.",
        login: "Login failed. Try again.",
      }[mode];
      setMessage(error?.response?.data?.detail || fallback);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.leftPanel}>
        <div style={styles.brandMark}>»»</div>
        <h1 style={styles.welcomeTitle}>
          WELCOME <span style={styles.welcomeDark}>BACK!</span>
        </h1>
        <p style={styles.welcomeText}>
          You can sign in to access with your existing account
        </p>
      </div>

      <form style={styles.rightPanel} onSubmit={handleSubmit}>
        <h2 style={styles.signinTitle}>
          {mode === "signup" ? "SIGN UP" : mode === "forgot" ? "RESET PASSWORD" : "SIGN IN"}
        </h2>

        <div style={styles.inputWrap}>
          <span style={styles.inputIcon}>✉</span>
          <input
            type="email"
            placeholder="Email Address"
            style={styles.input}
            value={email}
            autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div style={styles.inputWrap}>
          <span style={styles.inputIcon}>🔒</span>
          <input
            type={showPassword ? "text" : "password"}
            placeholder={mode === "forgot" ? "New Password" : "Password"}
            style={styles.input}
            value={password}
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            style={styles.eyeButton}
            onClick={() => setShowPassword((prev) => !prev)}
          >
            {showPassword ? "🙈" : "👁"}
          </button>
        </div>

        <label style={styles.rememberRow}>
          <input
            type="checkbox"
            style={styles.checkbox}
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
          />
          <span>Remember for 30 days</span>
        </label>

        {message ? (
          <p
            style={{
              ...styles.message,
              ...(messageType === "error" ? styles.messageError : styles.messageSuccess),
              ...(mode === "signup" && messageType === "success" ? styles.messageInfo : {}),
            }}
          >
            {message}
          </p>
        ) : null}

        <button style={styles.submitButton} type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? mode === "signup"
              ? "CREATING..."
              : mode === "forgot"
                ? "RESETTING..."
              : "SIGNING IN..."
            : mode === "signup"
              ? "CREATE ACCOUNT"
              : mode === "forgot"
                ? "RESET PASSWORD"
              : "SIGN IN"}
        </button>

        <button
          type="button"
          style={styles.linkButton}
          onClick={() => {
            setMessage("");
            setMode("forgot");
          }}
        >
          Forgot Password?
        </button>

        <p style={styles.signupText}>
          {mode === "signup"
            ? "Already have an account ? "
            : mode === "forgot"
              ? "Back to sign in ? "
              : "Don&apos;t have any account ? "}
          <button
            type="button"
            style={styles.inlineLinkButton}
            onClick={() => {
              setMessage("");
              setMode((prev) => (prev === "signup" || prev === "forgot" ? "login" : "signup"));
            }}
          >
            {mode === "signup" || mode === "forgot" ? "Sign in" : "Sign up"}
          </button>
        </p>
      </form>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    backgroundColor: "#f1f5f9",
    fontFamily: "Arial, sans-serif",
    position: "relative",
    overflow: "hidden",
  },
  leftPanel: {
    flex: 1,
    color: "#ffffff",
    background: "linear-gradient(120deg, #2f76c3 0%, #5fa7e8 52%, #8cbdea 100%)",
    padding: "72px 70px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
  brandMark: {
    position: "absolute",
    top: "26px",
    left: "34px",
    fontSize: "40px",
    fontWeight: 700,
    opacity: 0.7,
  },
  welcomeTitle: {
    fontSize: "clamp(34px, 4.1vw, 64px)",
    lineHeight: 1,
    margin: "0 0 18px",
    letterSpacing: "0.8px",
    fontWeight: 800,
  },
  welcomeDark: {
    color: "#1f4c8a",
  },
  welcomeText: {
    maxWidth: "500px",
    margin: 0,
    fontSize: "clamp(18px, 1.9vw, 38px)",
    lineHeight: 1.22,
    color: "#dbeafe",
  },
  rightPanel: {
    width: "45%",
    minWidth: "430px",
    maxWidth: "620px",
    backgroundColor: "#f8fafc",
    borderTopLeftRadius: "36px",
    borderBottomLeftRadius: "36px",
    padding: "72px 62px 48px",
    display: "flex",
    flexDirection: "column",
    boxShadow: "-8px 0 24px rgba(30, 64, 175, 0.08)",
  },
  signinTitle: {
    margin: "0 0 34px",
    color: "#2563eb",
    letterSpacing: "3px",
    fontSize: "clamp(30px, 3vw, 42px)",
    fontWeight: 700,
  },
  inputWrap: {
    background:
      "linear-gradient(90deg, rgba(37, 99, 235, 0.95) 0%, rgba(191, 219, 254, 0.8) 100%)",
    borderRadius: "26px",
    display: "flex",
    alignItems: "center",
    padding: "0 18px",
    height: "60px",
    marginBottom: "16px",
  },
  input: {
    width: "100%",
    height: "100%",
    border: "none",
    background: "transparent",
    color: "#f8fafc",
    fontSize: "clamp(15px, 1.7vw, 36px)",
    paddingLeft: "12px",
    outline: "none",
  },
  inputIcon: {
    color: "#e0f2fe",
    fontSize: "22px",
    lineHeight: 1,
  },
  eyeButton: {
    color: "#e0f2fe",
    fontSize: "18px",
    lineHeight: 1,
    background: "transparent",
    border: "none",
    cursor: "pointer",
  },
  rememberRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    color: "#4b6e93",
    fontSize: "clamp(14px, 1.4vw, 20px)",
    marginTop: "2px",
    marginBottom: "18px",
  },
  checkbox: {
    width: "16px",
    height: "16px",
    accentColor: "#2563eb",
  },
  message: {
    margin: "0 0 12px",
    textAlign: "center",
    fontSize: "14px",
    fontWeight: 600,
  },
  messageError: {
    color: "#b91c1c",
  },
  messageSuccess: {
    color: "#166534",
  },
  messageInfo: {
    color: "#1d4ed8",
  },
  submitButton: {
    width: "62%",
    alignSelf: "center",
    marginTop: "4px",
    marginBottom: "12px",
    padding: "16px 14px",
    border: "none",
    borderRadius: "42px",
    background: "linear-gradient(120deg, #5da8eb 0%, #538fd1 100%)",
    color: "#ffffff",
    fontWeight: 600,
    fontSize: "clamp(15px, 1.7vw, 34px)",
    letterSpacing: "1px",
    cursor: "pointer",
    opacity: 1,
  },
  linkButton: {
    alignSelf: "center",
    background: "none",
    border: "none",
    color: "#4b6e93",
    fontSize: "clamp(14px, 1.4vw, 20px)",
    textDecoration: "underline",
    cursor: "pointer",
    marginBottom: "36px",
  },
  signupText: {
    marginTop: "auto",
    textAlign: "center",
    color: "#4b6e93",
    fontSize: "clamp(14px, 1.4vw, 20px)",
  },
  inlineLinkButton: {
    background: "none",
    border: "none",
    color: "#4b6e93",
    textDecoration: "underline",
    cursor: "pointer",
    fontSize: "inherit",
    padding: 0,
  },
};

export default Login;
