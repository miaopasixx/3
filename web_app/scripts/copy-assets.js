const fs = require('fs');
const path = require('path');

// 源目录：上级目录的 weixin_articles
const sourceDir = path.join(__dirname, '..', '..', 'weixin_articles');
// 目标目录：public/articles
const targetDir = path.join(__dirname, '..', 'public', 'articles');

// 递归复制目录
function copyDir(src, dest) {
    // 如果源目录不存在，跳过
    if (!fs.existsSync(src)) {
        console.warn(`Warning: Source directory ${src} does not exist.`);
        return;
    }

    // 创建目标目录
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            // 只复制图片和html文件
            const ext = path.extname(entry.name).toLowerCase();
            if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.html'].includes(ext)) {
                fs.copyFileSync(srcPath, destPath);
            }
        }
    }
}

console.log(`Copying assets from ${sourceDir} to ${targetDir}...`);
copyDir(sourceDir, targetDir);
console.log('Assets copy complete.');
