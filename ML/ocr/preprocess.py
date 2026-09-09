try:
    import cv2
    import numpy as np
except ImportError:
    cv2 = None
    np = None

try:
    from PIL import Image, ImageEnhance
    import io
except ImportError:
    Image = None

def preprocess_image(image_bytes: bytes) -> bytes:
    if cv2 is not None and np is not None:
        try:
            arr = np.frombuffer(image_bytes, dtype=np.uint8)
            img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            if img is not None:
                h, w = img.shape[:2]
                if w < 1600:
                    scale = 1600.0 / w
                    img = cv2.resize(img, (1600, int(h * scale)), interpolation=cv2.INTER_CUBIC)
                
                # Add 50px white border padding so bottom/edge lines are fully captured
                img = cv2.copyMakeBorder(img, 50, 50, 50, 50, cv2.BORDER_CONSTANT, value=[255, 255, 255])

                lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
                l, a, b = cv2.split(lab)
                clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
                cl = clahe.apply(l)
                limg = cv2.merge((cl, a, b))
                enhanced = cv2.cvtColor(limg, cv2.COLOR_LAB2BGR)

                ok, buf = cv2.imencode(".png", enhanced)
                if ok:
                    return buf.tobytes()
        except Exception as e:
            print(f"OpenCV preprocessing error: {e}")

    if Image is not None:
        try:
            image = Image.open(io.BytesIO(image_bytes))
            if image.mode != "RGB":
                image = image.convert("RGB")
            if image.width < 1600:
                new_h = int(image.height * (1600.0 / image.width))
                image = image.resize((1600, new_h), Image.Resampling.LANCZOS)
            
            from PIL import ImageOps
            image = ImageOps.expand(image, border=50, fill="white")

            enhancer = ImageEnhance.Contrast(image)
            image = enhancer.enhance(1.3)
            output = io.BytesIO()
            image.save(output, format="PNG")
            return output.getvalue()
        except Exception as e:
            print(f"PIL preprocessing error: {e}")

    return image_bytes