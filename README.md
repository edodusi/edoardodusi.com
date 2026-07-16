# edoardodusi.com

Source for [edoardodusi.com](https://edoardodusi.com) — the personal site of
Edoardo Dusi: DevRel Team Manager at Storyblok, podcaster, conference speaker,
and writer based in Bologna, Italy.

A single, hand-written, dependency-free static page. No framework, no build
step — just HTML, CSS, and a sprinkle of vanilla JS. Light/dark theme aware.

## Structure

```
docs/                 # GitHub Pages root (served at edoardodusi.com)
├── index.html        # the whole site: Work, Podcast, Speaking, Writing,
│                     #   Guest Appearances, Side Projects, Elsewhere
├── main.css          # styles for the main page
├── main.js           # theme toggle + scroll reveal
├── style.css         # styles for the CodeRoutine subpages
├── og.jpg            # social share preview (Open Graph / Twitter Card)
├── CNAME             # custom domain mapping
└── coderoutine/      # CodeRoutine app landing + privacy policy
```

## Local preview

No tooling required — open `docs/index.html` directly, or serve the folder:

```sh
cd docs
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deployment

Hosted on **GitHub Pages** from the `docs/` folder on the `master` branch.
Pushing to `master` publishes automatically; the custom domain is set via
`docs/CNAME`.

## Updating content

The Speaking, Writing, and Guest Appearances lists are plain `<li>` rows in
`index.html`, grouped by year in reverse-chronological order. To add an entry,
copy an existing row in the right year block and edit the title, venue, link,
and date.

When changing the social preview, keep `og.jpg` at ~1200px wide (well under the
5 MB cap) and re-validate with LinkedIn's [Post Inspector](https://www.linkedin.com/post-inspector/)
so caches refresh.

## License

Code licensed under [Apache License 2.0](LICENSE). Content © Edoardo Dusi.
