import { getSortedArticlesData } from '@/lib/articles';
import ArticleCard from '@/components/ArticleCard';
import Link from 'next/link';
import { Settings } from 'lucide-react';

export default function Home() {
  const articles = getSortedArticlesData();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 px-6 py-4 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            My Reads
          </h1>
          <Link
            href="/settings"
            className="rounded-full p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
            title="Settings"
          >
            <Settings size={20} />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {articles.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-lg text-zinc-500 text-zinc-600 dark:text-zinc-400">
              No articles found.
            </p>
            <p className="mt-2 text-sm text-zinc-400 dark:text-zinc-500">
              Run the sync script to download articles based on your configuration.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
