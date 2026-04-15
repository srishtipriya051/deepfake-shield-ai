from pathlib import Path
from typing import Any, Dict

from backend.app.services.media_analyzer import build_report_narrative
from backend.app.utils.deepfake_model import predict_deepfake_probability


def _pipeline_flow(is_video: bool) -> list[str]:
    return [
        "Frontend (React)",
        "Backend API",
        "Face Detection (MTCNN)",
        "Frame Extraction" if is_video else "Frame Extraction (not required for image)",
        "Deepfake Model (XceptionNet / EfficientNet)",
        "Artifact Analysis",
        "Probability Calculation",
        "Dashboard Result",
    ]


def analyze_uploaded_media(content: bytes, filename: str, declared_mime: str | None) -> Dict[str, Any]:
    try:
        model_result = predict_deepfake_probability(content, filename, declared_mime)
    except Exception as e:
        raise RuntimeError(f"Deepfake detection failed: {str(e)}")

    prediction_score = float(model_result.get("prediction_score", 0.5))
    prediction_score = max(0.0, min(1.0, prediction_score))
    fake_probability = int(model_result.get("fakeProbability", int(prediction_score * 100)))
    fake_probability = max(0, min(100, fake_probability))
    real_probability = int(model_result.get("realProbability", 100 - fake_probability))
    real_probability = max(0, min(100, real_probability))
    label = str(model_result.get("label", "Uncertain"))
    risk_level = str(model_result.get("riskLevel", "Medium"))
    verdict = str(
        model_result.get(
            "verdict",
            "Deepfake Detected" if label == "Fake" else "Likely Real" if label == "Real" else "Analysis Inconclusive",
        )
    )

    suffix = Path((filename or "").lower()).suffix
    mime = (declared_mime or "").lower()
    is_video = suffix in {".mp4", ".mov", ".webm", ".avi", ".mkv", ".m4v"} or mime.startswith("video/")

    result: Dict[str, Any] = {
        **model_result,
        "filename": model_result.get("filename", filename),
        "label": label,
        "verdict": verdict,
        "riskLevel": risk_level,
        "fakeProbability": fake_probability,
        "realProbability": real_probability,
        "confidence": int(model_result.get("confidence", max(fake_probability, real_probability))),
        "prediction_score": prediction_score,
        "pipeline_flow": model_result.get("pipeline_flow", _pipeline_flow(is_video)),
        "disclaimer": model_result.get("disclaimer", "AI deepfake detection gives probability results and may not always be 100% accurate."),
    }

    try:
        narrative = build_report_narrative(result)
        result["explanation"] = narrative.get("explanation", "")
        result["findings"] = narrative.get("findings", [])
    except Exception:
        result["explanation"] = ""
        result["findings"] = []

    return result
