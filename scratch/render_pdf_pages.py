import fitz
import glob
import os

ARTIFACT_DIR = "/Users/pallavdeshmukh/.gemini/antigravity/brain/f5c460a2-1757-4e81-9867-592c08c7881f"
pdf_files = glob.glob(os.path.join(ARTIFACT_DIR, "downloads", "*.pdf"))
print("PDFs found:", pdf_files)

if pdf_files:
    pdf_path = pdf_files[0]
    doc = fitz.open(pdf_path)
    print(f"Total pages: {len(doc)}")
    
    for i, page in enumerate(doc):
        pix = page.get_pixmap(dpi=150)
        out_path = os.path.join(ARTIFACT_DIR, f"passport_pdf_page_{i+1}.png")
        pix.save(out_path)
        print(f"Saved {out_path}")
