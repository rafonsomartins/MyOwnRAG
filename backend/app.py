from fastapi import FastAPI
from sentence_transformers import SentenceTransformer, util
from pydantic import BaseModel
import google.generativeai as genai
from dotenv import load_dotenv
import os
import redis  # Regis added here
from uuid import uuid4
from typing import Optional
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
similarity_gap = 0.15  # Max allowed gap to keep weaker matches

app = FastAPI()

origins = [
	"http://localhost:3000",  # Allow frontend running on localhost:3000
	"https://your-frontend.com",  # Allow production frontend
]

# Add CORS middleware
app.add_middleware(
	CORSMiddleware,
	allow_origins=origins,  # Domains that can access the API
	allow_credentials=True,  # Allow cookies and authentication headers
	allow_methods=["*"],  # Allow all HTTP methods (GET, POST, PUT, DELETE, etc.)
	allow_headers=["*"],  # Allow all headers
)

# Regis: Redis session storage (Replace localhost with your Redis server if needed)
regis = redis.Redis(host="localhost", port=6379, decode_responses=True)

genai.configure(api_key=API_KEY)
model = SentenceTransformer("all-MiniLM-L6-v2")

class QueryRequest(BaseModel):
	session_id: Optional[str] = None
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
	# print("scored_docs:\n\n", scored_docs) # debug
	if not scored_docs:
		return []

	high_conf_docs = [(score, doc) for score, doc in scored_docs if score > threshold]
	low_conf_docs = [(score, doc) for score, doc in scored_docs if secondary_threshold <= score <= threshold]

	if high_conf_docs:
		return [doc["text"] for _, doc in high_conf_docs]

	if low_conf_docs:
		return [low_conf_docs[0][1]["text"]]

	return []

def get_session_history(session_id):
	"""Retrieve session history from Regis (Redis)."""
	history = regis.lrange(f"session:{session_id}", 0, -1)
	return history if history else ["No history yet."]

def save_session_history(session_id, conversation_history):
	"""Save conversation history to Regis (Redis)."""
	regis.delete(f"session:{session_id}")  # Clear previous history
	regis.rpush(f"session:{session_id}", *conversation_history)  # Save new history

def query_gemini(session_id, user_query, related_docs):
	context_text = "\n".join(related_docs)

	# Retrieve session history from Regis (Redis)
	conversation_history = get_session_history(session_id)

	prompt = f"This is some information about Rui: {aboutme}\nThis is a conversation between a recruiter and a Rui's assistent. If the Assistant doesn't know something, instead of making something up, they just reply exactly with: '{LLM_NOT_RELATED}'. The Recruiter doesn't share context directly. Context (Rui wrote this):\n{context_text}\n\n\nHistory:{conversation_history}\n\n\nRecruiter: {user_query}\n\nAssistant:"

	# Append query to session history
	conversation_history.append(f"Recruiter: {user_query}")

	# Add last 5 exchanges (limit context size)
	first_prompt = "\n".join(conversation_history[-5:]) + "\n" + prompt

	try:
		model = genai.GenerativeModel("gemini-2.0-flash")
		print("first_prompt:\n\n", first_prompt)
		response = model.generate_content(first_prompt)
		print("\n\nfirst response:\n\n", response.text) # debug
		if response.text == LLM_NOT_RELATED:
			return NO_INFORMATION
		second_prompt = "Make this more formal and human-like. Rui is not applying to any jobs. Make sure to remove buzzwords\n\n" + response.text
		final_response = model.generate_content(second_prompt)
	except Exception:
		return API_DOWN

	# Store response in history
	conversation_history.append(f"Assistant: {final_response.text}")

	# Save updated session history in Regis (Redis)
	save_session_history(session_id, conversation_history)

	return final_response.text if final_response else NO_INFORMATION

def check_similarity_to_greetings(query_embedding):
	greetings_embedding = model.encode(greetings, convert_to_tensor=True)  # Embedding of the 'greetings' content
	similarity_score = util.cos_sim(query_embedding, greetings_embedding).item()
	# print("similarity_score:\n\n", similarity_score) # debug
	return similarity_score

def check_similarity_to_aboutme(query_embedding):
	aboutme_embedding = model.encode(aboutme, convert_to_tensor=True)  # Embedding of the 'aboutme' content
	similarity_score = util.cos_sim(query_embedding, aboutme_embedding).item()
	# print("similarity_score:\n\n", similarity_score) # debug
	return similarity_score

# API Endpoints
@app.post("/query")
def query_rag(request: QueryRequest):
	session_id = request.session_id or str(uuid4())  # Create a session if none provided

	query_embedding = model.encode(request.query, convert_to_tensor=True)
	related_docs = find_related_documents(query_embedding)

	if not related_docs:
		if check_similarity_to_greetings(query_embedding) >= secondary_threshold:
			return {"session_id": session_id, "response": "Hello! How can I assist you today?"}
		if check_similarity_to_aboutme(query_embedding) < third_threshold:
			return {"session_id": session_id, "response": NO_INFORMATION}
		related_docs = ["No more context yet."]

	# print("context:\n\n", related_docs) # debug

	gemini_response = query_gemini(session_id, request.query, related_docs)

	return {"session_id": session_id, "response": gemini_response}
