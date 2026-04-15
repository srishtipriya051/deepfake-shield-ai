# deepfake-shield-ai

## Deepfake Detection Backend

Install the required libraries with:

```bash
pip install tensorflow torch torchvision opencv-python mtcnn numpy
```

Your FastAPI backend already exposes file-upload endpoints:

- `POST /upload`
- `POST /analyze`

Configure the detector through environment variables:

```bash
set DEEPFAKE_MODEL_NAME=xception
set DEEPFAKE_MODEL_PATH=C:\path\to\xception_weights.h5
set DEEPFAKE_MODEL_DEVICE=cpu
```

Supported model names:

- `xception` for TensorFlow / Keras `.h5` or `.keras` weights
- `mesonet` for TensorFlow / Keras `.h5` or `.keras` weights
- `efficientnet_b4` for PyTorch `.pt` or `.pth` weights

Example Python usage:

```python
from backend.app.services.deepfake_detector import (
    DeepfakeDetector,
    build_efficientnet_b4_model,
    build_mesonet,
    build_xception_model,
    load_tensorflow_model,
    load_torch_model,
)

# Build model architectures
xception_model = build_xception_model()
mesonet_model = build_mesonet()
efficientnet_model = build_efficientnet_b4_model()

# Load pretrained weights
xception_model = load_tensorflow_model("xception", "models/xception_weights.h5")
mesonet_model = load_tensorflow_model("mesonet", "models/mesonet_weights.h5")
efficientnet_model = load_torch_model("efficientnet_b4", "models/efficientnet_b4.pt", device="cpu")

# Predict from uploaded image bytes
detector = DeepfakeDetector(model_name="xception", weights_path="models/xception_weights.h5")
with open("sample.jpg", "rb") as file:
    result = detector.predict_image_bytes(file.read())

print(
    {
        "label": result.label,
        "fakeProbability": result.fake_probability,
        "realProbability": result.real_probability,
    }
)
```

The detector pipeline is backend-ready for FastAPI or Flask:

- reads uploaded image bytes
- optionally crops the primary face with `MTCNN`
- resizes to `224x224`
- normalizes before inference
- returns fake and real probabilities as percentages

Example response:

```json
{
  "label": "Fake",
  "fakeProbability": 78,
  "realProbability": 22
}
```

FastAPI integration example:

```python
from fastapi import APIRouter, File, UploadFile

from backend.app.services.deepfake_detector import DeepfakeDetector

router = APIRouter()
detector = DeepfakeDetector(
    model_name="xception",
    weights_path="models/xception_weights.h5",
)

@router.post("/detect")
async def detect(file: UploadFile = File(...)):
    content = await file.read()
    result = detector.predict_image_bytes(content)
    return {
        "label": result.label,
        "fakeProbability": result.fake_probability,
        "realProbability": result.real_probability,
    }
```
# Deepfake Shield AI

This project detects fake images and videos using AI.

## Model File

The model file is not included in this repository because it exceeds GitHub's size limit.

Download the model file and place it in the following folder:

backend/app/models/model.safetensors