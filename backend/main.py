from fastapi import FastAPI, Request, HTTPException
import google.generativeai as genai
from langchain_community.vectorstores import FAISS
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain.schema import Document
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware
import os
import json
import httpx
import logging
from typing import List, Dict, Optional

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

# Laravel API configuration
LARAVEL_API_BASE_URL = "http://192.168.5.109:8000/v1"
API_TIMEOUT = 30.0

# Setup Gemini with error handling
try:
    genai.configure(api_key=api_key)
    embedding = GoogleGenerativeAIEmbeddings(model="models/embedding-001", google_api_key=api_key)
    # Check if FAISS index exists
    if os.path.exists("retriever_index"):
        vectorstore = FAISS.load_local("retriever_index", embedding, allow_dangerous_deserialization=True)
        logger.info("FAISS vectorstore loaded successfully")
    else:
        logger.warning("FAISS index not found. Run load_faq.py first.")
        vectorstore = None
    model = genai.GenerativeModel("gemini-2.0-flash")
except Exception as e:
    logger.error(f"AI setup failed: {e}")
    vectorstore = None
    model = None

app = FastAPI(title="AI Customer Support API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API helper functions
async def api_request(endpoint: str, method: str = "GET", params: dict = None) -> dict:
    """Make HTTP request to Laravel API"""
    try:
        async with httpx.AsyncClient(timeout=API_TIMEOUT) as client:
            url = f"{LARAVEL_API_BASE_URL}{endpoint}"
            
            if method == "GET":
                response = await client.get(url, params=params)
            else:
                response = await client.request(method, url, json=params)
            
            response.raise_for_status()
            return response.json()
    except httpx.RequestError as e:
        logger.error(f"API request failed for {endpoint}: {e}")
        return {}
    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error for {endpoint}: {e.response.status_code}")
        return {}
    except Exception as e:
        logger.error(f"Unexpected error for {endpoint}: {e}")
        return {}

async def get_all_products() -> List[Dict]:
    """Get all products from Laravel API"""
    response = await api_request("/products")
    products_data = response.get("data", [])
    
    # Transform API response to match expected format
    products = []
    for product in products_data:
        products.append({
            "id": product.get("id"),
            "name": product.get("name"),
            "description": product.get("description"),
            "price": float(product.get("price", 0)),
            "stock": product.get("stock_quantity", 0),
            "category": product.get("category", {}).get("name") if product.get("category") else None,
            "brand": product.get("brand", {}).get("name") if product.get("brand") else None,
            "availability": "In Stock" if product.get("stock_quantity", 0) > 0 else "Out of Stock",
            "is_active": product.get("is_active", True)
        })
    return products

async def get_product_by_id(product_id: int) -> Dict:
    """Get specific product by ID from Laravel API"""
    response = await api_request(f"/products/{product_id}")
    if not response:
        return {}
    
    product = response
    return {
        "id": product.get("id"),
        "name": product.get("name"),
        "description": product.get("description"),
        "price": float(product.get("price", 0)),
        "stock": product.get("stock_quantity", 0),
        "category": product.get("category", {}).get("name") if product.get("category") else None,
        "brand": product.get("brand", {}).get("name") if product.get("brand") else None,
        "availability": "In Stock" if product.get("stock_quantity", 0) > 0 else "Out of Stock",
        "is_active": product.get("is_active", True)
    }

async def get_product_stock(product_name=None, product_id=None):
    """Search for products by name or get by ID"""
    try:
        if product_id:
            product = await get_product_by_id(product_id)
            return [product] if product else []
        
        if product_name:
            # Get all products and filter by name
            all_products = await get_all_products()
            product_name_lower = product_name.lower()
            
            # Filter products by name similarity
            matching_products = []
            for product in all_products:
                if product.get("name"):
                    name_lower = product["name"].lower()
                    description_lower = (product.get("description") or "").lower()
                    
                    # Exact match gets highest priority
                    if product_name_lower == name_lower:
                        matching_products.insert(0, product)
                    # Partial name match
                    elif product_name_lower in name_lower:
                        matching_products.append(product)
                    # Description match (lower priority)
                    elif product_name_lower in description_lower:
                        matching_products.append(product)
            
            return matching_products[:10]  # Limit to 10 results
        
        return []
    except Exception as e:
        logger.error(f"Error in get_product_stock: {e}")
        return []

async def get_product_recommendations(category=None, brand=None, limit=8):
    """Get product recommendations filtered by category or brand"""
    try:
        all_products = await get_all_products()
        filtered_products = []
        
        for product in all_products:
            # Filter by category if specified
            if category and product.get("category"):
                if category.lower() not in product["category"].lower():
                    continue
            
            # Filter by brand if specified
            if brand and product.get("brand"):
                if brand.lower() not in product["brand"].lower():
                    continue
            
            # Only include active products
            if product.get("is_active", True):
                filtered_products.append(product)
        
        # Sort by stock (descending) then price (ascending)
        filtered_products.sort(key=lambda x: (-x.get("stock", 0), x.get("price", 0)))
        
        return filtered_products[:limit]
    except Exception as e:
        logger.error(f"Error in get_product_recommendations: {e}")
        return []

async def get_categories():
    """Get all categories from Laravel API"""
    try:
        response = await api_request("/categories")
        categories_data = response.get("data", [])
        
        categories = []
        for category in categories_data:
            categories.append({
                "id": category.get("id"),
                "name": category.get("name"),
                "description": category.get("description"),
                "product_count": category.get("products_count", 0),
                "is_active": category.get("is_active", True)
            })
        
        return categories
    except Exception as e:
        logger.error(f"Error in get_categories: {e}")
        return []

async def get_brands():
    """Get all brands from Laravel API"""
    try:
        response = await api_request("/brands")
        brands_data = response.get("data", [])
        
        brands = []
        for brand in brands_data:
            brands.append({
                "id": brand.get("id"),
                "name": brand.get("name"),
                "description": brand.get("description"),
                "product_count": brand.get("products_count", 0),
                "is_active": brand.get("is_active", True)
            })
        
        return brands
    except Exception as e:
        logger.error(f"Error in get_brands: {e}")
        return []

# Health check endpoint
@app.get("/health")
async def health_check():
    """Check system health"""
    status = {
        "api": "healthy",
        "laravel_api": "disconnected",
        "ai_model": "unavailable",
        "vectorstore": "unavailable"
    }
    
    # Test Laravel API connection
    try:
        test_response = await api_request("/products")
        if test_response:
            status["laravel_api"] = "connected"
    except:
        pass
    
    if model:
        status["ai_model"] = "available"
    
    if vectorstore:
        status["vectorstore"] = "available"
    
    return status

# Enhanced categories endpoint
@app.get("/categories")
async def browse_categories():
    try:
        categories = await get_categories()
        return {"categories": categories}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve categories: {str(e)}")

@app.get("/brands")
async def browse_brands():
    try:
        brands = await get_brands()
        return {"brands": brands}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve brands: {str(e)}")

@app.post("/chat")
async def chat(request: Request):
    if not model:
        return {"response": "AI service is currently unavailable. Please try again later."}
    
    try:
        data = await request.json()
        question = data.get("question", "").strip()
        
        if not question:
            return {"response": "Please ask me a question about our products or services."}
        
        # Enhanced intent detection
        intent_prompt = f"""
        Analyze this customer query and extract information:
        Query: "{question}"
        
        Respond with JSON:
        {{
          "intent": "stock_check" | "product_recommendation" | "category_browsing" | "brand_browsing" | "general",
          "product_name": "<specific product name>" | null,
          "category": "<product category>" | null,
          "brand": "<brand name>" | null,
          "confidence": 0.0-1.0
        }}
        
        Guidelines:
        - "stock_check": specific product availability 
        - "product_recommendation": general product suggestions
        - "category_browsing": asking about product categories
        - "brand_browsing": asking about brands
        - "general": FAQ, policies, support questions
        """
        
        try:
            intent_response = model.generate_content(intent_prompt)
            intent_data = json.loads(intent_response.text)
            logger.info(f"Intent detected: {intent_data}")
        except Exception as e:
            logger.error(f"Intent parsing failed: {e}")
            intent_data = {"intent": "general", "confidence": 0.5}
        
        # Gather context based on intent
        db_context = ""
        product_results = []
        categories_list = []
        brands_list = []
        
        if intent_data.get("intent") == "category_browsing":
            categories = await get_categories()
            categories_list = categories
            
            if categories:
                db_context += "\n=== Available Product Categories ===\n"
                for category in categories:
                    desc = f" - {category['description']}" if category.get('description') else ""
                    count = f" ({category['product_count']} products)" if category.get('product_count') else ""
                    db_context += f"• {category['name']}{desc}{count}\n"
            else:
                db_context += "\nNo product categories available.\n"
        
        elif intent_data.get("intent") == "brand_browsing":
            brands = await get_brands()
            brands_list = brands
            
            if brands:
                db_context += "\n=== Available Brands ===\n"
                for brand in brands:
                    desc = f" - {brand['description']}" if brand.get('description') else ""
                    count = f" ({brand['product_count']} products)" if brand.get('product_count') else ""
                    db_context += f"• {brand['name']}{desc}{count}\n"
            else:
                db_context += "\nNo brands available.\n"
        
        elif intent_data.get("intent") == "stock_check":
            if intent_data.get("product_name"):
                product_results = await get_product_stock(product_name=intent_data["product_name"])
            elif intent_data.get("brand"):
                product_results = await get_product_recommendations(brand=intent_data["brand"], limit=10)
            elif intent_data.get("category"):
                product_results = await get_product_recommendations(category=intent_data["category"], limit=10)
            
            if product_results:
                db_context += "\n=== Product Information ===\n"
                for product in product_results:
                    db_context += f"• {product['name']} | ${product['price']:.2f} | {product['availability']} ({product['stock']} units) | {product['category']} | {product['brand']}\n"
        
        elif intent_data.get("intent") == "product_recommendation":
            recommendations = await get_product_recommendations(
                category=intent_data.get("category"),
                brand=intent_data.get("brand"),
                limit=10
            )
            product_results = recommendations
            
            if recommendations:
                db_context += "\n=== Product Recommendations ===\n"
                for product in recommendations:
                    description = product['description'] or "No description"
                    db_context += f"• {product['name']} (${product['price']:.2f}) - {description[:80]}...\n"
        
        # Get FAQ context
        faq_context = ""
        if vectorstore:
            try:
                retrieved_docs = vectorstore.similarity_search(question, k=3)
                faq_context = "\n=== FAQ Information ===\n" + "\n".join([doc.page_content for doc in retrieved_docs])
            except Exception as e:
                logger.error(f"FAQ retrieval failed: {e}")
        
        # Build full context
        context = f"{db_context}\n{faq_context}"
        
        # Enhanced prompt
        prompt = f"""You are ShopBot, an AI customer service assistant for an e-commerce store.

Context Information:
{context}

Customer Question: "{question}"

Response Guidelines:
1. Always prioritize showing actual data from our systems
2. Be specific and helpful with product information
3. If showing categories or brands, use exact names from our database
4. For stock checks, clearly state availability and pricing
5. Keep responses concise but informative
6. If no relevant data is found, acknowledge this and offer alternatives
7. Always maintain a friendly, professional tone

Respond naturally and helpfully based on the available information."""

        response = model.generate_content(prompt)
        return {"response": response.text}
    
    except Exception as e:
        logger.error(f"Chat error: {e}")
        return {"response": "I'm experiencing technical difficulties. Please try again in a moment."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)