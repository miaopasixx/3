/**
 * Generates a simple hash string for a given text content.
 * Used for identifying unique articles for OCR caching.
 */
export async function generateContentHash(content: string): Promise<string> {
    if (!content) return 'empty';

    // Use the Subtile Crypto API for SHA-256 (native in most browsers)
    const msgUint8 = new TextEncoder().encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return hashHex.substring(0, 16); // 16 chars is enough for our collision needs
}
