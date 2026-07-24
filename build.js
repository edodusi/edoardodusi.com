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

  const monoPath = path.join(__dirname, 'roboto-mono.woff');
  const monoBuffer = await downloadFont('https://cdn.jsdelivr.net/npm/@fontsource/roboto-mono/files/roboto-mono-latin-400-normal.woff', monoPath);

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
    const avatarBase64 = fs.readFileSync(path.join(__dirname, 'docs/avatar.jpg')).toString('base64');
    const markup = html`
      <div style="display: flex; flex-direction: column; width: 1200px; height: 630px; background-color: #ffffff; font-family: 'Inter'; padding: 24px;">
        <div style="display: flex; flex-direction: column; flex-grow: 1; border: 1px solid #2d3139; border-radius: 16px; background-color: #15161b; padding: 48px 56px;">
          
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 40px;">
            <div style="display: flex; align-items: center;">
              <img src="data:image/jpeg;base64,${avatarBase64}" style="width: 140px; height: 140px; margin-right: 24px; margin-top: -12px;" />
              <div style="display: flex; font-size: 50px; font-weight: 700; letter-spacing: -0.01em;">
                <span style="color: #8b949e;">edoardodusi/</span>
                <span style="color: #c9d1d9;">${slug}</span>
              </div>
            </div>
            <div style="display: flex;">
              <svg viewBox="0 0 16 16" width="56" height="56" fill="#8b949e">
                <path fill-rule="evenodd" d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 011-1h8zM5 12.25v3.25a.25.25 0 00.4.2l1.45-1.087a.25.25 0 01.3 0L8.6 15.7a.25.25 0 00.4-.2v-3.25a.25.25 0 00-.25-.25h-3.5a.25.25 0 00-.25.25z"></path>
              </svg>
            </div>
          </div>

          <div style="display: flex; font-size: 42px; font-family: 'Roboto Mono'; color: #8b949e; line-height: 1.5; margin-bottom: 20px; max-width: 1000px;">
            ${title}
          </div>

          <div style="display: flex; flex-grow: 1;"></div>

          <div style="display: flex; align-items: center; font-size: 28px; color: #8b949e; margin-bottom: 24px;">
            <div style="display: flex; align-items: center; margin-right: 48px;">
              <svg viewBox="0 0 16 16" width="32" height="32" fill="#8b949e" style="margin-right: 12px;"><path fill-rule="evenodd" d="M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25z"></path></svg>
              0 Stars
            </div>
            <div style="display: flex; align-items: center; margin-right: 48px;">
              <svg viewBox="0 0 16 16" width="32" height="32" fill="#8b949e" style="margin-right: 12px;"><path fill-rule="evenodd" d="M5 3.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm0 2.122a2.25 2.25 0 10-1.5 0v.878A2.25 2.25 0 005.75 8.5h1.5v2.128a2.251 2.251 0 101.5 0V8.5h1.5a2.25 2.25 0 002.25-2.25v-.878a2.25 2.25 0 10-1.5 0v.878a.75.75 0 01-.75.75h-4.5A.75.75 0 015 6.25v-.878zm3.75 7.378a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm3-8.75a.75.75 0 100-1.5.75.75 0 000 1.5z"></path></svg>
              0 Forks
            </div>
            <div style="display: flex; align-items: center;">
              <svg viewBox="0 0 16 16" width="32" height="32" fill="#8b949e" style="margin-right: 12px;"><path fill-rule="evenodd" d="M1.679 7.932c.412-1.067 1.49-2.758 3.023-4.01C6.222 2.684 7.63 2 9 2c1.37 0 2.778.684 4.298 1.922 1.533 1.252 2.611 2.943 3.023 4.01a.75.75 0 010 .536c-.412 1.067-1.49 2.758-3.023 4.01C11.778 13.316 10.37 14 9 14c-1.37 0-2.778-.684-4.298-1.922-1.533-1.252-2.611-2.943-3.023-4.01a.75.75 0 010-.536zM9 3.5c-1.073 0-2.264.555-3.52 1.58C4.243 6.091 3.25 7.439 2.82 8c.43.561 1.423 1.909 2.66 2.92C6.736 11.945 7.927 12.5 9 12.5c1.073 0 2.264-.555 3.52-1.58C13.757 9.909 14.75 8.561 15.18 8c-.43-.561-1.423-1.909-2.66-2.92C11.264 4.055 10.073 3.5 9 3.5zM9 10a2 2 0 100-4 2 2 0 000 4z"></path></svg>
              1 Reader
            </div>
          </div>

          <div style="display: flex; height: 12px; width: 100%; border-radius: 6px; overflow: hidden; margin-bottom: 16px;">
            <div style="display: flex; background-color: #3178c6; height: 100%; width: 60%;"></div>
            <div style="display: flex; background-color: #e34c26; height: 100%; width: 40%;"></div>
          </div>
          
          <div style="display: flex; font-size: 26px; color: #8b949e;">
            <div style="display: flex; align-items: center; margin-right: 32px;">
              <div style="display: flex; width: 14px; height: 14px; border-radius: 50%; background-color: #3178c6; margin-right: 12px;"></div>
              Markdown 60%
            </div>
            <div style="display: flex; align-items: center;">
              <div style="display: flex; width: 14px; height: 14px; border-radius: 50%; background-color: #e34c26; margin-right: 12px;"></div>
              Love 40%
            </div>
          </div>
        </div>
      </div>
    `;

    const svg = await satori(markup, {
      width: 1200,
      height: 630,
      fonts: [
        { name: 'Inter', data: fontBuffer, weight: 700, style: 'normal' },
        { name: 'Roboto Mono', data: monoBuffer, weight: 400, style: 'normal' }
      ],
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
