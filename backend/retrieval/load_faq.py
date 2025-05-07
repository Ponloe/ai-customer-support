import pandas as pd
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import FAISS
from langchain.text_splitter import CharacterTextSplitter
from langchain.docstore.document import Document
import os
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

# Load FAQ data with error handling
try:
    # Try loading with quoting to handle commas within fields
    df = pd.read_csv("data/faq.csv", quoting=pd.io.common.csv.QUOTE_ALL)
except:
    try:
        # Try loading with manual column names and skipping problematic rows
        df = pd.read_csv("data/faq.csv", on_bad_lines='skip', names=['question', 'answer'])
    except:
        # Fall back to reading as raw text
        with open("data/faq.csv", 'r') as file:
            lines = file.readlines()
            # Skip header
            data = {'question': [], 'answer': []}
            for line in lines[1:]:
                try:
                    parts = line.strip().split(',')
                    if len(parts) >= 2:
                        data['question'].append(parts[0])
                        # Join remaining parts as answer (in case answer contains commas)
                        data['answer'].append(','.join(parts[1:]))
                except:
                    print(f"Skipping problematic line: {line.strip()}")
            df = pd.DataFrame(data)

# Create text documents from DataFrame
texts = [f"Q: {row['question']} A: {row['answer']}" for _, row in df.iterrows()]
documents = [Document(page_content=text) for text in texts]

# Chunk and embed
text_splitter = CharacterTextSplitter(chunk_size=500, chunk_overlap=50)
docs = text_splitter.split_documents(documents)

embeddings = GoogleGenerativeAIEmbeddings(model="models/embedding-001", google_api_key=api_key)
vectorstore = FAISS.from_documents(docs, embeddings)

# Save FAISS index locally
vectorstore.save_local("retriever_index")