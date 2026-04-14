import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AppChrome from "../components/AppChrome";
import { decodeJwtEmail, getInitials, getStoredToken, loadProfile, saveProfile } from "../utils/userSession";
import "./Settings.css";

function Profile() {
  const navigate = useNavigate();
  const token = getStoredToken();
  const userEmail = decodeJwtEmail(token) || "analyst@deepfakeshield.ai";
  const [profile, setProfile] = useState(() => loadProfile(userEmail));
  const [isEditing, setIsEditing] = useState(false);

  const onChangeField = (key, value) => {
    setProfile((prev) => ({ ...prev, [key]: value }));
  };

  const onSaveProfile = () => {
    saveProfile(profile);
    setIsEditing(false);
  };

  const detailFields = [
    { key: "fullName", label: "Full name" },
    { key: "email", label: "Email address" },
    { key: "role", label: "Role" },
    { key: "workspace", label: "Workspace" },
  ];

  return (
    <AppChrome navigate={navigate} currentPage="profile" userEmail={profile.email || userEmail}>
      <main className="ds-content">
        <div className="profile-page profile-page--embedded">
          <section className="profile-hero">
            <div className="profile-hero__identity">
              <div className="profile-avatar-wrap">
                <div className="profile-avatar">{getInitials(profile.fullName)}</div>
                <span className="profile-avatar-badge">Verified</span>
              </div>

              <div className="profile-hero__copy">
                <p className="profile-eyebrow">User Profile</p>
                {isEditing ? (
                  <input
                    className="profile-edit-title"
                    value={profile.fullName}
                    onChange={(event) => onChangeField("fullName", event.target.value)}
                    aria-label="Full name"
                  />
                ) : (
                  <h1>{profile.fullName}</h1>
                )}
                <div className="profile-hero__meta">
                  <button type="button" className="profile-hero__link" onClick={() => navigate("/settings")}>
                    {profile.role}
                  </button>
                  <button type="button" className="profile-hero__link" onClick={() => navigate("/reports")}>
                    {profile.workspace}
                  </button>
                  <button type="button" className="profile-hero__link" onClick={() => navigate("/dashboard")}>
                    Joined {profile.joinedOn}
                  </button>
                </div>
              </div>
            </div>

            <div className="profile-hero__actions">
              {isEditing ? (
                <>
                  <button type="button" className="profile-btn profile-btn--primary" onClick={onSaveProfile}>
                    Save Profile
                  </button>
                  <button type="button" className="profile-btn profile-btn--secondary" onClick={() => setIsEditing(false)}>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="profile-btn profile-btn--primary" onClick={() => setIsEditing(true)}>
                    Edit Profile
                  </button>
                  <button type="button" className="profile-btn profile-btn--secondary" onClick={() => navigate("/dashboard")}>
                    Open Dashboard
                  </button>
                </>
              )}
            </div>
          </section>

          <section className="profile-grid profile-grid--single">
            <article className="profile-card">
              <div className="profile-card__header">
                <div>
                  <p className="profile-card__eyebrow">Account Details</p>
                  <h2>Identity and workspace</h2>
                </div>
                <button type="button" className="profile-chip" onClick={isEditing ? onSaveProfile : () => setIsEditing(true)}>
                  {isEditing ? "Save" : "Synced"}
                </button>
              </div>

              <div className="profile-detail-grid">
                {detailFields.map((item) => (
                  <div key={item.key} className="profile-detail-row">
                    <span>{item.label}</span>
                    {isEditing ? (
                      <input
                        className="profile-detail-input"
                        value={profile[item.key]}
                        onChange={(event) => onChangeField(item.key, event.target.value)}
                        aria-label={item.label}
                      />
                    ) : (
                      <strong>{profile[item.key]}</strong>
                    )}
                  </div>
                ))}
              </div>
            </article>

            <article className="profile-card">
              <div className="profile-card__header">
                <div>
                  <p className="profile-card__eyebrow">Security</p>
                  <h2>Protection status</h2>
                </div>
              </div>

              <div className="profile-security-panel">
                <div className="profile-security-meter">
                  <div className="profile-security-meter__ring">
                    <div className="profile-security-meter__inner">96%</div>
                  </div>
                  <p>Account health</p>
                </div>

                <ul className="profile-bullet-list">
                  <li>Two-factor authentication is active.</li>
                  <li>Password can be changed from settings.</li>
                  <li>Use the logo menu to move between dashboard, reports, and settings.</li>
                </ul>
              </div>
            </article>

            <article className="profile-card">
              <div className="profile-card__header">
                <div>
                  <p className="profile-card__eyebrow">Quick Links</p>
                  <h2>Jump to important pages</h2>
                </div>
              </div>

              <div className="settings-grid settings-grid--compact">
                <button type="button" className="settings-panel settings-panel--button settings-panel--quicklink" onClick={() => navigate("/dashboard")}>
                  <span className="settings-panel__icon settings-panel__icon--quick" aria-hidden="true">⌂</span>
                  <h2>Dashboard</h2>
                </button>
                <button type="button" className="settings-panel settings-panel--button settings-panel--quicklink" onClick={() => navigate("/reports")}>
                  <span className="settings-panel__icon settings-panel__icon--quick" aria-hidden="true">▤</span>
                  <h2>Reports</h2>
                </button>
                <button type="button" className="settings-panel settings-panel--button settings-panel--quicklink" onClick={() => navigate("/settings")}>
                  <span className="settings-panel__icon settings-panel__icon--quick" aria-hidden="true">⚙</span>
                  <h2>Settings</h2>
                </button>
              </div>
            </article>
          </section>
        </div>
      </main>
    </AppChrome>
  );
}

export default Profile;
