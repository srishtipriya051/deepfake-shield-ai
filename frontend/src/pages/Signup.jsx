import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { registerUser } from "../services/api"; // API function banana padega

function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agree, setAgree] = useState(false);

  const navigate = useNavigate();

  const handleSignup = async () => {
    if (!agree) {
      alert("Please accept terms & conditions");
      return;
    }

    try {
      await registerUser({ email, password });
      alert("Signup Successful 🚀");
      navigate("/login");
    } catch {
      alert("Signup Failed ❌");
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2>DeepFake Shield AI</h2>
        <p>Signup</p>

        <input
          type="email"
          placeholder="Email"
          style={styles.input}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          style={styles.input}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <div style={styles.checkboxContainer}>
          <input
            type="checkbox"
            checked={agree}
            onChange={() => setAgree(!agree)}
          />
          <span style={{ marginLeft: "8px" }}>I agree</span>
        </div>

        <button style={styles.button} onClick={handleSignup}>
          Signup
        </button>

        <p style={{ marginTop: "10px" }}>
          Already have an account?{" "}
          <span
            style={styles.link}
            onClick={() => navigate("/login")}
          >
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
    height: "100vh",
    backgroundColor: "#111"
  },

  card: {
    backgroundColor: "#1e1e1e",
    padding: "30px",
    borderRadius: "10px",
    textAlign: "center",
    width: "300px",
    color: "white"
  },

  input: {
    width: "100%",
    padding: "10px",
    margin: "10px 0",
    borderRadius: "5px",
    border: "none"
  },

  checkboxContainer: {
    display: "flex",
    alignItems: "center",
    marginTop: "10px",
    color: "white"
  },

  button: {
    width: "100%",
    padding: "10px",
    backgroundColor: "#4CAF50",
    color: "white",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    marginTop: "10px"
  },

  link: {
    color: "#4CAF50",
    cursor: "pointer",
    textDecoration: "underline"
  }
};

export default Signup;