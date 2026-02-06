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

    // Status Config
    const isCompleted = state === 'completed';
    const isLocked = state === 'locked';
    const isUpcoming = state === 'upcoming';

    const content = (
        <div className={cn(
            "relative flex flex-col h-full p-5 transition-all duration-500 group overflow-hidden",
            "border rounded-xl",
            // Base Styles
            isLocked ? "bg-zinc-50/50 border-zinc-100 dark:bg-zinc-900/30 dark:border-zinc-800" :
                "bg-white border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800",
            // Hover Effects (Floating)
            !isLocked && "hover:shadow-xl hover:-translate-y-1 hover:border-red-200 dark:hover:border-red-900/50",
            // Active Ring
            isCurrent && "ring-1 ring-red-500/50 ring-offset-0 bg-gradient-to-b from-red-50/30 to-transparent dark:from-red-950/10",
            className
        )}>
            {/* 1. Large Watermark Month Number - MAXIMUM IMPACT */}
            <div className={cn(
                "absolute -right-4 -bottom-12 text-[150px] font-black leading-none select-none pointer-events-none transition-all duration-500 z-0 tracking-tighter",
                // Base Gradient
                "bg-gradient-to-t from-transparent to-current bg-clip-text text-transparent",
                // Specific Colors & Opacity
                isCurrent ? "text-red-600/20 dark:text-red-500/20" :
                    isCompleted ? "text-red-800/10 dark:text-red-900/15 group-hover:text-red-600/15" :
                        "text-zinc-200/80 dark:text-zinc-800",
                // Transform
                isCurrent && "scale-105"
            )}>
                {monthString}
            </div>

            {/* 2. Decoration: Golden Line for Current/Completed */}
            {(isCurrent || isCompleted) && (
                <div className="absolute top-0 left-6 w-10 h-1 bg-gradient-to-r from-yellow-400 to-red-500 rounded-b-lg shadow-sm z-20" />
            )}

            {/* 3. Header: Status & Label - Compact */}
            <div className="mb-2 flex items-center justify-between relative z-20">
                <div className="flex items-center gap-2">
                    <span className={cn(
                        "text-[10px] font-bold tracking-[0.2em] uppercase",
                        isCurrent ? "text-red-600 dark:text-red-400" :
                            isCompleted ? "text-zinc-600 dark:text-zinc-400" :
                                "text-zinc-400"
                    )}>
                        {monthName}
                    </span>
                    {isCurrent && (
                        <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
                        </span>
                    )}
                </div>

                {/* Status Icon */}
                <div className={cn(
                    "transition-transform duration-300 group-hover:scale-110",
                    isCompleted ? "text-red-600 dark:text-red-500" :
                        isCurrent ? "text-red-500" :
                            "text-zinc-300 dark:text-zinc-700"
                )}>
                    {isCompleted && <CheckCircle2 size={18} strokeWidth={2} />}
                    {isCurrent && <Clock size={18} strokeWidth={2} />}
                    {isUpcoming && <Circle size={18} strokeWidth={2} className="opacity-50" />}
                    {isLocked && <Lock size={16} strokeWidth={2} />}
                </div>
            </div>

            {/* 4. Main Content (Middle) */}
            <div className="flex-1 relative z-20 flex flex-col justify-center min-h-[40px]">
                {article ? (
                    <h3 className={cn(
                        "font-bold text-base leading-tight transition-colors duration-300",
                        "text-zinc-900 dark:text-zinc-100",
                        !isLocked && "group-hover:text-red-700 dark:group-hover:text-red-400"
                    )}>
                        {article.title}
                    </h3>
                ) : (
                    <div className="flex flex-col gap-1.5">
                        <div className="h-1.5 w-2/3 bg-zinc-100 dark:bg-zinc-800 rounded-full" />
                        <div className="h-1.5 w-1/2 bg-zinc-100 dark:bg-zinc-800 rounded-full" />
                    </div>
                )}
            </div>

            {/* 5. Footer: Date */}
            <div className="mt-4 pt-3 border-t border-dashed border-zinc-200 dark:border-zinc-800 relative z-20 flex items-center justify-between text-[10px] font-medium">
                {article ? (
                    <span className="text-zinc-500 dark:text-zinc-400 font-mono tracking-tight group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                        {/* Format YYYY/MM/DD */}
                        {new Date(article.date).toLocaleDateString('zh-CN', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit'
                        }).replace(/\//g, '/')}
                    </span>
                ) : (
                    <span className="text-zinc-300 dark:text-zinc-700 font-mono tracking-tight">
                        {year}/{monthString}/--
                    </span>
                )}

                {article && (
                    <span className="text-red-600/0 group-hover:text-red-600 transition-all transform translate-x-2 group-hover:translate-x-0 opacity-0 group-hover:opacity-100">
                        →
                    </span>
                )}
            </div>

            {/* 6. Background Image Fade - Visible & Full */}
            {article?.coverImage && (
                <div className="absolute inset-0 z-0 opacity-20 group-hover:opacity-30 transition-opacity duration-700 pointer-events-none">
                    <Image
                        src={article.coverImage}
                        alt=""
                        fill
                        className="object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-white/90 via-white/50 to-transparent dark:from-zinc-900/90 dark:via-zinc-900/50" />
                </div>
            )}
        </div>
    );

    if (article && (isCompleted || isCurrent)) {
        return <Link href={article.url} className="block h-full">{content}</Link>;
    }

    return <div className="h-full cursor-default select-none">{content}</div>;
}
