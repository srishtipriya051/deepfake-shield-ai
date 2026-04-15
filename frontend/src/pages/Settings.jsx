import { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppChrome from "../components/AppChrome";
import { forgotPasswordUser } from "../services/api";
import { ThemeContext } from "../contexts/ThemeContextBase";
import { clearReports } from "../utils/reportsStorage";
import { decodeJwtEmail, getStoredToken, logoutUser } from "../utils/userSession";
import "./Settings.css";

function Settings() {
  const navigate = useNavigate();
  const token = getStoredToken();
  const userEmail = decodeJwtEmail(token) || "analyst@deepfakeshield.ai";
  const { theme, toggleTheme } = useContext(ThemeContext);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ newPassword: "", confirmPassword: "" });

  const handleLogout = () => {
    logoutUser();
    navigate("/login");
  };

  const handleDeleteAccount = () => {
    const confirmed = window.confirm("This will clear your local session and saved reports on this device. Continue?");
    if (!confirmed) return;
    clearReports();
    localStorage.removeItem("deepfake_shield_profile_v1");
    logoutUser();
    navigate("/signup");
  };

  const handleChangePassword = async () => {
    if (!passwordForm.newPassword.trim()) {
      window.alert("Enter a new password first.");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      window.alert("Passwords do not match.");
      return;
    }

    setIsChangingPassword(true);
    try {
      await forgotPasswordUser({ email: userEmail, new_password: passwordForm.newPassword });
      setPasswordForm({ newPassword: "", confirmPassword: "" });
      window.alert("Password updated successfully.");
    } catch (error) {
      window.alert(error?.response?.data?.detail || "Unable to update password right now.");
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <AppChrome navigate={navigate} currentPage="settings" userEmail={userEmail}>
      <main className="ds-content">
        <section className="settings-card">
          <div className="settings-card__header">
            <div>
              <p className="settings-eyebrow">Workspace Settings</p>
              <h1>Control your account and appearance</h1>
              <p className="settings-lead">
                Open profile details, switch between light and dark theme, update your password, or manage account access from one place.
              </p>
            </div>
          </div>

          <div className="settings-grid">
            <button type="button" className="settings-panel settings-panel--button" onClick={() => navigate("/profile")}>
              <span className="settings-panel__icon" aria-hidden="true">👤</span>
              <h2>Profile</h2>
            </button>

            <button type="button" className="settings-panel settings-panel--button" onClick={toggleTheme}>
              <span className="settings-panel__icon" aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>
              <h2>Theme Toggle</h2>
              <span className="settings-badge">{theme}</span>
            </button>

            <button type="button" className="settings-panel settings-panel--button" onClick={handleLogout}>
              <span className="settings-panel__icon" aria-hidden="true">↪</span>
              <h2>Log Out</h2>
            </button>

            <article className="settings-panel settings-panel--form">
              <span className="settings-panel__icon" aria-hidden="true">🔒</span>
              <h2>Change Password</h2>
              <input
                type="password"
                placeholder="New password"
                value={passwordForm.newPassword}
                onChange={(event) => setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))}
              />
              <input
                type="password"
                placeholder="Confirm new password"
                value={passwordForm.confirmPassword}
                onChange={(event) => setPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
              />
              <button type="button" className="profile-btn profile-btn--primary" onClick={handleChangePassword} disabled={isChangingPassword}>
                {isChangingPassword ? "Updating..." : "Update Password"}
              </button>
            </article>

            <button type="button" className="settings-panel settings-panel--button settings-panel--danger" onClick={handleDeleteAccount}>
              <span className="settings-panel__icon" aria-hidden="true">🗑</span>
              <h2>Delete Account</h2>
            </button>
          </div>
        </section>
      </main>
    </AppChrome>
  );
}

export default Settings;
