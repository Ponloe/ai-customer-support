from fastapi import FastAPI, Request
import google.generativeai as genai
from langchain_community.vectorstores import FAISS
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain.schema import Document
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware
import os

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

# Setup
genai.configure(api_key=api_key)
embedding = GoogleGenerativeAIEmbeddings(model="models/embedding-001", google_api_key=api_key)
# Add allow_dangerous_deserialization=True to explicitly allow loading the pickle file
vectorstore = FAISS.load_local("retriever_index", embedding, allow_dangerous_deserialization=True)
model = genai.GenerativeModel("gemini-2.0-flash")

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/chat")
async def chat(request: Request):
    data = await request.json()
    question = data.get("question", "")

    # Retrieve top 2 relevant FAQ entries
    retrieved_docs = vectorstore.similarity_search(question, k=2)
    context = "\n".join([doc.page_content for doc in retrieved_docs])

    # Ask Gemini with context
    prompt = f"""You are a helpful customer support assistant. Use the following FAQ context to answer the question.

    Context:
    {context}

    Question: {question}
    Answer:"""

    response = model.generate_content(prompt)
    return {"response": response.text}