# edoardodusi.com

Source for [edoardodusi.com](https://edoardodusi.com) — the personal site of
Edoardo Dusi: DevRel Team Manager at Storyblok, podcaster, conference speaker,
and writer based in Bologna, Italy.

The home page is a single, hand-written, dependency-free static page: HTML, CSS,
and a sprinkle of vanilla JS, light/dark theme aware. The blog is generated from
markdown by a small custom static site generator (`build.js`) that also produces
the blog index, RSS feed, sitemap, per-post Open Graph images, and AI-facing
indexes.

## Structure

```
content/blog/            # blog post sources — the only place posts are written
└── <slug>.md            # front matter + markdown body
templates/
├── blog-layout.html     # single post template
└── blog-list.html       # blog index template
build.js                 # static site generator
docs/                    # GitHub Pages root (served at edoardodusi.com)
├── index.html           # hand-written home page: Work, Podcast, Speaking, Writing, ...
├── main.css             # styles for the home page
├── main.js              # theme toggle + scroll reveal
├── style.css            # styles for the CodeRoutine subpages
├── avatar.jpg           # embedded into the generated OG images
├── og.jpg               # social preview for the home page
├── robots.txt
├── CNAME                # custom domain mapping
├── coderoutine/         # CodeRoutine app landing + privacy policy
├── syntax.css           # generated — highlight.js Dracula theme
├── sitemap.xml          # generated
├── llms.txt             # generated — index for AI crawlers
├── llms-full.txt        # generated — full post content for AI crawlers
└── blog/                # generated — do not edit by hand
    ├── index.html       # blog home
    ├── rss.xml          # RSS feed
    └── <year>/
        ├── <slug>.html  # post page
        └── <slug>-og.png# per-post Open Graph image (1200x630)
```

## Writing a post

1. Create `content/blog/<slug>.md`. The filename, in kebab-case, is the slug and
   ends up in both the URL and the generated OG image, so keep it short.
2. Add the front matter:

   ```markdown
   ---
   title: "Article title"
   date: "YYYY-MM-DD"
   tags: ["Tag One", "Tag Two"]
   excerpt: "A concise description of the article."
   ---

   Article body in markdown.
   ```

3. Push to `master`. The build runs on CI and publishes the post.

Notes:

- `date` decides the output folder (`docs/blog/<year>/`) and the ordering in the
  blog index, RSS, and sitemap.
- `tags` drive the coloured bar in the generated OG image, with a decreasing
  weight from the first tag to the last one, so order them by relevance and keep
  the list short. With no tags, the image falls back to `Markdown, Love`.
- Reading time is computed from the body at 200 words per minute.
- Never edit `docs/blog/` by hand: it is regenerated on every build and any
  manual change is overwritten.

## Build

```sh
npm ci
npm run build   # node build.js
```

The build reads every `content/blog/*.md` file and writes, under `docs/`:

- `blog/<year>/<slug>.html` from `templates/blog-layout.html`, with title, date,
  ISO date, reading time, tags, excerpt, canonical URL, and OG image
- `blog/<year>/<slug>-og.png`, a GitHub-repo-card style Open Graph image
  rendered with Satori and resvg
- `blog/index.html` from `templates/blog-list.html`, newest post first
- `blog/rss.xml`, `sitemap.xml`, `llms.txt`, `llms-full.txt`, `syntax.css`

On the first run the build downloads the Inter and Roboto Mono web fonts used by
the OG image renderer and caches them in the repository root.

### Continuous build

`.github/workflows/build-blog.yml` runs on every push to `master` that touches
`content/**`, `templates/**`, `build.js`, or `package*.json`. It installs
dependencies, runs `npm run build`, and commits the regenerated `docs/` folder
with the message `chore: auto-build blog`. Running the build locally is only
necessary to preview changes before pushing.

## Local preview

No tooling required for the static pages — open `docs/index.html` directly, or
serve the folder:

```sh
cd docs
python3 -m http.server 8000
# then open http://localhost:8000
```

To preview a new post, run `npm run build` first.

## Deployment

Hosted on **GitHub Pages** from the `docs/` folder on the `master` branch.
Pushing to `master` publishes automatically; the custom domain is set via
`docs/CNAME`.

## Updating the home page

The Speaking, Writing, and Guest Appearances lists are plain `<li>` rows in
`docs/index.html`, grouped by year in reverse-chronological order. To add an
entry, copy an existing row in the right year block and edit the title, venue,
link, and date.

When changing the home page social preview, keep `og.jpg` at ~1200px wide (well
under the 5 MB cap) and re-validate with LinkedIn's
[Post Inspector](https://www.linkedin.com/post-inspector/) so caches refresh.
Post-specific previews are generated automatically and need no manual work.

## License

Code licensed under [Apache License 2.0](LICENSE). Content © Edoardo Dusi.
