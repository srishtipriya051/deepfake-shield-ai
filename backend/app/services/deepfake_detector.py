"""
Deepfake model adapters for Deepfake Shield AI.

This module keeps heavy ML imports optional so the FastAPI backend can boot
even when TensorFlow or PyTorch are not installed yet. It supports:

- TensorFlow / Keras Xception-style binary classifiers (`.h5`, `.keras`)
- TensorFlow / Keras MesoNet-style binary classifiers (`.h5`, `.keras`)
- PyTorch EfficientNet-B4 binary classifiers (`.pt`, `.pth`)
"""

from __future__ import annotations

import io
import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal

import numpy as np
from PIL import Image, ImageOps

try:
    from mtcnn import MTCNN  # type: ignore
except Exception:  # noqa: BLE001
    MTCNN = None  # type: ignore


ModelFramework = Literal["tensorflow", "torch"]
ModelName = Literal["xception", "efficientnet_b4", "mesonet"]

IMAGE_SIZE = (224, 224)
IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)


@dataclass
class PredictionOutput:
    label: str
    fake_probability: int
    real_probability: int
    fake_score: float
    real_score: float
    model_name: str
    framework: str


@dataclass
class PreprocessedImage:
    rgb: np.ndarray
    tf_batch: np.ndarray
    torch_tensor: np.ndarray


@lru_cache(maxsize=1)
def _get_mtcnn_detector() -> Any | None:
    if MTCNN is None:
        return None
    try:
        return MTCNN()
    except Exception:  # noqa: BLE001
        return None


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


def _softmax(values: np.ndarray) -> np.ndarray:
    shifted = values - np.max(values)
    exp_values = np.exp(shifted)
    return exp_values / np.sum(exp_values)


def _extract_face(rgb: np.ndarray) -> np.ndarray:
    detector = _get_mtcnn_detector()
    if detector is None:
        return rgb

    try:
        detections = detector.detect_faces(rgb.astype(np.uint8))
    except Exception:  # noqa: BLE001
        return rgb

    if not detections:
        return rgb

    largest = max(detections, key=lambda item: item.get("box", [0, 0, 0, 0])[2] * item.get("box", [0, 0, 0, 0])[3])
    x, y, w, h = largest.get("box", [0, 0, rgb.shape[1], rgb.shape[0]])
    x = max(0, int(x))
    y = max(0, int(y))
    w = max(1, int(w))
    h = max(1, int(h))
    x2 = min(rgb.shape[1], x + w)
    y2 = min(rgb.shape[0], y + h)
    crop = rgb[y:y2, x:x2]
    return crop if crop.size else rgb


def decode_uploaded_image(content: bytes) -> np.ndarray:
    image = Image.open(io.BytesIO(content))
    image = ImageOps.exif_transpose(image).convert("RGB")
    return np.asarray(image, dtype=np.uint8)


def preprocess_image_array(
    rgb: np.ndarray,
    *,
    image_size: tuple[int, int] = IMAGE_SIZE,
    crop_face: bool = True,
) -> PreprocessedImage:
    source = _extract_face(rgb) if crop_face else rgb
    resized = Image.fromarray(source).resize(image_size)
    resized_rgb = np.asarray(resized, dtype=np.float32)

    normalized_01 = resized_rgb / 255.0
    torch_ready = (normalized_01 - IMAGENET_MEAN) / IMAGENET_STD
    torch_ready = np.transpose(torch_ready, (2, 0, 1)).astype(np.float32)

    return PreprocessedImage(
        rgb=resized_rgb.astype(np.uint8),
        tf_batch=np.expand_dims(normalized_01.astype(np.float32), axis=0),
        torch_tensor=np.expand_dims(torch_ready, axis=0),
    )


def preprocess_uploaded_image(
    content: bytes,
    *,
    image_size: tuple[int, int] = IMAGE_SIZE,
    crop_face: bool = True,
) -> PreprocessedImage:
    rgb = decode_uploaded_image(content)
    return preprocess_image_array(rgb, image_size=image_size, crop_face=crop_face)


def build_xception_model(input_shape: tuple[int, int, int] = (224, 224, 3)) -> Any:
    try:
        from tensorflow.keras import Model, layers
        from tensorflow.keras.applications import Xception
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError("TensorFlow is required to build the Xception model.") from exc

    base = Xception(include_top=False, weights="imagenet", input_shape=input_shape, pooling="avg")
    output = layers.Dense(1, activation="sigmoid", name="deepfake_probability")(base.output)
    return Model(inputs=base.input, outputs=output, name="xception_deepfake")


