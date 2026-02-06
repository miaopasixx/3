import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { CheckCircle2, Circle, Clock, Lock } from 'lucide-react';
import { Article } from '@/lib/articles';

interface MonthCardProps {
    month: number;
    year: number;
    article?: Article;
    isCurrent?: boolean; // New prop for visual styling
    state: 'completed' | 'current' | 'upcoming' | 'locked';
    className?: string;
}

export default function MonthCard({ month, year, article, isCurrent, state, className }: MonthCardProps) {
    const monthString = month.toString().padStart(2, '0');
    const monthNames = [
        "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
        "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"
    ];
    const monthName = monthNames[month - 1];

    const content = (
        <div className={cn(
            "relative flex flex-col h-full p-6 transition-all duration-300 group",
            "border border-zinc-200 dark:border-zinc-800 rounded-2xl",
            "bg-white dark:bg-zinc-900",
            state === 'completed' && "hover:border-blue-200 dark:hover:border-blue-900 hover:shadow-lg hover:-translate-y-1",
            isCurrent && "ring-2 ring-blue-500 ring-offset-2 ring-offset-zinc-50 dark:ring-offset-black hover:shadow-lg hover:-translate-y-1",
            (state === 'upcoming' || state === 'locked') && !isCurrent && "opacity-60 bg-zinc-50 dark:bg-zinc-900/50",
            className
        )}>
            {/* Background Image if Article exists */}
            {article?.coverImage && (
                <div className="absolute inset-0 z-0 overflow-hidden rounded-2xl">
                    <Image
                        src={article.coverImage}
                        alt={article.title}
                        fill
                        className="object-cover opacity-10 group-hover:opacity-20 transition-opacity duration-500 grayscale group-hover:grayscale-0"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-white via-white/80 to-transparent dark:from-zinc-900 dark:via-zinc-900/80" />
                </div>
            )}

            {/* Background Decor - Minimalist typography */}
            <div className="absolute right-4 top-4 text-4xl font-black text-zinc-100 dark:text-zinc-800/50 select-none pointer-events-none transition-colors group-hover:text-zinc-200 dark:group-hover:text-zinc-800 z-10">
                {monthString}
            </div>

            {/* Header: Status Indicator */}
            <div className="mb-4 flex items-center gap-2 relative z-20">
                {state === 'completed' && <CheckCircle2 size={18} className="text-emerald-500" />}
                {state === 'current' && <Circle size={18} className="text-blue-500 animate-pulse" />}
                {state === 'upcoming' && <Clock size={18} className="text-zinc-400" />}
                {state === 'locked' && <Lock size={18} className="text-zinc-300" />}

                <span className={cn(
                    "text-xs font-medium tracking-wider uppercase",
                    state === 'completed' ? "text-emerald-600 dark:text-emerald-400" :
                        state === 'current' ? "text-blue-600 dark:text-blue-400" :
                            "text-zinc-500"
                )}>
                    {monthName}
                </span>
            </div>

            {/* Content */}
            <div className="mt-auto relative z-20">
                {article ? (
                    <>
                        <h3 className="font-semibold text-lg text-zinc-900 dark:text-zinc-100 line-clamp-2 leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {article.title}
                        </h3>
                        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                            {new Date(article.date).toLocaleDateString()}
                        </p>
                    </>
                ) : (
                    <>
                        <h3 className="font-medium text-lg text-zinc-400 dark:text-zinc-600">
                            Coming Soon
                        </h3>
                        <p className="mt-1 text-sm text-zinc-400/60 dark:text-zinc-600/60">
                            {year}.{monthString}
                        </p>
                    </>
                )}
            </div>

            {/* Decorative Progress Line for 'Current' */}
            {isCurrent && (
                <div className="absolute bottom-0 left-6 right-6 h-0.5 bg-blue-100 dark:bg-blue-900 overflow-hidden rounded-full z-20">
                    <div className="absolute inset-y-0 left-0 w-1/3 bg-blue-500" />
                </div>
            )}
        </div>
    );

    if (article && (state === 'completed' || state === 'current')) {
        return <Link href={article.url} className="block h-full">{content}</Link>;
    }

    return <div className="h-full cursor-default">{content}</div>;
}
