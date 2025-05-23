from fastapi import FastAPI, Request, HTTPException
import google.generativeai as genai
from langchain_community.vectorstores import FAISS
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain.schema import Document
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware
import os
import json
from sqlalchemy import create_engine, text

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

# Database connection - updated to match .env file
DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
DB_PORT = os.getenv("DB_PORT", "3306")
DB_USER = os.getenv("DB_USERNAME", "root")  
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_DATABASE", "ecommerce")  

# Create database connection
DATABASE_URL = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
engine = create_engine(DATABASE_URL)

# Setup Gemini
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

# Database helper functions
def get_product_stock(product_name=None, product_id=None):
    """Query database for product stock information"""
    try:
        with engine.connect() as connection:
            if product_name:
                # Search by product name (case-insensitive partial match)
                query = text("""
                    SELECT p.id, p.name, p.description, p.price, p.stock, c.name as category, b.name as brand
                    FROM products p
                    LEFT JOIN categories c ON p.category_id = c.id
                    LEFT JOIN brands b ON p.brand_id = b.id
                    WHERE p.name LIKE :name
                    LIMIT 5
                """)
                result = connection.execute(query, {"name": f"%{product_name}%"})
            elif product_id:
                # Search by exact product ID
                query = text("""
                    SELECT p.id, p.name, p.description, p.price, p.stock, c.name as category, b.name as brand
                    FROM products p
                    LEFT JOIN categories c ON p.category_id = c.id
                    LEFT JOIN brands b ON p.brand_id = b.id
                    WHERE p.id = :id
                """)
                result = connection.execute(query, {"id": product_id})
            else:
                return []
                
            products = []
            for row in result:
                products.append({
                    "id": row.id,
                    "name": row.name,
                    "description": row.description,
                    "price": float(row.price) if row.price else 0.0,
                    "stock": row.stock if row.stock is not None else 0,
                    "category": row.category,
                    "brand": row.brand,
                    "availability": "In Stock" if row.stock > 0 else "Out of Stock"
                })
            return products
    except Exception as e:
        print(f"Database error in get_product_stock: {e}")
        return []

def get_product_recommendations(category=None, brand=None, limit=5):
    """Query database for product recommendations"""
    try:
        with engine.connect() as connection:
            conditions = []
            params = {}
            
            if category:
                conditions.append("c.name LIKE :category")
                params["category"] = f"%{category}%"
                
            if brand:
                conditions.append("b.name LIKE :brand")  
                params["brand"] = f"%{brand}%"
                
            # If no conditions, we'll return top products
            where_clause = " AND ".join(conditions)
            if where_clause:
                where_clause = f"WHERE {where_clause}"
            
            # Use a safer format for the SQL query with text()    
            query = text(f"""
                SELECT p.id, p.name, p.description, p.price, p.stock, c.name as category, b.name as brand
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                LEFT JOIN brands b ON p.brand_id = b.id
                {where_clause}
                ORDER BY p.stock DESC
                LIMIT :limit
            """)
            
            # Add limit parameter
            params["limit"] = limit
            
            result = connection.execute(query, params)
            
            products = []
            for row in result:
                products.append({
                    "id": row.id,
                    "name": row.name,
                    "description": row.description,
                    "price": float(row.price) if row.price else 0.0,
                    "stock": row.stock if row.stock is not None else 0,
                    "category": row.category,
                    "brand": row.brand,
                    "availability": "In Stock" if row.stock > 0 else "Out of Stock"
                })
            return products
    except Exception as e:
        print(f"Database error in get_product_recommendations: {e}")
        return []

def get_categories():
    """Retrieve all product categories from the database"""
    try:
        with engine.connect() as connection:
            query = text("""
                SELECT id, name, description 
                FROM categories 
                ORDER BY name
            """)
            result = connection.execute(query)
            
            categories = []
            for row in result:
                categories.append({
                    "id": row.id,
                    "name": row.name,
                    "description": row.description if hasattr(row, "description") else None
                })
            return categories
    except Exception as e:
        print(f"Database error in get_categories: {e}")
        return []

# new endpoint to retrieve categories
@app.get("/categories")
async def browse_categories():
    try:
        categories = get_categories()
        return {"categories": categories}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve categories: {str(e)}")