def build_mesonet(input_shape: tuple[int, int, int] = (224, 224, 3)) -> Any:
    try:
        from tensorflow.keras import Sequential, layers
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError("TensorFlow is required to build the MesoNet model.") from exc

    return Sequential(
        [
            layers.Input(shape=input_shape),
            layers.Conv2D(8, (3, 3), padding="same", activation="relu"),
            layers.BatchNormalization(),
            layers.MaxPooling2D(pool_size=(2, 2)),
            layers.Conv2D(8, (5, 5), padding="same", activation="relu"),
            layers.BatchNormalization(),
            layers.MaxPooling2D(pool_size=(2, 2)),
            layers.Conv2D(16, (5, 5), padding="same", activation="relu"),
            layers.BatchNormalization(),
            layers.MaxPooling2D(pool_size=(2, 2)),
            layers.Conv2D(16, (5, 5), padding="same", activation="relu"),
            layers.BatchNormalization(),
            layers.MaxPooling2D(pool_size=(4, 4)),
            layers.Flatten(),
            layers.Dropout(0.5),
            layers.Dense(16, activation="relu"),
            layers.Dropout(0.5),
            layers.Dense(1, activation="sigmoid", name="deepfake_probability"),
        ],
        name="mesonet_deepfake",
    )


def build_efficientnet_b4_model(num_classes: int = 1) -> Any:
    try:
        import torch.nn as nn
        from torchvision.models import efficientnet_b4
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError("PyTorch and torchvision are required to build EfficientNet-B4.") from exc

    model = efficientnet_b4(weights=None)
    in_features = model.classifier[1].in_features
    model.classifier[1] = nn.Linear(in_features, num_classes)
    return model


def load_tensorflow_model(model_name: ModelName, weights_path: str | None = None) -> Any:
    normalized_name = model_name.lower()
    if normalized_name == "xception":
        model = build_xception_model()
    elif normalized_name == "mesonet":
        model = build_mesonet()
    else:
        raise ValueError(f"TensorFlow model '{model_name}' is not supported.")

    if weights_path:
        suffix = Path(weights_path).suffix.lower()
        if suffix not in {".h5", ".keras"}:
            raise ValueError("TensorFlow models expect a .h5 or .keras weights file.")
        model.load_weights(weights_path)
    return model


def load_torch_model(model_name: ModelName, weights_path: str | None = None, device: str = "cpu") -> Any:
    normalized_name = model_name.lower()
    if normalized_name != "efficientnet_b4":
        raise ValueError(f"PyTorch model '{model_name}' is not supported.")

    try:
        import torch
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError("PyTorch is required to load the EfficientNet-B4 model.") from exc

    model = build_efficientnet_b4_model()
    if weights_path:
        state = torch.load(weights_path, map_location=device)
        if isinstance(state, dict) and "state_dict" in state:
            state = state["state_dict"]
        model.load_state_dict(state, strict=False)
    model.to(device)
    model.eval()
    return model


