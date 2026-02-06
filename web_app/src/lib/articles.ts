import fs from 'fs';
import path from 'path';

const articlesDirectory = path.join(process.cwd(), 'public', 'articles');

export interface Article {
    id: string;
    title: string;
    date: string;
    coverImage: string;
    url: string;
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
    const allArticlesData = fileNames.map((fileName) => {
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

            const htmlContent = fs.readFileSync(path.join(fullPath, htmlFile), 'utf-8');

            let title = id;
            const h1Match = htmlContent.match(/<h1[^>]*class="article-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i);
            if (h1Match) {
                title = h1Match[1].replace(/<[^>]+>/g, '').trim();
            } else {
                const titleMatch = htmlContent.match(/<title>([\s\S]*?)<\/title>/i);
                if (titleMatch) {
                    title = titleMatch[1].trim();
                }
            }

            let date = '';
            const ctMatch = htmlContent.match(/var\s+ct\s*=\s*"(\d+)"/);
            if (ctMatch) {
                date = new Date(parseInt(ctMatch[1]) * 1000).toISOString();
            } else {
                const stats = fs.statSync(path.join(fullPath, htmlFile));
                date = stats.mtime.toISOString();
            }

            const coverImageFile = files.find(f => f.match(/^image_1\.(jpeg|jpg|png|webp)$/i));
            const coverImage = coverImageFile ? `/articles/${encodeURIComponent(id)}/${coverImageFile}` : '';

            return {
                id,
                title,
                date,
                coverImage,
                url: `/article/${id}`
            };
        } catch (err) {
            console.error(`Error processing article ${id}:`, err);
            return null;
        }
    }).filter((item): item is Article => item !== null);

    return allArticlesData.sort((a, b) => {
        if (a.date < b.date) {
            return 1;
        } else {
            return -1;
        }
    });
}

export function getAllArticleIds() {
    if (!fs.existsSync(articlesDirectory)) {
        return [];
    }
    const fileNames = fs.readdirSync(articlesDirectory);
    return fileNames.filter(fileName => {
        try {
            return fs.statSync(path.join(articlesDirectory, fileName)).isDirectory();
        } catch {
            return false;
        }
    }).map(fileName => {
        return {
            id: fileName
        };
    });
}

export async function getArticleData(id: string): Promise<ArticleData | null> {
    const decodedId = decodeURIComponent(id);
    const nfcId = id.normalize('NFC');
    const decodedNfcId = decodedId.normalize('NFC');

    const searchPaths = [
        path.join(articlesDirectory, id),
        path.join(articlesDirectory, decodedId),
        path.join(articlesDirectory, nfcId),
        path.join(articlesDirectory, decodedNfcId)
    ];

    let fullPath = '';
    for (const p of searchPaths) {
        if (fs.existsSync(p)) {
            fullPath = p;
            break;
        }
    }

    if (!fullPath) {
        return null;
    }

    const files = fs.readdirSync(fullPath);
    const htmlFile = files.find(f => f.endsWith('.html'));

    if (!htmlFile) {
        return null;
    }

    let htmlContent = fs.readFileSync(path.join(fullPath, htmlFile), 'utf-8');

    // Rewrite image paths to point to the correct static location
    // Find all <img src="..."> and replace with /articles/ID/...
    const articleId = path.basename(fullPath);
    const encodedArticleId = encodeURIComponent(articleId);

    // Replace relative paths or any src that doesn't start with / or http
    htmlContent = htmlContent.replace(
        /(<img[^>]+src=")(?!https?:\/\/|\/)([^"]+)(")/gi,
        (match, prefix, src, suffix) => {
            return `${prefix}/articles/${encodedArticleId}/${src}${suffix}`;
        }
    );

    let title = articleId;
    const h1Match = htmlContent.match(/<h1[^>]*class="article-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i);
    if (h1Match) title = h1Match[1].replace(/<[^>]+>/g, '').trim();

    let date = '';
    const ctMatch = htmlContent.match(/var\s+ct\s*=\s*"(\d+)"/);
    if (ctMatch) {
        date = new Date(parseInt(ctMatch[1]) * 1000).toISOString();
    } else {
        const stats = fs.statSync(path.join(fullPath, htmlFile));
        date = stats.mtime.toISOString();
    }

    const coverImageFile = files.find(f => f.match(/^image_1\.(jpeg|jpg|png|webp)$/i));
    const coverImage = coverImageFile ? `/articles/${encodedArticleId}/${coverImageFile}` : '';

    return {
        id: articleId,
        title,
        date,
        coverImage,
        url: `/article/${articleId}`,
        contentHtml: htmlContent
    };
}
