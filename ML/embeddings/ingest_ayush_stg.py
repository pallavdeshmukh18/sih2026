import os
import glob
import logging
from typing import List, Dict, Any

logger = logging.getLogger("medikiosk.embeddings.ingest_ayush")
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data", "ayush_stg")
CHROMA_STORE_DIR = os.path.join(BASE_DIR, "chroma_store")

def extract_pdf_text(file_path: str) -> str:
    """Extracts raw text from PDF using available PDF libraries (pypdf, PyPDF2, pdfplumber, fitz)."""
    text_content = []
    
    # Try pypdf
    try:
        import pypdf
        reader = pypdf.PdfReader(file_path)
        logger.info(f"Extracting using pypdf ({len(reader.pages)} pages)...")
        for i, page in enumerate(reader.pages):
            txt = page.extract_text()
            if txt:
                text_content.append(txt)
        if text_content:
            return "\n\n".join(text_content)
    except Exception as e:
        logger.debug(f"pypdf failed or not available: {e}")

    # Try PyPDF2
    try:
        import PyPDF2
        reader = PyPDF2.PdfReader(file_path)
        logger.info(f"Extracting using PyPDF2 ({len(reader.pages)} pages)...")
        for page in reader.pages:
            txt = page.extract_text()
            if txt:
                text_content.append(txt)
        if text_content:
            return "\n\n".join(text_content)
    except Exception as e:
        logger.debug(f"PyPDF2 failed or not available: {e}")

    # Try pdfplumber
    try:
        import pdfplumber
        with pdfplumber.open(file_path) as pdf:
            logger.info(f"Extracting using pdfplumber ({len(pdf.pages)} pages)...")
            for page in pdf.pages:
                txt = page.extract_text()
                if txt:
                    text_content.append(txt)
        if text_content:
            return "\n\n".join(text_content)
    except Exception as e:
        logger.debug(f"pdfplumber failed or not available: {e}")

    # Try PyMuPDF (fitz)
    try:
        import fitz
        doc = fitz.open(file_path)
        logger.info(f"Extracting using PyMuPDF fitz ({len(doc)} pages)...")
        for page in doc:
            txt = page.get_text()
            if txt:
                text_content.append(txt)
        if text_content:
            return "\n\n".join(text_content)
    except Exception as e:
        logger.debug(f"fitz failed or not available: {e}")

    return "\n\n".join(text_content)


def chunk_text(text: str, chunk_size: int = 250, overlap: int = 40) -> List[str]:
    """Splits long text into overlapping chunks for dense vector embedding."""
    words = text.split()
    if not words:
        return []
    chunks = []
    step = max(1, chunk_size - overlap)
    for i in range(0, len(words), step):
        chunk = " ".join(words[i:i + chunk_size])
        if len(chunk.strip()) > 30:
            chunks.append(chunk.strip())
    return chunks


def run_ingestion():
    import chromadb
    from sentence_transformers import SentenceTransformer

    logger.info(f"Target AYUSH Data Directory: {DATA_DIR}")
    logger.info(f"Target ChromaDB Directory: {CHROMA_STORE_DIR}")

    os.makedirs(CHROMA_STORE_DIR, exist_ok=True)

    # Initialize persistent ChromaDB client
    chroma_client = chromadb.PersistentClient(path=CHROMA_STORE_DIR)
    collection = chroma_client.get_or_create_collection(name="ayush_clinical_knowledge")

    # Load embedding model
    logger.info("Loading SentenceTransformer model ('all-MiniLM-L6-v2')...")
    embedder = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

    pdf_files = glob.glob(os.path.join(DATA_DIR, "*.pdf"))
    if not pdf_files:
        logger.error(f"No PDF files found in {DATA_DIR}")
        return

    logger.info(f"Found {len(pdf_files)} PDF file(s) for ingestion.")

    total_chunks_added = 0

    for pdf_path in pdf_files:
        file_name = os.path.basename(pdf_path)
        logger.info(f"Starting processing for file: {file_name}")

        raw_text = extract_pdf_text(pdf_path)
        if not raw_text.strip():
            logger.warning(f"Could not extract text from {file_name}. Skipping.")
            continue

        chunks = chunk_text(raw_text)
        logger.info(f"Extracted {len(chunks)} chunks from {file_name}.")

        if not chunks:
            continue

        # Generate vector embeddings in batch
        logger.info(f"Generating embeddings for {len(chunks)} chunks...")
        embeddings = embedder.encode(chunks, batch_size=64, show_progress_bar=True).tolist()

        # Build unique IDs and metadatas
        ids = [f"doc_{hash(file_name) & 0xffffffff}_{i}" for i in range(len(chunks))]
        metadatas = [
            {
                "category": "ayush_stg",
                "source": file_name,
                "chunk_index": i,
                "text": chunk[:500]  # snippet stored in metadata
            }
            for i, chunk in enumerate(chunks)
        ]

        # Batch insert into ChromaDB collection
        collection.upsert(
            ids=ids,
            embeddings=embeddings,
            documents=chunks,
            metadatas=metadatas
        )

        total_chunks_added += len(chunks)
        logger.info(f"Successfully upserted {len(chunks)} chunks for {file_name} into ChromaDB!")

    logger.info(f"=== INGESTION COMPLETE ===")
    logger.info(f"Total Chunks Stored in ChromaDB Collection 'ayush_clinical_knowledge': {collection.count()}")

if __name__ == "__main__":
    run_ingestion()
