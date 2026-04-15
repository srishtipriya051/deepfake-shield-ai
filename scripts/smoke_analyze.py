"""Smoke tests: POST /analyze with a PNG (image) and a tiny MP4 (video, needs OpenCV). Run from repo root."""
import io
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import numpy as np  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image  # noqa: E402

from backend.app.main import app  # noqa: E402


def _check(body: dict, label: str) -> None:
    for key in ("fake_probability", "verdict", "real_like_percent", "fake_like_percent", "media_type"):
        assert key in body, f"{label}: missing {key}"
    p = int(body["fake_probability"])
    assert body["fake_like_percent"] == p
    assert body["real_like_percent"] == max(0, min(100, 100 - p))
    print(f"  [{label}] verdict={body['verdict']!r} fake_like={p}% real_like={body['real_like_percent']}% media={body['media_type']}")


def _tiny_mp4_bytes() -> bytes:
    import cv2

    path = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False).name
    w, h = 96, 72
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out = cv2.VideoWriter(path, fourcc, 6.0, (w, h))
    if not out.isOpened():
        Path(path).unlink(missing_ok=True)
        raise RuntimeError("VideoWriter could not open for mp4 (codec/host issue).")
    try:
        for i in range(24):
            frame = np.zeros((h, w, 3), dtype=np.uint8)
            frame[:] = ((i * 11) % 255, 60, 180)
            out.write(frame)
    finally:
        out.release()
    raw = Path(path).read_bytes()
    Path(path).unlink(missing_ok=True)
    return raw


def main() -> None:
    client = TestClient(app)

    img = Image.new("RGB", (64, 64), color=(40, 90, 200))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    r1 = client.post("/analyze", files={"file": ("smoke.png", buf.getvalue(), "image/png")})
    print("IMAGE /analyze status", r1.status_code)
    if r1.status_code != 200:
        print(r1.text)
        sys.exit(1)
    _check(r1.json(), "image")

    try:
        vbytes = _tiny_mp4_bytes()
    except Exception as e:  # noqa: BLE001
        print("VIDEO skipped (OpenCV writer):", e)
        print("smoke: image path OK; install opencv-python-headless for video.")
        return

    r2 = client.post("/analyze", files={"file": ("smoke.mp4", vbytes, "video/mp4")})
    print("VIDEO /analyze status", r2.status_code)
    if r2.status_code != 200:
        print(r2.text)
        sys.exit(1)
    _check(r2.json(), "video")
    print("smoke: image + video OK")


if __name__ == "__main__":
    main()
