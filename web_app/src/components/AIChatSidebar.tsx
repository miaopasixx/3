'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, Settings, AlertCircle, Image as ImageIcon, Loader2, X, RotateCw, Copy, Check, Trash2, Edit2, StopCircle, CornerDownLeft } from 'lucide-react';
import Link from 'next/link';
import { useChatConfig } from '@/lib/hooks';
import { chatCompletion, ocrImageContent, Message } from '@/lib/chat-client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { generateContentHash } from '@/lib/utils';
import { getOcrCache, setOcrCache, cleanupOcrCache } from '@/lib/ocr-cache';

interface AIChatSidebarProps {
    articleContent: string;
}

interface OCRResult {
    url: string;
    status: 'pending' | 'processing' | 'success' | 'error';
    text: string;
    error?: string;
}

// Helper to clean OCR text from technical tags and emojis
const sanitizeOcrText = (text: string): string => {
    if (!text) return '';
    return text
        // Remove paired tags like <|ref|>...</|ref|> and <|det|>...<|/det|> and their content
        .replace(/<\|(\w+)\|>(.*?)<\|\/\1\|>/g, '')
        // Remove any remaining single tags like <|image|> or <|something|>
        .replace(/<\|.*?\|>/g, '')
        // Remove Emoji icons
        .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F191}-\u{1F251}\u{1F004}\u{1F0CF}\u{1F170}-\u{1F171}\u{1F17E}-\u{1F17F}\u{1F18E}\u{3030}\u{2B50}\u{2B55}\u{2934}-\u{2935}\u{2B05}-\u{2B07}\u{2B1B}-\u{2B1C}\u{3297}\u{3299}\u{303D}\u{00A9}\u{00AE}\u{2122}]/gu, '')
        // Cleanup excessive whitespace
        .replace(/\n{3,}/g, '\n\n')
        .trim();
};

