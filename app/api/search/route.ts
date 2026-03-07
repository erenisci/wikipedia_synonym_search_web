import { searchArticles, SearchMode } from '@/app/lib/elasticsearch';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { query, top = 10, mode = 'synonym' } = await req.json();

  if (!query || typeof query !== 'string' || query.trim() === '') {
    return NextResponse.json({ error: 'Geçerli bir arama terimi giriniz.' }, { status: 400 });
  }

  try {
    const data = await searchArticles(query.trim(), mode as SearchMode, top);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Arama başarısız:', error);
    return NextResponse.json({ error: 'Arama başarısız oldu.' }, { status: 500 });
  }
}
