from __future__ import annotations

import io
import os
import tempfile
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image, ImageOps

from backend.app.services.deepfake_detector import load_detectors_from_env
from backend.app.services.media_analyzer import VIDEO_EXTENSIONS, analyze_upload

try:
    import cv2  # type: ignore
except ImportError:  # pragma: no cover
    cv2 = None  # type: ignore


FAKE_THRESHOLD = float(os.getenv("DEEPFAKE_FAKE_THRESHOLD", "0.70"))
REAL_THRESHOLD = float(os.getenv("DEEPFAKE_REAL_THRESHOLD", "0.70"))
MAX_VIDEO_FRAMES = int(os.getenv("DEEPFAKE_MAX_VIDEO_FRAMES", "16"))

_DETECTORS: list[Any] | None = None


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


def _is_video(filename: str, declared_mime: str | None) -> bool:
    suffix = Path((filename or "").lower()).suffix
    mime = (declared_mime or "").lower()
    return suffix in VIDEO_EXTENSIONS or mime.startswith("video/")


def _load_ensemble_detectors() -> list[Any]:
    global _DETECTORS
    if _DETECTORS is None:
        _DETECTORS = load_detectors_from_env()
    return _DETECTORS


def _decode_image_bytes(content: bytes) -> np.ndarray:
    image = Image.open(io.BytesIO(content))
    image = ImageOps.exif_transpose(image).convert("RGB")
    return np.asarray(image, dtype=np.uint8)


def _extract_video_frames(content: bytes, filename: str) -> list[np.ndarray]:
    if cv2 is None:
        return []

    suffix = Path(filename or "upload.mp4").suffix.lower()
    if suffix not in VIDEO_EXTENSIONS:
        suffix = ".mp4"

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tmp_path = tmp.name
    try:
        tmp.write(content)
        tmp.close()

        cap = cv2.VideoCapture(tmp_path)
        if not cap.isOpened():
          return []

        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        if frame_count <= 0:
            frame_count = MAX_VIDEO_FRAMES

        sample_count = max(1, min(MAX_VIDEO_FRAMES, frame_count))
        indices = np.linspace(0, max(0, frame_count - 1), num=sample_count, dtype=int)

        frames: list[np.ndarray] = []
        for frame_index in indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES, int(frame_index))
            ok, bgr = cap.read()
            if not ok or bgr is None:
                continue
            rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
            frames.append(rgb)

        cap.release()
        return frames
    finally:
        try:
            Path(tmp_path).unlink(missing_ok=True)
        except OSError:
            pass


def _predict_with_ensemble_frames(frames: list[np.ndarray]) -> dict[str, Any]:
    detectors = _load_ensemble_detectors()
    if not detectors or not frames:
        return {
            "prediction": None,
            "per_model_predictions": [],
            "model_names": [],
        }

    per_model_predictions: list[dict[str, Any]] = []
    model_scores: list[float] = []
    model_names: list[str] = []

    for detector in detectors:
        frame_scores: list[float] = []
        for frame in frames:
            try:
                output = detector.predict_frame(frame)
            except Exception:
                continue
            frame_scores.append(_clamp01(float(output.fake_score)))

        if not frame_scores:
            continue

        average_score = float(np.mean(frame_scores))
        model_name = getattr(detector, "model_name", "detector")
        model_names.append(model_name)
        model_scores.append(average_score)
        per_model_predictions.append(
            {
                "model": model_name,
                "frames_used": len(frame_scores),
                "avg_fake_score": round(average_score, 4),
            }
        )

    if not model_scores:
        return {
            "prediction": None,
            "per_model_predictions": [],
            "model_names": [],
        }

    return {
        "prediction": float(np.mean(model_scores)),
        "per_model_predictions": per_model_predictions,
        "model_names": model_names,
    }


def _predict_with_ensemble(content: bytes, filename: str, declared_mime: str | None) -> dict[str, Any]:
    if _is_video(filename, declared_mime):
        frames = _extract_video_frames(content, filename)
    else:
        try:
            frames = [_decode_image_bytes(content)]
        except Exception:
            frames = []

    result = _predict_with_ensemble_frames(frames)
    result["frames_used"] = len(frames)
    return result


def _final_label(prediction_score: float) -> tuple[str, int, int, str]:
    fake_probability = int(round(_clamp01(prediction_score) * 100))
    real_probability = 100 - fake_probability

    if fake_probability >= int(round(FAKE_THRESHOLD * 100)):
        return "Fake", fake_probability, real_probability, "High"
    if real_probability >= int(round(REAL_THRESHOLD * 100)):
        return "Real", fake_probability, real_probability, "Low"
    return "Uncertain", fake_probability, real_probability, "Medium"


def predict_deepfake_probability(content: bytes, filename: str, declared_mime: str | None) -> dict[str, Any]:
    result = analyze_upload(content, filename, declared_mime)
    artifact_prediction = _clamp01(float(result.get("prediction_score", 0.5)))

    ensemble = _predict_with_ensemble(content, filename, declared_mime)
    ensemble_prediction = ensemble.get("prediction")

    model_info = result.setdefault("model", {})
    if ensemble_prediction is not None:
        prediction = _clamp01((0.75 * float(ensemble_prediction)) + (0.25 * artifact_prediction))
        model_info["active"] = "Ensemble + Artifact"
        model_info["ensemble_models"] = ensemble.get("model_names", [])
        model_info["per_model_predictions"] = ensemble.get("per_model_predictions", [])
    else:
        prediction = artifact_prediction
        model_info["active"] = "Artifact Detection Only"
        model_info["ensemble_models"] = []
        model_info["per_model_predictions"] = []

    label, fake_probability, real_probability, risk_level = _final_label(prediction)
    result["prediction_score"] = round(prediction, 4)
    result["fakeProbability"] = fake_probability
    result["realProbability"] = real_probability
    result["label"] = label
    result["riskLevel"] = risk_level
    result["confidence"] = max(fake_probability, real_probability) if label != "Uncertain" else 100 - abs(fake_probability - real_probability)
    result.setdefault("metrics", {})
    result["metrics"]["ensemble_frames_used"] = int(ensemble.get("frames_used", 0))
    result["metrics"]["ensemble_models_used"] = len(model_info["ensemble_models"])
    result["metrics"]["artifact_prediction"] = round(artifact_prediction, 4)
    if ensemble_prediction is not None:
        result["metrics"]["ensemble_prediction"] = round(float(ensemble_prediction), 4)

    return result
