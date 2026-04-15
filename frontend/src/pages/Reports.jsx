import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AppChrome from "../components/AppChrome";
import { getAuthToken } from "../services/api";
import { downloadReportAsPdf, metricsRows, resolveReportNarrative } from "../utils/reportDownload";
import { clearReports, loadReports } from "../utils/reportsStorage";
import { decodeJwtEmail } from "../utils/userSession";
import "./Dashboard.css";
import "./Reports.css";

function formatRealLikePercent(report) {
  if (report?.realProbability != null && Number.isFinite(Number(report.realProbability))) {
    return `${Math.round(Number(report.realProbability))}%`;
  }
  if (report?.realLikePercent != null && Number.isFinite(Number(report.realLikePercent))) {
    return `${Math.round(Number(report.realLikePercent))}%`;
  }
  const p = Number(report?.probability);
  if (!Number.isFinite(p)) return "—";
  return `${Math.max(0, Math.min(100, 100 - Math.round(p)))}%`;
}

function formatRowDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function ReportNarrativeSections({ report }) {
  const { explanation, findings } = resolveReportNarrative(report);
  const rows = metricsRows(report);

  return (
    <>
      <div className="rep-section">
        <h4 className="rep-section-title">What this result means</h4>
        <p className="rep-explanation">{explanation}</p>
      </div>
      <div className="rep-section">
        <h4 className="rep-section-title">Detection output</h4>
        <ul className="rep-findings">
          {findings.map((line, idx) => (
            <li key={idx}>{line}</li>
          ))}
        </ul>
      </div>
      {rows.length ? (
        <div className="rep-section">
          <h4 className="rep-section-title">Pipeline metrics</h4>
          <table className="rep-metrics-table" aria-label="Detection metrics">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <td>{row.label}</td>
                  <td className="rep-metric-val">{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}

function ReportsMainContent({ reports, initialFocusId, navigate, onBumpStorage }) {
  const [focusId, setFocusId] = useState(initialFocusId ?? null);
  const focused = useMemo(() => reports.find((report) => report.id === focusId) || null, [reports, focusId]);

  const onClearAll = () => {
    if (!window.confirm("Delete all stored reports on this device?")) return;
    clearReports();
    onBumpStorage();
    setFocusId(null);
  };

  return (
    <main className="ds-content">
      <section className="ds-card">
        <div className="ds-card-hd">
          <h2>Analysis reports</h2>
          <p>History from your browser. Open a report and download it as PDF.</p>
        </div>

        <div className="rep-toolbar">
          <button className="ds-btn" type="button" onClick={() => navigate("/dashboard")}>
            Back to Dashboard
          </button>
          <button className="ds-btn" type="button" onClick={onClearAll} disabled={reports.length === 0}>
            Clear all
          </button>
        </div>

        {focused ? (
          <div className="rep-detail">
            <h3>Report detail</h3>
            <div className="rep-kv">
              <span>File</span>
              <span>{focused.filename || "—"}</span>
              <span>When</span>
              <span>{formatRowDate(focused.createdAt)}</span>
              <span>Media</span>
              <span>{focused.mediaType}</span>
              <span>Verdict</span>
              <span>{focused.verdict}</span>
              <span>Status</span>
              <span>
                <span className={`ds-pill ${focused.status === "Fake" ? "fake" : "real"}`}>{focused.status}</span>
              </span>
              <span>Confidence</span>
              <span>{focused.confidence}%</span>
              <span>Fake probability</span>
              <span>{focused.fakeProbability ?? focused.probability}%</span>
              <span>Real probability</span>
              <span>{formatRealLikePercent(focused)}</span>
              <span>Face cues</span>
              <span>{focused.faceSwapDetected ? "Inconsistencies flagged" : "No strong cues"}</span>
              <span>Voice analysis</span>
              <span>
                {focused.mediaType !== "Video" || !focused.audioAnalyzed
                  ? "N/A"
                  : focused.syntheticVoice
                    ? "Synthetic"
                    : "Natural"}
              </span>
            </div>

            <ReportNarrativeSections report={focused} />

            {focused.disclaimer ? <div className="rep-muted">{focused.disclaimer}</div> : null}
            <div className="rep-actions">
              <button className="ds-btn rep-pdf-btn" type="button" onClick={() => downloadReportAsPdf(focused)}>
                Download PDF
              </button>
            </div>
          </div>
        ) : null}

        <div style={{ padding: "0 18px 18px" }} className="rep-wrap ds-table-wrap">
          <table className="ds-table" aria-label="Saved reports">
            <thead>
              <tr>
                <th>Date</th>
                <th>File</th>
                <th>Media</th>
                <th>Status</th>
                <th>Confidence</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: "14px 10px", fontWeight: 800, color: "rgba(15, 23, 42, 0.62)" }}>
                    No saved reports yet.
                  </td>
                </tr>
              ) : (
                reports.map((row) => (
                  <tr key={row.id}>
                    <td>{formatRowDate(row.createdAt)}</td>
                    <td style={{ maxWidth: 260, fontWeight: 800 }}>{row.filename}</td>
                    <td>{row.mediaType}</td>
                    <td>
                      <span className={`ds-pill ${row.status === "Fake" ? "fake" : "real"}`}>{row.status}</span>
                    </td>
                    <td>{row.confidence}%</td>
                    <td>
                      <button type="button" onClick={() => setFocusId(row.id)}>
                        Open &gt;
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
  );
}

function Reports() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = getAuthToken();
  const userEmail = decodeJwtEmail(token) || "User";
  const [storageRev, setStorageRev] = useState(0);

  const reports = useMemo(
    () => loadReports(),
    [location.key, storageRev],
  );

  return (
    <AppChrome navigate={navigate} currentPage="reports" userEmail={userEmail}>
      <ReportsMainContent
        key={`${location.key}-${String(location.state?.focusId ?? "")}`}
        reports={reports}
        initialFocusId={location.state?.focusId ?? null}
        navigate={navigate}
        onBumpStorage={() => setStorageRev((value) => value + 1)}
      />
    </AppChrome>
  );
}

export default Reports;
