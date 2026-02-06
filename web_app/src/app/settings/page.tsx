'use client';

import { useChatConfig } from '@/lib/hooks';
import Link from 'next/link';
import { ArrowLeft, Save, Activity, CheckCircle2, AlertCircle, Eye, EyeOff, Send, MessageSquare, Bot } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

export default function SettingsPage() {
    const { config, updateConfig, loaded } = useChatConfig();
    const [formData, setFormData] = useState(config);
    const [saved, setSaved] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
    const [showApiKey, setShowApiKey] = useState(false);
    const initializedRef = useRef(false);

    // Chat test states
    const [chatInput, setChatInput] = useState('');
    const [chatResponse, setChatResponse] = useState('');
    const [isChatting, setIsChatting] = useState(false);

    useEffect(() => {
        if (loaded && !initializedRef.current) {
            setFormData(config);
            initializedRef.current = true;
        }
    }, [loaded, config]);

    const handleTestConnection = async () => {
        setIsTesting(true);
        setTestResult(null);
        try {
            const response = await fetch(`${formData.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${formData.apiKey.trim()}`,
                },
                body: JSON.stringify({
                    model: formData.chatModel.trim(),
                    messages: [{ role: 'user', content: 'ping' }],
                    max_tokens: 1,
                }),
            });

            if (response.ok) {
                setTestResult({ success: true, message: '连接成功！' });
            } else {
                const errorData = await response.json().catch(() => ({}));
                setTestResult({
                    success: false,
                    message: `错误 ${response.status}: ${errorData.message || response.statusText}`
                });
            }
        } catch (error: any) {
            setTestResult({ success: false, message: `连接失败: ${error.message}` });
        } finally {
            setIsTesting(false);
        }
    };

    const handleTestChat = async () => {
        if (!chatInput.trim() || isChatting) return;

        setIsChatting(true);
        setChatResponse('');

        try {
            const response = await fetch(`${formData.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${formData.apiKey.trim()}`,
                },
                body: JSON.stringify({
                    model: formData.chatModel.trim(),
                    messages: [{ role: 'user', content: chatInput }],
                    stream: true,
                    max_tokens: 512,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                setChatResponse(`Error ${response.status}: ${errorData.message || response.statusText}`);
                return;
            }

            if (!response.body) {
                setChatResponse('Error: No response body');
                return;
            }

            const reader = response.body.getReader();
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
                                setChatResponse(fullResponse);
                            }
                        } catch (e) { /* ignore */ }
                    }
                }
            }

            if (lineBuffer.trim() && lineBuffer.startsWith('data: ')) {
                try {
                    const jsonStr = lineBuffer.slice(6).trim();
                    if (jsonStr && jsonStr !== '[DONE]') {
                        const data = JSON.parse(jsonStr);
                        const content = data.choices[0]?.delta?.content || '';
                        if (content) fullResponse += content;
                        setChatResponse(fullResponse);
                    }
                } catch (e) { /* ignore */ }
            }

            if (!fullResponse) setChatResponse('(无回复)');
        } catch (error: any) {
            setChatResponse(`错误: ${error.message}`);
        } finally {
            setIsChatting(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedData = {
            ...formData,
            apiKey: formData.apiKey.trim(),
            baseUrl: formData.baseUrl.trim(),
            ocrModel: formData.ocrModel.trim(),
            chatModel: formData.chatModel.trim()
        };
        setFormData(trimmedData);
        updateConfig(trimmedData);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    if (!loaded) return null;

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-black">
            <header className="sticky top-0 z-10 flex h-16 items-center border-b border-zinc-200 bg-white/80 px-6 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/80">
                <div className="w-full flex items-center">
                    <Link
                        href="/"
                        className="flex items-center gap-2 text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                    >
                        <ArrowLeft size={18} />
                        返回
                    </Link>
                </div>
            </header>

            <main className="mx-auto max-w-2xl px-6 py-10 space-y-6">
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">设置</h1>

                <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="mb-6">
                        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">AI 配置</h2>
                        <div className="mt-2 rounded-lg bg-blue-50 p-4 text-sm text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
                            <p className="flex items-center gap-2 font-medium">
                                <AlertCircle size={16} />
                                双模型配置
                            </p>
                            <p className="mt-1">
                                <strong>OCR Model</strong>: 用于从图片中提取文字<br />
                                <strong>Chat Model</strong>: 用于智能对话
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                        <div>
                            <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                API 地址 (Base URL)
                            </label>
                            <input
                                type="text"
                                value={formData.baseUrl}
                                onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                                className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm outline-none focus:border-blue-500 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:focus:border-blue-500"
                                placeholder="https://api.siliconflow.cn/v1"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                API 密钥 (Key)
                            </label>
                            <div className="relative">
                                <input
                                    type={showApiKey ? 'text' : 'password'}
                                    value={formData.apiKey}
                                    onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                                    className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2 pr-10 text-sm outline-none focus:border-blue-500 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:focus:border-blue-500"
                                    placeholder="sk-..."
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowApiKey(!showApiKey)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
                                    tabIndex={-1}
                                >
                                    {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                    🖼️ OCR Model (图片识别)
                                </label>
                                <input
                                    type="text"
                                    value={formData.ocrModel}
                                    onChange={(e) => setFormData({ ...formData, ocrModel: e.target.value })}
                                    className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm outline-none focus:border-blue-500 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:focus:border-blue-500"
                                    placeholder="deepseek-ai/DeepSeek-OCR"
                                />
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                    💬 Chat Model (对话)
                                </label>
                                <input
                                    type="text"
                                    value={formData.chatModel}
                                    onChange={(e) => setFormData({ ...formData, chatModel: e.target.value })}
                                    className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm outline-none focus:border-blue-500 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:focus:border-blue-500"
                                    placeholder="Qwen/Qwen3-8B"
                                />
                            </div>
                        </div>

                        {testResult && (
                            <div className={`flex items-start gap-3 rounded-lg p-3 text-sm ${testResult.success ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300' : 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300'}`}>
                                {testResult.success ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />}
                                <span>{testResult.message}</span>
                            </div>
                        )}

                        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                            <button
                                type="button"
                                onClick={handleTestConnection}
                                disabled={isTesting || !formData.apiKey}
                                className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                            >
                                <Activity size={16} className={isTesting ? 'animate-pulse text-blue-500' : ''} />
                                {isTesting ? '测试中...' : '测试连接'}
                            </button>

                            <div className="flex items-center gap-3">
                                {saved && (
                                    <span className="text-sm font-medium text-green-600 dark:text-green-500">
                                        已保存!
                                    </span>
                                )}
                                <button
                                    type="submit"
                                    className="flex items-center gap-2 rounded-lg bg-zinc-900 px-6 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 transition-all shadow-sm active:scale-95"
                                >
                                    <Save size={16} />
                                    保存
                                </button>
                            </div>
                        </div>
                    </form>
                </div>

                {/* Test Chat Section */}
                <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="mb-4">
                        <h2 className="flex items-center gap-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                            <MessageSquare size={20} />
                            测试对话
                        </h2>
                        <p className="mt-1 text-sm text-zinc-500">使用 Chat Model 发送测试消息。</p>
                    </div>

                    <div className="space-y-4">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleTestChat()}
                                placeholder="输入测试消息..."
                                className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm outline-none focus:border-blue-500 focus:bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:focus:border-blue-500"
                                disabled={isChatting || !formData.apiKey}
                            />
                            <button
                                type="button"
                                onClick={handleTestChat}
                                disabled={isChatting || !chatInput.trim() || !formData.apiKey}
                                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
                            >
                                <Send size={16} />
                                发送
                            </button>
                        </div>

                        {(chatResponse || isChatting) && (
                            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800">
                                <div className="flex items-start gap-3">
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                                        <Bot size={16} />
                                    </div>
                                    <div className="flex-1 text-sm text-zinc-700 dark:text-zinc-300">
                                        {isChatting && !chatResponse && (
                                            <div className="flex items-center gap-1">
                                                <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.3s]"></div>
                                                <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.15s]"></div>
                                                <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400"></div>
                                            </div>
                                        )}
                                        {chatResponse && <div className="whitespace-pre-wrap">{chatResponse}</div>}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
