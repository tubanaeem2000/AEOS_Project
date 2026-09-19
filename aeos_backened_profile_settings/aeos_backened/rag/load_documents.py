from pathlib import Path

TXT_PATH = Path(__file__).parent / "documents" / "knowledge.txt"

if not TXT_PATH.exists():
    print("knowledge.txt not found!")
    exit()

text = TXT_PATH.read_text(encoding="utf-8")

print("Document loaded successfully!")
print(f"Characters extracted: {len(text)}")

print("\n--- First 1000 characters ---\n")
print(text[:1000])