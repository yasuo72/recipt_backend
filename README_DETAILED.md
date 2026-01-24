# Hugging Face Space – MedAssist+ RAG Backend

This README deep-dives into the FastAPI “space” (`hf_space/`) that powers the **online** chatbot mode.

## 1. Why a Space?
Hugging Face Spaces give us a free GPU/CPU sandbox with persistent storage – perfect to demo a self-contained Retrieval-Augmented Generation (RAG) stack without external infra.

* ⚡ **Cold-start < 30 s** once warmed.
* 🌐 Public HTTPS URL (CORS-friendly) – consumed by Flutter app.
* 📴 **Offline inside container** – no outbound calls; complies with privacy rules.

---
## 2. Folder Breakdown

| File / Dir | Purpose |
|------------|---------|
| `api.py` | FastAPI app – defines `/chat` and `/passages` POST endpoints. |
| `tinyllama_rag_chatbot.py` | Core pipeline: FAISS retrieval + Flan-T5 Small LoRA generation + rule fallback. |
| `doctor_engine.py` | Lightweight deterministic templater; used when LLM fails or times out. |
| `flan_lora/` | LoRA adapter weights (≈8 MB) – merged at runtime onto base model. |
| `rag_index.faiss` + `rag_meta.pkl` | Vector store + metadata for ~8 k medical passages. |
| `requirements.txt` | Pinned libs (`transformers==4.40`, `faiss-cpu`, `pydantic`). |
| `Dockerfile` *(optional)* | Explicit image build (CPU-only) for local replication. |

---
## 3. API Contract

### `POST /chat`
```json
{
  "question": "What causes itchy red eyes?"
}
→
{
  "answer": "Possible condition: Conjunctivitis…\nThis information is not a medical diagnosis."
}
```

### `POST /passages`
Returns `top_k` (default 5) raw passage texts for UI translucency context cards.

---
## 4. Local Dev

```bash
# In virtualenv
pip install -r requirements.txt
uvicorn api:app --reload --port 7860
```

Set `HF_HOME=.cache/huggingface` to reuse model downloads.

---
## 5. Deployment Notes

HF automatically detects `requirements.txt`; no `Dockerfile` needed. But we include one for reproducible local builds:

```
FROM python:3.11-slim
WORKDIR /code
COPY . .
RUN pip install -r requirements.txt
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "7860"]
```

Push to the Space repo and watch the logs 👀.

---
## 6. Performance & Cost
* **CPU-only** – Flan-T5 Small + LoRA runs at ~13 tokens/s.  
* Memory footprint ~1.1 GB (fits free tier).  
* Retrieval latency ~15 ms for FAISS on 8 k docs.

---
## 7. Safety
Answers end with disclaimer. No PHI leaves container; logs redacted.
