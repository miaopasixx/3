'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, PanelRightClose, PanelRightOpen, List } from 'lucide-react';
import AIChatSidebar from './AIChatSidebar';

interface ArticleViewProps {
    articleData: {
        title: string;
        contentHtml: string;
        accountName?: string;
        author?: string;
        date?: string;
        isOriginal?: boolean;
        location?: string;
        toc?: { id: string; text: string; level: number }[];
    };
}

export default function ArticleView({ articleData }: ArticleViewProps) {
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [activeTocId, setActiveTocId] = useState<string | null>(null);
    const [isTocVisible, setIsTocVisible] = useState(true);
    const observer = useRef<IntersectionObserver | null>(null);

    // Format date like WeChat: 2026年2月2日 17:03
    const formattedDate = articleData.date ? new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).format(new Date(articleData.date)).replace(/\//g, '-') : '';

    const articleContainerRef = useRef<HTMLDivElement>(null);

    // Handle Scroll Spy
    useEffect(() => {
        const container = articleContainerRef.current;
        if (articleData.toc && articleData.toc.length > 0 && container) {
            observer.current = new IntersectionObserver(
                (entries) => {
                    entries.forEach((entry) => {
                        if (entry.isIntersecting) {
                            setActiveTocId(entry.target.id);
                        }
                    });
                },
                {
                    root: container,
                    rootMargin: '-20% 0% -60% 0%'
                }
            );

            articleData.toc.forEach((item) => {
                const el = document.getElementById(item.id);
                if (el) observer.current?.observe(el);
            });
        }

        return () => observer.current?.disconnect();
    }, [articleData.toc, articleData.contentHtml]);

    const scrollToId = (id: string) => {
        const el = document.getElementById(id);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth' });
        }
    };

    return (
        <div className="flex min-h-screen flex-col bg-white dark:bg-black lg:flex-row overflow-hidden relative">
            {/* TOC Floating Menu - Desktop Only */}
            {articleData.toc && articleData.toc.length > 0 && (
                <div
                    className={`fixed left-8 top-32 z-20 hidden xl:block transition-all duration-300 ${isSidebarCollapsed && isTocVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10 pointer-events-none'
                        }`}
                >
                    <div className="w-56 space-y-4 rounded-2xl border border-zinc-200/50 bg-white/50 p-6 backdrop-blur-xl dark:border-zinc-900/50">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-400">
                            <List size={14} />
                            目录
                        </div>
                        <nav className="flex flex-col gap-3">
                            {articleData.toc.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => scrollToId(item.id)}
                                    className={`text-left text-[14px] leading-snug transition-all duration-200 outline-none ${activeTocId === item.id
                                        ? 'font-bold text-[#576b95] translate-x-1'
                                        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'
                                        } ${item.level > 2 ? 'ml-4' : ''}`}
                                >
                                    {item.text}
                                </button>
                            ))}
                        </nav>
                    </div>
                </div>
            )}

            {/* Article Content Area - Dynamic Width */}
            <div
                ref={articleContainerRef}
                className={`overflow-y-auto h-screen scrollbar-hide border-r border-zinc-200 dark:border-zinc-800 transition-all duration-500 ease-in-out ${isSidebarCollapsed ? 'flex-1' : 'w-full lg:w-[760px] shrink-0'
                    }`}
            >
                <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-zinc-200/50 bg-white/80 px-4 backdrop-blur-md dark:border-zinc-800/50 dark:bg-zinc-900/80">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/"
                            className="flex items-center gap-2 text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                        >
                            <ArrowLeft size={18} />
                        </Link>

                        {isSidebarCollapsed && articleData.toc && articleData.toc.length > 0 && (
                            <button
                                onClick={() => setIsTocVisible(!isTocVisible)}
                                className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${isTocVisible ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100' : 'text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                                    }`}
                                title="切换目录显示"
                            >
                                <List size={18} />
                            </button>
                        )}
                    </div>

                    <button
                        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        title={isSidebarCollapsed ? "展开助手" : "收起助手"}
                    >
                        {isSidebarCollapsed ? <PanelRightOpen size={20} /> : <PanelRightClose size={20} />}
                    </button>
                </header>

                <article className={`mx-auto max-w-[757px] px-[40px] py-10 transition-all duration-500 shadow-sm lg:shadow-none`}>
                    <h1 className="mb-4 text-[22px] font-bold leading-[1.4] tracking-tight text-zinc-900 dark:text-zinc-50 text-left">
                        {articleData.title}
                    </h1>

                    <div className="mb-8 flex flex-wrap items-center gap-x-3 gap-y-2 text-[15px]">
                        {articleData.isOriginal && (
                            <span className="rounded-[4px] bg-zinc-100 px-1 py-0.5 text-[12px] text-zinc-400 dark:bg-zinc-800">
                                原创
                            </span>
                        )}
                        <span className="text-zinc-400">
                            {articleData.author || ''}
                        </span>
                        <Link href="#" className="font-medium text-[#576b95] hover:opacity-80">
                            {articleData.accountName || '公众号'}
                        </Link>
                        <span className="text-zinc-400">
                            {formattedDate}
                        </span>
                        {articleData.location && (
                            <span className="text-zinc-400">
                                {articleData.location}
                            </span>
                        )}
                    </div>

                    <div
                        className="prose prose-lg dark:prose-invert max-w-none prose-img:m-0 prose-img:rounded-none prose-img:shadow-none prose-img:w-full prose-p:leading-relaxed prose-headings:tracking-tight prose-a:text-[#576b95] dark:prose-a:text-blue-400"
                        dangerouslySetInnerHTML={{ __html: articleData.contentHtml }}
                    />
                </article>
            </div>

            {/* AI Sidebar Area - Collapsible */}
            <div
                className={`grow relative glass-effect transition-all duration-500 ease-in-out lg:h-screen overflow-hidden ${isSidebarCollapsed ? 'max-w-0 opacity-0' : 'max-w-full opacity-100'
                    }`}
            >
                <div className="w-full h-full flex flex-col min-w-[600px]">
                    <AIChatSidebar articleContent={articleData.contentHtml} />
                </div>
            </div>
        </div>
    );
}
