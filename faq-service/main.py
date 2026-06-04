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
    {"question": "How do I create a feature branch in Git?", "answer": "Use git checkout -b branch-name.", "phase": "bronze"},
    {"question": "How do I lock package versions?", "answer": "Run pip freeze > requirements.txt.", "phase": "bronze"},
    {"question": "How do I deploy an API to AWS EC2?", "answer": "Set up a Docker container and expose port 8000.", "phase": "silver"},
    {"question": "How do I set up a CI/CD pipeline?", "answer": "Use GitHub Actions with workflow YAML files.", "phase": "gold"}
]

# FIX: Extract only the text questions for the AI to calculate math vectors
faq_embeddings = search_model.encode([faq["question"] for faq in faq_database], convert_to_tensor=True)

class QuestionInput(BaseModel):
    text: str

class SearchInput(BaseModel):
    query: str
    phase: str # Accepts "bronze", "silver", or "gold"

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
    # 1. Map Phase: Find all indices matching the selected phase
    valid_indices = [
        i for i, faq in enumerate(faq_database) 
        if faq.get("phase", "").lower() == data.phase.lower()
    ]
    
    # Safety Check: If your database doesn't have any questions for this phase yet
    if not valid_indices:
        return {"recommendations": [], "message": f"No questions found for the {data.phase} phase."}
    
    # 2. Convert user query to math vectors
    query_embedding = search_model.encode(data.query, convert_to_tensor=True)
    
    # FIX: Slice your main math vectors tensor to ONLY include this phase's vectors
    filtered_embeddings = faq_embeddings[valid_indices]
    
    # 3. Calculate similarity against ONLY the filtered vectors
    cos_scores = util.cos_sim(query_embedding, filtered_embeddings)[0]
    
    # 4. Get closest matches dynamically based on how many items exist in this phase
    k_value = min(2, len(valid_indices))
    top_results = torch.topk(cos_scores, k=k_value)
    
    recommendations = []
    for score, local_idx in zip(top_results[0], top_results[1]):
        # 5. Internal check: Only recommend if the AI is genuinely confident
        if float(score) >= 0.45:
            
            # 6. Index Mapping 
            # Maps the local position back to its true global index position in faq_database
            global_idx = valid_indices[int(local_idx)]
            recommendations.append(faq_database[global_idx])
            
    return {"recommendations": recommendations}