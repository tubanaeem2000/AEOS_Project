from pathlib import Path
import numpy as np
import faiss

BASE_DIR = Path(__file__).parent
EMBEDDINGS_PATH = BASE_DIR / "embeddings" / "embeddings.npy"
INDEX_PATH = BASE_DIR / "vector_store" / "faiss.index"

# Load embeddings
embeddings = np.load(EMBEDDINGS_PATH).astype("float32")

print(f"Loaded embeddings: {embeddings.shape}")

# Create FAISS index
dimension = embeddings.shape[1]
index = faiss.IndexFlatL2(dimension)

# Add embeddings
index.add(embeddings)

# Save index
INDEX_PATH.parent.mkdir(parents=True, exist_ok=True)
faiss.write_index(index, str(INDEX_PATH))

print("FAISS vector store created successfully!")
print(f"Vectors stored: {index.ntotal}")
print(f"Saved to: {INDEX_PATH}")