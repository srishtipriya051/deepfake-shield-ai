import { useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./Dashboard.css";

function decodeJwtEmail(token) {
  if (!token) return null;
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return json?.sub || null;
  } catch {
    return null;
  }
}

function todayLabel() {
  const d = new Date();
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const userEmail = decodeJwtEmail(token) || "User";

  const videoInputRef = useRef(null);
  const imageInputRef = useRef(null);

  const [videoFile, setVideoFile] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [analysis, setAnalysis] = useState(() => ({
    status: "idle",
    probability: 92,
    confidence: 92,
    faceSwapDetected: true,
    syntheticVoice: true,
    verdict: "Deepfake Detected",
    mediaType: "Video",
    timestampLabel: "Today",
    previewUrl: null,
  }));

  const [recentReports, setRecentReports] = useState(() => [
    { date: "Today", mediaType: "Video", status: "Fake", confidence: 89 },
    { date: "Yesterday", mediaType: "Image", status: "Fake", confidence: 91 },
    { date: "Last Week", mediaType: "Video", status: "Real", confidence: 8 },
  ]);

  const activeTop = useMemo(() => {
    if (location.pathname.startsWith("/reports")) return "reports";
    if (location.pathname.startsWith("/settings")) return "settings";
    return "dashboard";
  }, [location.pathname]);

  const probabilityStyle = useMemo(() => ({ "--p": `${analysis.probability}%` }), [analysis.probability]);

  const pickFile = (kind) => {
    if (kind === "video") videoInputRef.current?.click();
    if (kind === "image") imageInputRef.current?.click();
  };

  const onSelectVideo = (e) => {
    const file = e.target.files?.[0] || null;
    setVideoFile(file);
    if (file) {
      setImageFile(null);
      setAnalysis((prev) => ({ ...prev, mediaType: "Video", previewUrl: URL.createObjectURL(file) }));
    }
  };

  const onSelectImage = (e) => {
    const file = e.target.files?.[0] || null;
    setImageFile(file);
    if (file) {
      setVideoFile(null);
      setAnalysis((prev) => ({ ...prev, mediaType: "Image", previewUrl: URL.createObjectURL(file) }));
    }
  };

  const startAnalysis = async () => {
    if (!videoFile && !imageFile) {
      alert("Please upload a video or image first.");
      return;
    }

    setIsAnalyzing(true);
    setAnalysis((prev) => ({ ...prev, status: "running" }));

    // Mock analysis to keep UI fully functional even without ML endpoints wired yet.
    await new Promise((r) => setTimeout(r, 1200));

    const probability = Math.min(99, Math.max(1, Math.round(70 + Math.random() * 29)));
    const confidence = probability;
    const isFake = probability >= 50;

    setAnalysis((prev) => ({
      ...prev,
      status: "done",
      probability,
      confidence,
      verdict: isFake ? "Deepfake Detected" : "Likely Real",
      faceSwapDetected: isFake ? Math.random() > 0.25 : Math.random() > 0.75,
      syntheticVoice: prev.mediaType === "Video" ? (isFake ? Math.random() > 0.25 : Math.random() > 0.75) : false,
      timestampLabel: "Today",
    }));

    setRecentReports((prev) => [
      { date: "Today", mediaType: imageFile ? "Image" : "Video", status: isFake ? "Fake" : "Real", confidence },
      ...prev.slice(0, 5),
    ]);

    setIsAnalyzing(false);
  };

  const logout = () => {
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
    navigate("/login");
  };

  const viewReport = (row) => {
    alert(`Report\n\nDate: ${row.date}\nMedia: ${row.mediaType}\nStatus: ${row.status}\nConfidence: ${row.confidence}%`);
  };

  return (
    <div className="ds-shell">
      <header className="ds-topbar">
        <div className="ds-brand">
          <div className="ds-logo">🛡️</div>
          <div>Deepfake Shield AI</div>
        </div>

        <nav className="ds-nav" aria-label="Top navigation">
          <button aria-current={activeTop === "dashboard" ? "page" : undefined} onClick={() => navigate("/dashboard")}>
            Dashboard
          </button>
          <button aria-current={activeTop === "reports" ? "page" : undefined} onClick={() => navigate("/reports")}>
            Reports
          </button>
          <button aria-current={activeTop === "settings" ? "page" : undefined} onClick={() => navigate("/settings")}>
            Settings
          </button>
        </nav>

        <div className="ds-user">
          <div className="ds-avatar" />
          <div>
            <div style={{ fontSize: 12, opacity: 0.92 }}>Welcome,</div>
            <div style={{ fontSize: 13 }}>{userEmail}</div>
          </div>
        </div>
      </header>

      <div className="ds-body">
        <aside className="ds-sidebar" aria-label="Sidebar navigation">
          <button className="ds-side-item" aria-current="page" onClick={() => navigate("/dashboard")}>
            <span>🏠</span> Dashboard
          </button>
          <button className="ds-side-item" onClick={() => document.getElementById("detect")?.scrollIntoView({ behavior: "smooth" })}>
            <span>🕵️</span> Detect Deepfake Media
          </button>
          <button className="ds-side-item" onClick={() => document.getElementById("analysis")?.scrollIntoView({ behavior: "smooth" })}>
            <span>📊</span> Analysis Reports
          </button>
          <button className="ds-side-item" onClick={() => navigate("/settings")}>
            <span>⚙️</span> Settings
          </button>
          <button className="ds-side-item" onClick={logout}>
            <span>⏻</span> Log Out
          </button>
        </aside>

        <main className="ds-content">
          <section id="detect" className="ds-card">
            <div className="ds-card-hd">
              <h2>Detect Deepfake Media</h2>
              <p>Upload files you want to analyze for deepfake content.</p>
            </div>

            <div className="ds-upload-grid">
              <div className="ds-upload-box">
                <div className="ds-upload-title">
                  <div>Upload Video</div>
                  <span>{videoFile ? videoFile.name : "MP4, MOV, WEBM"}</span>
                </div>
                <button className="ds-btn" type="button" onClick={() => pickFile("video")}>
                  Browse Files ›
                </button>
                <input ref={videoInputRef} type="file" accept="video/*" style={{ display: "none" }} onChange={onSelectVideo} />
              </div>

              <div className="ds-upload-box">
                <div className="ds-upload-title">
                  <div>Upload Image</div>
                  <span>{imageFile ? imageFile.name : "JPG, PNG, WEBP"}</span>
                </div>
                <button className="ds-btn" type="button" onClick={() => pickFile("image")}>
                  Browse Files ›
                </button>
                <input ref={imageInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onSelectImage} />
              </div>
            </div>

            <div className="ds-actions">
              <button className="ds-primary" type="button" onClick={startAnalysis} disabled={isAnalyzing}>
                {isAnalyzing ? "Analyzing..." : "Start Analysis ›"}
              </button>
            </div>
          </section>

          <section id="analysis" className="ds-card">
            <div className="ds-card-hd">
              <h2>Analysis Results</h2>
              <p>
                {analysis.status === "idle"
                  ? "Upload media and start analysis to see results."
                  : `Last run: ${analysis.timestampLabel} (${todayLabel()})`}
              </p>
            </div>

            <div className="ds-results">
              <div className="ds-panel">
                <div className="ds-panel-hd">
                  <span>{analysis.verdict}</span>
                  <span style={{ opacity: 0.75 }}>{analysis.mediaType}</span>
                </div>
                <div className="ds-media">
                  <div className="ds-preview">
                    {analysis.previewUrl ? (
                      analysis.mediaType === "Video" ? (
                        <video src={analysis.previewUrl} controls />
                      ) : (
                        <img src={analysis.previewUrl} alt="Uploaded preview" />
                      )
                    ) : (
                      <img
                        src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=60"
                        alt="Sample preview"
                      />
                    )}
                  </div>

                  <div>
                    <div className="ds-badge">Deepfake Detected</div>
                    <div className="ds-sub">Detection Confidence: {analysis.confidence}%</div>
                    <div style={{ marginTop: 10 }}>
                      <button className="ds-btn" type="button" onClick={() => viewReport({ date: "Today", mediaType: analysis.mediaType, status: "Fake", confidence: analysis.confidence })}>
                        View Detailed Report ›
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="ds-panel">
                <div className="ds-panel-hd">
                  <span>Deepfake Probability</span>
                  <span style={{ opacity: 0.75 }}>{analysis.probability}%</span>
                </div>
                <div className="ds-meter">
                  <div className="ds-ring" style={probabilityStyle}>
                    <div className="ds-ring-inner">{analysis.probability}%</div>
                  </div>
                  <div style={{ textAlign: "center", fontWeight: 900, color: "#991b1b" }}>
                    {analysis.probability >= 50 ? "High Risk" : "Low Risk"}
                  </div>
                </div>
              </div>

              <div className="ds-panel">
                <div className="ds-panel-hd">
                  <span>Facial Manipulation</span>
                  <span style={{ opacity: 0.75 }}>{analysis.faceSwapDetected ? "Detected" : "Not Detected"}</span>
                </div>
                <div className="ds-mini">
                  <div className="ds-preview">
                    <img
                      src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=60"
                      alt="Face sample"
                    />
                  </div>
                  <div style={{ textAlign: "center", fontWeight: 900, color: "rgba(15, 23, 42, 0.76)" }}>
                    {analysis.faceSwapDetected ? "Face Swap Detected" : "No Face Swap Indicators"}
                  </div>

                  <div className="ds-panel-hd" style={{ marginTop: 8 }}>
                    <span>Voice Analysis</span>
                    <span style={{ opacity: 0.75 }}>{analysis.syntheticVoice ? "Synthetic" : "Natural"}</span>
                  </div>
                  <div className="ds-wave" />
                  <div style={{ textAlign: "center", fontWeight: 900, color: "rgba(15, 23, 42, 0.76)" }}>
                    {analysis.syntheticVoice ? "Synthetic Voice Identified" : "No Synthetic Voice Indicators"}
                  </div>
                </div>
              </div>
            </div>

            <div className="ds-two">
              <div className="ds-panel">
                <div className="ds-panel-hd">
                  <span>Tips to Spot Deepfakes</span>
                  <span style={{ opacity: 0.7 }}>Quick checks</span>
                </div>
                <ul className="ds-list">
                  <li>Unnatural facial movements</li>
                  <li>Mismatch in lighting and shadows</li>
                  <li>Irregular audio or voice</li>
                </ul>
              </div>

              <div className="ds-panel">
                <div className="ds-panel-hd">
                  <span>Recommended Actions</span>
                  <span style={{ opacity: 0.7 }}>What to do</span>
                </div>
                <ul className="ds-list">
                  <li>Verify the source</li>
                  <li>Report this content</li>
                  <li>Educate others on deepfakes</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="ds-card">
            <div className="ds-card-hd">
              <h2>Recent Analysis Reports</h2>
              <p>Saved locally after each analysis run.</p>
            </div>

            <div style={{ padding: "0 18px 18px" }}>
              <table className="ds-table" aria-label="Recent reports table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Media Type</th>
                    <th>Status</th>
                    <th>Confidence</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {recentReports.map((row, idx) => (
                    <tr key={`${row.date}-${idx}`}>
                      <td>{row.date}</td>
                      <td>{row.mediaType}</td>
                      <td>
                        <span className={`ds-pill ${row.status === "Fake" ? "fake" : "real"}`}>{row.status}</span>
                      </td>
                      <td>{row.confidence}%</td>
                      <td>
                        <button type="button" onClick={() => viewReport(row)}>
                          View Report ›
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export default Dashboard;

