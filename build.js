const fs = require('fs');
const path = require('path');
const https = require('https');
const fm = require('front-matter');
const { marked } = require('marked');
const { markedHighlight } = require('marked-highlight');
const hljs = require('highlight.js');
const { html } = require('satori-html');
const satori = require('satori').default || require('satori');
const { Resvg } = require('@resvg/resvg-js');

marked.use(markedHighlight({
  langPrefix: 'hljs language-',
  highlight(code, lang) {
    const language = hljs.getLanguage(lang) ? lang : 'plaintext';
    return hljs.highlight(code, { language }).value;
  }
}));

const contentDir = path.join(__dirname, 'content/blog');
const outputDir = path.join(__dirname, 'docs/blog');
const templatesDir = path.join(__dirname, 'templates');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const cssSource = path.join(__dirname, 'node_modules/highlight.js/styles/base16/dracula.css');
const cssDest = path.join(__dirname, 'docs/syntax.css');
fs.copyFileSync(cssSource, cssDest);

const layoutTemplate = fs.readFileSync(path.join(templatesDir, 'blog-layout.html'), 'utf-8');
const listTemplate = fs.readFileSync(path.join(templatesDir, 'blog-list.html'), 'utf-8');

// Escape a value for use in HTML text nodes and attribute values.
// Without this, a double quote in a post title breaks attributes such as
// <meta property="og:title" content="{{title}}" />.
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Escape a value for embedding inside a JSON string literal (JSON-LD).
function escapeJsonString(value) {
  return JSON.stringify(String(value)).slice(1, -1);
}

