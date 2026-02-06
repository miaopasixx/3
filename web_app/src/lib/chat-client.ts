export interface Message {
    role: 'system' | 'user' | 'assistant';
    content: string | MessageContent[];
}

// For vision models that support image input
export interface MessageContent {
    type: 'text' | 'image_url';
    text?: string;
    image_url?: { url: string };
}

export interface ChatConfig {
    apiKey: string;
    baseUrl: string;
    ocrModel: string;   // Model for OCR (image text extraction)
    chatModel: string;  // Model for conversation
}

export const DEFAULT_CONFIG: ChatConfig = {
    apiKey: '',
    baseUrl: 'https://api.siliconflow.cn/v1',
    ocrModel: 'deepseek-ai/DeepSeek-OCR',
    chatModel: 'Qwen/Qwen3-8B',
};

/**
 * Call OCR model to extract text from a single image
 */
export async function ocrImageContent(
    imageUrl: string,
    config: ChatConfig
): Promise<string> {
    const { apiKey, baseUrl, ocrModel } = config;

    if (!apiKey) {
        throw new Error('API Key is missing');
    }

    if (!imageUrl) {
        return '';
    }

    // Standard Vision format: Image then Text
    const messages: any[] = [
        {
            role: 'user',
            content: [
                {
                    type: 'image_url',
                    image_url: { url: imageUrl }
                },
                {
                    type: 'text',
                    text: '请识别图片中的所有文字内容，按原始布局输出。'
                }
            ]
        }
    ];

    const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: ocrModel,
            messages,
            max_tokens: 1024,
            temperature: 0.1,
        }),
    });

    if (!response.ok) {
        let errorMessage = `OCR API Error: ${response.status} ${response.statusText}`;
        try {
            const errorData = await response.json();
            errorMessage = errorData.message || errorData.error?.message || errorMessage;
        } catch (e) {
            // Keep default error
        }
        throw new Error(`${errorMessage} (Image: ${imageUrl.substring(0, 100)}${imageUrl.length > 100 ? '...' : ''})`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
}

/**
 * Stream chat completion with the chat model
 */
export async function chatCompletion(
    messages: Message[],
    config: ChatConfig,
    signal?: AbortSignal
): Promise<ReadableStream<Uint8Array>> {
    const { apiKey, baseUrl, chatModel } = config;

    if (!apiKey) {
        throw new Error('API Key is missing');
    }

    // Convert messages to simple text format for chat model
    const simpleMessages = messages.map(m => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : m.content.map(c => c.text || '').join('')
    }));

    const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        signal,
        body: JSON.stringify({
            model: chatModel,
            messages: simpleMessages,
            stream: true,
            max_tokens: 4096,
            temperature: 0.7,
        }),
    });

    if (!response.ok) {
        let errorMessage = `API Error: ${response.status} ${response.statusText}`;
        try {
            const errorData = await response.json();
            errorMessage = errorData.message || errorMessage;
        } catch (e) {
            // If not JSON, keep default
        }

        if (response.status === 401) {
            errorMessage = `Unauthorized (401): Please check if your API Key is correct. ${errorMessage}`;
        }

        throw new Error(errorMessage);
    }

    if (!response.body) {
        throw new Error('No response body');
    }

    return response.body;
}
