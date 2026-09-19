import os
from dotenv import load_dotenv
from google import genai
from retriever import search
load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")

if not api_key or "YOUR_ACTUAL" in api_key or "your_gemini" in api_key:
    print("ERROR: Actual GEMINI_API_KEY .env mein set nahi hai.")
    exit()

client = genai.Client(api_key=api_key)

question = input("Enter your question: ")

results = search(question, top_k=3)

context = "\n\n".join(
    result["chunk"] for result in results
)

prompt = f"""
Answer the question using the project knowledge base.

PROJECT KNOWLEDGE BASE:
{context}

QUESTION:
{question}

If the answer is not available in the knowledge base, say:
"The information is not available in the project knowledge base."
"""

response = client.models.generate_content(
    model="gemini-flash-lite-latest",
    contents=prompt,
)

print("\n===== RAG ANSWER =====\n")
print(response.text)