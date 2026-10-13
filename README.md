# edoardodusi.com

Source for [edoardodusi.com](https://edoardodusi.com) — the personal site of
Edoardo Dusi: Senior Developer Advocate at AWS, podcaster, conference speaker,
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
├── img/edo-avatar*.jpg  # illustrated avatar: speaker kit, OG cards, author card
├── og.png               # generated - social preview for the home page
├── robots.txt
├── CNAME                # custom domain mapping
├── speaker/index.html   # hand-written speaker kit: bios, talks, photos, A/V
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

   Optional fields:

   ```markdown
   updated: "YYYY-MM-DD"       # shows "Updated ..." and sets dateModified / sitemap lastmod
   lang: "it"                  # sets <html lang>; defaults to "en"
   cover: "/img/posts/x.jpg"   # image shown under the title
   cover_alt: "Description"    # alt text for the cover
   draft: true                 # skipped by the build; preview with `DRAFTS=1 npm run build`
   ```

3. Push to `master`. The build runs on CI and publishes the post.

Notes:

- `date` decides the output folder (`docs/blog/<year>/`) and the ordering in the
  blog index, RSS, and sitemap.
- The OG image is a navy brand card: the title in Anton (it steps down in size
  as the title gets longer), the date, read time, and as many tags as fit on
  one line, so order tags by relevance.
- Fence plain output (logs, command results) as ```` ```text ````, not `bash`:
  it skips highlighting and the language label.
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
- `blog/<year>/<slug>-og.png`, a 1200x630 brand Open Graph image rendered with
  Satori and resvg
- `blog/index.html` from `templates/blog-list.html`, newest post first
- `blog/rss.xml`, `sitemap.xml`, `llms.txt`, `llms-full.txt`, `syntax.css`

On the first run the build downloads the Inter, Roboto Mono, and Anton web fonts
used by the OG image renderer and caches them in the repository root.

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

Long lists are wrapped in `<div data-collapse="N" data-label="...">`: `main.js`
shows the first N rows and adds a "Show N more" button. Without JS everything
shows. Talks collapse every 8, writing and guest appearances every 5.

The speaker kit lives in `docs/speaker/index.html`. Keep its bios, talk list,
and "Past stages" in sync when the home page changes.

Social previews are all generated by the build: `docs/og.png` (home),
`docs/blog/og.png`, `docs/speaker/og.png`, and one per post. The copy for the
three page cards is in `staticCards` in `build.js`. After changing one,
re-validate with LinkedIn's
[Post Inspector](https://www.linkedin.com/post-inspector/) so caches refresh.

## License

Code licensed under [Apache License 2.0](LICENSE). Content © Edoardo Dusi.
