from retriever import search


def generate_answer(question):
    results = search(question, top_k=3)

    context = "\n\n".join(
        result["chunk"]
        for result in results
    )

    answer = f"""
Based on the retrieved knowledge base:

{context}

Question:
{question}

The information above was retrieved from the project knowledge base.
"""

    return answer


if __name__ == "__main__":
    question = input("Enter your question: ")

    answer = generate_answer(question)

    print("\n===== RAG ANSWER =====\n")
    print(answer)