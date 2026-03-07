# Model

Trained Word2Vec model files for the Wikipedia synonym search pipeline.

## Files (all 3 required — do NOT delete)

- `gensim_w2v_model.model` — main Gensim model file (load this one)
- `gensim_w2v_model.model.wv.vectors.npy` — word vectors (numpy array)
- `gensim_w2v_model.model.syn1neg.npy` — negative sampling weights

## Training config

| Parameter   | Value                          |
| ----------- | ------------------------------ |
| Algorithm   | skip-gram (sg=1)               |
| vector_size | 100                            |
| window      | 5                              |
| min_count   | 5                              |
| workers     | 4                              |
| epochs      | 10                             |
| corpus      | 30K Turkish Wikipedia articles |

## Retrain

```bash
python pipeline/train.py
```
