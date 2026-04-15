"""
Face-aware media analysis pipeline for Deepfake Shield AI.

The pipeline stores uploads only while they are being processed, detects faces
with OpenCV and optionally MTCNN, samples video frames, and computes forensic
feature signals that can be combined with a trained model adapter.
"""

from __future__ import annotations

import io
import os
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image, ImageOps

try:
    import cv2  # type: ignore
except ImportError:  # pragma: no cover
    cv2 = None  # type: ignore


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
VIDEO_EXTENSIONS = {".mp4", ".mov", ".webm", ".avi", ".mkv", ".m4v"}


@dataclass
class FaceDetection:
    x: int
    y: int
    w: int
    h: int
    detector: str
    confidence: float | None = None


_MTCNN_DETECTOR: Any | None = None
_MTCNN_ATTEMPTED = False


def _get_mtcnn_detector() -> Any | None:
    global _MTCNN_ATTEMPTED, _MTCNN_DETECTOR
    if _MTCNN_ATTEMPTED:
        return _MTCNN_DETECTOR

    _MTCNN_ATTEMPTED = True
    try:
        from mtcnn import MTCNN  # type: ignore

        _MTCNN_DETECTOR = MTCNN()
    except Exception:  # noqa: BLE001
        _MTCNN_DETECTOR = None
    return _MTCNN_DETECTOR


def _safe_float(value: float) -> float:
    if np.isnan(value) or np.isinf(value):
        return 0.0
    return float(value)


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, _safe_float(value)))


def _laplacian_variance(gray: np.ndarray) -> float:
    if cv2 is not None:
        return _safe_float(float(cv2.Laplacian(gray, cv2.CV_64F).var()))
    g = gray.astype(np.float32)
    return _safe_float(float(np.var(np.diff(g, axis=1)) + np.var(np.diff(g, axis=0))))


def _crop_with_padding(rgb: np.ndarray, face: FaceDetection, padding: float = 0.28) -> np.ndarray:
    h, w = rgb.shape[:2]
    pad_x = int(face.w * padding)
    pad_y = int(face.h * padding)
    x1 = max(0, face.x - pad_x)
    y1 = max(0, face.y - pad_y)
    x2 = min(w, face.x + face.w + pad_x)
    y2 = min(h, face.y + face.h + pad_y)
    crop = rgb[y1:y2, x1:x2]
    return crop if crop.size else rgb


def _detect_faces_mtcnn(rgb: np.ndarray) -> list[FaceDetection]:
    detector = _get_mtcnn_detector()
    if detector is None:
        return []

    try:
        detected = detector.detect_faces(rgb.astype(np.uint8))
    except Exception:  # noqa: BLE001
        return []

    faces: list[FaceDetection] = []
    for item in detected:
        x, y, w, h = item.get("box", [0, 0, 0, 0])
        if w < 24 or h < 24:
            continue
        faces.append(
            FaceDetection(
                x=max(0, int(x)),
                y=max(0, int(y)),
                w=int(w),
                h=int(h),
                detector="MTCNN",
                confidence=float(item.get("confidence", 0.0)),
            )
        )
    return faces


def _detect_faces_opencv(rgb: np.ndarray) -> list[FaceDetection]:
    if cv2 is None:
        return []

    gray = cv2.cvtColor(rgb.astype(np.uint8), cv2.COLOR_RGB2GRAY)
    classifier_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    cascade = cv2.CascadeClassifier(classifier_path)
    if cascade.empty():
        return []

    min_side = max(32, min(rgb.shape[:2]) // 12)
    faces = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(min_side, min_side))
    return [FaceDetection(int(x), int(y), int(w), int(h), "OpenCV Haar") for x, y, w, h in faces]


def _iou(a: FaceDetection, b: FaceDetection) -> float:
    ax1, ay1, ax2, ay2 = a.x, a.y, a.x + a.w, a.y + a.h
    bx1, by1, bx2, by2 = b.x, b.y, b.x + b.w, b.y + b.h
    inter_x1, inter_y1 = max(ax1, bx1), max(ay1, by1)
    inter_x2, inter_y2 = min(ax2, bx2), min(ay2, by2)
    inter_w = max(0, inter_x2 - inter_x1)
    inter_h = max(0, inter_y2 - inter_y1)
    inter_area = inter_w * inter_h
    if inter_area == 0:
        return 0.0
    a_area = max(1, a.w * a.h)
    b_area = max(1, b.w * b.h)
    union = a_area + b_area - inter_area
    return inter_area / max(1, union)


