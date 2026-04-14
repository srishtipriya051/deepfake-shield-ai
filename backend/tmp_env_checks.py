import importlib, sys
print('python_executable:', sys.executable)

try:
    import cv2
    print('cv2_version:', getattr(cv2, '__version__', None))
    print('haarcascades_path:', cv2.data.haarcascades)
    cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    print('cascade_loaded:', not cascade.empty())
    info = cv2.getBuildInformation()
    print('ffmpeg_present:', 'FFMPEG' in info.upper())
except Exception as e:
    print('cv2_error:', repr(e))

def is_installed(name: str) -> bool:
    try:
        importlib.import_module(name)
        return True
    except Exception:
        return False

print('mtcnn_installed:', is_installed('mtcnn'))
print('tensorflow_installed:', is_installed('tensorflow'))

try:
    from backend.app.services.media_analyzer import detect_faces
    print('media_analyzer_import: OK')
except Exception as e:
    print('media_analyzer_import_error:', repr(e))
