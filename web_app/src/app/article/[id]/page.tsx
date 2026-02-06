import { getAllArticleIds, getArticleData } from '@/lib/articles';
import Link from 'next/link';
import ArticleView from '@/components/ArticleView';

export const dynamicParams = false;

export async function generateStaticParams() {
  try {
    const paths = getAllArticleIds();
    console.log(`[Build] Generating static params for ${paths.length} articles.`);

    if (paths.length === 0) {
      console.warn('[Build] No articles found. Returning fallback ID "init".');
      return [{ id: 'init' }];
    }

    // De-duplicate and normalize IDs
    const allIds = new Set<string>();

    paths.forEach(p => {
      if (!p.id) return;
      const rawId = p.id;
      allIds.add(rawId);
      // Normalize to handle potential OS differences in file naming/encoding
      allIds.add(rawId.normalize('NFC'));
      allIds.add(rawId.normalize('NFD'));

      try {
        const decoded = decodeURIComponent(rawId);
        allIds.add(decoded);
        allIds.add(decoded.normalize('NFC'));
        allIds.add(decoded.normalize('NFD'));
      } catch { }
    });

    const result = Array.from(allIds).map(id => ({ id }));
    console.log(`[Build] Final static params count: ${result.length}`);
    return result;
  } catch (error) {
    console.error('Error generating static params:', error);
    return [{ id: 'init' }];
  }
}

export default async function Article({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const id = resolvedParams.id;

  if (id === 'init') {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-zinc-950 text-white">
        <h1 className="text-2xl font-bold text-red-500">文章库初始化中</h1>
        <p className="text-zinc-500 text-center px-4">当前云端尚未抓取到文章数据。<br />请稍后刷新或检查自动同步任务建议。</p>
        <Link href="/" className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg hover:bg-zinc-800 transition-colors">返回首页</Link>
      </div>
    );
  }

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

  return <ArticleView articleData={articleData} />;
}
