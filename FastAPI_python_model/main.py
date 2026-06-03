from fastapi import FastAPI
from pydantic import BaseModel
import re
from transformers import pipeline
from sentence_transformers import SentenceTransformer, util
import torch

# 1. Initialize FastAPI App
app = FastAPI(title="Smart FAQ Microservice")

# 2. Load Free AI Models at Startup
print("Loading Noise Filter AI...")
classifier = pipeline("zero-shot-classification", model="valhalla/distilbart-mnli-12-1")

print("Loading Search Vector AI...")
search_model = SentenceTransformer('all-MiniLM-L6-v2')

# Mock Database
faq_database = [
    "What is the procedure to apply for an internship NOC?",
    "Can I get a stipend during my college summer internship?",
    "Where do I submit the final internship completion certificate?",
    "How many days does it take to process an academic NOC for higher studies?",
    "What happens if I fail to clear the final semester examinations?"
]
faq_embeddings = search_model.encode(faq_database, convert_to_tensor=True)

class QuestionInput(BaseModel):
    text: str

class SearchInput(BaseModel):
    query: str
    documents: list[str] = None

# ENDPOINT 1: THE NOISE FILTER
@app.post("/api/v1/validate")
def validate_user_question(data: QuestionInput):
    text = data.text.strip()
    if len(text) < 8:
        return {"valid": False, "reason": "Too short to be a valid question."}
    if re.search(r'(.)\1{4,}', text): 
        return {"valid": False, "reason": "Contains repeating gibberish characters."}
    
    labels = ["meaningful question", "gibberish noise junk"]
    ai_result = classifier(text, candidate_labels=labels)
    meaningful_score = ai_result['scores'][ai_result['labels'].index("meaningful question")]
    
    if meaningful_score >= 0.85:
        return {"valid": True, "reason": "Passes safety check."}
    else:
        return {"valid": False, "reason": "AI flagged this as unreadable noise."}

# ENDPOINT 2: SMART INTENT SEARCH (Clean Recommendation Output)
@app.post("/api/v1/search")
def smart_search(data: SearchInput):
    docs = data.documents if data.documents is not None else faq_database
    if not docs:
        return {"recommendations": []}

    # 1. Convert user query & documents to math vectors
    if data.documents is not None:
        doc_embeddings = search_model.encode(docs, convert_to_tensor=True)
    else:
        doc_embeddings = faq_embeddings

    query_embedding = search_model.encode(data.query, convert_to_tensor=True)
    cos_scores = util.cos_sim(query_embedding, doc_embeddings)[0]
    
    # 2. Get top 2 closest matches (or fewer if database size is small)
    k = min(2, len(docs))
    if k == 0:
        return {"recommendations": []}

    top_results = torch.topk(cos_scores, k=k)
    
    recommendations = []
    scores = top_results[0]
    indices = top_results[1]

    # Handle single element tensors
    if k == 1:
        if not hasattr(scores, '__len__') or scores.dim() == 0:
            scores = [scores]
            indices = [indices]

    for score, idx in zip(scores, indices):
        # 3. Internal check: Only recommend if the AI is genuinely confident
        if float(score) >= 0.45:
            # We only append the clean text string, NO raw math scores!
            recommendations.append(docs[int(idx)])
            
    return {"recommendations": recommendations}