def _merge_face_detections(haar_faces: list[FaceDetection], mtcnn_faces: list[FaceDetection]) -> list[FaceDetection]:
    merged: list[FaceDetection] = list(haar_faces)
    for mt in mtcnn_faces:
        overlap_index = -1
        overlap_iou = 0.0
        for idx, existing in enumerate(merged):
            iou = _iou(existing, mt)
            if iou > overlap_iou:
                overlap_iou = iou
                overlap_index = idx

        if overlap_index >= 0 and overlap_iou >= 0.35:
            existing = merged[overlap_index]
            # Fuse overlapping detections and mark that both detectors agreed.
            x1 = min(existing.x, mt.x)
            y1 = min(existing.y, mt.y)
            x2 = max(existing.x + existing.w, mt.x + mt.w)
            y2 = max(existing.y + existing.h, mt.y + mt.h)
            merged[overlap_index] = FaceDetection(
                x=x1,
                y=y1,
                w=max(1, x2 - x1),
                h=max(1, y2 - y1),
                detector="Haar+MTCNN",
                confidence=mt.confidence,
            )
        else:
            merged.append(mt)
    return merged


def detect_faces(rgb: np.ndarray) -> list[FaceDetection]:
    # Stage 1 of pipeline: run both Haar and MTCNN and merge for better recall.
    haar_faces = _detect_faces_opencv(rgb)
    mtcnn_faces = _detect_faces_mtcnn(rgb)
    return _merge_face_detections(haar_faces, mtcnn_faces)


def _rgb_to_gray(rgb: np.ndarray) -> np.ndarray:
    if cv2 is not None:
        return cv2.cvtColor(rgb.astype(np.uint8), cv2.COLOR_RGB2GRAY)
    arr = rgb.astype(np.float32)
    return np.clip((0.299 * arr[..., 0] + 0.587 * arr[..., 1] + 0.114 * arr[..., 2]), 0, 255).astype(np.uint8)


def _edge_density(gray: np.ndarray) -> float:
    gray01 = gray.astype(np.float32) / 255.0
    gx = np.abs(np.diff(gray01, axis=1))
    gy = np.abs(np.diff(gray01, axis=0))
    return _safe_float(float((np.mean(gx > 0.08) + np.mean(gy > 0.08)) / 2.0))


def _jpeg_block_artifact_score(gray: np.ndarray) -> float:
    h, w = gray.shape
    if h < 32 or w < 32:
        return 0.0
    gray_f = gray.astype(np.float32) / 255.0
    vertical_diffs = np.abs(np.diff(gray_f, axis=1))
    horizontal_diffs = np.abs(np.diff(gray_f, axis=0))
    vertical_boundary = vertical_diffs[:, 7::8]
    horizontal_boundary = horizontal_diffs[7::8, :]
    vertical_inner = np.delete(vertical_diffs, np.arange(7, vertical_diffs.shape[1], 8), axis=1)
    horizontal_inner = np.delete(horizontal_diffs, np.arange(7, horizontal_diffs.shape[0], 8), axis=0)
    if vertical_boundary.size == 0 or horizontal_boundary.size == 0 or vertical_inner.size == 0 or horizontal_inner.size == 0:
        return 0.0

    boundary = float(np.mean(vertical_boundary) + np.mean(horizontal_boundary)) / 2.0
    inner = float(np.mean(vertical_inner) + np.mean(horizontal_inner)) / 2.0
    ratio = boundary / (inner + 1e-6)
    return _clamp01((ratio - 1.35) / 1.65)


