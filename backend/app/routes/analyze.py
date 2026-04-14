from fastapi import APIRouter, File, HTTPException, UploadFile

from backend.app.controllers.detection_controller import analyze_uploaded_media

router = APIRouter(tags=["analyze"])


async def _handle_upload(file: UploadFile) -> dict:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename.")

    try:
        raw = await file.read()
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Could not read upload: {e}") from e

    if not raw:
        raise HTTPException(status_code=400, detail="Empty file.")

    max_bytes = 80 * 1024 * 1024
    if len(raw) > max_bytes:
        raise HTTPException(status_code=413, detail="File too large (max 80MB).")

    try:
        return analyze_uploaded_media(raw, file.filename, file.content_type)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/upload")
async def upload_media(file: UploadFile = File(...)):
    return await _handle_upload(file)


@router.post("/analyze")
async def analyze_media(file: UploadFile = File(...)):
    return await _handle_upload(file)
