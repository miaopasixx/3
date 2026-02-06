import { Article } from '@/lib/articles';
import MonthCard from './MonthCard';

interface GuideTimelineProps {
    articles: Article[];
    year: number;
}

export default function GuideTimeline({ articles, year }: GuideTimelineProps) {
    // Generate 12 months data
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    // Helper to find article for a specific month
    const getArticleForMonth = (m: number) => {
        return articles.find(a => {
            const d = new Date(a.date);
            return d.getMonth() + 1 === m && d.getFullYear() === year;
        });
    };

    return (
        <div className="w-full">
            {/* 
        Grid Layout: 
        - Mobile: 1 column
        - Tablet: 2 columns
        - Desktop: 3 columns
        - Large: 4 columns
        
        Using a simple grid for "professional documentation" feel.
        The visual flow is natural Left -> Right, Top -> Bottom.
      */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {months.map((month) => {
                    const article = getArticleForMonth(month);
                    const isCurrent = year === currentYear && month === currentMonth;

                    let state: 'completed' | 'current' | 'upcoming' | 'locked' = 'locked';

                    if (article) {
                        // User feedback: "Already formed article content should be marked with a green checkmark"
                        // So if article exists, it is ALWAYS completed (green), even if it is the current month.
                        state = 'completed';
                    } else {
                        // No article yet
                        if (year < currentYear || (year === currentYear && month < currentMonth)) {
                            // Past month but no article
                            state = 'locked';
                        } else if (isCurrent) {
                            // Current month, no article yet -> This is the "Current" active task
                            state = 'current';
                        } else {
                            // Future
                            state = 'upcoming';
                        }
                    }

                    // Special case: If we have an article for a future month (early release), show it
                    if (article && state === 'upcoming') state = 'completed';

                    return (
                        <MonthCard
                            key={month}
                            month={month}
                            year={year}
                            article={article}
                            isCurrent={isCurrent}
                            state={state}
                            className="min-h-[180px]"
                        />
                    );
                })}
            </div>
        </div>
    );
}
