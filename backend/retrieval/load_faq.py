import pandas as pd
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import FAISS
from langchain.text_splitter import CharacterTextSplitter
from langchain.docstore.document import Document
import os
from dotenv import load_dotenv
import csv

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

# File path
faq_file = "backend/data/faq_khmer.csv"  

# First, clean up the CSV file
cleaned_data = {"question": [], "answer": []}

try:
    with open(faq_file, 'r', encoding='utf-8') as file:
        # Skip the first line if it contains the filepath comment
        first_line = file.readline()
        if "filepath:" in first_line:
            # Skip the comment line
            header = file.readline().strip()
        else:
            # Use the first line as header
            header = first_line.strip()
        
        # Continue reading the rest of the file
        for line in file:
            line = line.strip()
            # Skip empty lines
            if not line:
                continue
                
            # Handle the actual data rows
            if "," in line:
                # Find first comma to split question and answer
                split_pos = line.find(',')
                if split_pos > 0:
                    question = line[:split_pos].strip()
                    answer = line[split_pos+1:].strip()
                    cleaned_data["question"].append(question)
                    cleaned_data["answer"].append(answer)
                    
    # Create DataFrame from cleaned data
    df = pd.DataFrame(cleaned_data)
    print(f"Successfully parsed {len(df)} FAQ entries")
    
except Exception as e:
    print(f"Error reading CSV: {e}")
    raise

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

print("FAQ retriever index created successfully!")