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
      <header className="sticky top-0 z-10 border-b border-red-100/50 bg-white/80 px-6 py-4 backdrop-blur-md dark:border-red-900/30 dark:bg-zinc-900/80 supports-[backdrop-filter]:bg-white/60">
        <div className="absolute inset-0 bg-gradient-to-r from-red-50/50 via-transparent to-red-50/30 dark:from-red-950/20 dark:to-transparent pointer-events-none" />
        <div className="mx-auto flex max-w-7xl items-center justify-between relative z-10">
          <div className="flex items-center gap-4">
            {/* Logo Badge */}
            <div className="relative group">
              <div className="absolute -inset-1 rounded-xl bg-gradient-to-br from-yellow-300 to-red-600 opacity-75 blur transition duration-500 group-hover:opacity-100" />
              <div className="relative h-10 w-10 rounded-xl overflow-hidden bg-white shadow-xl flex items-center justify-center border border-yellow-500/30">
                <img
                  src="/favicon.png"
                  alt="Logo"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>

            <div className="flex flex-col">
              <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                组织生活指南
                <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-bold tracking-widest bg-red-50 text-red-600 border border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">
                  OFFICIAL
                </span>
              </h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium tracking-wide">
                CPC ORGANIZATION LIFE GUIDE <span className="text-red-500/50 mx-1">/</span> {currentYear}
              </p>
            </div>
          </div>
          <Link
            href="/settings"
            className="group relative rounded-full p-2 text-zinc-400 transition-all hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
            title="Settings"
          >
            <Settings size={20} className="transition-transform duration-500 group-hover:rotate-180" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-12">
        <section className="mb-12">
          <div className="max-w-3xl relative">
            <div className="absolute -left-6 top-1 h-8 w-1 bg-red-600 rounded-full" />
            <h2 className="text-3xl font-serif font-bold text-zinc-900 dark:text-zinc-50 mb-6 tracking-wide">
              支部生活，<span className="text-red-700 dark:text-red-500">月度指引</span>
            </h2>
            <p className="text-zinc-600 dark:text-zinc-300 text-lg leading-relaxed font-light">
              规范化、标准化的党支部组织生活月度清单。
              <br className="hidden sm:block" />
              汇集一年的<span className="font-semibold text-red-700/80 dark:text-red-400">学习重点</span>与<span className="font-semibold text-red-700/80 dark:text-red-400">活动指南</span>，助力支部建设。
            </p>
          </div>
        </section>

        <GuideTimeline articles={guideArticles} year={currentYear} />

        {/* Fallback for other non-guide articles if needed, kept hidden for now as per "Exclusive" request */}
      </main>
    </div>
  );
}
