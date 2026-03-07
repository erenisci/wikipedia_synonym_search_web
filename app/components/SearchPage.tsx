'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

type SearchMode = 'synonym' | 'text' | 'vector';

type Synonym = {
  word: string;
  score: number;
};

type SearchResult = {
  title: string;
  url: string;
};

type WikiSummary = {
  extract: string;
  description?: string;
};

const RESULTS_PER_PAGE = 10;

function getModeLabel(mode: SearchMode) {
  if (mode === 'synonym') return 'Eş Anlamlı';
  if (mode === 'text') return 'Tam Metin';
  return 'Vektör';
}

function getModeColor(mode: SearchMode) {
  if (mode === 'synonym') return 'text-purple-400';
  if (mode === 'text') return 'text-green-400';
  return 'text-orange-400';
}

type HighlightType = 'query' | 'synonym' | 'none';

function buildHighlightedParts(
  text: string,
  queryWords: string[],
  synonymWords: string[],
): { text: string; type: HighlightType }[] {
  const escape = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const allTerms: { word: string; type: HighlightType }[] = [
    ...queryWords.map(w => ({ word: w, type: 'query' as HighlightType })),
    ...synonymWords.map(w => ({ word: w, type: 'synonym' as HighlightType })),
  ];

  if (allTerms.length === 0) return [{ text, type: 'none' }];

  // Her pozisyona hangi type'ın eşleştiğini bul
  const hits: { start: number; end: number; type: HighlightType }[] = [];

  for (const { word, type } of allTerms) {
    const regex = new RegExp(`(${escape(word)})`, 'gi');
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      hits.push({ start: match.index, end: match.index + match[0].length, type });
    }
  }

  if (hits.length === 0) return [{ text, type: 'none' }];

  // Çakışmaları çöz: önce query, sonra synonym öncelikli
  hits.sort((a, b) => a.start - b.start || (a.type === 'query' ? -1 : 1));

  const parts: { text: string; type: HighlightType }[] = [];
  let cursor = 0;

  for (const hit of hits) {
    if (hit.start < cursor) continue; // çakışma — atla
    if (hit.start > cursor) {
      parts.push({ text: text.slice(cursor, hit.start), type: 'none' });
    }
    parts.push({ text: text.slice(hit.start, hit.end), type: hit.type });
    cursor = hit.end;
  }

  if (cursor < text.length) {
    parts.push({ text: text.slice(cursor), type: 'none' });
  }

  return parts;
}

function HighlightedText({
  text,
  queryWords,
  synonymWords,
}: {
  text: string;
  queryWords: string[];
  synonymWords: string[];
}) {
  const parts = buildHighlightedParts(text, queryWords, synonymWords);
  return (
    <span>
      {parts.map((part, i) => {
        if (part.type === 'query') {
          return (
            <span
              key={i}
              className='text-orange-300 font-semibold'
            >
              {part.text}
            </span>
          );
        }
        if (part.type === 'synonym') {
          return (
            <span
              key={i}
              className='text-blue-300 font-semibold'
            >
              {part.text}
            </span>
          );
        }
        return <span key={i}>{part.text}</span>;
      })}
    </span>
  );
}

