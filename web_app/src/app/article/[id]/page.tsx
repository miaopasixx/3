import { getAllArticleIds, getArticleData } from '@/lib/articles';
import Link from 'next/link';
import ArticleView from '@/components/ArticleView';

export const dynamicParams = false;

export async function generateStaticParams() {
  try {
    const paths = getAllArticleIds();

    // De-duplicate and normalize IDs
    const allIds = new Set<string>();

    paths.forEach(p => {
      if (!p.id) return;
      const rawId = p.id;
      allIds.add(rawId);
      allIds.add(rawId.normalize('NFC'));
      allIds.add(rawId.normalize('NFD'));
      // Add encoded version just in case
      allIds.add(encodeURIComponent(rawId));

      try {
        const decoded = decodeURIComponent(rawId);
        allIds.add(decoded);
        allIds.add(decoded.normalize('NFC'));
        allIds.add(decoded.normalize('NFD'));
      } catch { }
    });

    return Array.from(allIds).map(id => ({ id }));
  } catch (error) {
    console.error('Error generating static params:', error);
    // Return empty array to allow build to pass (will result in no pages generated if paths are empty)
    return [];
  }
}

export default async function Article({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const id = resolvedParams.id;

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
