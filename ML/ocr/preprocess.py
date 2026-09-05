import cv2
import numpy as np


def preprocess_image(image_bytes: bytes) -> bytes:
    arr = np.frombuffer(image_bytes, dtype=np.uint8)

    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)

    if img is None:
        raise ValueError("Could not decode the image.")

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Deskew
    coords = np.column_stack(np.where(gray < 200))

    angle = 0.0

    if len(coords) > 0:
        angle = cv2.minAreaRect(coords)[-1]
        angle = -(90 + angle) if angle < -45 else -angle

    h, w = gray.shape

    M = cv2.getRotationMatrix2D(
        (w // 2, h // 2),
        angle,
        1.0
    )

    deskewed = cv2.warpAffine(
        gray,
        M,
        (w, h),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_REPLICATE
    )

    # Denoise
    denoised = cv2.fastNlMeansDenoising(
        deskewed,
        h=10
    )

    # Adaptive threshold
    thresh = cv2.adaptiveThreshold(
        denoised,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        31,
        15
    )

    ok, buf = cv2.imencode(".png", thresh)

    if not ok:
        raise ValueError("Could not encode the processed image.")

    return buf.tobytes()