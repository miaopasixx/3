import { getAllArticleIds, getArticleData } from '@/lib/articles';
import Link from 'next/link';
import ArticleView from '@/components/ArticleView';


// Force git update for build trigger
export const dynamicParams = false;

export async function generateStaticParams() {
  // Debugging: return empty array or known paths to verify function detection
  // const paths = getAllArticleIds();
  // ...
  return [{ id: 'test-article-id' }];
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