class DeepfakeDetector:
    def __init__(
        self,
        model_name: str | None = None,
        weights_path: str | None = None,
        device: str | None = None,
    ) -> None:
        self.model_name = (model_name or os.getenv("DEEPFAKE_MODEL_NAME", "xception")).strip().lower()
        self.weights_path = (weights_path or os.getenv("DEEPFAKE_MODEL_PATH", "")).strip() or None
        self.device = (device or os.getenv("DEEPFAKE_MODEL_DEVICE", "cpu")).strip().lower()
        self.framework = self._resolve_framework(self.model_name)
        self.model = self._load_model()

    @staticmethod
    def _resolve_framework(model_name: str) -> ModelFramework:
        if model_name in {"xception", "mesonet"}:
            return "tensorflow"
        if model_name == "efficientnet_b4":
            return "torch"
        raise ValueError(f"Unsupported deepfake model '{model_name}'.")

    def _load_model(self) -> Any:
        if self.framework == "tensorflow":
            return load_tensorflow_model(self.model_name, self.weights_path)
        return load_torch_model(self.model_name, self.weights_path, self.device)

    def _predict_tensorflow(self, preprocessed: PreprocessedImage) -> tuple[float, float]:
        batch = preprocessed.tf_batch

        if self.model_name == "xception":
            try:
                from tensorflow.keras.applications.xception import preprocess_input
            except Exception as exc:  # noqa: BLE001
                raise RuntimeError("TensorFlow Xception preprocessing is unavailable.") from exc
            batch = preprocess_input((batch * 255.0).astype(np.float32))

        prediction = np.asarray(self.model.predict(batch, verbose=0), dtype=np.float32).squeeze()
        if np.ndim(prediction) == 0:
            fake_score = _clamp01(float(prediction))
            return fake_score, 1.0 - fake_score

        flattened = np.ravel(prediction)
        if flattened.size == 1:
            fake_score = _clamp01(float(flattened[0]))
            return fake_score, 1.0 - fake_score

        probs = _softmax(flattened[:2])
        real_score = _clamp01(float(probs[0]))
        fake_score = _clamp01(float(probs[1]))
        return fake_score, real_score

    def _predict_torch(self, preprocessed: PreprocessedImage) -> tuple[float, float]:
        try:
            import torch
        except Exception as exc:  # noqa: BLE001
            raise RuntimeError("PyTorch is required to run the EfficientNet-B4 detector.") from exc

        tensor = torch.from_numpy(preprocessed.torch_tensor).to(self.device)
        with torch.no_grad():
            logits = self.model(tensor)

        output = logits.detach().cpu().numpy().astype(np.float32).squeeze()
        if np.ndim(output) == 0:
            fake_score = _clamp01(1.0 / (1.0 + np.exp(-float(output))))
            return fake_score, 1.0 - fake_score

        flattened = np.ravel(output)
        if flattened.size == 1:
            fake_score = _clamp01(1.0 / (1.0 + np.exp(-float(flattened[0]))))
            return fake_score, 1.0 - fake_score

        probs = _softmax(flattened[:2])
        real_score = _clamp01(float(probs[0]))
        fake_score = _clamp01(float(probs[1]))
        return fake_score, real_score

    def predict_image_bytes(self, content: bytes) -> PredictionOutput:
        preprocessed = preprocess_uploaded_image(content)
        if self.framework == "tensorflow":
            fake_score, real_score = self._predict_tensorflow(preprocessed)
        else:
            fake_score, real_score = self._predict_torch(preprocessed)

        fake_probability = int(round(fake_score * 100))
        real_probability = int(round(real_score * 100))
        total = max(1, fake_probability + real_probability)
        fake_probability = int(round((fake_probability / total) * 100))
        real_probability = 100 - fake_probability
        label = "Fake" if fake_probability >= real_probability else "Real"

        return PredictionOutput(
            label=label,
            fake_probability=fake_probability,
            real_probability=real_probability,
            fake_score=fake_score,
            real_score=real_score,
            model_name=self.model_name,
            framework=self.framework,
        )

    def predict_frame(self, rgb_frame: np.ndarray) -> PredictionOutput:
        preprocessed = preprocess_image_array(rgb_frame)
        if self.framework == "tensorflow":
            fake_score, real_score = self._predict_tensorflow(preprocessed)
        else:
            fake_score, real_score = self._predict_torch(preprocessed)

        fake_probability = int(round(fake_score * 100))
        real_probability = 100 - fake_probability
        label = "Fake" if fake_probability >= real_probability else "Real"

        return PredictionOutput(
            label=label,
            fake_probability=fake_probability,
            real_probability=real_probability,
            fake_score=fake_score,
            real_score=real_score,
            model_name=self.model_name,
            framework=self.framework,
        )


def load_detector_from_env() -> DeepfakeDetector:
    return DeepfakeDetector()


def load_detectors_from_env() -> list[DeepfakeDetector]:
    configured = (os.getenv("DEEPFAKE_MODEL_PATHS", "") or "").strip()
    device = (os.getenv("DEEPFAKE_MODEL_DEVICE", "cpu") or "cpu").strip().lower()
    detectors: list[DeepfakeDetector] = []

    if configured:
        for chunk in configured.split(";"):
            item = chunk.strip()
            if not item:
                continue
            if "=" not in item:
                continue
            model_name, weights_path = item.split("=", 1)
            weights_path = weights_path.strip()
            if not weights_path or not Path(weights_path).exists():
                continue
            try:
                detectors.append(
                    DeepfakeDetector(
                        model_name=model_name.strip().lower(),
                        weights_path=weights_path,
                        device=device,
                    )
                )
            except Exception:
                continue
        if detectors:
            return detectors

    model_name = (os.getenv("DEEPFAKE_MODEL_NAME", "") or "").strip().lower()
    weights_path = (os.getenv("DEEPFAKE_MODEL_PATH", "") or "").strip()
    if model_name and weights_path and Path(weights_path).exists():
        try:
            detectors.append(
                DeepfakeDetector(
                    model_name=model_name,
                    weights_path=weights_path,
                    device=device,
                )
            )
        except Exception:
            return []

    return detectors
