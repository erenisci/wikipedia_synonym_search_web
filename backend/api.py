"""
Flask API for Wikipedia Synonym Search.

Wraps search.py and exposes HTTP endpoints for the Next.js frontend.

Usage:
    pip install flask flask-cors
    python api.py

Endpoints:
    GET /health
    GET /search?q=teknoloji&mode=synonym&top=5
    GET /synonyms?q=teknoloji&top=10
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
from search import get_synonyms, search

app = Flask(__name__)
CORS(app)


@app.get("/health")
def health():
    return jsonify({"status": "ok"})


@app.get("/search")
def search_endpoint():
    query = request.args.get("q", "").strip()
    mode = request.args.get("mode", "synonym")
    top = min(int(request.args.get("top", 5)), 20)

    if not query:
        return jsonify({"error": "q parameter is required"}), 400
    if mode not in ("synonym", "text", "vector"):
        return jsonify({"error": "mode must be synonym, text, or vector"}), 400

    synonyms = [{"word": w, "score": round(float(s), 4)}
                for w, s in get_synonyms(query, top_n=10)]
    results = search(query, mode=mode, top_k=top)

    return jsonify({
        "query": query,
        "mode": mode,
        "synonyms": synonyms,
        "results": results,
    })


@app.get("/synonyms")
def synonyms_endpoint():
    query = request.args.get("q", "").strip()
    top = min(int(request.args.get("top", 10)), 50)

    if not query:
        return jsonify({"error": "q parameter is required"}), 400

    synonyms = [{"word": w, "score": round(float(s), 4)}
                for w, s in get_synonyms(query, top_n=top)]

    return jsonify({"query": query, "synonyms": synonyms})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
