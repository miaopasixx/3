import fs from 'fs';
import path from 'path';

const articlesDirectory = path.join(process.cwd(), 'public', 'articles');

export interface Article {
    id: string;
    title: string;
    date: string;
    coverImage: string;
    url: string;
    accountName?: string;
    author?: string;
    isOriginal?: boolean;
    location?: string;
    toc?: { id: string; text: string; level: number }[];
}

export interface ArticleData extends Article {
    contentHtml: string;
}

export function getSortedArticlesData(): Article[] {
    if (!fs.existsSync(articlesDirectory)) {
        console.warn(`Articles directory not found at ${articlesDirectory}. Make sure to run 'node scripts/copy-assets.js' first.`);
        return [];
    }

    const fileNames = fs.readdirSync(articlesDirectory);
    const allArticlesData = fileNames.map((fileName): Article | null => {
        const id = fileName;
        const fullPath = path.join(articlesDirectory, id);

        try {
            if (!fs.statSync(fullPath).isDirectory()) {
                return null;
            }

            const files = fs.readdirSync(fullPath);
            const htmlFile = files.find(f => f.endsWith('.html'));

            if (!htmlFile) {
                return null;
            }

            const htmlPath = path.join(fullPath, htmlFile);
            const htmlContent = fs.readFileSync(htmlPath, 'utf8');

            const titleMatch = htmlContent.match(/<title>([\s\S]*?)<\/title>/i) ||
                htmlContent.match(/<h1[^>]*class="article-title"[^>]*>([\s\S]*?)<\/h1>/i);
            const title = titleMatch ? titleMatch[1].trim() : id;

            let date = '';
            const ctMatch = htmlContent.match(/var\s+ct\s*=\s*"(\d+)"/);
            if (ctMatch && ctMatch[1]) {
                date = new Date(parseInt(ctMatch[1]) * 1000).toISOString();
            } else {
                // 尝试从 <em id="publish_time">2026年1月4日 18:08</em> 提取
                const publishTimeMatch = htmlContent.match(/<em[^>]*id="publish_time"[^>]*>(\d{4})年(\d{1,2})月(\d{1,2})日\s*(\d{1,2}):(\d{2})<\/em>/i);
                if (publishTimeMatch) {
                    const [, year, month, day, hour, minute] = publishTimeMatch;
                    date = new Date(
                        parseInt(year),
                        parseInt(month) - 1,
                        parseInt(day),
                        parseInt(hour),
                        parseInt(minute)
                    ).toISOString();
                } else {
                    const stats = fs.statSync(htmlPath);
                    date = stats.mtime.toISOString();
                }
            }

            const encodedArticleId = encodeURIComponent(id);
            const coverImageFile = files.find(f => f.match(/^image_1\.(jpeg|jpg|png|webp)$/i));
            const coverImage = coverImageFile ? `/articles/${encodedArticleId}/${coverImageFile}` : '';

            // Extract account metadata
            const nicknameMatch = htmlContent.match(/var\s+nickname\s*=\s*"([^"]+)"/) ||
                htmlContent.match(/data-nickname="([^"]+)"/);
            const accountName = nicknameMatch ? nicknameMatch[1] : '';

            const authorMatch = htmlContent.match(/var\s+user_name\s*=\s*"([^"]+)"/) ||
                htmlContent.match(/<span[^>]*class="rich_media_meta\s+rich_media_meta_text"[^>]*>([\s\S]*?)<\/span>/i);
            const author = authorMatch ? authorMatch[1].trim() : '';

            const isOriginal = htmlContent.includes('copyright_logo') || htmlContent.includes('原创');

            return {
                id,
                title,
                date,
                coverImage,
                url: `/article/${id}`,
                accountName,
                author,
                isOriginal
            };
        } catch (error) {
            console.error(`Error reading article ${id}:`, error);
            return null;
        }
    });

    return allArticlesData
        .filter((article): article is Article => article !== null)
        .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getAllArticleIds() {
    if (!fs.existsSync(articlesDirectory)) {
        return [];
    }
    const fileNames = fs.readdirSync(articlesDirectory);
    return fileNames
        .filter(fileName => fs.statSync(path.join(articlesDirectory, fileName)).isDirectory())
        .map(fileName => {
            return {
                id: fileName
            };
        });
}

