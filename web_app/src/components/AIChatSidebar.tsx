'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, Settings, AlertCircle, Image as ImageIcon, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useChatConfig } from '@/lib/hooks';
import { chatCompletion, ocrImageContent, Message } from '@/lib/chat-client';
import ReactMarkdown from 'react-markdown';

interface AIChatSidebarProps {
    articleContent: string;
}

export default function AIChatSidebar({ articleContent }: AIChatSidebarProps) {
    const { config, loaded } = useChatConfig();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [streamingContent, setStreamingContent] = useState('');

    // OCR states
    const [ocrText, setOcrText] = useState('');
    const [isOcrProcessing, setIsOcrProcessing] = useState(false);
    const [ocrProgress, setOcrProgress] = useState({ current: 0, total: 0 });
    const [ocrError, setOcrError] = useState('');
    const ocrProcessedRef = useRef(false);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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

    // OCR preprocessing
    useEffect(() => {
        if (!loaded || !config.apiKey || ocrProcessedRef.current) return;

        const imageUrls = extractImageUrls(articleContent).slice(0, 10); // Limit to 10 images
        if (imageUrls.length === 0) {
            ocrProcessedRef.current = true;
            return;
        }

        const processOcr = async () => {
            setIsOcrProcessing(true);
            setOcrError('');
            setOcrProgress({ current: 0, total: imageUrls.length });

            let accumulatedText = '';
            try {
                // Process images one by one to show progress
                for (let i = 0; i < imageUrls.length; i++) {
                    setOcrProgress({ current: i + 1, total: imageUrls.length });
                    const result = await ocrImageContent([imageUrls[i]], config);
                    if (result) {
                        accumulatedText += `\n[Image ${i + 1} Content]:\n${result}\n`;
                    }
                }

                setOcrText(accumulatedText);
                ocrProcessedRef.current = true;
            } catch (error: any) {
                console.error('OCR error:', error);
                setOcrError(error.message);
                ocrProcessedRef.current = true;
            } finally {
                setIsOcrProcessing(false);
            }
        };

        processOcr();
    }, [loaded, config, articleContent, extractImageUrls]);

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

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;
        if (!config.apiKey) {
            alert('Please configure your API Key in Settings first.');
            return;
        }

        const userMessage: Message = { role: 'user', content: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);
        setStreamingContent('');

        // Prepare context: combine HTML text + OCR extracted text
        const cleanHtml = articleContent.replace(/<[^>]+>/g, ' ').substring(0, 15000);
        const ocrContext = ocrText ? `\n\n--- Extracted Text from Images ---\n${ocrText.substring(0, 10000)}` : '';
        const fullContext = cleanHtml + ocrContext;

        const systemMessage: Message = {
            role: 'system',
            content: `You are a helpful AI assistant. You are answering questions about the following article content:\n\n${fullContext}\n\nPlease answer the user's question based on this content. If the answer is not in the text, please state that.`
        };

        const chatMessages = [systemMessage, ...messages, userMessage];

        try {
            const stream = await chatCompletion(chatMessages, config);
            const reader = stream.getReader();
            const decoder = new TextDecoder();
            let done = false;
            let fullResponse = '';
            let lineBuffer = '';

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
            console.error('Chat error:', error);
            setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${error.message}` }]);
        } finally {
            setIsLoading(false);
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
        <div className="flex h-full flex-col bg-zinc-50 dark:bg-zinc-950">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                    <Bot size={18} className="text-blue-600 dark:text-blue-400" />
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">AI助手</span>
                    {isOcrProcessing && (
                        <div className="flex items-center gap-1.5 ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:bg-amber-900/20 dark:text-amber-400">
                            <Loader2 size={10} className="animate-spin" />
                            <span>正在分析图片 {ocrProgress.current}/{ocrProgress.total}...</span>
                        </div>
                    )}
                    {ocrText && !isOcrProcessing && (
                        <div className="flex items-center gap-1 ml-2 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-600 dark:bg-green-900/20 dark:text-green-400" title="所有图片已分析完成">
                            <ImageIcon size={10} />
                            <span>图片已识别</span>
                        </div>
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
                    <div key={index} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${msg.role === 'user' ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                            {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                        </div>
                        <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${msg.role === 'user'
                            ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                            : 'bg-white text-zinc-700 shadow-sm dark:bg-zinc-900 dark:text-zinc-300'
                            }`}>
                            <div className="prose prose-sm dark:prose-invert max-w-none">
                                <ReactMarkdown>
                                    {typeof msg.content === 'string' ? msg.content : ''}
                                </ReactMarkdown>
                            </div>
                        </div>
                    </div>
                ))}

                {/* Streaming Message */}
                {isLoading && streamingContent && (
                    <div className="flex gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                            <Bot size={14} />
                        </div>
                        <div className="max-w-[85%] rounded-2xl bg-white px-4 py-2 text-sm text-zinc-700 shadow-sm dark:bg-zinc-900 dark:text-zinc-300">
                            <div className="prose prose-sm dark:prose-invert max-w-none">
                                <ReactMarkdown>{streamingContent}</ReactMarkdown>
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
            <div className="border-t border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        handleSend();
                    }}
                    className="relative flex items-center"
                >
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={isOcrProcessing ? "Processing images..." : "Ask about this article..."}
                        className="w-full rounded-full border border-zinc-200 bg-zinc-50 py-3 pl-4 pr-12 text-sm outline-none focus:border-blue-500 focus:bg-white dark:border-zinc-800 dark:bg-zinc-900 dark:focus:border-blue-500 dark:focus:bg-zinc-950"
                        disabled={isLoading || isOcrProcessing}
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isLoading || isOcrProcessing}
                        className="absolute right-2 rounded-full p-2 text-blue-600 transition-colors hover:bg-blue-50 disabled:text-zinc-400 disabled:hover:bg-transparent dark:text-blue-400 dark:hover:bg-blue-900/20"
                    >
                        <Send size={18} />
                    </button>
                </form>
            </div>
        </div>
    );
}
