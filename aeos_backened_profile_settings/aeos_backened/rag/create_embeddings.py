from pathlib import Path
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer

BASE_DIR = Path(__file__).parent
CHUNKS_PATH = BASE_DIR / "embeddings" / "chunks.txt"
OUTPUT_PATH = BASE_DIR / "embeddings" / "embeddings.npy"
VOCAB_PATH = BASE_DIR / "embeddings" / "vectorizer.npy"

# Load chunks
content = CHUNKS_PATH.read_text(encoding="utf-8")

chunks = [
    chunk.strip()
    for chunk in content.split("\n\n--- CHUNK SEPARATOR ---\n\n")
    if chunk.strip()
]

print(f"Loaded chunks: {len(chunks)}")

# Create lightweight text embeddings using TF-IDF
vectorizer = TfidfVectorizer(
    lowercase=True,
    stop_words="english"
)

embeddings = vectorizer.fit_transform(chunks).toarray()

# Save embeddings
np.save(OUTPUT_PATH, embeddings)

# Save vocabulary/settings needed for retrieval
import pickle

with open(BASE_DIR / "embeddings" / "vectorizer.pkl", "wb") as f:
    pickle.dump(vectorizer, f)

print("Embeddings generated successfully!")
print(f"Shape: {embeddings.shape}")
print(f"Saved to: {OUTPUT_PATH}")
print("Vectorizer saved successfully!")