export function getArticleData(articleId: string): ArticleData | null {
    const decodedId = decodeURIComponent(articleId);
    const fullPath = path.join(articlesDirectory, decodedId);

    if (!fs.existsSync(fullPath)) {
        return null;
    }

    const files = fs.readdirSync(fullPath);
    const htmlFile = files.find(f => f.endsWith('.html'));

    if (!htmlFile) {
        return null;
    }

    const htmlPath = path.join(fullPath, htmlFile);
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');

    const titleMatch = htmlContent.match(/<title>([\s\S]*?)<\/title>/i) ||
        htmlContent.match(/<h1[^>]*class="article-title"[^>]*>([\s\S]*?)<\/h1>/i);
    const title = titleMatch ? titleMatch[1].trim() : decodedId;

    let date = '';
    const ctMatch = htmlContent.match(/var\s+ct\s*=\s*"(\d+)"/);
    if (ctMatch && ctMatch[1]) {
        date = new Date(parseInt(ctMatch[1]) * 1000).toISOString();
    } else {
        // 尝试从 <em id="publish_time">2026年1月4日 18:08</em> 提取
        const publishTimeMatch = htmlContent.match(/<em[^>]*id="publish_time"[^>]*>(\d{4})年(\d{1,2})月(\d{1,2})日\s*(\d{1,2}):(\d{2})<\/em>/i);
        if (publishTimeMatch) {
            const [, year, month, day, hour, minute] = publishTimeMatch;
            date = new Date(
                parseInt(year),
                parseInt(month) - 1,
                parseInt(day),
                parseInt(hour),
                parseInt(minute)
            ).toISOString();
        } else {
            const stats = fs.statSync(htmlPath);
            date = stats.mtime.toISOString();
        }
    }

    // Extract metadata
    const nicknameMatch = htmlContent.match(/var\s+nickname\s*=\s*"([^"]+)"/) ||
        htmlContent.match(/data-nickname="([^"]+)"/);
    const accountName = nicknameMatch ? nicknameMatch[1] : '';

    const authorMatch = htmlContent.match(/var\s+user_name\s*=\s*"([^"]+)"/) ||
        htmlContent.match(/<span[^>]*class="rich_media_meta\s+rich_media_meta_text"[^>]*>([\s\S]*?)<\/span>/i);
    const author = authorMatch ? authorMatch[1].trim() : '';

    const isOriginal = htmlContent.includes('copyright_logo') || htmlContent.includes('原创');

    const locationMatch = htmlContent.match(/ip_wording2\s*:\s*"([^"]+)"/);
    const location = locationMatch ? locationMatch[1] : '';

    const encodedArticleId = encodeURIComponent(decodedId);
    const coverImageFile = files.find(f => f.match(/^image_1\.(jpeg|jpg|png|webp)$/i));
    const coverImage = coverImageFile ? `/articles/${encodedArticleId}/${coverImageFile}` : '';

    // Extract only the core content to avoid double padding from the original wrapper
    const contentMatch = htmlContent.match(/<div[^>]*id="js_content"[^>]*>([\s\S]*?)<\/div>/i) ||
        htmlContent.match(/<div[^>]*class="rich_media_content[^"]*"[^>]*>([\s\S]*?)<\/div>/i);

    let finalContent = contentMatch ? contentMatch[1] : htmlContent;

    // --- TOC Generation ---
    const toc: { id: string; text: string; level: number }[] = [];
    let tocCounter = 1;

    // Strategy 1: Headers (H2-H4)
    finalContent = finalContent.replace(/<h([2-4])[^>]*>([\s\S]*?)<\/h\1>/gi, (match, level, text) => {
        const id = `toc-${tocCounter++}`;
        const plainText = text.replace(/<[^>]+>/g, '').trim();
        if (plainText) {
            toc.push({ id, text: plainText, level: parseInt(level) });
            return `<h${level} id="${id}" class="scroll-mt-24">${text}</h${level}>`;
        }
        return match;
    });

    // Strategy 2: Image-based sections (Specific to "Organization Life Guide")
    // Added offset for precise jumping within multi-section images
    const guideMappings: Record<string, { img: string; text: string; level: number; offset?: number }[]> = {
        '2026年1月组织生活指南': [
            { img: '3', text: '理论充电站', level: 2 },
            { img: '21', text: '发展风向标', level: 2 },
            { img: '31', text: '支部活力坊', level: 2, offset: 0 },
            { img: '31', text: '温馨提示', level: 3, offset: 46.5 },
            { img: '31', text: '党史上的今天', level: 2, offset: 70 },
            { img: '33', text: '云端学习馆', level: 2, offset: 2 }
        ],
        '2026年2月组织生活指南': [
            { img: '2', text: '理论充电站', level: 2, offset: 43 },
            { img: '11', text: '省市新动态', level: 2, offset: 2 },
            { img: '21', text: '支部活力坊', level: 2, offset: 110 },
            { img: '25', text: '温馨提示', level: 3, offset: 1 },
            { img: '25', text: '党史上的今天', level: 2, offset: 45 },
            { img: '27', text: '云端学习馆', level: 2 }
        ]
    };

    // Strategy 2 Injection (Multi-anchor support)
    if (guideMappings[title]) {
        // Group mappings by image index to handle multiple sections in one image
        const groupedMappings: Record<string, typeof guideMappings[string]> = {};
        guideMappings[title].forEach(item => {
            if (!groupedMappings[item.img]) groupedMappings[item.img] = [];
            groupedMappings[item.img].push(item);
        });

        // Process each unique image index once
        Object.keys(groupedMappings).forEach(imgIndex => {
            const items = groupedMappings[imgIndex];
            // Regex to match ONLY the img tag, safely preserving attributes
            const imgPattern = new RegExp(`(<img[^>]+(?:src|data-src)="image_${imgIndex}\\.(?:jpeg|jpg|png|webp)"[^>]*>)`, 'i');

            if (imgPattern.test(finalContent)) {
                finalContent = finalContent.replace(imgPattern, (match) => {
                    // Create anchors for all TOC items sharing this specific image
                    const anchors = items.map(item => {
                        const id = `toc-${item.text.replace(/\s+/g, '-')}`;
                        toc.push({ id, text: item.text, level: item.level });

                        // If offset exists, use absolute positioning; otherwise top of image
                        const offsetStyle = item.offset !== undefined ? `top: ${item.offset}%;` : `top: 0;`;
                        // Inline style for scroll-margin-top ensures reliability regardless of external CSS
                        return `<div id="${id}" style="position: absolute; ${offsetStyle} left: 0; width: 100%; height: 1px; pointer-events: none; scroll-margin-top: 80px;" class="scroll-mt-24"></div>`;
                    }).join('');

                    // Wrap only the target <img> tag in a relative div to scope the absolute anchors
                    // This avoids breaking external <section> or <a> tags
                    return `<div style="position: relative; width: 100%; display: block;">${anchors}${match}</div>`;
                });
            }
        });
    }

    // Stability & Path Fix: Handle aspect-ratio and relative paths for ALL images
    finalContent = finalContent.replace(/<img([^>]+)>/gi, (match: string, attrs: string) => {
        let newAttrs = attrs;

        // 1. Aspect Ratio (Stabilize Layout)
        const ratioMatch = attrs.match(/data-ratio="([\d.]+)"/);
        if (ratioMatch) {
            const ratio = parseFloat(ratioMatch[1]);
            const styleMatch = attrs.match(/style="([^"]*)"/);
            // Height/Width ratio from WeChat. 
            // We add scroll-margin-top here to ensure it's on the element itself.
            const aspectStyle = `aspect-ratio: 1 / ${ratio}; width: 100%; height: auto; display: block; scroll-margin-top: 80px;`;
            if (styleMatch) {
                newAttrs = newAttrs.replace(`style="${styleMatch[1]}"`, `style="${aspectStyle} ${styleMatch[1]}"`);
            } else {
                newAttrs += ` style="${aspectStyle}"`;
            }
        }

        // 2. Relative Paths
        newAttrs = newAttrs.replace(/(src|data-src)="([^"]+)"/g, (m: string, attr: string, src: string) => {
            if (src.startsWith('http') || src.startsWith('data:') || src.startsWith('/')) {
                return m;
            }
            return `${attr}="/articles/${encodedArticleId}/${src}"`;
        });

        return `<img${newAttrs}>`;
    });

    return {
        id: articleId,
        title,
        date,
        coverImage,
        url: `/article/${articleId}`,
        contentHtml: finalContent,
        accountName,
        author,
        isOriginal,
        location,
        toc
    };
}
