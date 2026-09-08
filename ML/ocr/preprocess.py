try:
    import cv2
    import numpy as np
except ImportError:
    cv2 = None
    np = None

try:
    from PIL import Image
    import io
except ImportError:
    Image = None

def preprocess_image(image_bytes: bytes) -> bytes:
    if cv2 is not None and np is not None:
        try:
            arr = np.frombuffer(image_bytes, dtype=np.uint8)
            img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            if img is not None:
                gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
                coords = np.column_stack(np.where(gray < 200))
                angle = 0.0
                if len(coords) > 0:
                    angle = cv2.minAreaRect(coords)[-1]
                    angle = -(90 + angle) if angle < -45 else -angle
                h, w = gray.shape
                M = cv2.getRotationMatrix2D((w // 2, h // 2), angle, 1.0)
                deskewed = cv2.warpAffine(gray, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
                denoised = cv2.fastNlMeansDenoising(deskewed, h=10)
                thresh = cv2.adaptiveThreshold(denoised, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 15)
                ok, buf = cv2.imencode(".png", thresh)
                if ok:
                    return buf.tobytes()
        except Exception as e:
            print(f"OpenCV preprocessing error: {e}")

    if Image is not None:
        try:
            image = Image.open(io.BytesIO(image_bytes))
            if image.mode != "RGB":
                image = image.convert("RGB")
            output = io.BytesIO()
            image.save(output, format="PNG")
            return output.getvalue()
        except Exception as e:
            print(f"PIL preprocessing error: {e}")

    return image_bytes