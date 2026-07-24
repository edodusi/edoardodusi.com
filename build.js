const fs = require('fs');
const path = require('path');
const fm = require('front-matter');
const { marked } = require('marked');
const { markedHighlight } = require('marked-highlight');
const hljs = require('highlight.js');

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

// Ensure output dir exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Copy highlight.js CSS so it's fully local and zero-dependency at runtime
const cssSource = path.join(__dirname, 'node_modules/highlight.js/styles/base16/dracula.css');
const cssDest = path.join(__dirname, 'docs/syntax.css');
fs.copyFileSync(cssSource, cssDest);

// Read templates
const layoutTemplate = fs.readFileSync(path.join(templatesDir, 'blog-layout.html'), 'utf-8');
const listTemplate = fs.readFileSync(path.join(templatesDir, 'blog-list.html'), 'utf-8');

// Get all markdown files
let files = [];
if (fs.existsSync(contentDir)) {
  files = fs.readdirSync(contentDir).filter(f => f.endsWith('.md'));
}

let posts = [];

for (const file of files) {
  const content = fs.readFileSync(path.join(contentDir, file), 'utf-8');
  const parsed = fm(content);
  
  // Basic metadata
  const title = parsed.attributes.title || 'Untitled';
  const date = parsed.attributes.date ? new Date(parsed.attributes.date) : new Date();
  const excerpt = parsed.attributes.excerpt || '';
  const slug = file.replace('.md', '');
  
  // Generate year folder
  const year = date.getFullYear().toString();
  const yearDir = path.join(outputDir, year);
  if (!fs.existsSync(yearDir)) {
    fs.mkdirSync(yearDir, { recursive: true });
  }

  // Parse markdown
  const htmlContent = marked.parse(parsed.body);
  const relativeUrl = `${year}/${slug}.html`;

  // Create post HTML
  let postHtml = layoutTemplate
    .replace(/{{title}}/g, title)
    .replace(/{{date}}/g, date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }))
    .replace(/{{content}}/g, htmlContent)
    .replace(/{{excerpt}}/g, excerpt)
    .replace(/{{url}}/g, `https://edoardodusi.com/blog/${relativeUrl}`);

  fs.writeFileSync(path.join(yearDir, `${slug}.html`), postHtml);

  posts.push({
    title,
    date,
    excerpt,
    url: relativeUrl
  });
}

// Sort posts by date descending
posts.sort((a, b) => b.date - a.date);

// Generate blog index
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

console.log(`\n✅ Build complete! Generated ${posts.length} blog posts in docs/blog/`);
console.log(`✅ Copied syntax highlighting CSS to docs/syntax.css\n`);
