import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppChrome from "../components/AppChrome";
import { analyzeMedia, formatApiDetail, getAuthToken } from "../services/api";
import { addReport, loadReports } from "../utils/reportsStorage";
import { downloadReportAsPdf } from "../utils/reportDownload";
import { decodeJwtEmail } from "../utils/userSession";
import "./Dashboard.css";

function todayLabel() {
  const d = new Date();
  return d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatRowDate(iso) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
}

function newId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `r_${Date.now()}`;
}

function defaultPipelineFlow() {
  return [
    "Frontend (React)",
    "Backend API",
    "Face Detection (MTCNN)",
    "Frame Extraction",
    "Deepfake Model (XceptionNet / EfficientNet)",
    "Artifact Analysis",
    "Probability Calculation",
    "Dashboard Result",
  ];
}

function normalizePipelineStages(stages, mediaType) {
  if (Array.isArray(stages) && stages.length) {
    return stages.map((stage) => ({
      key: stage?.key || String(stage?.title || Math.random()),
      title: stage?.title || "Pipeline Stage",
      status: stage?.status || "completed",
    }));
  }

  const isVideo = mediaType === "Video";
  return [
    { key: "frontend", title: "Frontend (React)", status: "completed" },
    { key: "backend_api", title: "Backend API", status: "completed" },
    { key: "face_detection", title: "Face Detection (MTCNN)", status: "completed" },
    { key: "frame_extraction", title: "Frame Extraction", status: isVideo ? "completed" : "skipped" },
    { key: "deepfake_model", title: "Deepfake Model (XceptionNet / EfficientNet)", status: "completed" },
    { key: "artifact_analysis", title: "Artifact Analysis", status: "completed" },
    { key: "probability", title: "Probability Calculation", status: "completed" },
    { key: "dashboard_result", title: "Dashboard Result", status: "completed" },
  ];
}

function emptyAnalysis() {
  return {
    status: "idle",
    probability: null,
    confidence: null,
    label: "",
    faceSwapDetected: false,
    syntheticVoice: false,
    audioAnalyzed: false,
    verdict: "",
    mediaType: "",
    timestampLabel: "",
    previewUrl: null,
    error: null,
    filename: null,
    reportId: null,
    disclaimer: null,
    realLikePercent: null,
    riskLevel: null,
    facesDetected: null,
    framesAnalyzed: null,
    featureAnalysis: null,
    model: null,
    noFacesDetected: false,
    pipelineStages: [],
    pipelineFlow: defaultPipelineFlow(),
  };
}