async function fetchWikiSummary(title: string): Promise<WikiSummary | null> {
  try {
    const encoded = encodeURIComponent(title.replace(/ /g, '_'));
    const res = await fetch(`https://tr.wikipedia.org/api/rest_v1/page/summary/${encoded}`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      extract: data.extract || '',
      description: data.description || '',
    };
  } catch {
    return null;
  }
}

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlQuery = searchParams.get('query') || '';
  const urlMode = (searchParams.get('mode') as SearchMode) || 'synonym';
  const currentPage = parseInt(searchParams.get('page') || '1', 10);

  const [inputValue, setInputValue] = useState(urlQuery);
  const [mode, setMode] = useState<SearchMode>(urlMode);
  const [focused, setFocused] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [synonyms, setSynonyms] = useState<Synonym[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(!!urlQuery);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [wikiSummary, setWikiSummary] = useState<WikiSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (urlQuery.trim()) {
      setInputValue(urlQuery);
      setMode(urlMode);
      performSearch(urlQuery, urlMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function performSearch(q: string, m: SearchMode) {
    setLoading(true);
    setErrorMsg('');
    setSelectedResult(null);
    setWikiSummary(null);

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, top: 20, mode: m }),
      });

      if (!res.ok) {
        const err = await res.json();
        setErrorMsg(err.error || 'Arama başarısız oldu.');
        setSearchResults([]);
        setSynonyms([]);
        return;
      }

      const data = await res.json();
      setSearchResults(data.results || []);
      setSynonyms(data.synonyms || []);
    } catch {
      setErrorMsg("Python API'ye bağlanılamadı. Servisin çalıştığından emin olun.");
      setSearchResults([]);
      setSynonyms([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleResultClick(result: SearchResult) {
    setSelectedResult(result);
    setWikiSummary(null);
    setSummaryLoading(true);
    const summary = await fetchWikiSummary(result.title);
    setWikiSummary(summary);
    setSummaryLoading(false);
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    setHasSearched(true);
    router.push(`?query=${encodeURIComponent(inputValue.trim())}&mode=${mode}&page=1`);
    await performSearch(inputValue.trim(), mode);
  };

  const totalPages = Math.ceil(searchResults.length / RESULTS_PER_PAGE);

  const paginatedResults = searchResults.slice(
    (currentPage - 1) * RESULTS_PER_PAGE,
    currentPage * RESULTS_PER_PAGE,
  );

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      router.push(`?query=${encodeURIComponent(urlQuery)}&mode=${mode}&page=${page}`);
      setSelectedResult(null);
      setWikiSummary(null);
    }
  };

  const generatePageNumbers = (): (number | 'dots')[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | 'dots')[] = [1];
    if (currentPage > 3) pages.push('dots');
    for (
      let i = Math.max(2, currentPage - 1);
      i <= Math.min(totalPages - 1, currentPage + 1);
      i++
    ) {
      pages.push(i);
    }
    if (currentPage < totalPages - 2) pages.push('dots');
    pages.push(totalPages);
    return pages;
  };

  const truncateTitle = (title: string) => (title.length > 40 ? title.slice(0, 40) + '...' : title);

  if (!hasSearched) {
    return (
      <div className='flex flex-col items-center justify-center h-screen gap-8'>
        {/* Başlık */}
        <div className='text-center'>
          <h1 className='text-4xl font-bold text-white tracking-tight'>
            Wikipedia <span className='text-blue-400'>Synonym</span> Search
          </h1>
          <p className='text-gray-400 mt-2 text-sm'>Türkçe Wikipedia üzerinde anlamsal arama</p>
        </div>

        {/* Mod Seçici */}
        <div className='flex gap-2'>
          {(['synonym', 'text', 'vector'] as SearchMode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-4 py-1.5 text-xs rounded-full font-semibold transition-colors ${
                mode === m
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {getModeLabel(m)}
            </button>
          ))}
        </div>

        {/* Arama Çubuğu */}
        <form
          onSubmit={handleSearch}
          className={`flex items-center rounded-xl w-full max-w-lg transition-all duration-300 ${
            focused ? 'shadow-[0_0_20px_5px_rgba(59,130,246,0.3)]' : ''
          }`}
        >
          <input
            type='text'
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            placeholder='Aramak istediğiniz kelimeyi girin...'
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            autoFocus
            className='w-full px-4 py-3 bg-gray-200 text-gray-800 focus:outline-none rounded-l-xl text-sm font-semibold'
          />
          <button
            type='submit'
            className='px-4 py-3 bg-gray-700 text-gray-200 rounded-r-xl hover:bg-blue-600 focus:outline-none transition-colors'
          >
            <svg
              xmlns='http://www.w3.org/2000/svg'
              fill='none'
              viewBox='0 0 24 24'
              strokeWidth='1.5'
              stroke='currentColor'
              className='w-5 h-5'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                d='m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z'
              />
            </svg>
          </button>
        </form>

        {/* Mod açıklamaları */}
        <div className='flex gap-6 text-xs text-gray-500'>
          <span>
            <span className='text-purple-400 font-semibold'>Eş Anlamlı</span> — Word2Vec ile
            genişletilmiş arama
          </span>
          <span>
            <span className='text-green-400 font-semibold'>Tam Metin</span> — Türkçe analizörlü ES
            araması
          </span>
          <span>
            <span className='text-orange-400 font-semibold'>Vektör</span> — Cosine similarity
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className='flex h-screen justify-center items-center gap-6 px-4'>
      {/* Sol Panel */}
      <div className='flex-1 bg-gray-900 p-4 min-w-[25rem] max-w-[25rem]'>
        {/* Mod Seçici */}
        <div className='flex gap-1 mb-3'>
          {(['synonym', 'text', 'vector'] as SearchMode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-1 text-xs rounded-md font-semibold transition-colors ${
                mode === m
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {getModeLabel(m)}
            </button>
          ))}
        </div>

        {/* Arama Çubuğu */}
        <form
          onSubmit={handleSearch}
          className={`flex items-center rounded-lg transition-all duration-300 ${
            focused ? 'shadow-[0_0_10px_3px_rgba(59,130,246,0.4)]' : ''
          }`}
        >
          <input
            type='text'
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            placeholder='Ara...'
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            className='w-full p-2 bg-gray-200 text-gray-800 focus:outline-none rounded-l-md text-sm font-semibold'
          />
          <button
            type='submit'
            className='p-2 bg-gray-700 text-gray-200 rounded-r-md hover:bg-blue-600 focus:outline-none transition-colors'
          >
            <svg
              xmlns='http://www.w3.org/2000/svg'
              fill='none'
              viewBox='0 0 24 24'
              strokeWidth='1.5'
              stroke='currentColor'
              className='w-5 h-5'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                d='m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z'
              />
            </svg>
          </button>
        </form>

        {/* Yükleniyor */}
        {loading && (
          <div className='mt-4 text-center text-gray-400'>
            <div className='w-7 h-7 border-4 border-t-transparent border-gray-300 rounded-full animate-spin mx-auto' />
            <p className='mt-2 text-sm'>Aranıyor...</p>
          </div>
        )}

        {/* Hata */}
        {!loading && errorMsg && (
          <p className='mt-4 text-red-400 text-sm text-center'>{errorMsg}</p>
        )}

        {/* Eş Anlamlılar */}
        {!loading && mode === 'synonym' && synonyms.length > 0 && (
          <div className='mt-3 px-1'>
            <p className='text-xs text-gray-500 mb-1 font-semibold uppercase tracking-wide'>
              Eş Anlamlılar
            </p>
            <div className='flex flex-wrap gap-1'>
              {synonyms.map((s, i) => (
                <span
                  key={i}
                  title={`Benzerlik: ${s.score}`}
                  className='text-xs bg-gray-700 text-blue-300 px-2 py-0.5 rounded-full cursor-default'
                >
                  {s.word}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Sonuç Listesi */}
        {!loading && paginatedResults.length > 0 && (
          <div className='mt-3'>
            {paginatedResults.map((result, index) => (
              <div
                key={index}
                onClick={() => handleResultClick(result)}
                className={`block px-3 py-2 border-b border-gray-700 cursor-pointer font-semibold text-sm transition-colors ${
                  index === 0 ? 'rounded-t-lg' : ''
                } ${index === paginatedResults.length - 1 ? 'rounded-b-lg' : ''} ${
                  selectedResult?.url === result.url
                    ? 'bg-blue-200 text-gray-800'
                    : 'bg-gray-200 text-gray-800 hover:bg-blue-100'
                }`}
              >
                {truncateTitle(result.title)}
              </div>
            ))}

            {/* Sayfalama */}
            {totalPages > 1 && (
              <div className='flex justify-center items-center mt-3 space-x-1'>
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className='px-2 py-1 rounded-md bg-gray-700 text-gray-300 text-xs disabled:opacity-30 hover:bg-gray-600'
                >
                  ‹
                </button>
                {generatePageNumbers().map((p, i) =>
                  p === 'dots' ? (
                    <span
                      key={`dots-${i}`}
                      className='px-1 text-gray-400 text-xs'
                    >
                      ...
                    </span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => handlePageChange(p)}
                      className={`px-2 py-1 rounded-md text-xs font-semibold ${
                        currentPage === p
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-400'
                      }`}
                    >
                      {p}
                    </button>
                  ),
                )}
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className='px-2 py-1 rounded-md bg-gray-700 text-gray-300 text-xs disabled:opacity-30 hover:bg-gray-600'
                >
                  ›
                </button>
              </div>
            )}

            <p className='text-center text-xs text-gray-500 mt-2'>
              {searchResults.length} sonuç · {getModeLabel(mode)} modu
            </p>
          </div>
        )}

        {/* Sonuç Yok */}
        {!loading && !errorMsg && searchResults.length === 0 && urlQuery && (
          <p className='mt-4 text-gray-500 text-sm text-center'>
            &quot;{urlQuery}&quot; için sonuç bulunamadı.
          </p>
        )}
      </div>

      {/* Sağ Panel */}
      {selectedResult && (
        <div className='bg-gray-800 flex flex-col text-white overflow-hidden max-w-[44rem] min-w-[44rem] rounded-lg min-h-[38rem] max-h-[38rem]'>
          {/* Header */}
          <div className='flex items-start justify-between px-6 py-4 border-b border-gray-700'>
            <div className='flex-1 min-w-0'>
              <h1 className='text-xl text-white font-bold leading-snug truncate'>
                {selectedResult.title}
              </h1>
              {wikiSummary?.description && (
                <p className='text-xs text-gray-400 mt-0.5'>{wikiSummary.description}</p>
              )}
            </div>
            <div className='flex items-center gap-3 ml-4 shrink-0'>
              {/* Mod Etiketi */}
              <span
                className={`text-xs font-semibold uppercase tracking-wide ${getModeColor(urlMode)}`}
              >
                {getModeLabel(urlMode)}
              </span>
              {/* Wikipedia Link */}
              <a
                href={selectedResult.url}
                target='_blank'
                rel='noopener noreferrer'
                className='flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs transition-colors'
              >
                <span>Wikipedia</span>
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  fill='none'
                  viewBox='0 0 24 24'
                  strokeWidth={1.5}
                  stroke='currentColor'
                  className='w-3.5 h-3.5'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    d='m4.5 19.5 15-15m0 0H8.25m11.25 0v11.25'
                  />
                </svg>
              </a>
            </div>
          </div>

          {/* İçerik */}
          <div className='overflow-y-auto custom-scrollbar flex-1 px-6 py-4'>
            {summaryLoading ? (
              <div className='flex items-center justify-center h-full gap-3 text-gray-500'>
                <div className='w-5 h-5 border-2 border-t-transparent border-gray-400 rounded-full animate-spin' />
                <span className='text-sm'>Yükleniyor...</span>
              </div>
            ) : wikiSummary?.extract ? (
              <>
                {/* Özet paragrafları */}
                {wikiSummary.extract
                  .split('\n')
                  .filter(p => p.trim())
                  .map((paragraph, i) => (
                    <p
                      key={i}
                      className='text-gray-200 text-sm leading-relaxed mb-4'
                    >
                      <HighlightedText
                        text={paragraph}
                        queryWords={urlQuery.trim().split(/\s+/).filter(Boolean)}
                        synonymWords={urlMode === 'synonym' ? synonyms.map(s => s.word) : []}
                      />
                    </p>
                  ))}
              </>
            ) : (
              <div className='flex flex-col items-center justify-center h-full gap-2 text-gray-500'>
                <p className='text-sm'>Özet bulunamadı.</p>
                <a
                  href={selectedResult.url}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-blue-400 hover:text-blue-300 text-xs underline'
                >
                  Makaleyi Wikipedia&apos;da görüntüle
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