export default function AIChatSidebar({ articleContent }: AIChatSidebarProps) {
    const { config, loaded } = useChatConfig();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [streamingContent, setStreamingContent] = useState('');

    // OCR states
    const [ocrResults, setOcrResults] = useState<OCRResult[]>([]);
    const [ocrText, setOcrText] = useState('');
    const [isOcrProcessing, setIsOcrProcessing] = useState(false);
    const [ocrProgress, setOcrProgress] = useState({ current: 0, total: 0 });
    const [ocrError, setOcrError] = useState('');
    const [showOcrPanel, setShowOcrPanel] = useState(false);
    const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
    const ocrProcessedRef = useRef(false);
    const abortControllerRef = useRef<AbortController | null>(null);
    const [isStreaming, setIsStreaming] = useState(false);
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editInput, setEditInput] = useState('');

    const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
        messagesEndRef.current?.scrollIntoView({ behavior });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, streamingContent]);

    // Extract image URLs from article content and convert relative to absolute
    const extractImageUrls = useCallback((html: string): string[] => {
        const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
        const urls: string[] = [];
        let match;

        // Resolve relative paths based on current URL
        const baseUri = typeof window !== 'undefined' ? window.location.href : '';
        const baseDir = baseUri.substring(0, baseUri.lastIndexOf('/') + 1);

        while ((match = imgRegex.exec(html)) !== null) {
            let url = match[1];
            if (url.startsWith('http') || url.startsWith('data:')) {
                urls.push(url);
            } else if (typeof window !== 'undefined') { // Only attempt URL resolution in browser environment
                try {
                    const absoluteUrl = new URL(url, baseDir).href;
                    urls.push(absoluteUrl);
                } catch (e) {
                    console.warn('Failed to resolve image URL:', url);
                }
            }
        }
        return urls;
    }, []);

    // Helper to convert image URL to base64
    const imageUrlToBase64 = async (url: string): Promise<string> => {
        if (url.startsWith('data:')) return url;

        try {
            const response = await fetch(url);
            const blob = await response.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (e) {
            console.error('Failed to convert image to base64:', e);
            return url; // Fallback to original URL
        }
    };

    // OCR preprocessing
    useEffect(() => {
        if (!loaded || !config.apiKey || ocrProcessedRef.current) return;

        const imageUrls = extractImageUrls(articleContent).slice(0, 100); // Increased limit to 100 images
        if (imageUrls.length === 0) {
            ocrProcessedRef.current = true;
            return;
        }

        const processOcr = async () => {
            const urls = extractImageUrls(articleContent).slice(0, 100);
            if (urls.length === 0) {
                ocrProcessedRef.current = true;
                return;
            }

            // 1. Generate hash for caching
            const contentHash = await generateContentHash(articleContent);

            // 2. Check Cache
            const cachedResults = await getOcrCache(contentHash);
            if (cachedResults && Array.isArray(cachedResults) && cachedResults.length === urls.length) {
                setOcrResults(cachedResults as OCRResult[]);
                ocrProcessedRef.current = true;
                return;
            }

            setIsOcrProcessing(true);
            setOcrError('');

            // Initialize ocrResults
            const initialResults: OCRResult[] = urls.map(url => ({
                url,
                status: 'pending',
                text: ''
            }));
            setOcrResults(initialResults);
            setOcrProgress({ current: 0, total: urls.length });

            // 3. Process with Controlled Parallelism (Concurrency limit: 3)
            const CONCURRENCY = 3;
            const finalResults = [...initialResults];
            let completedCount = 0;

            const processQueue = async (indices: number[]) => {
                for (const i of indices) {
                    setOcrResults(prev => prev.map((item, idx) =>
                        idx === i ? { ...item, status: 'processing' } : item
                    ));

                    try {
                        const targetUrl = await imageUrlToBase64(urls[i]);
                        const result = await ocrImageContent(targetUrl, config);

                        finalResults[i] = { ...finalResults[i], status: 'success', text: result };
                        setOcrResults([...finalResults]);
                    } catch (error: any) {
                        console.error(`OCR error for image ${i + 1}:`, error);
                        finalResults[i] = { ...finalResults[i], status: 'error', error: error.message || '识别失败' };
                        setOcrResults([...finalResults]);
                    } finally {
                        completedCount++;
                        setOcrProgress({ current: completedCount, total: urls.length });
                    }
                }
            };

            // Divide tasks into chunks for limited concurrency
            const chunks: number[][] = [];
            const chunkSize = Math.ceil(urls.length / CONCURRENCY);
            for (let i = 0; i < urls.length; i += chunkSize) {
                chunks.push(Array.from({ length: Math.min(chunkSize, urls.length - i) }, (_, k) => i + k));
            }

            await Promise.all(chunks.map(chunk => processQueue(chunk)));

            // 4. Save to Cache
            await setOcrCache(contentHash, finalResults);
            setIsOcrProcessing(false);
            ocrProcessedRef.current = true;
        };

        processOcr();
    }, [loaded, config, articleContent, extractImageUrls]);

    // Sync ocrText whenever ocrResults changes
    useEffect(() => {
        const text = ocrResults
            .map((res, i) => {
                if (res.status === 'success') {
                    return `\n[图片 ${i + 1} 识别内容]:\n${res.text}\n`;
                } else if (res.status === 'error') {
                    return `\n[图片 ${i + 1}]: (识别失败: ${res.error})\n`;
                } else if (res.status === 'processing') {
                    return `\n[图片 ${i + 1}]: (正在识别...)\n`;
                }
                return '';
            })
            .filter(Boolean)
            .join('');
        setOcrText(text);
    }, [ocrResults]);

    // Handler for re-identifying a single image
    const handleRetryOcr = async (index: number) => {
        const item = ocrResults[index];
        if (!item || item.status === 'processing') return;

        setOcrResults(prev => prev.map((res, i) =>
            i === index ? { ...res, status: 'processing', error: undefined } : res
        ));

        try {
            const targetUrl = await imageUrlToBase64(item.url);
            const result = await ocrImageContent(targetUrl, config);

            const newResults: OCRResult[] = ocrResults.map((res, i) =>
                i === index ? { ...res, status: 'success' as const, text: result } : res
            );
            setOcrResults(newResults);

            // Update cache after retry
            const contentHash = await generateContentHash(articleContent);
            await setOcrCache(contentHash, newResults);
        } catch (error: any) {
            setOcrResults(prev => prev.map((res, i) =>
                i === index ? { ...res, status: 'error', error: error.message || '识别失败' } : res
            ));
        }
    };

    // Initial greeting
    useEffect(() => {
        if (loaded && messages.length === 0 && !isOcrProcessing) {
            const hasImages = extractImageUrls(articleContent).length > 0;
            const greeting = hasImages && ocrText
                ? 'Hello! I have read the article content and extracted text from the images. Ask me anything about it!'
                : 'Hello! I am your AI assistant. I have read the article content. Ask me anything about it!';

            setMessages([{ role: 'assistant', content: greeting }]);
        }
    }, [loaded, messages.length, isOcrProcessing, ocrText, articleContent, extractImageUrls]);

    const handleStop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setIsStreaming(false);
            setIsLoading(false);
        }
    };

    const handleDeleteMessage = (index: number) => {
        setMessages(prev => prev.filter((_, i) => i !== index));
    };

    const handleCopy = (content: string, index: number) => {
        // Optimize copy result: remove UI-specific markers and Markdown symbols for plain text
        const cleanContent = content
            .replace(/\s*\[已停止\]\s*$/, '') // Remove stopped marker
            .replace(/\*\*\*(.*?)\*\*\*/g, '$1') // Remove bold-italic
            .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
            .replace(/\*(.*?)\*/g, '$1') // Remove italic
            .replace(/__(.*?)__/g, '$1') // Remove bold underscore
            .replace(/_(.*?)_/g, '$1') // Remove italic underscore
            .replace(/`{1,3}(.*?)`{1,3}/g, '$1') // Remove code markers
            .replace(/^#+\s+/gm, '') // Remove headers
            .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove link syntax, keep text
            .trim();

        navigator.clipboard.writeText(cleanContent);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    const handleRetry = (index: number) => {
        const messageToRetry = messages[index];
        if (messageToRetry.role !== 'assistant') return;

        // Find the last user message before this assistant message
        const prevMessages = messages.slice(0, index);
        const lastUserMsgIndex = [...prevMessages].reverse().findIndex(m => m.role === 'user');

        if (lastUserMsgIndex === -1) return;

        const actualUserMsgIndex = index - 1 - lastUserMsgIndex;
        const userContent = messages[actualUserMsgIndex].content as string;

        // Remove the assistant message and everything after it
        const newMessages = messages.slice(0, index);
        setMessages(newMessages);

        // Trigger send with the last user message's content
        handleSend(userContent, newMessages.slice(0, actualUserMsgIndex));
    };

    const handleEdit = (index: number) => {
        const msg = messages[index];
        if (msg.role !== 'user') return;
        setEditingIndex(index);
        setEditInput(msg.content as string);
    };

    const handleSaveEdit = () => {
        if (editingIndex === null || !editInput.trim()) return;

        // Remove this message and all subsequent messages
        const newMessages = messages.slice(0, editingIndex);
        setMessages(newMessages);

        const content = editInput;
        setEditingIndex(null);
        setEditInput('');

        // Start new chat with the edited content
        handleSend(content, newMessages);
    };

    const handleSend = async (contentOverride?: string, messagesOverride?: Message[]) => {
        const contentToSend = contentOverride || input;
        if (!contentToSend.trim() || isLoading) return;
        if (!config.apiKey) {
            alert('Please configure your API Key in Settings first.');
            return;
        }

        const userMessage: Message = { role: 'user', content: contentToSend };
        const currentMessages = messagesOverride || messages;

        setMessages([...currentMessages, userMessage]);
        if (!contentOverride) setInput('');

        setIsLoading(true);
        setIsStreaming(true);
        setStreamingContent('');

        // Create new abort controller
        abortControllerRef.current = new AbortController();

        // Prepare context: combine HTML text + OCR extracted text
        const cleanHtml = articleContent.replace(/<[^>]+>/g, ' ').substring(0, 15000);

        // Construct a structured prompt with clear sections
        let systemContent = `你是一个专业的 AI 助手。请根据以下提供的文章内容回答用户的问题。\n\n`;
        systemContent += `### 文章正文内容：\n${cleanHtml}\n\n`;

        if (ocrText) {
            // Sanitize OCR text to remove technical tags and emojis for a cleaner context
            const sanitizedOcr = sanitizeOcrText(ocrText);
            if (sanitizedOcr) {
                // Increased truncation to 25000 for large documents with many images
                systemContent += `### 文章图片中的提取文本 (OCR)：\n${sanitizedOcr.substring(0, 25000)}\n\n`;
            }
        }

        systemContent += `请根据上述内容进行回答。如果用户的问题在这些内容中找不到答案，请诚实说明。如果是关于图片内容的，请参考 OCR 部分。对于链接，请直接输出 URL 即可。`;

        const systemMessage: Message = {
            role: 'system',
            content: systemContent
        };

        const chatMessages = [systemMessage, ...currentMessages, userMessage];

        let fullResponse = '';
        try {
            const stream = await chatCompletion(chatMessages, config, abortControllerRef.current.signal);
            const reader = stream.getReader();
            const decoder = new TextDecoder();
            let done = false;
            let lineBuffer = '';

            // Mark as streaming once we get the reader
            setIsStreaming(true);

            while (!done) {
                const { value, done: doneReading } = await reader.read();
                done = doneReading;
                const chunkValue = decoder.decode(value, { stream: true });

                lineBuffer += chunkValue;
                const lines = lineBuffer.split('\n');
                lineBuffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (!trimmedLine || trimmedLine.includes('[DONE]')) continue;

                    if (trimmedLine.startsWith('data: ')) {
                        try {
                            const jsonStr = trimmedLine.slice(6);
                            if (jsonStr === '[DONE]') continue;

                            const data = JSON.parse(jsonStr);
                            const content = data.choices[0]?.delta?.content || '';
                            if (content) {
                                fullResponse += content;
                                setStreamingContent(fullResponse);
                            }
                        } catch (e) {
                            // Ignore parse errors
                        }
                    }
                }
            }

            // Process remaining buffer
            if (lineBuffer.trim() && lineBuffer.startsWith('data: ')) {
                try {
                    const jsonStr = lineBuffer.slice(6).trim();
                    if (jsonStr && jsonStr !== '[DONE]') {
                        const data = JSON.parse(jsonStr);
                        const content = data.choices[0]?.delta?.content || '';
                        if (content) fullResponse += content;
                    }
                } catch (e) { /* ignore */ }
            }

            setMessages(prev => [...prev, { role: 'assistant', content: fullResponse }]);
            setStreamingContent('');

        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.log('Stream aborted');
                // Optionally add what was generated so far
                if (fullResponse) {
                    setMessages(prev => [...prev, { role: 'assistant', content: fullResponse + ' [已停止]' }]);
                }
            } else {
                console.error('Chat error:', error);
                setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${error.message}` }]);
            }
        } finally {
            setIsLoading(false);
            setIsStreaming(false);
            abortControllerRef.current = null;
        }
    };

    if (!loaded) return null;

    if (!config.apiKey) {
        return (
            <div className="flex h-full flex-col items-center justify-center p-6 text-center">
                <AlertCircle className="mb-2 h-10 w-10 text-yellow-500" />
                <h3 className="mb-2 text-lg font-semibold">Setup Required</h3>
                <p className="mb-4 text-sm text-zinc-500">Please configure your API Key to use the AI assistant.</p>
                <Link
                    href="/settings"
                    className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
                >
                    Go to Settings
                </Link>
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col glass-effect relative">
            {/* Ambient Background Glows */}
            <div className="absolute top-0 right-0 -z-10 h-64 w-64 rounded-full bg-blue-500/5 blur-[100px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 -z-10 h-64 w-64 rounded-full bg-indigo-500/5 blur-[100px] pointer-events-none" />

            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-200/50 px-6 py-4 dark:border-zinc-800/50">
                <div className="flex items-center gap-2">
                    <Bot size={18} className="text-blue-600 dark:text-blue-400" />
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">AI助手</span>
                    {isOcrProcessing && (
                        <button
                            onClick={() => setShowOcrPanel(true)}
                            className="flex items-center gap-1.5 ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-600 hover:bg-amber-100 transition-colors dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/40"
                        >
                            <Loader2 size={10} className="animate-spin" />
                            <span>正在分析图片 {ocrProgress.current}/{ocrProgress.total}...</span>
                        </button>
                    )}
                    {ocrResults.length > 0 && !isOcrProcessing && (
                        <button
                            onClick={() => setShowOcrPanel(true)}
                            className="flex items-center gap-1 ml-2 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-600 hover:bg-green-100 transition-colors dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/40"
                            title="点击查看所有图片识别结果"
                        >
                            <ImageIcon size={10} />
                            <span>图片已识别 ({ocrResults.length})</span>
                        </button>
                    )}
                </div>
                <Link href="/settings" title="配置">
                    <Settings size={16} className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100" />
                </Link>
            </div>

            {/* OCR Error */}
            {ocrError && (
                <div className="mx-4 mt-3 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-600 dark:bg-red-900/20 dark:text-red-400">
                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                    <div>
                        <p className="font-semibold">图片识别失败</p>
                        <p className="mt-0.5 opacity-80">{ocrError}</p>
                    </div>
                </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800">
                {messages.map((msg, index) => (
                    <div key={index} className={`group flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl shadow-sm ${msg.role === 'user'
                            ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                            : 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-blue-200/50 dark:shadow-none'
                            }`}>
                            {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                        </div>
                        <div className="flex max-w-[85%] flex-col gap-1.5">
                            <div className={`relative rounded-2xl px-4 py-2.5 text-[0.9375rem] leading-relaxed shadow-sm transition-all ${msg.role === 'user'
                                ? 'bg-zinc-900 text-white dark:bg-zinc-800 dark:text-zinc-100'
                                : 'bg-white/80 dark:bg-zinc-900/80 text-zinc-700 dark:text-zinc-300 border border-white/20 dark:border-zinc-800/50'
                                }`}>
                                {editingIndex === index ? (
                                    <div className="flex flex-col gap-2 min-w-[200px]">
                                        <textarea
                                            value={editInput}
                                            onChange={(e) => setEditInput(e.target.value)}
                                            className="w-full bg-transparent outline-none resize-none min-h-[60px] text-white"
                                            autoFocus
                                        />
                                        <div className="flex justify-end gap-2 border-t border-white/10 pt-2">
                                            <button
                                                onClick={() => setEditingIndex(null)}
                                                className="text-xs text-zinc-400 hover:text-white"
                                            >
                                                取消
                                            </button>
                                            <button
                                                onClick={handleSaveEdit}
                                                className="text-xs text-blue-400 hover:text-blue-300 font-medium"
                                            >
                                                保存并重新发送
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="prose prose-sm dark:prose-invert max-w-none prose-table:overflow-x-auto scrollbar-hide">
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                            components={{
                                                a: ({ node, ...props }) => (
                                                    <a
                                                        {...props}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-blue-500 hover:text-blue-600 underline"
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                ),
                                            }}
                                        >
                                            {typeof msg.content === 'string' ? msg.content : ''}
                                        </ReactMarkdown>
                                    </div>
                                )}
                            </div>

                            {/* Action Buttons */}
                            {!isLoading && editingIndex !== index && (
                                <div className={`flex items-center gap-2 px-1 text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    {msg.role === 'assistant' && (
                                        <>
                                            <button
                                                onClick={() => handleCopy(msg.content as string, index)}
                                                className="hover:text-zinc-600 dark:hover:text-zinc-200"
                                                title="复制内容"
                                            >
                                                {copiedIndex === index ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                                            </button>
                                            <button
                                                onClick={() => handleRetry(index)}
                                                className="hover:text-zinc-600 dark:hover:text-zinc-200"
                                                title="重新生成"
                                            >
                                                <RotateCw size={14} />
                                            </button>
                                        </>
                                    )}
                                    {msg.role === 'user' && (
                                        <button
                                            onClick={() => handleEdit(index)}
                                            className="hover:text-zinc-600 dark:hover:text-zinc-200"
                                            title="编辑问题"
                                        >
                                            <Edit2 size={14} />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleDeleteMessage(index)}
                                        className="hover:text-red-500 transition-colors"
                                        title="删除消息"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {/* Streaming Message */}
                {isLoading && streamingContent && (
                    <div className="flex gap-3 animate-in fade-in duration-300">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm">
                            <Bot size={14} />
                        </div>
                        <div className="max-w-[85%] rounded-2xl bg-white/80 px-4 py-2.5 text-[0.9375rem] leading-relaxed shadow-sm dark:bg-zinc-900/80 text-zinc-700 dark:text-zinc-300 border border-white/20 dark:border-zinc-800/50">
                            <div className="prose prose-sm dark:prose-invert max-w-none prose-table:overflow-x-auto scrollbar-hide">
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                        a: ({ node, ...props }) => (
                                            <a
                                                {...props}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-500 hover:text-blue-600 underline"
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        ),
                                    }}
                                >
                                    {streamingContent}
                                </ReactMarkdown>
                            </div>
                        </div>
                    </div>
                )}

                {/* Loading Indicator */}
                {isLoading && !streamingContent && (
                    <div className="flex gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                            <Bot size={14} />
                        </div>
                        <div className="flex items-center gap-1 rounded-2xl bg-white px-4 py-3 shadow-sm dark:bg-zinc-900">
                            <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.3s]"></div>
                            <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.15s]"></div>
                            <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400"></div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-zinc-200/50 bg-white/30 p-6 backdrop-blur-md dark:border-zinc-800/50 dark:bg-black/30">
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        handleSend();
                    }}
                    className="relative flex items-center transition-all focus-within:ring-2 focus-within:ring-blue-500/20 rounded-3xl"
                >
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={(isOcrProcessing || isStreaming) ? (isStreaming ? "正在回复..." : "正在处理图片...") : "问问有关文章的事..."}
                        className="w-full rounded-2xl border border-zinc-200 bg-white/50 py-3.5 pl-5 pr-14 text-[0.9375rem] outline-none transition-all placeholder:text-zinc-400 focus:border-blue-500 focus:bg-white dark:border-zinc-800 dark:bg-zinc-900/50 dark:placeholder:text-zinc-600 dark:focus:border-blue-500 dark:focus:bg-zinc-900 shadow-inner"
                        disabled={isLoading || isOcrProcessing}
                    />
                    {isStreaming ? (
                        <button
                            type="button"
                            onClick={handleStop}
                            className="absolute right-2 rounded-xl p-2.5 text-red-500 transition-all hover:bg-red-50 hover:scale-105 active:scale-95 dark:text-red-400 dark:hover:bg-red-900/40"
                            title="停止生成"
                        >
                            <StopCircle size={20} />
                        </button>
                    ) : (
                        <button
                            type="submit"
                            disabled={!input.trim() || isLoading || isOcrProcessing}
                            className="absolute right-2 rounded-xl p-2.5 text-blue-600 transition-all hover:bg-blue-50 hover:scale-105 active:scale-95 disabled:text-zinc-300 disabled:hover:scale-100 dark:text-blue-400 dark:hover:bg-blue-900/40"
                        >
                            <Send size={20} />
                        </button>
                    )}
                </form>
            </div>

            {/* OCR Results Panel */}
            {showOcrPanel && (
                <div className="absolute inset-0 z-50 flex flex-col bg-white dark:bg-zinc-950 animate-in slide-in-from-right duration-300">
                    <div className="flex items-center justify-between border-b border-zinc-200 p-4 dark:border-zinc-800">
                        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">图片识别详情</h3>
                        <button
                            onClick={() => setShowOcrPanel(false)}
                            className="rounded-full p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        >
                            <X size={20} className="text-zinc-500" />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {ocrResults.map((res, i) => (
                            <div key={i} className="flex flex-col gap-2 rounded-xl border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setSelectedImageUrl(res.url)}
                                            className="flex h-10 w-10 items-center justify-center overflow-hidden rounded bg-zinc-200 hover:opacity-80 transition-opacity dark:bg-zinc-800"
                                            title="点击放大图片"
                                        >
                                            <img src={res.url} alt={`Img ${i + 1}`} className="h-full w-full object-cover" />
                                        </button>
                                        <span className="text-xs font-medium text-zinc-500">图片 {i + 1}</span>
                                        {res.status === 'processing' && (
                                            <Loader2 size={12} className="animate-spin text-blue-500" />
                                        )}
                                        {res.status === 'error' && (
                                            <span className="text-[10px] text-red-500">{res.error}</span>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => handleRetryOcr(i)}
                                        disabled={res.status === 'processing'}
                                        className="flex items-center gap-1 rounded bg-zinc-200 px-2 py-1 text-[10px] hover:bg-zinc-300 disabled:opacity-50 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                                        title="重新识别"
                                    >
                                        <RotateCw size={10} className={res.status === 'processing' ? 'animate-spin' : ''} />
                                        <span>重试</span>
                                    </button>
                                </div>
                                {res.text && (
                                    <div className="mt-1 rounded border border-zinc-200 bg-white p-2 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 max-h-32 overflow-y-auto">
                                        <div className="prose prose-xs dark:prose-invert">
                                            <ReactMarkdown>{res.text}</ReactMarkdown>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Image Zoom Modal */}
            {selectedImageUrl && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={() => setSelectedImageUrl(null)}
                >
                    <button
                        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
                        onClick={() => setSelectedImageUrl(null)}
                    >
                        <X size={24} />
                    </button>
                    <div className="relative max-h-full max-w-full" onClick={e => e.stopPropagation()}>
                        <img
                            src={selectedImageUrl}
                            alt="Preview"
                            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
