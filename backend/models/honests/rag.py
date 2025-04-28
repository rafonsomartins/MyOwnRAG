from fastapi import FastAPI
from sentence_transformers import SentenceTransformer, util
from pydantic import BaseModel
import google.generativeai as genai
from dotenv import load_dotenv
import os
import redis
from typing import List, Dict, Optional
from fastapi.middleware.cors import CORSMiddleware

DOCS_FOLDER = "docs"

GITHUB = "https://github.com/rafonsomartins"
LINKEDIN = "https://linkedin.com/in/rui-afonso-martins"

LINKS = f"Fell free to visit my {LINKEDIN} or {GITHUB} for more information.\n"

NO_INFORMATION = f"Sorry, I coulnd't find information about that.\n{LINKS}"
API_DOWN = f"Sorry, it looks like the model is down. Please try again later.\n{LINKS}"

LLM_NOT_RELATED = "Not related.\n"

load_dotenv()
API_KEY = os.getenv("GEMINI_API_KEY")

# Define similarity thresholds
threshold = 0.25
secondary_threshold = 0.2
third_threshold = 0.15

app = FastAPI()

origins = [
    "http://localhost:3000",  # Allow frontend running on localhost:3000
    "https://your-frontend.com",  # Allow production frontend
]

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Redis session storage
redis_client = redis.Redis(host="localhost", port=6379, decode_responses=True)

genai.configure(api_key=API_KEY)
model = SentenceTransformer("all-MiniLM-L6-v2")

# Modified to match frontend request format
class MessageFormat(BaseModel):
    role: str
    content: str

class QueryRequest(BaseModel):
    history: List[MessageFormat]
    query: str

# Load documents
def load_documents():
    documents = []
    for filename in os.listdir(DOCS_FOLDER):
        file_path = os.path.join(DOCS_FOLDER, filename)
        if os.path.isfile(file_path) and filename.endswith(".txt"):
            with open(file_path, "r", encoding="utf-8") as file:
                content = file.read().strip()
                documents.append({"id": filename, "text": content})
    return documents

documents = load_documents()
doc_embeddings = {doc["id"]: model.encode(doc["text"], convert_to_tensor=True) for doc in documents}

with open(os.path.join(DOCS_FOLDER, "aboutme"), "r", encoding="utf-8") as file:
    aboutme = file.read().strip()

with open(os.path.join(DOCS_FOLDER, "greetings"), "r", encoding="utf-8") as file:
    greetings = file.read().strip()

# Helper functions
def find_related_documents(query_embedding):  
    scored_docs = [
        (util.cos_sim(query_embedding, doc_embeddings[doc["id"]]).item(), doc)
        for doc in documents
    ]
    scored_docs.sort(reverse=True, key=lambda x: x[0])
    
    if not scored_docs:
        return []

    high_conf_docs = [(score, doc) for score, doc in scored_docs if score > threshold]
    low_conf_docs = [(score, doc) for score, doc in scored_docs if secondary_threshold <= score <= threshold]

    if high_conf_docs:
        return [doc["text"] for _, doc in high_conf_docs]

    if low_conf_docs:
        return [low_conf_docs[0][1]["text"]]

    return []

def check_similarity_to_greetings(query_embedding):
    greetings_embedding = model.encode(greetings, convert_to_tensor=True)
    similarity_score = util.cos_sim(query_embedding, greetings_embedding).item()
    return similarity_score

def check_similarity_to_aboutme(query_embedding):
    aboutme_embedding = model.encode(aboutme, convert_to_tensor=True)
    similarity_score = util.cos_sim(query_embedding, aboutme_embedding).item()
    return similarity_score

def format_conversation_history(history):
    """Format the conversation history for the prompt"""
    formatted_history = []
    for msg in history:
        role = "Recruiter" if msg["role"] == "user" else "Assistant"
        formatted_history.append(f"{role}: {msg['content']}")
    return "\n".join(formatted_history)

def query_gemini(conversation_history, user_query, related_docs):
    context_text = "\n".join(related_docs)
    
    # Format the conversation history for the prompt
    history_text = format_conversation_history(conversation_history)
    
    prompt = f"""This is some information about Rui: {aboutme}
This is a conversation between a recruiter and Rui's assistant. If the Assistant doesn't know something, instead of making something up, they just reply exactly with: '{LLM_NOT_RELATED}'. The Recruiter doesn't share context directly.

Context (Rui wrote this):
{context_text}

History:
{history_text}

Recruiter: {user_query}"""