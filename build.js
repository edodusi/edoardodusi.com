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

  let files = [];
  if (fs.existsSync(contentDir)) {
    files = fs.readdirSync(contentDir).filter(f => f.endsWith('.md'));
  }

  let posts = [];

  for (const file of files) {
    const content = fs.readFileSync(path.join(contentDir, file), 'utf-8');
    const parsed = fm(content);
    
    const title = parsed.attributes.title || 'Untitled';
    const date = parsed.attributes.date ? new Date(parsed.attributes.date) : new Date();
    const excerpt = parsed.attributes.excerpt || '';
    const slug = file.replace('.md', '');
    
    const year = date.getFullYear().toString();
    const yearDir = path.join(outputDir, year);
    if (!fs.existsSync(yearDir)) {
      fs.mkdirSync(yearDir, { recursive: true });
    }

    const dateString = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const markup = html`
      <div style="display: flex; flex-direction: column; width: 1200px; height: 630px; background-color: #121314; padding: 60px; font-family: 'Inter';">
        <div style="display: flex; flex-direction: column; flex-grow: 1; justify-content: center; border: 2px solid rgba(236, 234, 230, 0.12); border-radius: 24px; padding: 64px; background-color: #1a1b1d;">
          <div style="display: flex; align-items: center; font-size: 32px; color: #4fd1c5; margin-bottom: 32px; letter-spacing: 0.1em; text-transform: uppercase;">
            edoardodusi.com / blog
          </div>
          <div style="display: flex; font-size: 72px; font-weight: 700; color: #eceae6; line-height: 1.1; margin-bottom: 32px;">
            ${title}
          </div>
          <div style="display: flex; font-size: 36px; color: #a3a19b; line-height: 1.4;">
            ${excerpt}
          </div>
          <div style="display: flex; flex-grow: 1;"></div>
          <div style="display: flex; align-items: center; font-size: 28px; color: #a3a19b;">
            <div style="display: flex; width: 24px; height: 24px; border-radius: 50%; background-color: #4fd1c5; margin-right: 16px;"></div>
            Edoardo Dusi • ${dateString}
          </div>
        </div>
      </div>
    `;

    const svg = await satori(markup, {
      width: 1200,
      height: 630,
      fonts: [{ name: 'Inter', data: fontBuffer, weight: 700, style: 'normal' }],
    });

    const resvg = new Resvg(svg, { font: { loadSystemFonts: false } });
    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();
    const ogFileName = `${slug}-og.png`;
    fs.writeFileSync(path.join(yearDir, ogFileName), pngBuffer);

    const htmlContent = marked.parse(parsed.body);
    const relativeUrl = `${year}/${slug}.html`;
    const ogImageUrl = `https://edoardodusi.com/blog/${year}/${ogFileName}`;

    let postHtml = layoutTemplate
      .replace(/{{title}}/g, title)
      .replace(/{{date}}/g, dateString)
      .replace(/{{content}}/g, htmlContent)
      .replace(/{{excerpt}}/g, excerpt)
      .replace(/{{url}}/g, `https://edoardodusi.com/blog/${relativeUrl}`)
      .replace(/{{og_image}}/g, ogImageUrl);

    fs.writeFileSync(path.join(yearDir, `${slug}.html`), postHtml);
    posts.push({ title, date, excerpt, url: relativeUrl });
  }

  posts.sort((a, b) => b.date - a.date);

  let postListHtml = '';
  if (posts.length > 0) {
    postListHtml = '<ol class="stack">\n';
    for (const post of posts) {
      postListHtml += `
        <li class="row">
          <div class="row-main">
            <a href="${post.url}">${post.title}</a>
            <p>${post.excerpt}</p>
          </div>
          <span class="row-meta">${post.date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}</span>
        </li>
      `;
    }
    postListHtml += '</ol>';
  } else {
    postListHtml = '<p class="muted">No posts yet. Check back soon!</p>';
  }

  const finalIndexHtml = listTemplate.replace(/{{posts}}/g, postListHtml);
  fs.writeFileSync(path.join(outputDir, 'index.html'), finalIndexHtml);

  console.log(`\n✅ Build complete! Generated ${posts.length} blog posts and custom OG Images in docs/blog/`);
}

build().catch(console.error);
