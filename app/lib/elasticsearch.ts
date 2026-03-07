import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());

const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:5000';

export type SearchMode = 'synonym' | 'text' | 'vector';

export type Article = {
  title: string;
  url: string;
  text?: string;
};

export type Synonym = {
  word: string;
  score: number;
};

export type SearchResponse = {
  query: string;
  mode: SearchMode;
  synonyms: Synonym[];
  results: Article[];
};

export async function searchArticles(
  query: string,
  mode: SearchMode = 'synonym',
  top: number = 10,
): Promise<SearchResponse> {
  const params = new URLSearchParams({
    q: query,
    mode,
    top: String(top),
  });

  const res = await fetch(`${PYTHON_API_URL}/search?${params.toString()}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Python API hatası (${res.status}): ${err}`);
  }

  return res.json() as Promise<SearchResponse>;
}
