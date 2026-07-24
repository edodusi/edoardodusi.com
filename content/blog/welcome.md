---
title: "Welcome to my new website and blog!"
date: "2026-07-24"
excerpt: "I finally decided to build a proper home on the internet. Here's a look under the hood of my new custom static site and markdown blog."
---

It was about time I gave my personal website a proper refresh. Welcome to the new home for my writing, speaking engagements, and side projects!

For this iteration, I wanted to keep things blisteringly fast and extremely minimal. Instead of reaching for a heavy JavaScript framework or a complex CMS, I decided to build a custom, zero-dependency Static Site Generator (SSG). 

## Under the Hood

The entire site is served as static HTML directly from GitHub Pages. The styling uses modern, vanilla CSS with CSS Variables for seamless light and dark mode switching. 

For the blog, I wrote a tiny Node.js build script that parses markdown files and generates the static HTML. 

```javascript
// A tiny peek at our custom build script
const fm = require('front-matter');
const { marked } = require('marked');

const parsed = fm(markdownContent);
const htmlContent = marked.parse(parsed.body);
```

I even added custom syntax highlighting using **Highlight.js** (specifically the gorgeous Dracula theme) so code snippets look perfectly crisp whether you are reading in light or dark mode. 

## What's Next?

I plan to use this space to share more in-depth thoughts on web development, Developer Relations, software architecture, and the open-source ecosystem. 

Stay tuned for more updates, and feel free to reach out on my socials if you have any questions about the setup!
