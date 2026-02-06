import { getAllArticleIds, getArticleData } from '@/lib/articles';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import AIChatSidebar from '@/components/AIChatSidebar';

export const dynamicParams = false;

export async function generateStaticParams() {
  const paths = getAllArticleIds();

  const allIds = new Set<string>();

  paths.forEach(p => {
    const rawId = p.id;
    // 1. Raw original
    allIds.add(rawId);

    // 2. NFC (Windows/Linux norm)
    allIds.add(rawId.normalize('NFC'));

    // 3. NFD (Mac/Git-related norm)
    allIds.add(rawId.normalize('NFD'));

    // 4. URL Encoded variant - sometimes Next.js dev server expects this
    allIds.add(encodeURIComponent(rawId));

    // 5. Decoded variants
    try {
      const decoded = decodeURIComponent(rawId);
      allIds.add(decoded);
      allIds.add(decoded.normalize('NFC'));
      allIds.add(decoded.normalize('NFD'));
    } catch { }
  });

  const finalParams = Array.from(allIds).map(id => ({ id }));

  console.log('--- generateStaticParams debug ---');
  console.log('Original IDs count:', paths.length);
  console.log('Generated combinations count:', finalParams.length);
  console.log('Generated IDs:', JSON.stringify(finalParams.map(p => p.id)));
  console.log('---------------------------------');

  return finalParams;
}

export default async function Article({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const id = resolvedParams.id;

  console.log(`[Runtime] Accessing article with ID: "${id}" (decoded: "${decodeURIComponent(id)}")`);

  // Try to find the article with the provided ID or its decoded version
  let articleData = await getArticleData(id);

  if (!articleData) {
    try {
      articleData = await getArticleData(decodeURIComponent(id));
      if (!articleData) {
        articleData = await getArticleData(id.normalize('NFC'));
      }
    } catch { }
  }

  if (!articleData) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold">Article not found</h1>
        <p className="text-zinc-500">ID: {id}</p>
        <Link href="/" className="text-blue-500 hover:underline">Return Home</Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-black lg:flex-row">

      {/* Article Content Area */}
      <div className="flex-1 overflow-y-auto h-screen">
        <header className="sticky top-0 z-10 flex h-16 items-center border-b border-zinc-200 bg-white/80 px-4 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/80">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            <ArrowLeft size={18} />
            Back
          </Link>
        </header>

        <article className="mx-auto max-w-3xl px-6 py-10">
          <h1 className="mb-8 text-3xl font-bold leading-tight tracking-tight text-zinc-900 dark:text-zinc-50 lg:text-4xl">
            {articleData.title}
          </h1>

          <div
            className="prose prose-lg dark:prose-invert max-w-none prose-img:rounded-xl prose-img:shadow-sm"
            dangerouslySetInnerHTML={{ __html: articleData.contentHtml }}
          />
        </article>
      </div>

      {/* AI Sidebar Area - Fixed on Desktop */}
      <div className="hidden w-[400px] border-l border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 lg:flex lg:flex-col lg:h-screen">
        <AIChatSidebar articleContent={articleData.contentHtml} />
      </div>
    </div>
  );
}
