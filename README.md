# Wikipedia Synonym Search

A semantic search engine built on top of the Turkish Wikipedia corpus. The project combines Word2Vec embeddings, Elasticsearch, and a Next.js frontend to let users search Wikipedia articles using natural language — including synonym-aware and vector-based search modes.

> **Note:** This project was built as a university course assignment. As a result, the UI labels, in-code comments, and some variable names are in Turkish. The codebase and documentation are otherwise written in English.

---

## Repositories

This project is split across two repositories:

| Repository                                                                                   | Description                                                                                                               |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **[wikipedia_synonym_search](https://github.com/erenisci/wikipedia_synonym_search)**         | Data pipeline — parses the Turkish Wikipedia XML dump, trains the Word2Vec model, and indexes articles into Elasticsearch |
| **[wikipedia_synonym_search_web](https://github.com/erenisci/wikipedia_synonym_search_web)** | This repo — Next.js frontend + Flask API that serves search results to the browser                                        |

The pipeline repo must be run first to produce the trained model and Elasticsearch index that this web app depends on.

---

## What It Does

Most search engines match keywords exactly. This project goes further: when you search for _teknoloji_, the engine also finds articles related to _bilişim_, _yazılım_, and _mühendislik_ — because Word2Vec knows these words appear in similar contexts across 30,000 Turkish Wikipedia articles.

Three search modes are available:

| Mode          | How It Works                                                                                                                                 |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Synonym**   | Expands your query with semantically similar words from Word2Vec, then runs an Elasticsearch multi-match search across title and text fields |
| **Full-text** | Standard Elasticsearch full-text search with a Turkish language analyzer (stop words + Snowball stemmer)                                     |
| **Vector**    | Converts your query into a word vector and finds articles whose average word vector is closest via cosine similarity                         |

When you click a result, the article summary is fetched live from the Turkish Wikipedia REST API and displayed in the right panel — with your search terms and synonyms highlighted in different colors.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                              │
│              Next.js Frontend (port 3000)                   │
│   ┌──────────────────┐        ┌────────────────────────┐    │
│   │   Left Panel     │        │      Right Panel       │    │
│   │  · Mode selector │        │  · Article title       │    │
│   │  · Search bar    │   →    │  · Short description   │    │
│   │  · Synonym tags  │        │  · Full summary text   │    │
│   │  · Result list   │        │  · Highlighted terms   │    │
│   └──────────────────┘        └────────────────────────┘    │
└────────────────┬────────────────────────┬───────────────────┘
                 │ POST /api/search        │ GET Wikipedia REST API
                 ▼                         ▼
     ┌───────────────────┐     ┌─────────────────────────┐
     │  Flask Backend    │     │  tr.wikipedia.org       │
     │  (port 5000)      │     │  /api/rest_v1/page/     │
     │  · search.py      │     │   summary/{title}       │
     │  · Word2Vec model │     └─────────────────────────┘
     └────────┬──────────┘
              │
     ┌────────▼──────────┐
     │   Elasticsearch   │
     │   (port 9200)     │
     │   30K TR articles │
     │   + word vectors  │
     └───────────────────┘
```

The Next.js frontend never talks to Elasticsearch directly. It sends requests to its own `/api/search` route, which proxies them to the Flask backend. The Flask backend handles Word2Vec synonym expansion and Elasticsearch queries.

---

## Tech Stack

**Frontend**

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS

**Backend**

- Python + Flask
- Gensim Word2Vec (skip-gram, 100-dimensional vectors, trained on 30K articles)
- Elasticsearch 8.x with Turkish language analyzer
- MongoDB (article storage during the pipeline phase)

---

## Project Structure

```
wikipedia_synonym_search_web/
├── app/
│   ├── api/search/route.ts       # Next.js API route — proxies requests to Flask
│   ├── components/SearchPage.tsx # Main UI: search bar, results, article panel
│   ├── lib/elasticsearch.ts      # HTTP client for the Flask backend
│   ├── _styles/globals.css       # Global styles + custom scrollbar
│   ├── layout.tsx                # HTML shell
│   └── page.tsx                  # Entry point with Suspense boundary
├── backend/
│   ├── api.py                    # Flask server exposing /search, /synonyms, /health
│   ├── search.py                 # Core search logic: Word2Vec + Elasticsearch queries
│   ├── model/                    # Trained Word2Vec model files (not committed to git)
│   ├── .env                      # Elasticsearch credentials
│   └── README.md                 # Backend-specific setup and API docs
├── .env                          # Frontend environment (API URL)
└── README.md
```

---

## How the Search Pipeline Was Built

The data pipeline lives in the separate **wikipedia_synonym_search** repository (see Repositories above). It ran three steps before this web app was built:

### Step 1 — Ingest

Parsed the Turkish Wikipedia XML dump (`trwiki-latest-pages-articles-multistream.xml`) with `xml.etree.ElementTree`. Cleaned article text (removed templates, HTML, wiki markup, URLs) and stored 30,000 articles in MongoDB.

### Step 2 — Train

Fetched articles from MongoDB, preprocessed tokens (punctuation removal, stop word filtering, Turkish Snowball stemming), and trained a skip-gram Word2Vec model with Gensim:

- `vector_size = 100`
- `window = 5`
- `min_count = 5`
- `epochs = 10`
- `sg = 1` (skip-gram)

### Step 3 — Index

Indexed all articles into Elasticsearch. Each document has:

- `title` — analyzed with a Turkish language analyzer (stop words + Snowball stemmer)
- `text` — same analyzer
- `word_vector` — 100-dimensional dense vector (average Word2Vec vector of all tokens in the article), enabling cosine similarity search via `script_score`

> **Note:** The pipeline is currently limited to **30,000 articles** for testing/portfolio purposes. The full Turkish Wikipedia dump contains ~500K+ articles. To index the full dataset, set `limit=None` in `pipeline/xml_processor.py` and re-run all three pipeline steps. Expect significantly longer processing times.

---

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.10+
- Elasticsearch 8.x
- MongoDB
- Trained Word2Vec model files (produced by the pipeline repo — see `backend/README.md` and the Repositories section above)

### 1. Run the Pipeline

If you haven't already, follow the setup instructions in the **wikipedia_synonym_search** repo to ingest, train, and index the Wikipedia corpus. This produces:

- The trained model files that go into `backend/model/`
- The `wikipedia` index in Elasticsearch

### 2. Start Required Services

| Service       | Port  | Command                                |
| ------------- | ----- | -------------------------------------- |
| MongoDB       | 27017 | Runs as a Windows service (auto-start) |
| Elasticsearch | 9200  | `net start elasticsearch-service-x64`  |

### 3. Start the Backend

```bash
cd backend
pip install flask flask-cors python-dotenv elasticsearch gensim numpy
python api.py
```

The Flask server starts on `http://localhost:5000`.

### 4. Start the Frontend

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

---

## Environment Variables

**`.env`** (frontend root):

```env
PYTHON_API_URL=http://localhost:5000
```

**`backend/.env`**:

```env
MONGO_URL=mongodb://localhost:27017
ELASTIC_URL=http://localhost:9200
ELASTIC_USERNAME=elastic
ELASTIC_PASSWORD=your_password
```

---

## API Reference

The Flask backend exposes three endpoints.

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

Returns semantically similar words from the Word2Vec model.

| Parameter | Type   | Default  | Description                 |
| --------- | ------ | -------- | --------------------------- |
| `q`       | string | required | Query word                  |
| `top`     | int    | `10`     | Number of synonyms (max 50) |

**Example:**

```
GET /synonyms?q=teknoloji&top=10
```

**Response:**

```json
{
  "query": "teknoloji",
  "synonyms": [
    { "word": "bilişim", "score": 0.8712 },
    { "word": "yazılım", "score": 0.8501 }
  ]
}
```

### `GET /health`

```json
{ "status": "ok" }
```

---

## Search Modes — Technical Detail

### Synonym mode

```
query → Word2Vec.most_similar() → [synonym1, synonym2, ...]
                                          ↓
expanded_query = "query synonym1 synonym2 ..."
                                          ↓
Elasticsearch multi_match (best_fields) on title^2 + text
```

### Full-text mode

```
query → Elasticsearch multi_match on title^2 + text
        (Turkish analyzer: stop words + Snowball stemmer)
```

### Vector mode

```
query tokens → Word2Vec vectors → mean vector
                                       ↓
Elasticsearch script_score: cosineSimilarity(query_vec, 'word_vector') + 1.0
```
