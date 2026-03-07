# Wikipedia Synonym Search — Backend

Flask API that wraps the Word2Vec + Elasticsearch search engine for the Next.js frontend.

> **Note:** This project was built as a university course assignment. As a result, the UI labels, in-code comments, and some variable names are in Turkish. The codebase and documentation are otherwise written in English.

## Requirements

- Python 3.10+
- Elasticsearch 8.x running on port 9200
- Trained Word2Vec model files in `model/`

## Setup

```bash
pip install flask flask-cors python-dotenv elasticsearch gensim numpy
```

Configure `.env` (copy from `.env.example`):

```env
ELASTIC_URL=http://localhost:9200
ELASTIC_USERNAME=elastic
ELASTIC_PASSWORD=your_password
```

## Model Files

Place the following files in `model/` (not committed to git):

```
model/gensim_w2v_model.model
model/gensim_w2v_model.model.wv.vectors.npy
model/gensim_w2v_model.model.syn1neg.npy
```

Trained on 30K Turkish Wikipedia articles — skip-gram, vector_size=100, window=5, epochs=10.

> **Note:** The pipeline is currently limited to **30,000 articles** for testing/portfolio purposes. The full Turkish Wikipedia dump (`trwiki-latest-pages-articles-multistream.xml`) contains ~500K+ articles. To index the full dataset, set `limit=None` in `pipeline/xml_processor.py` and re-run all three pipeline steps. Expect significantly longer processing times.

## Running

```bash
python api.py
```

Server starts on `http://localhost:5000`.

## Endpoints

### `GET /health`

```json
{ "status": "ok" }
```

### `GET /search`

| Parameter | Type   | Default   | Description                     |
| --------- | ------ | --------- | ------------------------------- |
| `q`       | string | required  | Search query                    |
| `mode`    | string | `synonym` | `synonym` \| `text` \| `vector` |
| `top`     | int    | `5`       | Number of results (max 20)      |

**Example:**

```
GET /search?q=teknoloji&mode=synonym&top=5
```

**Response:**

```json
{
  "query": "teknoloji",
  "mode": "synonym",
  "synonyms": [
    { "word": "bilişim", "score": 0.8712 },
    { "word": "yazılım", "score": 0.8501 }
  ],
  "results": [
    { "title": "Bilgisayar", "url": "https://tr.wikipedia.org/wiki/Bilgisayar" },
    { "title": "İnternet", "url": "https://tr.wikipedia.org/wiki/İnternet" }
  ]
}
```

### `GET /synonyms`

| Parameter | Type   | Default  | Description                 |
| --------- | ------ | -------- | --------------------------- |
| `q`       | string | required | Query word                  |
| `top`     | int    | `10`     | Number of synonyms (max 50) |

**Response:**

```json
{
  "query": "teknoloji",
  "synonyms": [{ "word": "bilişim", "score": 0.8712 }]
}
```

## Search Modes

| Mode      | Description                                            |
| --------- | ------------------------------------------------------ |
| `synonym` | Word2Vec synonym expansion + Elasticsearch multi-match |
| `text`    | Elasticsearch full-text search with Turkish analyzer   |
| `vector`  | Cosine similarity on article `word_vector` field       |
