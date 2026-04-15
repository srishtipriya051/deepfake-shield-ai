import { useEffect, useState } from "react";
import shieldLogo from "../assets/shield-logo.jpeg";
import { getInitials, logoutUser } from "../utils/userSession";

function AppChrome({ navigate, currentPage, userEmail, children }) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    setIsDrawerOpen(false);
  }, [currentPage]);

  useEffect(() => {
    if (!isDrawerOpen) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") setIsDrawerOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isDrawerOpen]);

  const closeDrawer = () => setIsDrawerOpen(false);
  const goTo = (path) => {
    closeDrawer();
    navigate(path);
  };
  const onLogout = () => {
    closeDrawer();
    logoutUser();
    navigate("/login");
  };

  const drawerItems = [
    { key: "dashboard", label: "Dashboard", short: "🏠", path: "/dashboard" },
    { key: "reports", label: "Reports", short: "📄", path: "/reports" },
    { key: "settings", label: "Settings", short: "⚙", path: "/settings" },
  ];

  return (
    <div className="ds-shell">
      <header className="ds-topbar">
        <button type="button" className="ds-brand ds-brand-button" onClick={() => setIsDrawerOpen(true)} aria-label="Open navigation menu">
          <img src={shieldLogo} alt="Deepfake Shield AI logo" className="ds-logo ds-logo-image" />
          <div>
            <span className="ds-brand-full">Deepfake Shield AI</span>
            <span className="ds-brand-short" aria-hidden="true">
              Shield AI
            </span>
          </div>
        </button>

        <button type="button" className="ds-user ds-user-button" onClick={() => navigate("/profile")} aria-label="Open profile page">
          <div className="ds-avatar ds-avatar-text">{getInitials(userEmail)}</div>
          <div>
            <div style={{ fontSize: 12, opacity: 0.92 }}>Profile</div>
            <div style={{ fontSize: 13 }}>{userEmail}</div>
          </div>
        </button>
      </header>

      <div className={`ds-drawer-backdrop ${isDrawerOpen ? "is-open" : ""}`} onClick={closeDrawer} aria-hidden={!isDrawerOpen} />
      <aside className={`ds-drawer ${isDrawerOpen ? "is-open" : ""}`} aria-label="Sidebar navigation">
        <div className="ds-drawer-head">
          <div className="ds-drawer-brand">
            <img src={shieldLogo} alt="Deepfake Shield AI logo" className="ds-drawer-logo" />
            <span>Deepfake Shield AI</span>
          </div>
          <button type="button" className="ds-drawer-close" onClick={closeDrawer} aria-label="Close navigation menu">
            x
          </button>
        </div>

        <nav className="ds-drawer-nav">
          {drawerItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className="ds-side-item"
              aria-current={currentPage === item.key ? "page" : undefined}
              onClick={() => goTo(item.path)}
            >
              <span className="ds-side-item__icon">{item.short}</span>
              {item.label}
            </button>
          ))}
          <button type="button" className="ds-side-item" onClick={onLogout}>
            <span className="ds-side-item__icon">⎋</span>
            Log Out
          </button>
        </nav>
      </aside>

      <div className="ds-body ds-body--no-sidebar">{children}</div>
    </div>
  );
}

export default AppChrome;
