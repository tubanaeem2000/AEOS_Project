from pathlib import Path
import pickle
import numpy as np
import faiss

BASE_DIR = Path(__file__).parent

CHUNKS_PATH = BASE_DIR / "embeddings" / "chunks.txt"
VECTORIZER_PATH = BASE_DIR / "embeddings" / "vectorizer.pkl"
INDEX_PATH = BASE_DIR / "vector_store" / "faiss.index"


def load_chunks():
    text = CHUNKS_PATH.read_text(encoding="utf-8")

    chunks = [
        chunk.strip()
        for chunk in text.split("\n\n--- CHUNK SEPARATOR ---\n\n")
        if chunk.strip()
    ]

    return chunks


def load_vectorizer():
    with open(VECTORIZER_PATH, "rb") as f:
        return pickle.load(f)


def search(query, top_k=3):
    # Load vectorizer
    vectorizer = load_vectorizer()

    # Convert query into the same TF-IDF vector space
    query_embedding = vectorizer.transform([query]).toarray().astype("float32")

    # Load FAISS index
    index = faiss.read_index(str(INDEX_PATH))

    # Search
    distances, indices = index.search(query_embedding, top_k)

    # Load chunks
    chunks = load_chunks()

    results = []

    for distance, index_position in zip(distances[0], indices[0]):
        if index_position < len(chunks):
            results.append({
                "chunk": chunks[index_position],
                "distance": float(distance)
            })

    return results


if __name__ == "__main__":
    query = input("Enter your question: ")

    results = search(query)

    print("\n===== RETRIEVED CONTEXT =====\n")

    for i, result in enumerate(results, start=1):
        print(f"--- Result {i} ---")
        print(f"Distance: {result['distance']:.4f}")
        print(result["chunk"])
        print()