function Dashboard() {
  const navigate = useNavigate();
  const token = getAuthToken();
  const userEmail = decodeJwtEmail(token) || "User";

  const videoInputRef = useRef(null);
  const imageInputRef = useRef(null);

  const [videoFile, setVideoFile] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(() => emptyAnalysis());
  const [recentReports, setRecentReports] = useState(() => loadReports());

  useEffect(() => {
    const url = analysis.previewUrl;
    return () => {
      if (url && String(url).startsWith("blob:")) URL.revokeObjectURL(url);
    };
  }, [analysis.previewUrl]);

  const probabilityStyle = useMemo(() => {
    const p = analysis.probability == null ? 0 : analysis.probability;
    return { "--p": `${p}%` };
  }, [analysis.probability]);

  const updatePreview = (file, mediaType) => {
    setAnalysis((prev) => ({
      ...prev,
      ...emptyAnalysis(),
      mediaType,
      previewUrl: URL.createObjectURL(file),
      filename: file.name,
    }));
  };

  const onSelectVideo = (event) => {
    const input = event.target;
    const file = input.files?.[0] || null;
    if (input) input.value = "";
    setVideoFile(file);
    setImageFile(null);
    if (file) updatePreview(file, "Video");
  };

  const onSelectImage = (event) => {
    const input = event.target;
    const file = input.files?.[0] || null;
    if (input) input.value = "";
    setImageFile(file);
    setVideoFile(null);
    if (file) updatePreview(file, "Image");
  };

  const startAnalysis = async () => {
    const file = imageFile || videoFile;
    if (!file) {
      alert("Please upload a video or image first.");
      return;
    }

    setIsAnalyzing(true);
    setAnalysis((prev) => ({
      ...prev,
      status: "running",
      error: null,
      pipelineFlow: defaultPipelineFlow(),
    }));

    try {
      const { data } = await analyzeMedia(file);
      const mediaType = data?.media_type === "video" ? "Video" : "Image";
      const rawFake = Number(data?.fakeProbability ?? data?.fake_probability);
      const rawReal = Number(data?.realProbability ?? data?.real_like_percent);
      const rawConfidence = Number(data?.confidence);

      const probability = Number.isFinite(rawFake)
        ? Math.max(0, Math.min(100, Math.round(rawFake)))
        : 0;
      const realLikePercent = Number.isFinite(rawReal)
        ? Math.max(0, Math.min(100, Math.round(rawReal)))
        : Math.max(0, Math.min(100, 100 - probability));
      const confidence = Number.isFinite(rawConfidence)
        ? Math.max(0, Math.min(100, Math.round(rawConfidence)))
        : Math.max(probability, realLikePercent);

      const label = ["Fake", "Real", "Uncertain"].includes(data?.label)
        ? data.label
        : Math.abs(probability - realLikePercent) < 10
          ? "Uncertain"
          : probability >= realLikePercent
            ? "Fake"
            : "Real";

      const pipelineFlow = Array.isArray(data?.pipeline_flow) && data.pipeline_flow.length
        ? data.pipeline_flow
        : defaultPipelineFlow();
      const pipelineStages = normalizePipelineStages(data?.pipeline_stages, mediaType);
      const riskLevel = data?.riskLevel || (label === "Fake" ? "High" : label === "Real" ? "Low" : "Medium");

      const report = {
        id: newId(),
        createdAt: new Date().toISOString(),
        filename: file.name,
        mediaType,
        status: label,
        confidence,
        label,
        verdict: String(data?.verdict || label),
        fakeProbability: probability,
        realProbability: realLikePercent,
        probability,
        faceSwapDetected: Boolean(data?.face_swap_detected),
        syntheticVoice: Boolean(data?.synthetic_voice),
        audioAnalyzed: Boolean(data?.audio_analyzed),
        disclaimer: data?.disclaimer || null,
        metrics: data?.metrics || null,
        explanation: typeof data?.explanation === "string" ? data.explanation : "",
        findings: Array.isArray(data?.findings) ? data.findings : [],
        realLikePercent,
        riskLevel,
        featureAnalysis: data?.feature_analysis || null,
        facesDetected: Number.isFinite(Number(data?.faces_detected ?? data?.metrics?.faces_detected))
          ? Number(data?.faces_detected ?? data?.metrics?.faces_detected)
          : null,
        framesAnalyzed: Number.isFinite(Number(data?.metrics?.frames_analyzed))
          ? Number(data?.metrics?.frames_analyzed)
          : mediaType === "Video"
            ? null
            : 1,
        model: data?.model || null,
        noFacesDetected: Boolean(data?.noFacesDetected),
        pipelineStages,
        pipelineFlow,
      };

      addReport(report);
      setRecentReports(loadReports());
      setAnalysis((prev) => ({
        ...prev,
        status: "done",
        probability,
        confidence,
        label,
        verdict: report.verdict,
        faceSwapDetected: report.faceSwapDetected,
        syntheticVoice: report.syntheticVoice,
        audioAnalyzed: report.audioAnalyzed,
        mediaType,
        timestampLabel: "Just now",
        reportId: report.id,
        disclaimer: report.disclaimer,
        realLikePercent,
        riskLevel,
        featureAnalysis: report.featureAnalysis,
        facesDetected: report.facesDetected,
        framesAnalyzed: report.framesAnalyzed,
        model: report.model,
        noFacesDetected: report.noFacesDetected,
        pipelineStages,
        pipelineFlow,
      }));

      requestAnimationFrame(() => {
        document.getElementById("analysis")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    } catch (error) {
      setAnalysis((prev) => ({
        ...prev,
        status: "error",
        error: formatApiDetail(
          error,
          "Analysis failed. Start the API on port 8000 and keep the Vite dev server running.",
        ),
      }));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const viewReport = (row) => {
    navigate("/reports", { state: { focusId: row.id } });
  };

  const badgeLabel =
    analysis.status !== "done" || analysis.probability == null
      ? "Awaiting analysis"
      : analysis.label === "Fake"
        ? "Deepfake risk"
        : analysis.label === "Uncertain"
          ? "Uncertain"
          : "Likely authentic";

  const probLabel = analysis.probability == null ? "-" : `${analysis.probability}%`;
  const riskColor =
    analysis.probability == null
      ? "rgba(15, 23, 42, 0.55)"
      : analysis.label === "Fake"
        ? "#991b1b"
        : analysis.label === "Uncertain"
          ? "#92400e"
          : "#166534";

  return (
    <AppChrome navigate={navigate} currentPage="dashboard" userEmail={userEmail}>
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
                <button className="ds-btn" type="button" onClick={() => videoInputRef.current?.click()}>
                  Browse Files &gt;
                </button>
                <input ref={videoInputRef} type="file" accept="video/*" style={{ display: "none" }} onChange={onSelectVideo} />
              </div>

              <div className="ds-upload-box">
                <div className="ds-upload-title">
                  <div>Upload Image</div>
                  <span>{imageFile ? imageFile.name : "JPG, PNG, WEBP"}</span>
                </div>
                <button className="ds-btn" type="button" onClick={() => imageInputRef.current?.click()}>
                  Browse Files &gt;
                </button>
                <input ref={imageInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onSelectImage} />
              </div>
            </div>

            <div className="ds-actions">
              <button className="ds-primary" type="button" onClick={startAnalysis} disabled={isAnalyzing} aria-busy={isAnalyzing}>
                {isAnalyzing ? "Analyzing..." : "Start Analysis >"}
              </button>
            </div>
          </section>

          <section id="analysis" className="ds-card">
            <div className="ds-card-hd">
              <h2>Analysis Results</h2>
              <p>
                {analysis.status === "idle"
                  ? "Upload media and start analysis to see results."
                  : analysis.status === "running"
                    ? "Running analysis on your file..."
                    : analysis.status === "error"
                      ? "The last analysis run failed."
                      : `Last run: ${analysis.timestampLabel} (${todayLabel()})`}
              </p>
            </div>

            {analysis.status === "error" && analysis.error ? (
              <div style={{ padding: "0 18px 18px", color: "#991b1b", fontWeight: 800 }}>{analysis.error}</div>
            ) : null}

            {analysis.status === "running" ? (
              <div className="ds-result-banner ds-result-banner--pending">Scanning your upload... this can take a bit for video.</div>
            ) : null}

            {analysis.status === "done" && analysis.probability != null && analysis.realLikePercent != null ? (
              <div className="ds-result-banner ds-result-banner--done">
                <strong>Detection Result:</strong> {analysis.label} - <span className="ds-fake-pct">Fake Probability: {analysis.probability}%</span> -{" "}
                <span className="ds-real-pct">Authenticity Score: {analysis.realLikePercent}%</span> - <strong>Risk Level:</strong> {analysis.riskLevel || "Medium"}
              </div>
            ) : null}

            {analysis.status === "done" && analysis.probability != null ? (
              <div
                className={`ds-verdict-strip ${analysis.label === "Fake" ? "ds-verdict-strip--fake" : analysis.label === "Uncertain" ? "ds-verdict-strip--uncertain" : "ds-verdict-strip--real"}`}
                role="status"
                aria-live="polite"
              >
                <span className="ds-verdict-strip__title">Detection Result: {analysis.label}</span>
                <span className="ds-verdict-strip__verdict">{analysis.verdict}</span>
              </div>
            ) : null}

            <div className="ds-results">
              <div className="ds-panel">
                <div className="ds-panel-hd">
                  <span>{analysis.status === "done" ? analysis.verdict : "No verdict yet"}</span>
                  <span style={{ opacity: 0.75 }}>{analysis.mediaType || "-"}</span>
                </div>
                <div className="ds-media">
                  <div className="ds-preview">
                    {analysis.previewUrl ? (
                      analysis.mediaType === "Video" ? (
                        <video src={analysis.previewUrl} controls playsInline preload="metadata" />
                      ) : (
                        <img src={analysis.previewUrl} alt="Uploaded preview" />
                      )
                    ) : (
                      <div className="ds-preview-placeholder">Upload a file to preview it here.</div>
                    )}
                  </div>

                  <div>
                    <div
                      className={
                        analysis.status !== "done" || analysis.probability == null
                          ? "ds-badge ds-badge--neutral"
                          : analysis.label === "Fake"
                            ? "ds-badge ds-badge--risk"
                            : analysis.label === "Uncertain"
                              ? "ds-badge ds-badge--warn"
                              : "ds-badge ds-badge--ok"
                      }
                    >
                      {badgeLabel}
                    </div>
                    <div className="ds-sub">
                      {analysis.confidence == null ? "Detection confidence: -" : `Detection confidence: ${analysis.confidence}%`}
                    </div>
                    {analysis.filename ? (
                      <div className="ds-sub" style={{ marginTop: 6 }}>
                        File: {analysis.filename}
                      </div>
                    ) : null}
                    {analysis.disclaimer ? (
                      <div className="ds-sub" style={{ marginTop: 8, fontWeight: 700, color: "rgba(15, 23, 42, 0.62)" }}>
                        {analysis.disclaimer}
                      </div>
                    ) : null}
                    <div style={{ marginTop: 10 }}>
                      <button className="ds-btn" type="button" disabled={!analysis.reportId} onClick={() => analysis.reportId && viewReport({ id: analysis.reportId })}>
                        View Detailed Report &gt;
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="ds-panel">
                <div className="ds-panel-hd">
                  <span>Deepfake Probability</span>
                  <span style={{ opacity: 0.75 }}>{probLabel}</span>
                </div>
                <div className="ds-meter">
                  <div className="ds-ring" style={probabilityStyle}>
                    <div className="ds-ring-inner">{probLabel}</div>
                  </div>
                  <div style={{ textAlign: "center", fontWeight: 900, color: riskColor }}>
                    {analysis.probability == null ? "-" : `Risk Level: ${analysis.riskLevel || (analysis.label === "Fake" ? "High" : analysis.label === "Uncertain" ? "Medium" : "Low")}`}
                  </div>
                  <div className="ds-score-grid">
                    <span>Fake Probability</span>
                    <strong>{analysis.probability == null ? "-" : `${analysis.probability}%`}</strong>
                    <span>Authenticity Score</span>
                    <strong>{analysis.realLikePercent == null ? "-" : `${analysis.realLikePercent}%`}</strong>
                  </div>
                </div>
              </div>

              <div className="ds-panel">
                <div className="ds-feature-list">
                  <div className="ds-panel-hd" style={{ marginTop: 8 }}>
                    <span>Voice Analysis</span>
                    <span style={{ opacity: 0.75 }}>
                      {analysis.mediaType !== "Video" || !analysis.audioAnalyzed ? "N/A" : analysis.syntheticVoice ? "Synthetic" : "Natural"}
                    </span>
                  </div>
                  <div className="ds-wave" />
                  <div style={{ textAlign: "center", fontWeight: 900, color: "rgba(15, 23, 42, 0.76)" }}>
                    {analysis.mediaType !== "Video"
                      ? "Voice checks apply to video uploads only."
                      : !analysis.audioAnalyzed
                        ? "Voice/audio is not analyzed in this build."
                        : analysis.syntheticVoice
                          ? "Heuristic audio-risk flag (demo)"
                          : "No strong synthetic-voice heuristic flag"}
                  </div>
                </div>
              </div>
            </div>

          </section>

          <section className="ds-card">
            <div className="ds-card-hd">
              <h2>Recent Analysis Reports</h2>
              <p>Saved in your browser after each successful analysis.</p>
            </div>

            <div className="ds-table-wrap" style={{ padding: "0 18px 18px" }}>
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
                  {recentReports.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: "14px 10px", fontWeight: 800, color: "rgba(15, 23, 42, 0.62)" }}>
                        No reports yet. Run an analysis to create your first report.
                      </td>
                    </tr>
                  ) : (
                    recentReports.map((row) => (
                      <tr key={row.id || `${row.createdAt}-${row.filename}`}>
                        <td>{formatRowDate(row.createdAt) || row.date || "-"}</td>
                        <td>{row.mediaType}</td>
                        <td>
                          <span className={`ds-pill ${row.status === "Fake" ? "fake" : "real"}`}>{row.status}</span>
                        </td>
                        <td>{row.confidence}%</td>
                        <td>
                          <button type="button" onClick={() => viewReport(row)}>
                            View Report &gt;
                          </button>
                          <button type="button" style={{ marginLeft: 8 }} onClick={() => downloadReportAsPdf(row)}>
                            Download PDF
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
    </AppChrome>
  );
}

export default Dashboard;
