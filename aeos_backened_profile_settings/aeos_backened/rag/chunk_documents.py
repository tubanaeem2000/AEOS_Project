from pathlib import Path

INPUT_PATH = Path(__file__).parent / "documents" / "knowledge.txt"
OUTPUT_PATH = Path(__file__).parent / "embeddings" / "chunks.txt"

text = INPUT_PATH.read_text(encoding="utf-8")

# Split document into paragraphs/sections
sections = [section.strip() for section in text.split("\n\n") if section.strip()]

# Create chunks
chunk_size = 2
chunks = []

for i in range(0, len(sections), chunk_size):
    chunk = "\n\n".join(sections[i:i + chunk_size])
    chunks.append(chunk)

OUTPUT_PATH.write_text(
    "\n\n--- CHUNK SEPARATOR ---\n\n".join(chunks),
    encoding="utf-8"
)

print("Chunking completed successfully!")
print(f"Total chunks: {len(chunks)}")
print(f"Saved to: {OUTPUT_PATH}")