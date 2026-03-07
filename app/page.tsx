'use client';

import { Suspense } from 'react';
import SearchPage from './components/SearchPage';

export default function Home() {
  return (
    <Suspense fallback={<div className='text-gray-400 text-center'>Yükleniyor...</div>}>
      <SearchPage />
    </Suspense>
  );
}
