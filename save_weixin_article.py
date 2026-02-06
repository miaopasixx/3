#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
微信公众号文章保存工具
可以将微信公众号文章保存到本地，包括文章内容和图片
解决跨域问题：通过模拟浏览器请求头来绕过微信的防盗链机制
"""

import os
import re
import sys
import time
import hashlib
import requests
import json
import feedparser
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse, unquote
import argparse


class WeixinArticleSaver:
    """微信公众号文章保存器"""
    
    def __init__(self, output_dir="weixin_articles"):
        self.output_dir = output_dir
        self.session = requests.Session()
        
        # 设置请求头，模拟浏览器访问，解决跨域和防盗链问题
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Cache-Control': 'max-age=0',
            'Upgrade-Insecure-Requests': '1',
        }
        
        # 图片请求头，关键是设置 Referer 来绕过防盗链
        self.image_headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Referer': 'https://mp.weixin.qq.com/',  # 关键：设置 Referer 绕过防盗链
        }
        
        self.session.headers.update(self.headers)
    
    def clean_filename(self, filename):
        """清理文件名，移除非法字符"""
        # 移除或替换非法字符
        illegal_chars = r'[<>:"/\\|?*]'
        filename = re.sub(illegal_chars, '_', filename)
        # 移除首尾空格和点
        filename = filename.strip(' .')
        # 限制长度
        if len(filename) > 100:
            filename = filename[:100]
        return filename or 'untitled'
    
    def get_article_content(self, url):
        """获取文章内容"""
        print(f"正在获取文章: {url}")
        
        try:
            response = self.session.get(url, headers=self.headers, timeout=30)
            response.raise_for_status()
            response.encoding = 'utf-8'
            return response.text
        except requests.RequestException as e:
            print(f"获取文章失败: {e}")
            return None
    
    def extract_title(self, soup):
        """提取文章标题"""
        # 尝试多种方式获取标题
        title = None
        
        # 方式1: meta property="og:title"
        og_title = soup.find('meta', property='og:title')
        if og_title and og_title.get('content'):
            title = og_title['content']
        
        # 方式2: id="activity-name"
        if not title:
            activity_name = soup.find(id='activity-name')
            if activity_name:
                title = activity_name.get_text(strip=True)
        
        # 方式3: class="rich_media_title"
        if not title:
            rich_title = soup.find(class_='rich_media_title')
            if rich_title:
                title = rich_title.get_text(strip=True)
        
        # 方式4: title 标签
        if not title:
            title_tag = soup.find('title')
            if title_tag:
                title = title_tag.get_text(strip=True)
        
        return title or 'untitled'
    
    def extract_publish_time(self, soup):
        """提取文章发布时间，返回 Unix 时间戳字符串"""
        # 方式1: <em id="publish_time">2026年1月4日 18:08</em>
        publish_time_elem = soup.find(id='publish_time')
        if publish_time_elem:
            time_text = publish_time_elem.get_text(strip=True)
            # 解析 "2026年1月4日 18:08" 格式
            match = re.match(r'(\d{4})年(\d{1,2})月(\d{1,2})日\s*(\d{1,2}):(\d{2})', time_text)
            if match:
                from datetime import datetime
                year, month, day, hour, minute = map(int, match.groups())
                dt = datetime(year, month, day, hour, minute)
                timestamp = int(dt.timestamp())
                return str(timestamp)
        
        # 方式2: var ct = "1234567890"
        # (如果原始HTML中已有，直接用)
        html_str = str(soup)
        ct_match = re.search(r'var\s+ct\s*=\s*"(\d+)"', html_str)
        if ct_match:
            return ct_match.group(1)
        
        return None
    
    def download_image(self, img_url, save_path, referer_url):
        """下载图片，处理防盗链"""
        try:
            # 处理相对URL
            if img_url.startswith('//'):
                img_url = 'https:' + img_url
            elif img_url.startswith('/'):
                img_url = 'https://mp.weixin.qq.com' + img_url
            
            # 处理微信图片URL中的特殊参数
            # 有些图片URL可能包含 wx_fmt 参数
            
            headers = self.image_headers.copy()
            headers['Referer'] = referer_url
            
            response = self.session.get(img_url, headers=headers, timeout=30, stream=True)
            response.raise_for_status()
            
            # 检查内容类型
            content_type = response.headers.get('Content-Type', '')
            
            with open(save_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
            
            return True
        except Exception as e:
            print(f"  下载图片失败 {img_url}: {e}")
            return False
    
    def process_images(self, soup, article_dir, article_url):
        """处理文章中的所有图片"""
        images = soup.find_all('img')
        image_map = {}  # 原始URL -> 本地路径
        image_count = 0
        
        for img in images:
            # 获取图片URL，微信文章可能使用 data-src 或 src
            img_url = img.get('data-src') or img.get('src')
            
            if not img_url:
                continue
            
            # 跳过 base64 图片和空白图片
            if img_url.startswith('data:') or 'spacer.gif' in img_url:
                continue
            
            # 跳过已处理的图片
            if img_url in image_map:
                img['src'] = image_map[img_url]
                if img.get('data-src'):
                    del img['data-src']
                continue
            
            image_count += 1
            
            # 确定图片扩展名
            ext = '.jpg'  # 默认扩展名
            if 'wx_fmt=' in img_url:
                fmt_match = re.search(r'wx_fmt=(\w+)', img_url)
                if fmt_match:
                    fmt = fmt_match.group(1).lower()
                    if fmt in ['png', 'gif', 'jpeg', 'jpg', 'webp']:
                        ext = f'.{fmt}'
            elif '.' in urlparse(img_url).path:
                path_ext = os.path.splitext(urlparse(img_url).path)[1].lower()
                if path_ext in ['.png', '.gif', '.jpeg', '.jpg', '.webp', '.svg']:
                    ext = path_ext
            
            # 生成本地文件名
            local_filename = f"image_{image_count}{ext}"
            local_path = os.path.join(article_dir, local_filename)
            
            print(f"  下载图片 {image_count}: {img_url[:80]}...")
            
            if self.download_image(img_url, local_path, article_url):
                # 更新图片引用为本地路径
                image_map[img_url] = local_filename
                img['src'] = local_filename
                if img.get('data-src'):
                    del img['data-src']
                print(f"    -> 保存为 {local_filename}")
            else:
                # 下载失败，保留原始URL
                img['src'] = img_url
            
            # 添加延迟，避免请求过快
            time.sleep(0.3)
        
        return image_count
    
    def clean_html(self, soup):
        """清理HTML，移除不必要的元素"""
        # 移除脚本
        for script in soup.find_all('script'):
            script.decompose()
        
        # 移除样式表链接（保留内联样式）
        for link in soup.find_all('link', rel='stylesheet'):
            link.decompose()
        
        # 移除一些微信特有的隐藏元素
        for elem in soup.find_all(class_=['qr_code_pc_outer', 'rich_media_tool', 'reward_area']):
            elem.decompose()
        
        # 移除评论区
        for elem in soup.find_all(id=['js_tpl_comment_area', 'js_comment_area']):
            elem.decompose()
        
        # 移除隐藏样式（微信用于懒加载的样式）
        # 查找内容区域并移除 visibility:hidden 和 opacity:0 样式
        content_div = soup.find(id='js_content') or soup.find(class_='rich_media_content')
        if content_div:
            # 移除隐藏样式
            current_style = content_div.get('style', '')
            # 移除 visibility: hidden 和 opacity: 0
            current_style = re.sub(r'visibility\s*:\s*hidden\s*;?\s*', '', current_style)
            current_style = re.sub(r'opacity\s*:\s*0\s*;?\s*', '', current_style)
            if current_style.strip():
                content_div['style'] = current_style.strip()
            elif content_div.has_attr('style'):
                del content_div['style']
        
        return soup
    
    def create_standalone_html(self, soup, title, publish_time=None):
        """创建独立的HTML文件，保留原始布局"""
        # 获取文章主体内容
        content_div = soup.find(id='js_content') or soup.find(class_='rich_media_content')
        
        if not content_div:
            # 如果找不到主体内容，使用整个body
            content_div = soup.find('body') or soup
        
        # 提取所有内联样式
        styles = []
        for style in soup.find_all('style'):
            styles.append(style.get_text())
        
        # 获取内容的HTML字符串
        content_html = str(content_div)
        
        # 格式化发布时间
        formatted_time = ""
        if publish_time:
            try:
                from datetime import datetime
                dt = datetime.fromtimestamp(int(publish_time))
                formatted_time = dt.strftime('%Y年%#m月%#d日 %H:%M')
                # Windows上使用 %#m %#d 去除前导零，Linux上使用 %-m %-d
                # 为了跨平台兼容，这里简单处理一下
                if os.name != 'nt': 
                     formatted_time = dt.strftime('%Y年%-m月%-d日 %H:%M')
            except Exception as e:
                print(f"时间格式化失败: {e}")

        # 创建新的HTML文档，保留微信原始样式
        html_template = f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <style>
        /* 基础样式 */  
        * {{
            box-sizing: border-box;
        }}
        html {{
            font-size: 16px;
        }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei UI", "Microsoft YaHei", Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f5f5f5;
            margin: 0;
            padding: 0;
        }}
        .weixin-article-wrapper {{
            max-width: 677px;
            margin: 0 auto;
            background-color: #fff;
            padding: 20px;
            min-height: 100vh;
        }}
        .article-title {{
            font-size: 22px;
            font-weight: bold;
            margin-bottom: 20px;
            color: #333;
            text-align: center;
            line-height: 1.4;
            padding: 0 10px;
        }}
        .article-meta {{
            margin-bottom: 20px;
            text-align: center;
            color: rgba(0,0,0,0.3);
            font-size: 15px;
        }}
        /* 微信文章内容样式 */
        #js_content, .rich_media_content {{
            overflow: hidden;
            font-size: 17px;
            word-wrap: break-word;
            -webkit-hyphens: auto;
            -ms-hyphens: auto;
            hyphens: auto;
            text-align: justify;
            position: relative;
        }}
        /* 图片样式 */
        #js_content img, .rich_media_content img {{
            max-width: 100% !important;
            height: auto !important;
            display: block;
            margin: 0 auto;
        }}
        /* section 样式 */
        section {{
            box-sizing: border-box;
        }}
        /* 链接样式 */
        a {{
            color: #576b95;
            text-decoration: none;
        }}
        a:hover {{
            text-decoration: underline;
        }}
        /* 段落样式 */
        p {{
            margin: 0;
            padding: 0;
        }}
        /* 隐藏微信特有组件 */
        mp-common-profile,
        .mp_profile_iframe_wrp,
        mp-style-type {{
            display: none !important;
        }}
        /* 原始样式 */
        {chr(10).join(styles)}
    </style>
    <script>var ct = "{publish_time or ''}";</script>
</head>
<body>
    <div class="weixin-article-wrapper">
        <h1 class="article-title">{title}</h1>
        <div class="article-meta">
            {f'<em id="publish_time" class="rich_media_meta rich_media_meta_text">{formatted_time}</em>' if formatted_time else ''}
        </div>
        <div class="article-content">
            {content_html}
        </div>
    </div>
</body>
</html>'''
        
        return html_template
    
    def save_article(self, url):
        """保存文章到本地"""
        # 获取文章内容
        html_content = self.get_article_content(url)
        if not html_content:
            return False
        
        # 解析HTML
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # 提取标题
        title = self.extract_title(soup)
        clean_title = self.clean_filename(title)
        
        print(f"文章标题: {title}")
        
        # 创建文章目录
        article_dir = os.path.join(self.output_dir, clean_title)
        os.makedirs(article_dir, exist_ok=True)
        
        # 提取发布时间（在清理HTML之前）
        publish_time = self.extract_publish_time(soup)
        if publish_time:
            print(f"发布时间戳: {publish_time}")
        
        # 清理HTML
        soup = self.clean_html(soup)
        
        # 处理图片
        print("正在下载图片...")
        image_count = self.process_images(soup, article_dir, url)
        print(f"共下载 {image_count} 张图片")
        
        # 创建独立HTML
        final_html = self.create_standalone_html(soup, title, publish_time)
        
        # 保存HTML文件
        html_path = os.path.join(article_dir, f"{clean_title}.html")
        with open(html_path, 'w', encoding='utf-8') as f:
            f.write(final_html)
        
        print(f"\n文章已保存到: {article_dir}")
        print(f"HTML文件: {html_path}")
        
        return True


class WeixinAutoMonitor:
    """微信公众号自动监控器"""
    
    def __init__(self, config_path="config.json", history_path="downloaded_history.json"):
        self.config_path = config_path
        self.history_path = history_path
        self.config = self.load_config()
        self.history = self.load_history()
        self.saver = WeixinArticleSaver(output_dir=self.config.get("output_dir", "weixin_articles"))
        
    def load_config(self):
        """加载配置文件"""
        try:
            if os.path.exists(self.config_path):
                with open(self.config_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            return {}
        except Exception as e:
            print(f"加载配置失败: {e}")
            return {}
            
    def load_history(self):
        """加载历史记录"""
        try:
            if os.path.exists(self.history_path):
                with open(self.history_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            return {"downloaded_urls": []}
        except Exception as e:
            print(f"加载历史记录失败: {e}")
            return {"downloaded_urls": []}
            
    def save_history(self):
        """保存历史记录"""
        try:
            with open(self.history_path, 'w', encoding='utf-8') as f:
                json.dump(self.history, f, ensure_ascii=False, indent=4)
        except Exception as e:
            print(f"保存历史记录失败: {e}")
            
    def check_and_download(self):
        """检查更新并下载新文章"""
        rsshub_base = self.config.get("rsshub_base_url", "http://localhost:1200")
        accounts = self.config.get("accounts", [])
        
        if not accounts:
            print("❌ 配置文件中未找到公众号列表")
            return
            
        for account in accounts:
            name = account.get("name", "Unknown")
            biz = account.get("biz")
            # 支持直接配置 RSS URL
            rss_url = account.get("rss_url")
            
            if not rss_url:
                if not biz:
                    print(f"⚠️ 忽略公众号 {name}: 缺少 biz 或 rss_url")
                    continue
                rss_url = f"{rsshub_base}/wechat/mp/msgalist/{biz}"
                
            print(f"\n[Monitor] 正在检查公众号: {name}")
            print(f"  源地址: {rss_url}")
            
            try:
                feed = feedparser.parse(rss_url)
                
                if hasattr(feed, 'status'):
                    print(f"  RSS 响应状态码: {feed.status}")
                
                if not feed.entries:
                    print(f"  ❌ 未发现文章或抓取失败。")
                    if hasattr(feed, 'status') and feed.status == 503:
                        print("  💡 提示: RSSHub 返回 503，通常是由于被微信封锁或路由已失效。")
                    continue
                    
                new_articles_count = 0
                for entry in feed.entries:
                    url = entry.link
                    clean_url = url.split('&')[0] if 'mp.weixin.qq.com' in url else url
                    
                    if clean_url in self.history["downloaded_urls"]:
                        continue
                        
                    # 标题关键词过滤
                    keywords = account.get("keywords", [])
                    if keywords:
                        match = any(kw in entry.title for kw in keywords)
                        if not match:
                            # 如果是初始化模式，我们也把不匹配的也记录为“已阅”，避免以后多余检查
                            if self.config.get("init_only", False):
                                self.history["downloaded_urls"].append(clean_url)
                            continue

                    print(f"  🎯 发现匹配新文章: {entry.title}")
                    
                    # 如果是初始化模式，不执行下载，仅记录历史
                    if self.config.get("init_only", False):
                        print(f"    [Init] 已标记为已下载 (不执行下载)")
                        self.history["downloaded_urls"].append(clean_url)
                        new_articles_count += 1
                        continue

                    if self.saver.save_article(url):
                        self.history["downloaded_urls"].append(clean_url)
                        new_articles_count += 1
                        if new_articles_count >= 5:
                            break
                    time.sleep(2)
                
                if new_articles_count > 0:
                    status_text = "标记" if self.config.get("init_only") else "下载"
                    print(f"  ✅ 公众号 {name} 处理完成，{status_text}了 {new_articles_count} 篇文章")
                    self.save_history()
                else:
                    print(f"  ☕ 公众号 {name} 无匹配更新")
                    
            except Exception as e:
                print(f"  💥 处理公众号 {name} 时出错: {e}")


def main():
    parser = argparse.ArgumentParser(
        description='微信公众号文章保存工具 - 将微信公众号文章保存到本地',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
示例:
  python save_weixin_article.py https://mp.weixin.qq.com/s/xxxxx
  python save_weixin_article.py --auto
  python save_weixin_article.py -c config.json --auto
        '''
    )
    parser.add_argument('url', nargs='?', help='微信公众号文章URL')
    parser.add_argument('-o', '--output', default='weixin_articles', 
                        help='输出目录 (默认: weixin_articles)')
    parser.add_argument('--auto', action='store_true', help='开启自动监控模式')
    parser.add_argument('-c', '--config', default='config.json', help='配置文件路径 (仅自动模式使用)')
    parser.add_argument('--history', default='downloaded_history.json', help='历史记录文件路径')
    
    args = parser.parse_args()
    
    if args.auto:
        print("[Mode] 开启自动监控下载模式")
        monitor = WeixinAutoMonitor(config_path=args.config, history_path=args.history)
        monitor.check_and_download()
    elif args.url:
        # 验证URL
        if 'mp.weixin.qq.com' not in args.url:
            print("警告: 这可能不是一个有效的微信公众号文章链接")
            print("微信公众号文章链接通常以 https://mp.weixin.qq.com/s/ 开头")
        
        # 创建保存器并保存文章
        saver = WeixinArticleSaver(output_dir=args.output)
        success = saver.save_article(args.url)
        
        if success:
            print("\n[OK] 文章保存成功!")
        else:
            print("\n[FAIL] 文章保存失败!")
            sys.exit(1)
    else:
        parser.print_help()


if __name__ == '__main__':
    main()