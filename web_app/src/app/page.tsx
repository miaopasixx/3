import { getSortedArticlesData } from '@/lib/articles';
import GuideTimeline from '@/components/GuideTimeline';
import Link from 'next/link';
import { Settings } from 'lucide-react';

export default function Home() {
  const allArticles = getSortedArticlesData();

  // Filter for "Organization Life Guide" (组织生活指南)
  // Matching "组织生活" should be safe enough based on user request
  const guideArticles = allArticles.filter(article =>
    article.title.includes('组织生活') || article.title.includes('Life Guide')
  );

  const currentYear = 2026; // Hardcoded for this context or derived

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black selection:bg-blue-100 dark:selection:bg-blue-900/30">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 px-6 py-4 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/80 supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-red-600 to-red-700 shadow-md flex items-center justify-center text-white font-bold text-lg">
              党
            </div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              组织生活指南 <span className="text-zinc-400 font-normal ml-2 text-sm">{currentYear} 年度</span>
            </h1>
          </div>
          <Link
            href="/settings"
            className="rounded-full p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
            title="Settings"
          >
            <Settings size={20} />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-12">
        <section className="mb-12">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-4">
              支部生活，月度指引
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400 text-lg leading-relaxed">
              规范化、标准化的党支部组织生活月度清单。
              <br className="hidden sm:block" />
              这里汇集了一年的学习重点与活动指南。
            </p>
          </div>
        </section>

        <GuideTimeline articles={guideArticles} year={currentYear} />

        {/* Fallback for other non-guide articles if needed, kept hidden for now as per "Exclusive" request */}
      </main>
    </div>
  );
}