@app.post("/chat")
async def chat(request: Request):
    try:
        data = await request.json()
        question = data.get("question", "")
        
        # Process the question to identify intent
        intent_prompt = f"""
        Analyze the following customer query and categorize it:
        Query: {question}
        
        Extract as much product information as possible, including partial matches.
        Respond in JSON format:
        {{
          "intent": "stock_check" | "product_recommendation" | "category_browsing" | "general",
          "product_name": "<extracted product name if applicable>" | null,
          "category": "<extracted category if applicable>" | null,
          "brand": "<extracted brand if applicable>" | null,
          "specifications": ["<any product specs mentioned>"] | []
        }}
        Note: If the user is asking to browse, list, or see product categories, classify as "category_browsing".
        """
        
        intent_response = model.generate_content(intent_prompt)
        try:
            intent_data = json.loads(intent_response.text)
            if "specifications" not in intent_data:
                intent_data["specifications"] = []
        except Exception as e:
            print(f"Error parsing intent response: {e}")
            intent_data = {"intent": "general", "product_name": None, "category": None, "brand": None, "specifications": []}
        
        # Gather context based on intent
        db_context = ""
        product_results = []
        categories_list = []
        
        if intent_data["intent"] == "category_browsing":
            # Retrieve all categories
            categories = get_categories()
            categories_list = categories  
            
            if categories:
                db_context += "\nAvailable Product Categories:\n"
                for category in categories:
                    # Include both name and description in the context
                    category_desc = f" - {category['description']}" if category['description'] else ""
                    db_context += f"- {category['name']}{category_desc}\n"
            else:
                db_context += "\nNo product categories found.\n"
        
        elif intent_data["intent"] == "stock_check":
            # First try with specific product name if available
            if intent_data["product_name"]:
                product_results = get_product_stock(product_name=intent_data["product_name"])
            
            # If no specific product but brand is mentioned, get brand products
            elif intent_data["brand"]:
                product_results = get_product_recommendations(brand=intent_data["brand"], limit=8)
            
            # If no results yet but category is mentioned, get category products
            if not product_results and intent_data["category"]:
                product_results = get_product_recommendations(category=intent_data["category"], limit=8)
            
            if product_results:
                db_context += f"\nProduct Information:\n"
                for product in product_results:
                    db_context += f"- {product['name']}: {product['stock']} units available, Price: ${product['price']:.2f}, {product['availability']}\n"
        
        elif intent_data["intent"] == "product_recommendation":
            recommendations = get_product_recommendations(
                category=intent_data["category"],
                brand=intent_data["brand"],
                limit=8
            )
            product_results = recommendations
            
            if recommendations:
                db_context += f"\nProduct Recommendations:\n"
                for product in recommendations:
                    description = product['description'] or "No description available"
                    db_context += f"- {product['name']} (${product['price']:.2f}): {description[:100]}{'...' if len(description) > 100 else ''}\n"
        
        # Also retrieve relevant FAQ entries
        retrieved_docs = vectorstore.similarity_search(question, k=2)
        faq_context = "\n".join([doc.page_content for doc in retrieved_docs])
        
        # Build the full context
        context = f"{db_context}\n\nFAQ Knowledge Base:\n{faq_context}"

        # Create improved ShopBot prompt with explicit category information
        prompt = f"""You are 'ShopBot', an AI customer service assistant for an e-commerce store.
        You have access to the product database, category listings, and FAQ knowledge.
        
        Use the following context information to answer the customer's question:
        
        {context}
        
        Customer Question: {question}
        
        Response guidelines:
        1. ALWAYS LEAD with actual product or category information when available - show what you have first.
        2. If the customer is asking about product categories, present the EXACT list of available categories from the database.
        3. NEVER make up or invent category names like "Category A, B, C" - only use the actual category names from the database.
        4. When showing categories, include both the name and description when available.
        5. If we have product information matching their query, present it immediately in a helpful way.
        6. Only ask clarifying questions if absolutely necessary AFTER showing what information you already have.
        7. If the customer's query is vague but you have partial matches, show those options instead of asking for clarification.
        8. Be concise, helpful, and friendly.
        
        Products available: {len(product_results)}
        Categories available: {len(categories_list)}
        
        If showing categories, ONLY use these exact category names: {", ".join([cat["name"] for cat in categories_list]) if categories_list else "None available"}
        
        NOTE: YOU CAN BROWSE PRODUCT CATEGORIES. If the user asks to see categories, always show them the full list.
        """

        response = model.generate_content(prompt)
        return {"response": response.text}
    
    except Exception as e:
        error_message = f"Error processing chat: {str(e)}"
        print(error_message)
        return {"response": "Sorry, I encountered an error while processing your request. Please try again."}