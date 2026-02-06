import Link from 'next/link';
import Image from 'next/image';
import { Article } from '@/lib/articles';

interface ArticleCardProps {
  article: Article;
}

export default function ArticleCard({ article }: ArticleCardProps) {
  return (
    <Link href={article.url} className="group flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white transition-all hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
        {article.coverImage ? (
          <Image
            src={article.coverImage}
            alt={article.title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center text-zinc-400">
            No Cover
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="mb-2 text-lg font-semibold leading-tight tracking-tight text-zinc-900 group-hover:text-blue-600 dark:text-zinc-100 dark:group-hover:text-blue-400">
          {article.title}
        </h3>
        {article.date && (
          <time className="mt-auto text-xs text-zinc-500 dark:text-zinc-400">
            {new Date(article.date).toLocaleDateString()}
          </time>
        )}
      </div>
    </Link>
  );
}