// Straight quotes read as prime marks in display type, badly so in a condensed
// face. Applied to titles and excerpts, so the page, OG image, RSS and JSON-LD
// all carry the same text.
function typographicQuotes(value) {
  return String(value)
    .replace(/(^|[\s([{—–-])"/g, '$1“')
    .replace(/"/g, '”')
    .replace(/(\p{L})'(\p{L})/gu, '$1’$2')
    .replace(/(^|[\s([{])'/g, '$1‘')
    .replace(/'/g, '’');
}

async function downloadFont(url, dest) {
  if (fs.existsSync(dest)) return fs.readFileSync(dest);
  console.log('Downloading Inter font...');
  const res = await fetch(url);
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  fs.writeFileSync(dest, buffer);
  return buffer;
}

async function build() {
  const fontPath = path.join(__dirname, 'inter.woff');
  const fontBuffer = await downloadFont('https://cdn.jsdelivr.net/npm/@fontsource/inter/files/inter-latin-700-normal.woff', fontPath);

  const monoPath = path.join(__dirname, 'roboto-mono.woff');
  const monoBuffer = await downloadFont('https://cdn.jsdelivr.net/npm/@fontsource/roboto-mono/files/roboto-mono-latin-400-normal.woff', monoPath);

  // Anton, the logo face, for OG titles. Satori can't read woff2, so this is
  // the woff build of the same font the site self-hosts.
  const antonPath = path.join(__dirname, 'anton.woff');
  const antonBuffer = await downloadFont('https://cdn.jsdelivr.net/npm/@fontsource/anton/files/anton-latin-400-normal.woff', antonPath);

  const avatarBase64 = fs.readFileSync(path.join(__dirname, 'docs/img/edo-avatar-og.jpg')).toString('base64');

  // --- OG card renderer ------------------------------------------------------
  // Brand card: navy ground, the title in Anton, the illustrated avatar on a
  // yellow offset block (the homepage hero's composition), a yellow rule at
  // the foot. The title steps down in size as it gets longer so it always
  // fits in four lines. Used for every post and for the static pages.
  async function renderOgCard({ topline, title, meta }) {
    const titleSize = title.length <= 36 ? 92 : title.length <= 60 ? 78 : title.length <= 90 ? 64 : 54;
    const markupString = `
      <div style="display: flex; width: 1200px; height: 630px; background-color: #0a1543; font-family: 'Inter'; position: relative;">
        <div style="display: flex; flex-direction: column; width: 820px; height: 616px; padding: 60px 0 52px 72px;">
          <div style="display: flex; font-family: 'Roboto Mono'; font-size: 26px; color: #ffd500;">${escapeHtml(topline)}</div>
          <div style="display: flex; flex-grow: 1; align-items: center;">
            <div style="display: flex; font-family: 'Anton'; font-size: ${titleSize}px; line-height: 1.08; color: #ffffff;">${escapeHtml(title)}</div>
          </div>
          <div style="display: flex; font-family: 'Roboto Mono'; font-size: 24px; color: #aab3d6;">${escapeHtml(meta)}</div>
        </div>
        <div style="display: flex; position: absolute; left: 870px; top: 96px; width: 270px; height: 270px; background-color: #ffd500;"></div>
        <img src="data:image/jpeg;base64,${avatarBase64}" style="position: absolute; left: 854px; top: 80px; width: 270px; height: 270px; border: 6px solid #0a1543;" />
        <div style="display: flex; flex-direction: column; position: absolute; left: 854px; top: 398px; width: 290px;">
          <div style="display: flex; font-size: 30px; color: #ffffff;">Edoardo Dusi</div>
          <div style="display: flex; font-family: 'Roboto Mono'; font-size: 19px; color: #aab3d6; margin-top: 6px;">Senior Developer Advocate</div>
        </div>
        <div style="display: flex; position: absolute; left: 0; bottom: 0; width: 1200px; height: 14px; background-color: #ffd500;"></div>
      </div>
    `;

    const svg = await satori(html([markupString]), {
      width: 1200,
      height: 630,
      fonts: [
        { name: 'Inter', data: fontBuffer, weight: 700, style: 'normal' },
        { name: 'Roboto Mono', data: monoBuffer, weight: 400, style: 'normal' },
        { name: 'Anton', data: antonBuffer, weight: 400, style: 'normal' },
      ],
    });

    return new Resvg(svg, { font: { loadSystemFonts: false } }).render().asPng();
  }

  // Static pages get the same card. Their copy lives here, next to the post
  // cards, so a headline change on a page means a one-line edit below.
  const staticCards = [
    { file: 'docs/og.png', topline: 'edoardodusi.com', title: 'Turning hard tech into talks developers remember', meta: 'Talks  ·  Writing  ·  Podcast' },
    { file: 'docs/blog/og.png', topline: 'edoardodusi.com/blog', title: 'Unfiltered thoughts on the web, cloud, AI and code', meta: 'Blog  ·  RSS' },
    { file: 'docs/speaker/og.png', topline: 'edoardodusi.com/speaker', title: 'Invite me to speak', meta: 'Keynotes  ·  Talks  ·  Workshops  ·  EN / IT' },
  ];
  for (const card of staticCards) {
    fs.mkdirSync(path.dirname(path.join(__dirname, card.file)), { recursive: true });
    fs.writeFileSync(path.join(__dirname, card.file), await renderOgCard(card));
  }

  // Drafts are skipped unless DRAFTS=1, so a post can be pushed before it's
  // ready and previewed locally with `DRAFTS=1 npm run build`.
  const includeDrafts = process.env.DRAFTS === '1';

  let files = [];
  if (fs.existsSync(contentDir)) {
    files = fs.readdirSync(contentDir).filter(f => f.endsWith('.md'));
  }

  let posts = [];

  for (const file of files) {
    const content = fs.readFileSync(path.join(contentDir, file), 'utf-8');
    const parsed = fm(content);
    
    const title = typographicQuotes(parsed.attributes.title || 'Untitled');
    const date = parsed.attributes.date ? new Date(parsed.attributes.date) : new Date();
    const excerpt = typographicQuotes(parsed.attributes.excerpt || '');
    const slug = file.replace('.md', '');
    
    const year = date.getFullYear().toString();
    const yearDir = path.join(outputDir, year);
    if (!fs.existsSync(yearDir)) {
      fs.mkdirSync(yearDir, { recursive: true });
    }

    if (parsed.attributes.draft === true && !includeDrafts) {
      console.log(`Skipping draft: ${file}`);
      continue;
    }

    const rawTags = parsed.attributes.tags;
    let tagArray = [];
    if (rawTags) {
      tagArray = Array.isArray(rawTags) ? rawTags : rawTags.split(',').map(t => t.trim());
    }

    const updated = parsed.attributes.updated ? new Date(parsed.attributes.updated) : null;
    const lang = parsed.attributes.lang || 'en';
    const cover = parsed.attributes.cover || '';
    const coverAlt = typographicQuotes(parsed.attributes.cover_alt || '');

    const wordCount = parsed.body.trim().split(/\s+/).length;
    const readingTime = Math.max(1, Math.ceil(wordCount / 200));
    const longDate = (d) => d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const dateString = longDate(date);

    // --- OG image -------------------------------------------------------------
    // Date, read time, then as many tags as fit on one line.
    let ogMeta = [
      date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
      `${readingTime} min read`,
    ].join('  ·  ');
    for (const tag of tagArray) {
      const next = `${ogMeta}  ·  #${tag.toLowerCase()}`;
      if (next.length > 50) break;
      ogMeta = next;
    }

    const pngBuffer = await renderOgCard({ topline: 'edoardodusi.com/blog', title, meta: ogMeta });
    const ogFileName = `${slug}-og.png`;
    fs.writeFileSync(path.join(yearDir, ogFileName), pngBuffer);

    // Wrap tables so wide ones scroll horizontally instead of overflowing the column.
    const htmlContent = marked.parse(parsed.body)
      .replace(/<table>[\s\S]*?<\/table>/g, (t) => `<div class="table-wrap">${t}</div>`);
    const relativeUrl = `${year}/${slug}.html`;

    posts.push({
      title, date, updated, excerpt, lang, cover, coverAlt, tagArray, dateString,
      htmlContent, readingTime, yearDir, slug,
      url: relativeUrl,
      ogImageUrl: `https://edoardodusi.com/blog/${year}/${ogFileName}`,
      body: parsed.body,
    });
  }

  posts.sort((a, b) => b.date - a.date);

  // Pages are rendered after sorting so each post can link its neighbours.
  posts.forEach((post, i) => {
    const newer = posts[i - 1];
    const older = posts[i + 1];

    let pageTagsHtml = '';
    if (post.tagArray.length > 0) {
      pageTagsHtml = '<ul class="article-tags" aria-label="Tags">' + post.tagArray.map(t => `<li class="tag">${escapeHtml(t)}</li>`).join('') + '</ul>';
    }

    const updatedHtml = post.updated
      ? ` &middot; Updated <time class="dt-updated" datetime="${post.updated.toISOString()}">${post.updated.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</time>`
      : '';

    const coverHtml = post.cover
      ? `<figure class="post-cover reveal"><img src="${escapeHtml(post.cover)}" alt="${escapeHtml(post.coverAlt)}" decoding="async" /></figure>`
      : '';

    const navLink = (p, label, cls) => p
      ? `<a class="post-nav-link ${cls}" href="/blog/${p.url}"><span class="card-label">${label}</span><span class="card-title">${escapeHtml(p.title)}</span></a>`
      : '<span></span>';
    const postNavHtml = (newer || older)
      ? `<nav class="post-nav" aria-label="More posts">${navLink(older, '&larr; Older', 'older')}${navLink(newer, 'Newer &rarr;', 'newer')}</nav>`
      : '';

    const isoDate = post.date.toISOString();
    const isoUpdated = (post.updated || post.date).toISOString();

    // Title and excerpt appear both in HTML contexts (text nodes, attribute
    // values) and inside the JSON-LD script block. Escape the JSON-LD block
    // first with JSON string escaping, then everything else as HTML.
    const safeTemplate = layoutTemplate.replace(
      /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
      (block) => block
        .replace(/{{title}}/g, escapeJsonString(post.title))
        .replace(/{{excerpt}}/g, escapeJsonString(post.excerpt))
    );

    const postHtml = safeTemplate
      .replace(/{{lang}}/g, escapeHtml(post.lang))
      .replace(/{{title}}/g, escapeHtml(post.title))
      .replace(/{{date}}/g, post.dateString)
      .replace(/{{iso_date}}/g, isoDate)
      .replace(/{{iso_updated}}/g, isoUpdated)
      .replace(/{{updated}}/g, updatedHtml)
      .replace(/{{reading_time}}/g, `${post.readingTime} min read`)
      .replace(/{{cover}}/g, coverHtml)
      .replace(/{{post_nav}}/g, postNavHtml)
      .replace(/{{excerpt}}/g, escapeHtml(post.excerpt))
      .replace(/{{url}}/g, `https://edoardodusi.com/blog/${post.url}`)
      .replace(/{{og_image}}/g, post.ogImageUrl)
      .replace(/{{tags}}/g, pageTagsHtml)
      // Content last: a post that mentions "{{title}}" in a code block must
      // not have it substituted.
      .replace(/{{content}}/g, () => post.htmlContent);

    fs.writeFileSync(path.join(post.yearDir, `${post.slug}.html`), postHtml);
  });

  let postListHtml = '';
  if (posts.length > 0) {
    postListHtml = '<ol class="stack">\n';
    for (const post of posts) {
      postListHtml += `
        <li class="row">
          <div class="row-main">
            <a href="${post.url}">${escapeHtml(post.title)}</a>
            <p>${escapeHtml(post.excerpt)}</p>
          </div>
          <span class="row-meta">${post.date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })} &middot; ${post.readingTime} min</span>
        </li>
      `;
    }
    postListHtml += '</ol>';
  } else {
    postListHtml = '<p class="muted">No posts yet. Check back soon!</p>';
  }

  const finalIndexHtml = listTemplate.replace(/{{posts}}/g, postListHtml);
  fs.writeFileSync(path.join(outputDir, 'index.html'), finalIndexHtml);

  // Generate RSS Feed
  const rssItems = posts.map(post => `
    <item>
      <title><![CDATA[${post.title}]]></title>
      <link>https://edoardodusi.com/blog/${post.url}</link>
      <description><![CDATA[${post.excerpt}]]></description>
      <pubDate>${post.date.toUTCString()}</pubDate>
      <guid>https://edoardodusi.com/blog/${post.url}</guid>
    </item>
  `).join('');

  const rssFeed = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>Edoardo Dusi's Blog</title>
  <link>https://edoardodusi.com/blog</link>
  <description>Articles, thoughts, and updates from Edoardo Dusi</description>
  <language>en-us</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
  <atom:link href="https://edoardodusi.com/blog/rss.xml" rel="self" type="application/rss+xml" />
  ${rssItems}
</channel>
</rss>`;

  fs.writeFileSync(path.join(outputDir, 'rss.xml'), rssFeed);

  // Generate Sitemap
  const staticUrls = [
    { loc: 'https://edoardodusi.com/', priority: '1.0', changefreq: 'monthly' },
    { loc: 'https://edoardodusi.com/blog/', priority: '0.9', changefreq: 'weekly' },
    { loc: 'https://edoardodusi.com/speaker/', priority: '0.8', changefreq: 'monthly' },
  ];

  const postUrls = posts.map(post => ({
    loc: `https://edoardodusi.com/blog/${post.url}`,
    lastmod: (post.updated || post.date).toISOString().split('T')[0],
    priority: '0.8',
    changefreq: 'never',
  }));

  const allUrls = [...staticUrls, ...postUrls];
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.map(u => `  <url>
    <loc>${u.loc}</loc>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ''}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

  fs.writeFileSync(path.join(path.dirname(outputDir), 'sitemap.xml'), sitemapXml);

  // Generate llms.txt (index for AI)
  const docsDir = path.dirname(outputDir);
  const llmsTxt = `# Edoardo Dusi

> Senior Developer Advocate at AWS, speaker, and blogger writing about the web, cloud, AI, coding and the developer ecosystem.

## Blog Posts
${posts.map(p => `- [${p.title}](https://edoardodusi.com/blog/${p.url}): ${p.excerpt}`).join('\n')}

## Links
- [Speaker kit](https://edoardodusi.com/speaker/)
- [Blog](https://edoardodusi.com/blog/)
- [RSS Feed](https://edoardodusi.com/blog/rss.xml)
- [Sitemap](https://edoardodusi.com/sitemap.xml)
`;
  fs.writeFileSync(path.join(docsDir, 'llms.txt'), llmsTxt);

  // Generate llms-full.txt (full content for AI)
  const llmsFullTxt = `# Edoardo Dusi - Full Blog Content

> Senior Developer Advocate at AWS, speaker, and blogger writing about the web, cloud, AI, coding and the developer ecosystem.
> Website: https://edoardodusi.com

---

${posts.map(p => {
    const dateStr = p.date.toISOString().split('T')[0];
    return `# ${p.title}\nURL: https://edoardodusi.com/blog/${p.url}\nDate: ${dateStr}\nReading time: ${p.readingTime} min\n\n${p.body.trim()}`;
  }).join('\n\n---\n\n')}
`;
  fs.writeFileSync(path.join(docsDir, 'llms-full.txt'), llmsFullTxt);

  console.log(`\n✅ Build complete! Generated ${posts.length} blog posts, custom OG Images, RSS feed, sitemap, and llms.txt in docs/`);
}

build().catch(console.error);
