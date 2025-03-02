from fastapi import FastAPI
from sentence_transformers import SentenceTransformer, util
from pydantic import BaseModel
import google.generativeai as genai
import os

app = FastAPI()

genai.configure(api_key="#####")
model = SentenceTransformer("all-MiniLM-L6-v2")

DOCS_FOLDER = "docs"

def load_documents():
    documents = []
    for filename in os.listdir(DOCS_FOLDER):
        file_path = os.path.join(DOCS_FOLDER, filename)
        if os.path.isfile(file_path) and filename.endswith(".txt"):  # Adjust for other formats
            with open(file_path, "r", encoding="utf-8") as file:
                content = file.read().strip()
                documents.append({"id": filename, "text": content})
    return documents

documents = load_documents()

doc_embeddings = {
	doc["id"]: model.encode(doc["text"], convert_to_tensor=True) for doc in documents
}

threshold = 0.25
secondary_threshold = 0.2
similarity_gap = 0.15  # Max allowed gap to keep weaker matches

GITHUB = "https://github.com/rafonsomartins"
LINKEDIN = "https://www.linkedin.com/in/rui-afonso-martins"

LINKS = f"Fell free to visit my LinkedIn or Github for more information:\n\nLinkedIn: {LINKEDIN}\n\nGithub: {GITHUB}\n"

NO_INFORMATION = f"Sorry, I coulnd't find information about that.\n{LINKS}"
API_DOWN = f"Sorry, it looks like the model is down.\n{LINKS}"

LLM_NOT_RELATED = "Not related.\n"

class QueryRequest(BaseModel):
	query: str

def filter_by_similarity_gap(scored_docs):
	filtered_docs = []
	for i, (score, doc) in enumerate(scored_docs):
		if i == 0:
			filtered_docs.append((score, doc))
			continue
		prev_score = filtered_docs[-1][0]  # Last included document score
		if prev_score - score <= similarity_gap:
			filtered_docs.append((score, doc))
		else:
			break  # Stop including documents if the gap is exceeded
	return filtered_docs


def find_related_documents(query_embedding):
	scored_docs = [
		(util.cos_sim(query_embedding, doc_embeddings[doc["id"]]).item(), doc)
		for doc in documents
	]
	
	scored_docs.sort(reverse=True, key=lambda x: x[0])
	# print("Sorted documents with scores:", scored_docs)
	
	if not scored_docs:
		return []
	
	high_conf_docs = [(score, doc) for score, doc in scored_docs if score > threshold]
	low_conf_docs = [(score, doc) for score, doc in scored_docs if secondary_threshold <= score <= threshold]
	
	if high_conf_docs:
		filtered_high_conf = filter_by_similarity_gap(high_conf_docs)
		return [doc["text"] for _, doc in filtered_high_conf]
	
	if low_conf_docs:
		filtered_low_conf = filter_by_similarity_gap(low_conf_docs)
		if filtered_low_conf:
			return [filtered_low_conf[0][1]["text"]]  # Return the best weak match
	
	return []


def query_gemini(context_docs, user_query):
	context_text = "\n".join(context_docs)
	prompt = f"Pretend that you are Rui secretary. Don't mention you are being passed a context. If there is no related information in the context just answer with '{LLM_NOT_RELATED}' exactly like this, no extra breakline or anything. Dont' mention you were given context.\n\nContext:\n{context_text}\n\nUser Query: {user_query}\n\n"

	try:
		model = genai.GenerativeModel("gemini-2.0-flash")
		response = model.generate_content(prompt)
	except Exception as e:
		return API_DOWN

	if response.text == LLM_NOT_RELATED:
		return NO_INFORMATION
	return response.text if response else NO_INFORMATION

@app.post("/query")
def query_rag(request: QueryRequest):
	query_embedding = model.encode(request.query, convert_to_tensor=True)
	related_docs = find_related_documents(query_embedding)

	if not related_docs:
		return NO_INFORMATION

	gemini_response = query_gemini(related_docs, request.query)
	
	return gemini_response
