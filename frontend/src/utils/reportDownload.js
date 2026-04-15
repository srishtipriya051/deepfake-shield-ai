function safeFilename(name) {
  let out = "";
  for (const ch of String(name || "report")) {
    const c = ch.codePointAt(0);
    if (c !== undefined && c < 32) {
      out += "_";
      continue;
    }
    if (/[<>:"/\\|?*]/.test(ch)) {
      out += "_";
      continue;
    }
    out += ch;
  }
  return out.replace(/\s+/g, " ").trim().slice(0, 120);
}

function formatMetricLabel(key) {
  return String(key)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatMetricValue(val) {
  if (val === null || val === undefined) return "—";
  if (typeof val === "number" && Number.isFinite(val)) {
    return Number.isInteger(val) ? String(val) : val.toFixed(6).replace(/\.?0+$/, "");
  }
  if (typeof val === "boolean") return val ? "Yes" : "No";
  return String(val);
}

function resolveFakeProbability(report) {
  return report.fakeProbability ?? report.probability ?? null;
}

function resolveRealProbability(report) {
  if (report.realProbability != null && Number.isFinite(Number(report.realProbability))) {
    return Math.round(Number(report.realProbability));
  }
  if (report.realLikePercent != null && Number.isFinite(Number(report.realLikePercent))) {
    return Math.round(Number(report.realLikePercent));
  }
  if (Number.isFinite(Number(report.probability))) {
    return Math.max(0, Math.min(100, 100 - Math.round(Number(report.probability))));
  }
  return null;
}

/** Merge stored API fields with fallbacks for older localStorage entries. */
export function resolveReportNarrative(report) {
  const explanation =
    typeof report.explanation === "string" && report.explanation.trim()
      ? report.explanation.trim()
      : [
          "This entry was saved before detailed narratives were added, or the analysis response did not include one.",
          `Stored verdict: ${report.verdict || "—"}. Fake probability: ${resolveFakeProbability(report) ?? "—"}%.`,
          report.disclaimer || "",
        ]
          .filter(Boolean)
          .join(" ");

  let findings = Array.isArray(report.findings) ? report.findings.filter((x) => typeof x === "string" && x.trim()) : [];
  if (!findings.length) {
    findings = [
      `Verdict: ${report.verdict || "—"}`,
      `Fake probability (stored): ${resolveFakeProbability(report) ?? "—"}%`,
      `Real probability (stored): ${resolveRealProbability(report) ?? "—"}%`,
      `Face cue (stored): ${report.faceSwapDetected ? "Flagged" : "Not flagged"}`,
      report.mediaType === "Video" && report.audioAnalyzed
        ? `Voice analysis (stored): ${report.syntheticVoice ? "Synthetic" : "Natural"}`
        : "Voice: N/A (not analyzed)",
    ];
  }

  return { explanation, findings };
}

export function metricsRows(report) {
  const m = report.metrics;
  if (!m || typeof m !== "object") return [];
  return Object.entries(m).map(([key, val]) => ({
    key,
    label: formatMetricLabel(key),
    value: formatMetricValue(val),
  }));
}

function buildTextBody(report) {
  const { explanation, findings } = resolveReportNarrative(report);
  const rows = metricsRows(report);
  const lines = [];
  lines.push("Deepfake Shield AI — Analysis Report");
  lines.push("=".repeat(40));
  lines.push(`Report ID: ${report.id || "—"}`);
  lines.push(`Generated: ${report.createdAt || "—"}`);
  lines.push(`File name: ${report.filename || "—"}`);
  lines.push(`Media type: ${report.mediaType || "—"}`);
  lines.push(`Summary status: ${report.status || "—"}`);
  lines.push(
    `Fake vs real probability: ${resolveFakeProbability(report) ?? "—"}% fake · ${resolveRealProbability(report) ?? "—"}% real`,
  );
  lines.push(`Confidence (stored): ${report.confidence ?? "—"}%`);
  lines.push("");
  lines.push("EXPLANATION");
  lines.push("-".repeat(40));
  lines.push(explanation);
  lines.push("");
  lines.push("DETECTION OUTPUT / FINDINGS");
  lines.push("-".repeat(40));
  findings.forEach((f, i) => lines.push(`${i + 1}. ${f}`));
  lines.push("");
  lines.push("METRICS (raw pipeline output)");
  lines.push("-".repeat(40));
  if (!rows.length) {
    lines.push("(No metrics stored for this report.)");
  } else {
    rows.forEach((r) => lines.push(`${r.label}: ${r.value}`));
  }
  if (report.disclaimer) {
    lines.push("");
    lines.push("DISCLAIMER");
    lines.push("-".repeat(40));
    lines.push(report.disclaimer);
  }
  lines.push("");
  lines.push("— End of report —");
  return lines.join("\n");
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function sanitizePdfText(value) {
  return String(value ?? "")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function buildPdfContentLines(report) {
  const { explanation, findings } = resolveReportNarrative(report);
  const rows = metricsRows(report);
  const lines = [
    "Deepfake Shield AI Report",
    "",
    `Report ID: ${report.id || "-"}`,
    `Generated: ${report.createdAt || "-"}`,
    `File name: ${report.filename || "-"}`,
    `Media type: ${report.mediaType || "-"}`,
    `Status: ${report.status || "-"}`,
    `Verdict: ${report.verdict || "-"}`,
    `Confidence: ${report.confidence ?? "-"}%`,
    `Fake probability: ${resolveFakeProbability(report) ?? "-"}%`,
    `Real probability: ${resolveRealProbability(report) ?? "-"}%`,
    "",
    "Summary",
    explanation,
    "",
    "Detection Output",
    ...findings.map((line, index) => `${index + 1}. ${line}`),
    "",
    "Pipeline Metrics",
    ...(rows.length ? rows.map((row) => `${row.label}: ${row.value}`) : ["No metrics stored for this report."]),
  ];

  if (report.disclaimer) {
    lines.push("", "Disclaimer", report.disclaimer);
  }

  return lines;
}

function createPdfBlob(lines) {
  const pageWidth = 595;
  const pageHeight = 842;
  const left = 48;
  const top = 790;
  const lineHeight = 16;
  const fontSize = 11;
  const pageUsableLines = 44;

  const pages = [];
  for (let index = 0; index < lines.length; index += pageUsableLines) {
    const chunk = lines.slice(index, index + pageUsableLines);
    const textOps = [
      "BT",
      `/F1 ${fontSize} Tf`,
      `${left} ${top} Td`,
      `${lineHeight} TL`,
      ...chunk.map((line, lineIndex) => `${lineIndex === 0 ? "" : "T* " }(${sanitizePdfText(line)}) Tj`.trim()),
      "ET",
    ];
    pages.push(textOps.join("\n"));
  }

  const objects = [];
  const addObject = (body) => {
    objects.push(body);
    return objects.length;
  };

  const catalogId = addObject("<< /Type /Catalog /Pages 2 0 R >>");
  const pagesId = addObject("<< /Type /Pages /Kids [] /Count 0 >>");
  const fontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const pageIds = [];

  pages.forEach((content) => {
    const contentStream = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
    const contentId = addObject(contentStream);
    const pageId = addObject(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    pageIds.push(pageId);
  });

  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
}

export function downloadReportAsText(report) {
  const body = buildTextBody(report);
  const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
  const base = safeFilename(report.filename || "analysis");
  triggerDownload(blob, `deepfake-shield-report_${base.replace(/\.[^.]+$/, "")}.txt`);
}

export function downloadReportAsJson(report) {
  const { explanation, findings } = resolveReportNarrative(report);
  const payload = {
    app: "Deepfake Shield AI",
    reportId: report.id,
    createdAt: report.createdAt,
    filename: report.filename,
    mediaType: report.mediaType,
    status: report.status,
    confidence: report.confidence,
    verdict: report.verdict,
    label: report.label || report.status,
    fakeProbability: resolveFakeProbability(report),
    realProbability: resolveRealProbability(report),
    faceSwapDetected: report.faceSwapDetected,
    syntheticVoice: report.syntheticVoice,
    audioAnalyzed: Boolean(report.audioAnalyzed),
    disclaimer: report.disclaimer,
    metrics: report.metrics ?? null,
    explanation,
    findings,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const base = safeFilename(report.filename || "analysis");
  triggerDownload(blob, `deepfake-shield-report_${base.replace(/\.[^.]+$/, "")}.json`);
}

export function downloadReportAsPdf(report) {
  const base = safeFilename(report.filename || "analysis").replace(/\.[^.]+$/, "");
  const lines = buildPdfContentLines(report);
  const blob = createPdfBlob(lines);
  triggerDownload(blob, `deepfake-shield-report_${base}.pdf`);
}
