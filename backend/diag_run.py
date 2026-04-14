import sys, os
print('CWD:', os.getcwd())
# ensure repo root on path
sys.path.insert(0, os.getcwd())
# check cv2
try:
    import cv2
    print('cv2 version', cv2.__version__)
    cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    print('cascade empty?', cascade.empty())
    info = cv2.getBuildInformation()
    print('ffmpeg present:', 'FFMPEG' in info.upper())
except Exception as e:
    print('cv2 error:', repr(e))
# import analyzer
try:
    from backend.app.services.media_analyzer import detect_faces
    print('import media_analyzer: OK')
except Exception as e:
    print('import media_analyzer error:', repr(e))
# call detect_faces on a white image
try:
    import numpy as np
    img = np.ones((400,400,3), dtype=np.uint8) * 255
    faces = detect_faces(img)
    print('detect_faces returned:', faces)
except Exception as e:
    print('detect_faces call error:', repr(e))
