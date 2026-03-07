"""
Wikipedia Synonym Search

Provides three search modes over the indexed Turkish Wikipedia corpus:
  - synonym : Word2Vec synonym expansion + Elasticsearch multi-match (default)
  - text    : Elasticsearch full-text search with Turkish analyzer
  - vector  : Cosine similarity on article word vectors

Usage (CLI):
    python search.py <query> [--mode synonym|text|vector] [--top 5]

Usage (as a module):
    from search import search, get_synonyms
    results = search("teknoloji", mode="synonym", top_k=10)
    synonyms = get_synonyms("teknoloji", top_n=10)
"""

import argparse
import os

import numpy as np
from dotenv import load_dotenv
from elasticsearch import Elasticsearch
from gensim.models import Word2Vec

load_dotenv()

_MODEL_PATH = os.path.join(os.path.dirname(
    __file__), "model", "gensim_w2v_model.model")
_INDEX = "wikipedia"

es = Elasticsearch(
    hosts=[os.getenv("ELASTIC_URL")],
    basic_auth=(os.getenv("ELASTIC_USERNAME"), os.getenv("ELASTIC_PASSWORD")),
    request_timeout=60,
)

if not es.ping():
    raise ConnectionError("Cannot connect to Elasticsearch. Is it running?")

if not os.path.exists(_MODEL_PATH):
    raise FileNotFoundError(
        f"Word2Vec model not found at {_MODEL_PATH}. Run pipeline/train.py first.")

word_model = Word2Vec.load(_MODEL_PATH)


def _tokens(query):
    """Tokenizes a query string, returns list of known vocabulary words."""
    return [t for t in query.lower().split() if t in word_model.wv]


def get_synonyms(query, top_n=10):
    """
    Returns the top_n semantically similar words to the query using Word2Vec.

    Returns:
        List of (word, similarity_score) tuples, or [] if no vocabulary match.
    """
    seeds = _tokens(query)
    if not seeds:
        return []
    return word_model.wv.most_similar(positive=seeds, topn=top_n)


def _query_vector(query):
    """Converts a query string into an average Word2Vec vector."""
    seeds = _tokens(query)
    if not seeds:
        return np.zeros(word_model.vector_size)
    return np.mean([word_model.wv[w] for w in seeds], axis=0)


def search_by_text(query, top_k=5):
    """Full-text search using Elasticsearch Turkish analyzer."""
    resp = es.search(index=_INDEX, body={
        "size": top_k,
        "query": {
            "multi_match": {
                "query": query,
                "fields": ["title^2", "text"],
            }
        },
        "_source": ["title", "url"],
    })
    return [h["_source"] for h in resp["hits"]["hits"]]


def search_by_vector(query, top_k=5):
    """Semantic search using cosine similarity on article word vectors."""
    vec = _query_vector(query)
    if not np.any(vec):
        return []

    resp = es.search(index=_INDEX, body={
        "size": top_k,
        "query": {
            "script_score": {
                "query": {"match_all": {}},
                "script": {
                    "source": "cosineSimilarity(params.q, 'word_vector') + 1.0",
                    "params": {"q": vec.tolist()},
                },
            }
        },
        "_source": ["title", "url"],
    })
    return [h["_source"] for h in resp["hits"]["hits"]]


def search_by_synonym(query, top_k=5, synonym_count=5):
    """
    Synonym-enhanced search:
    1. Finds semantically similar words via Word2Vec
    2. Expands the query with those synonyms
    3. Runs Elasticsearch multi-match on the expanded query
    """
    synonyms = [w for w, _ in get_synonyms(query, top_n=synonym_count)]
    expanded = " ".join([query] + synonyms)

    resp = es.search(index=_INDEX, body={
        "size": top_k,
        "query": {
            "multi_match": {
                "query": expanded,
                "fields": ["title^2", "text"],
                "type": "best_fields",
            }
        },
        "_source": ["title", "url"],
    })
    return [h["_source"] for h in resp["hits"]["hits"]]


def search(query, mode="synonym", top_k=5):
    """
    Main search entry point.

    Args:
        query:  Search query string.
        mode:   'synonym' (default) | 'text' | 'vector'
        top_k:  Number of results to return.

    Returns:
        List of dicts with 'title' and 'url' keys.
    """
    if mode == "text":
        return search_by_text(query, top_k)
    elif mode == "vector":
        return search_by_vector(query, top_k)
    else:
        return search_by_synonym(query, top_k)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Wikipedia Synonym Search")
    parser.add_argument("query", nargs="+", help="Search query")
    parser.add_argument(
        "--mode", choices=["synonym", "text", "vector"], default="synonym")
    parser.add_argument("--top", type=int, default=5)
    args = parser.parse_args()

    query = " ".join(args.query)

    print(f"\nQuery : '{query}'")
    print(f"Mode  : {args.mode}\n")

    synonyms = get_synonyms(query, top_n=10)
    if synonyms:
        print("Synonyms (Word2Vec):")
        for word, score in synonyms:
            print(f"  {word:<25} {score:.4f}")
    else:
        print("No synonyms found (word not in vocabulary).")

    print("\nResults:")
    results = search(query, mode=args.mode, top_k=args.top)
    if results:
        for i, r in enumerate(results, 1):
            print(f"  {i}. {r['title']}")
            print(f"     {r['url']}")
    else:
        print("  No results found.")