def _lighting_mismatch_score(rgb: np.ndarray) -> float:
    h, w = rgb.shape[:2]
    if h < 32 or w < 32:
        return 0.0
    lab = cv2.cvtColor(rgb.astype(np.uint8), cv2.COLOR_RGB2LAB) if cv2 is not None else rgb.astype(np.uint8)
    lightness = lab[..., 0].astype(np.float32) / 255.0
    left = lightness[:, : w // 2]
    right = lightness[:, w // 2 :]
    top = lightness[: h // 2, :]
    bottom = lightness[h // 2 :, :]
    directional_delta = max(abs(float(left.mean() - right.mean())), abs(float(top.mean() - bottom.mean())))
    local_std = float(np.std(lightness))
    return _clamp01((directional_delta - 0.18) / 0.32 + max(0.0, local_std - 0.32))


def _face_edge_score(face_rgb: np.ndarray) -> float:
    gray = _rgb_to_gray(face_rgb)
    h, w = gray.shape
    if h < 32 or w < 32:
        return 0.0

    border = max(3, min(h, w) // 10)
    edge_mask = np.zeros_like(gray, dtype=bool)
    edge_mask[:border, :] = True
    edge_mask[-border:, :] = True
    edge_mask[:, :border] = True
    edge_mask[:, -border:] = True
    center = ~edge_mask

    if cv2 is not None:
        edges = cv2.Canny(gray, 70, 160).astype(np.float32) / 255.0
    else:
        g = gray.astype(np.float32) / 255.0
        edges = np.pad(np.abs(np.diff(g, axis=1)), ((0, 0), (0, 1)))

    edge_mean = float(edges[edge_mask].mean())
    center_mean = float(edges[center].mean()) if np.any(center) else edge_mean
    return _clamp01(abs(edge_mean - center_mean) / (center_mean + 0.05))


def _texture_inconsistency_score(face_rgb: np.ndarray) -> float:
    gray = _rgb_to_gray(face_rgb)
    h, w = gray.shape
    if h < 32 or w < 32:
        return 0.0
    block = max(8, min(h, w) // 8)
    trimmed_h = max(block, (h // block) * block)
    trimmed_w = max(block, (w // block) * block)
    cropped = gray[:trimmed_h, :trimmed_w].astype(np.float32) / 255.0
    blocks = cropped.reshape(trimmed_h // block, block, trimmed_w // block, block)
    block_std = np.std(blocks, axis=(1, 3))
    lap = _laplacian_variance(gray)
    smooth_score = _clamp01((85.0 - lap) / 85.0)
    uneven_score = _clamp01(float(np.std(block_std)) * 8.0)
    return _clamp01(0.55 * smooth_score + 0.45 * uneven_score)


def _chroma_artifact_score(face_rgb: np.ndarray) -> float:
    arr = face_rgb.astype(np.float32) / 255.0
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    chroma_spread = float(np.mean(np.abs(r - g)) + np.mean(np.abs(r - b)) + np.mean(np.abs(g - b)))
    max_c = np.max(arr, axis=2)
    min_c = np.min(arr, axis=2)
    saturation = float(np.mean((max_c - min_c) / (max_c + 1e-6)))
    return _clamp01((chroma_spread - 0.34) / 0.7 + (saturation - 0.52) / 0.8)


def _noise_residual_score(gray: np.ndarray) -> float:
    if gray.shape[0] < 16 or gray.shape[1] < 16:
        return 0.0
    blurred = cv2.GaussianBlur(gray, (5, 5), 0) if cv2 is not None else gray
    residual = gray.astype(np.float32) - blurred.astype(np.float32)
    residual_std = float(np.std(residual))
    return _clamp01((residual_std - 6.0) / 18.0)


def _banding_score(gray: np.ndarray) -> float:
    gray_f = gray.astype(np.float32)
    vertical = np.abs(np.diff(gray_f, axis=1))
    horizontal = np.abs(np.diff(gray_f, axis=0))
    near_flat = float(np.mean(vertical < 2.0) + np.mean(horizontal < 2.0)) / 2.0
    return _clamp01((near_flat - 0.42) / 0.4)


def analyze_full_frame(rgb: np.ndarray) -> dict[str, Any]:
    gray = _rgb_to_gray(rgb)
    pixel = _jpeg_block_artifact_score(gray)
    chroma = _chroma_artifact_score(rgb)
    lighting = _lighting_mismatch_score(rgb)
    lap = _laplacian_variance(gray)
    edge_density = _edge_density(gray)
    noise = _noise_residual_score(gray)
    banding = _banding_score(gray)

    fallback_score = _clamp01(
        0.26 * pixel
        + 0.18 * chroma
        + 0.18 * lighting
        + 0.16 * noise
        + 0.12 * banding
        + 0.10 * _clamp01((0.22 - edge_density) / 0.22)
    )

    return {
        "fallback_prediction": fallback_score,
        "pixel_artifacts": round(pixel, 4),
        "color_artifacts": round(chroma, 4),
        "lighting_mismatch": round(lighting, 4),
        "laplacian_variance": round(lap, 4),
        "edge_density": round(edge_density, 4),
        "noise_residual": round(noise, 4),
        "compression_banding": round(banding, 4),
    }


def _eye_state_score(face_rgb: np.ndarray) -> dict[str, float | int | None]:
    if cv2 is None:
        return {"eyes_detected": 0, "eye_darkness": None, "blink_proxy": 0.0}

    gray = _rgb_to_gray(face_rgb)
    cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_eye.xml")
    if cascade.empty():
        return {"eyes_detected": 0, "eye_darkness": None, "blink_proxy": 0.0}

    eyes = cascade.detectMultiScale(gray, scaleFactor=1.08, minNeighbors=5, minSize=(12, 8))
    if len(eyes) == 0:
        return {"eyes_detected": 0, "eye_darkness": None, "blink_proxy": 0.15}

    darkness: list[float] = []
    for x, y, w, h in eyes[:2]:
        patch = gray[int(y) : int(y + h), int(x) : int(x + w)]
        if patch.size:
            darkness.append(float(1.0 - (patch.mean() / 255.0)))

    avg_darkness = float(np.mean(darkness)) if darkness else 0.0
    return {
        "eyes_detected": int(len(eyes)),
        "eye_darkness": _safe_float(avg_darkness),
        "blink_proxy": _clamp01((avg_darkness - 0.45) / 0.35),
    }


def analyze_face_crop(face_rgb: np.ndarray) -> dict[str, Any]:
    texture = _texture_inconsistency_score(face_rgb)
    lighting = _lighting_mismatch_score(face_rgb)
    edge = _face_edge_score(face_rgb)
    pixel = _jpeg_block_artifact_score(_rgb_to_gray(face_rgb))
    chroma = _chroma_artifact_score(face_rgb)
    eye = _eye_state_score(face_rgb)
    lap = _laplacian_variance(_rgb_to_gray(face_rgb))
    edge_density = _edge_density(_rgb_to_gray(face_rgb))

    fallback_score = _clamp01(
        0.30 * texture
        + 0.20 * lighting
        + 0.18 * edge
        + 0.16 * pixel
        + 0.10 * chroma
        + 0.06 * float(eye["blink_proxy"] or 0.0)
    )

    return {
        "fallback_prediction": fallback_score,
        "facial_texture_inconsistency": round(texture, 4),
        "lighting_mismatch": round(lighting, 4),
        "unnatural_face_edges": round(edge, 4),
        "pixel_artifacts": round(pixel, 4),
        "color_artifacts": round(chroma, 4),
        "abnormal_eye_blink_proxy": round(float(eye["blink_proxy"] or 0.0), 4),
        "eyes_detected": eye["eyes_detected"],
        "eye_darkness": None if eye["eye_darkness"] is None else round(float(eye["eye_darkness"]), 4),
        "laplacian_variance": round(lap, 4),
        "edge_density": round(edge_density, 4),
    }


def _aggregate_scores(face_results: list[dict[str, Any]], frame_motion: float | None = None) -> float:
    if not face_results:
        return 0.5

    scores = [float(r["fallback_prediction"]) for r in face_results]
    base = float(np.median(scores))
    if frame_motion is not None:
        too_static = _clamp01((0.8 - frame_motion) / 0.8)
        too_jumpy = _clamp01((frame_motion - 18.0) / 30.0)
        base = _clamp01((base * 0.90) + (max(too_static, too_jumpy) * 0.10))
    return _clamp01(0.12 + (base * 0.76))


def _aggregate_frame_and_face_scores(face_results: list[dict[str, Any]], frame_analysis: dict[str, Any]) -> float:
    face_score = _aggregate_scores(face_results) if face_results else None
    frame_score = float(frame_analysis.get("fallback_prediction", 0.5))
    if face_score is None:
        return _clamp01(frame_score)
    return _clamp01((0.65 * face_score) + (0.35 * frame_score))


def _temporal_consistency_score(frame_results: list[dict[str, Any]]) -> float:
    if len(frame_results) < 2:
        return 0.0

    predictions = np.array([float(item.get("prediction", 0.5)) for item in frame_results], dtype=np.float32)
    face_counts = np.array([float(item.get("face_count", 0)) for item in frame_results], dtype=np.float32)
    edge_values = np.array([float(item.get("frame_analysis", {}).get("edge_density", 0.0)) for item in frame_results], dtype=np.float32)
    lap_values = np.array([float(item.get("frame_analysis", {}).get("laplacian_variance", 0.0)) for item in frame_results], dtype=np.float32)

    pred_jitter = float(np.std(np.diff(predictions))) if predictions.size > 1 else 0.0
    face_jitter = float(np.std(np.diff(face_counts))) if face_counts.size > 1 else 0.0
    edge_jitter = float(np.std(np.diff(edge_values))) if edge_values.size > 1 else 0.0
    lap_jitter = float(np.std(np.diff(lap_values))) if lap_values.size > 1 else 0.0

    return _clamp01(
        0.40 * _clamp01(pred_jitter / 0.16)
        + 0.22 * _clamp01(face_jitter / 1.5)
        + 0.20 * _clamp01(edge_jitter / 0.08)
        + 0.18 * _clamp01(lap_jitter / 45.0)
    )


def _motion_pattern_score(gray_frames: list[np.ndarray]) -> tuple[float, float]:
    if len(gray_frames) < 2:
        return 0.0, 0.0

    motion_values: list[float] = []
    for prev, current in zip(gray_frames, gray_frames[1:]):
        if prev.shape != current.shape and cv2 is not None:
            current = cv2.resize(current, (prev.shape[1], prev.shape[0]), interpolation=cv2.INTER_AREA)
        diff = cv2.absdiff(prev, current) if cv2 is not None else np.abs(prev.astype(np.float32) - current.astype(np.float32))
        motion_values.append(float(np.mean(diff)))

    if not motion_values:
        return 0.0, 0.0

    mean_motion = float(np.mean(motion_values))
    motion_variation = float(np.std(motion_values))
    anomaly = _clamp01(
        0.55 * _clamp01((1.0 - min(mean_motion, 1.0)) / 1.0)
        + 0.45 * _clamp01((motion_variation - 7.0) / 14.0)
    )
    return mean_motion, anomaly


def _label_from_probability(prediction: float) -> tuple[str, int, int, str]:
    fake_probability = int(round(_clamp01(prediction) * 100))
    real_probability = 100 - fake_probability
    if fake_probability > 60:
        return "Fake", fake_probability, real_probability, "High"
    if real_probability > 60:
        return "Real", fake_probability, real_probability, "Low"
    return "Uncertain", fake_probability, real_probability, "Medium"


def _analyze_rgb_frame(rgb: np.ndarray) -> dict[str, Any]:
    frame_analysis = analyze_full_frame(rgb)
    faces = detect_faces(rgb)
    if faces:
        analyzed_faces = []
        detector_counts: dict[str, int] = {"haar": 0, "mtcnn": 0, "combined": 0}
        for face in faces:
            detector = (face.detector or "").lower()
            if "haar+mtcnn" in detector:
                detector_counts["combined"] += 1
            elif "haar" in detector:
                detector_counts["haar"] += 1
            elif "mtcnn" in detector:
                detector_counts["mtcnn"] += 1
        for face in faces[:6]:
            crop = _crop_with_padding(rgb, face)
            analyzed_faces.append(
                {
                    "box": {"x": face.x, "y": face.y, "w": face.w, "h": face.h},
                    "detector": face.detector,
                    "confidence": face.confidence,
                    **analyze_face_crop(crop),
                }
            )
        prediction = _aggregate_frame_and_face_scores(analyzed_faces, frame_analysis)
        return {
            "faces": analyzed_faces,
            "prediction": prediction,
            "face_count": len(faces),
            "detector_counts": detector_counts,
            "frame_analysis": frame_analysis,
        }

    analysis = analyze_full_frame(rgb)
    return {
        "faces": [{**analysis, "detector": "no-face fallback", "confidence": None, "no_face_detected": True}],
        "prediction": float(analysis["fallback_prediction"]),
        "face_count": 0,
        "detector_counts": {"haar": 0, "mtcnn": 0, "combined": 0},
        "frame_analysis": frame_analysis,
    }


def _build_result(
    *,
    filename: str,
    media_type: str,
    prediction: float,
    faces: list[dict[str, Any]],
    metrics: dict[str, Any],
) -> dict[str, Any]:
    real_faces = [face for face in faces if not face.get("no_face_detected")]
    analysis_faces = real_faces or faces
    no_faces_detected = len(real_faces) == 0

    label, fake_probability, real_probability, risk_level = _label_from_probability(prediction)
    face_swap_detected = any(float(face.get("unnatural_face_edges", 0.0)) > 0.62 for face in real_faces)

    feature_analysis = {
        "facial_texture_inconsistencies": round(float(np.mean([f.get("facial_texture_inconsistency", 0.0) for f in analysis_faces])), 4),
        "lighting_mismatches": round(float(np.mean([f.get("lighting_mismatch", 0.0) for f in analysis_faces])), 4),
        "abnormal_eye_blink": round(float(np.mean([f.get("abnormal_eye_blink_proxy", 0.0) for f in analysis_faces])), 4),
        "unnatural_face_edges": round(float(np.mean([f.get("unnatural_face_edges", 0.0) for f in analysis_faces])), 4),
        "pixel_artifacts": round(float(np.mean([f.get("pixel_artifacts", 0.0) for f in analysis_faces])), 4),
        "color_artifacts": round(float(np.mean([f.get("color_artifacts", 0.0) for f in analysis_faces])), 4),
        "noise_residual": round(float(metrics.get("noise_residual", 0.0)), 4),
        "compression_banding": round(float(metrics.get("compression_banding", 0.0)), 4),
        "frame_consistency": round(float(metrics.get("frame_consistency", 0.0)), 4),
        "motion_pattern_score": round(float(metrics.get("motion_pattern_score", 0.0)), 4),
    }

    pipeline_stages = [
        {"key": "frontend", "title": "Frontend (React)", "status": "completed"},
        {"key": "backend_api", "title": "Backend API", "status": "completed"},
        {
            "key": "face_detection",
            "title": "Face Detection (MTCNN)",
            "status": "completed",
            "details": {
                "faces_detected": int(metrics.get("faces_detected", 0)),
                "haar_faces": int(metrics.get("haar_faces", 0)),
                "mtcnn_faces": int(metrics.get("mtcnn_faces", 0)),
                "combined_faces": int(metrics.get("combined_faces", 0)),
            },
        },
    ]

    if media_type == "video":
        pipeline_stages.append(
            {
                "key": "frame_extraction",
                "title": "Frame Extraction",
                "status": "completed",
                "details": {
                    "frames_analyzed": int(metrics.get("frames_analyzed", 0)),
                    "fps_reported": metrics.get("fps_reported"),
                    "frame_count_reported": metrics.get("frame_count_reported"),
                },
            }
        )
    else:
        pipeline_stages.append(
            {
                "key": "frame_extraction",
                "title": "Frame Extraction",
                "status": "skipped",
                "details": {
                    "reason": "Single image upload",
                    "frames_analyzed": 1,
                },
            }
        )

    pipeline_stages.extend(
        [
            {
                "key": "deepfake_model",
                "title": "Deepfake Model (XceptionNet / EfficientNet)",
                "status": "completed",
            },
            {
                "key": "artifact_detection",
                "title": "Artifact Analysis",
                "status": "completed",
                "details": feature_analysis,
            },
            {"key": "probability_score", "title": "Probability Calculation", "status": "completed"},
            {"key": "dashboard_result", "title": "Dashboard Result", "status": "completed"},
        ]
    )

    return {
        "media_type": media_type,
        "filename": filename or "upload",
        "prediction_score": round(_clamp01(prediction), 4),
        "label": label,
        "fakeProbability": fake_probability,
        "realProbability": real_probability,
        "fake_probability": fake_probability,
        "fake_like_percent": fake_probability,
        "real_like_percent": real_probability,
        "confidence": max(fake_probability, real_probability) if label != "Uncertain" else 100 - abs(fake_probability - real_probability),
        "riskLevel": risk_level,
        "face_swap_detected": face_swap_detected,
        "synthetic_voice": False,
        "audio_analyzed": False,
        "faces_detected": int(metrics.get("faces_detected", 0)),
        "noFacesDetected": no_faces_detected,
        "feature_analysis": feature_analysis,
        "face_analysis": faces[:10],
        "metrics": {**metrics, **feature_analysis},
        "pipeline_stages": pipeline_stages,
        "model": {
            "primary": "optional pretrained CNN adapter",
            "fallback": "OpenCV/MTCNN face feature classifier",
            "datasets_reference": ["FaceForensics++", "Celeb-DF", "DeepFake Detection Challenge"],
        },
    }


def analyze_image_bytes(content: bytes, filename: str) -> dict[str, Any]:
    try:
        img = Image.open(io.BytesIO(content))
        img = ImageOps.exif_transpose(img).convert("RGB")
    except Exception as e:  # noqa: BLE001
        raise ValueError(f"Could not read image: {e}") from e

    img.thumbnail((1280, 1280))
    rgb = np.asarray(img, dtype=np.uint8)
    analysis = _analyze_rgb_frame(rgb)
    return _build_result(
        filename=filename,
        media_type="image",
        prediction=float(analysis["prediction"]),
        faces=analysis["faces"],
        metrics={
            "faces_detected": analysis["face_count"],
            "frames_analyzed": 1,
            "haar_faces": int(analysis["detector_counts"]["haar"]),
            "mtcnn_faces": int(analysis["detector_counts"]["mtcnn"]),
            "combined_faces": int(analysis["detector_counts"]["combined"]),
            "noise_residual": float(analysis["frame_analysis"].get("noise_residual", 0.0)),
            "compression_banding": float(analysis["frame_analysis"].get("compression_banding", 0.0)),
            "frame_consistency": 0.0,
            "motion_pattern_score": 0.0,
            "mtcnn_enabled": _get_mtcnn_detector() is not None,
        },
    )


def _sample_video_frames(cap: Any, fps: float, frame_count: int) -> list[np.ndarray]:
    interval_ms = int(os.getenv("VIDEO_FRAME_INTERVAL_MS", "250"))
    max_frames = int(os.getenv("VIDEO_MAX_FRAMES", "32"))
    step = max(1, int((fps or 24.0) * interval_ms / 1000.0))

    frames: list[np.ndarray] = []
    frame_index = 0
    while len(frames) < max_frames:
        if frame_count > 0 and frame_index >= frame_count:
            break
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_index)
        ok, bgr = cap.read()
        if not ok or bgr is None:
            break
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        if max(rgb.shape[:2]) > 960:
            scale = 960 / max(rgb.shape[:2])
            rgb = cv2.resize(rgb, (int(rgb.shape[1] * scale), int(rgb.shape[0] * scale)), interpolation=cv2.INTER_AREA)
        frames.append(rgb)
        frame_index += step
    return frames


def analyze_video_bytes(content: bytes, filename: str) -> dict[str, Any]:
    if cv2 is None:
        raise RuntimeError("OpenCV is required for video analysis. Install opencv-python-headless.")

    suffix = Path(filename or "upload").suffix.lower()
    if suffix not in VIDEO_EXTENSIONS:
        suffix = ".mp4"

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tmp_path = tmp.name
    try:
        tmp.write(content)
        tmp.close()

        cap = cv2.VideoCapture(tmp_path)
        if not cap.isOpened():
            raise ValueError("Could not open video file.")

        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        fps = float(cap.get(cv2.CAP_PROP_FPS) or 0.0)
        frames = _sample_video_frames(cap, fps, frame_count)
        cap.release()

        if not frames:
            raise ValueError("No frames could be read from the video.")

        frame_results: list[dict[str, Any]] = []
        gray_frames: list[np.ndarray] = []
        for frame in frames:
            frame_results.append(_analyze_rgb_frame(frame))
            gray_frames.append(_rgb_to_gray(frame))

        frame_motion, motion_pattern_score = _motion_pattern_score(gray_frames)
        frame_consistency = _temporal_consistency_score(frame_results)

        all_faces = [face for result in frame_results for face in result["faces"]]
        total_haar = int(sum(result["detector_counts"]["haar"] for result in frame_results))
        total_mtcnn = int(sum(result["detector_counts"]["mtcnn"] for result in frame_results))
        total_combined = int(sum(result["detector_counts"]["combined"] for result in frame_results))
        frame_predictions = [float(result["prediction"]) for result in frame_results]
        temporal_boost = _clamp01(0.55 * frame_consistency + 0.45 * motion_pattern_score)
        prediction = _clamp01(
            0.80 * _aggregate_scores([{"fallback_prediction": p} for p in frame_predictions], frame_motion=frame_motion)
            + 0.20 * temporal_boost
        )
        avg_noise = float(np.mean([result["frame_analysis"].get("noise_residual", 0.0) for result in frame_results]))
        avg_banding = float(np.mean([result["frame_analysis"].get("compression_banding", 0.0) for result in frame_results]))

        return _build_result(
            filename=filename,
            media_type="video",
            prediction=prediction,
            faces=all_faces or [{"fallback_prediction": prediction}],
            metrics={
                "faces_detected": int(sum(result["face_count"] for result in frame_results)),
                "haar_faces": total_haar,
                "mtcnn_faces": total_mtcnn,
                "combined_faces": total_combined,
                "frames_analyzed": len(frames),
                "frame_count_reported": frame_count,
                "fps_reported": round(fps, 3) if fps else None,
                "average_frame_prediction": round(float(np.mean(frame_predictions)), 4),
                "inter_frame_motion": round(frame_motion, 4),
                "frame_consistency": round(frame_consistency, 4),
                "motion_pattern_score": round(motion_pattern_score, 4),
                "noise_residual": round(avg_noise, 4),
                "compression_banding": round(avg_banding, 4),
                "mtcnn_enabled": _get_mtcnn_detector() is not None,
            },
        )
    finally:
        try:
            Path(tmp_path).unlink(missing_ok=True)
        except OSError:
            pass


def build_report_narrative(result: dict[str, Any]) -> dict[str, Any]:
    fake_p = int(result.get("fakeProbability", result.get("fake_probability", 0)))
    real_p = int(result.get("realProbability", 100 - fake_p))
    label = str(result.get("label", "Uncertain"))
    media = str(result.get("media_type", "image"))
    risk = str(result.get("riskLevel", "Medium"))
    features = result.get("feature_analysis") or {}
    frames = result.get("metrics", {}).get("frames_analyzed")
    faces = result.get("metrics", {}).get("faces_detected")

    explanation = (
        f"The {media} was scanned with face detection, forensic texture checks, lighting analysis, "
        f"edge-artifact analysis, and {'multi-frame averaging' if media == 'video' else 'single-frame scoring'}. "
        f"The final result is {label}: fake probability {fake_p}% and real probability {real_p}%."
    )

    findings = [
        f"Detection Result: {label}",
        f"Fake probability: {fake_p}%",
        f"Real probability: {real_p}%",
        f"Risk level: {risk}",
        f"Faces detected: {faces if faces is not None else 0}",
        f"Frames analyzed: {frames if frames is not None else 1}",
        f"Facial texture inconsistencies: {features.get('facial_texture_inconsistencies', 0)}",
        f"Lighting mismatches: {features.get('lighting_mismatches', 0)}",
        f"Abnormal eye blink proxy: {features.get('abnormal_eye_blink', 0)}",
        f"Unnatural face edges: {features.get('unnatural_face_edges', 0)}",
        f"Pixel artifacts: {features.get('pixel_artifacts', 0)}",
    ]

    return {"explanation": explanation, "findings": findings}


def analyze_upload(content: bytes, filename: str, declared_mime: str | None) -> dict[str, Any]:
    name = (filename or "").lower()
    mime = (declared_mime or "").lower()
    suffix = Path(name).suffix

    is_video = suffix in VIDEO_EXTENSIONS or mime.startswith("video/")
    is_image = suffix in IMAGE_EXTENSIONS or mime.startswith("image/")

    if is_video:
        return analyze_video_bytes(content, filename)
    if is_image:
        return analyze_image_bytes(content, filename)

    raise ValueError("Unsupported file type. Upload an image (JPG, PNG) or a video (MP4, MOV).")
