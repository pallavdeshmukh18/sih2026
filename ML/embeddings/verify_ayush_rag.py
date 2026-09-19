import os
import time
import logging
from embeddings.retrieve import retrieve_clinical_knowledge

logger = logging.getLogger("medikiosk.embeddings.verify")
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

TEST_QUERIES = [
    "joint pain stiffness in rheumatoid arthritis",
    "diabetes mellitus metabolic disorder management",
    "gout joint swelling pain in big toe",
    "thyroid dysfunction metabolism fatigue",
    "osteoarthritis knee joint pain treatment"
]

def run_verification():
    print("\n" + "="*70)
    print("      MEDIKIOSK AYUSH STG CHROMADB VECTOR RETRIEVAL BENCHMARK      ")
    print("="*70 + "\n")

    for i, query in enumerate(TEST_QUERIES, 1):
        print(f"[{i}] QUERY: '{query}'")
        start_time = time.time()
        
        results = retrieve_clinical_knowledge(query, top_k=2)
        elapsed_ms = (time.time() - start_time) * 1000

        print(f"    Retrieval Latency: {elapsed_ms:.2f} ms")
        print(f"    Total Matches Retrieved: {len(results)}")
        
        for idx, item in enumerate(results, 1):
            source = item.get("metadata", {}).get("source", "Knowledge Base")
            score = item.get("score", 0.0)
            dist = item.get("distance", 0.0)
            text_snippet = item.get("text", "").replace("\n", " ")[:200]

            print(f"    --------------------------------------------------")
            print(f"    Match #{idx} | Source: {source} | Score: {score:.4f} | Distance: {dist:.4f}")
            print(f"    Text Excerpt: \"{text_snippet}...\"")

        print("\n")

if __name__ == "__main__":
    run_verification()
