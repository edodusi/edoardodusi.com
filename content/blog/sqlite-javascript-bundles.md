---
title: "SQLite for JavaScript bundles, plus a distributed version on Lambda"
date: "2026-11-04"
tags: ["JavaScript", "SQLite", "Bundlers", "AWS Lambda"]
draft: true
excerpt: "What if a JavaScript bundle were a SQLite database? I tested a vibe-coded prototype with Kiro Crew, rebuilt it until it matched esbuild, then spread the build across AWS Lambda and made a website that bundles itself on the first visit."
---

A JavaScript bundler takes hundreds (sometimes thousands) of modules and turns them into a single file a browser can run. Every bundler you use, *webpack* and *esbuild* included, keeps its own little **database** inside that file: a table of modules, a way to look them up, a cache of what already ran. It just never calls it that!

In August, Farid Zakaria wrote [Your executable is a SQLite database](https://fzakaria.com/2026/08/23/your-executable-is-a-sqlite-database), a post arguing that ELF, the format of every Linux binary, is a database that refuses to admit it. I spent a good part of last year on bundlers (because *why not*) and gave a talk about [how they work](https://www.youtube.com/watch?v=8GJb6fC5ceA) at DEVWorld, so obviously I immediately thought: what if a JavaScript bundle admitted it? What if the output of a bundler were a real SQLite file, and linking, tree-shaking and patching were SQL queries?

Ok, you will probably never ship a bundle as a database, and I won't try to convince you to. But [SQLite runs almost everywhere](https://sqlite.org/mostdeployed.html) and pushing it into a job it was not really meant for is a good way to do a deep dive. And maybe an edge case like this holds the answer to a problem you actually have.

What I put in this article:

- What a bundler really does and what is the real challenge
- How a bundle maps onto the parts of a native executable: object files, symbol tables, relocations, a linker
- How this experiment compares with esbuild on three real apps
- Why distributing the build across 512 AWS Lambda functions does not make it 512 times faster!
- What a website that bundles itself on the first visit looks like, and why it is a job for AWS Lambda Web Functions

It is also a story about working with an AI agent, Kiro Crew in my case: prompt, steer, review, question, challenge, measure. Come for the fun, stay for the useful lesson.

## The first version passed its own tests

I started the way many of us start now: an afternoon of vibe coding gave me a working prototype with a long walkthrough. It parsed ES modules, stored them in SQLite, ran in Node and in the browser, and came with eight passing tests and a list of "superpowers": tree-shaking as a SQL query, hot-patching a dependency in place, a 2.5 MB bundle for a real TodoMVC app.

It looked great! So I did what you should always do with agents: **stopped believing and started checking**.

I opened the prototype in [Kiro Crew](https://kiro.dev/crew), and the first thing I asked for was tests the prototype had not written for itself. Kiro Crew wrote fourteen tiny programs, each testing one rule of how JavaScript modules behave: for example, when a module changes an exported variable, every module that imports it must see the new value. Each program runs in plain Node and through the bundle, and the two must print exactly the same thing.

The prototype passed 25 of 56 checks.

Then I checked its claims one by one:

| Claim | Reality |
|---|---|
| Tree-shaking with one SQL query | It only removed modules nothing imported, and the bundler never adds those. On a real build it removed nothing; the test inserted a fake orphan to have something to delete. |
| A 2.5 MB bundle for TodoMVC | The file on disk was 8.4 MB: after measuring, the build stored a copy of the whole page, including the database itself, inside the database. |
| Hot-patching in place | It changed the dependency for every module with the same import, and the compiled output went stale. |
| The bundle can query itself | In the fast version, the query function returned a hard-coded number whatever you asked. |

None of this is a dig at vibe coding. Simon Willison [puts the line in the right place](https://simonwillison.net/2025/Mar/19/vibe-coding/): "When I talk about vibe coding I mean building software with an LLM without reviewing the code it writes." That is what the prototype was, and it was the right tool to test the idea in an afternoon. To trust the result, you have to switch from vibing to steering: give the agent feedback, check what comes back, and repeat until you understand what the program does. Strict tests against Node were the first round of steering.

## Rebuilding it, with an agent that gets challenged

From here on, when I say "we" I mean me and Kiro Crew. The loop was always the same: write the failing test, let the agent propose a fix, review the diff, ask why, push back when the answer did not convince me, and measure before believing.

The "SQLite bundler" got a new name, [rowpack](https://github.com/edodusi/rowpack), and a simple rule: every claim in the README needs a number behind it. The prototype is the first commit in the repository, so you can see the whole diff.

The key change is how imports work. Since I know how webpack does it, I steered the agent toward the same idea: webpack defines a getter for every export, so instead of copying values from one module into another, every import becomes a live read from the other module's namespace. A use of `count` imported from `./counter.js` is rewritten to something like `__rp_i0.count`, a getter that always returns the current value. Live bindings, cycles and the "cannot access before initialization" error all come out right, because nothing is ever copied.

All fixtures now print exactly what Node prints, through all three engines, with and without tree-shaking: 149 tests in total. The real-world check is [TodoMVC Vanilla ES6](https://github.com/tarhi-saad/TodoMVC-Vanilla-ES6) (53 modules once you count flatpickr from npm, 27 SVGs, two stylesheets and a sound file): it renders and behaves identically in headless Chrome whether esbuild or rowpack built it.

## What is inside the database

Think of the bundle as an executable that kept its build notes. A native binary has sections for code, a symbol table that says which names it exports, relocations that say where code refers to a name, and a list of libraries it needs. *rowpack* has a table for each:

| Table | Native executable | What it holds |
|---|---|---|
| `statements` | `.text` | every top-level statement of every module |
| `bindings`, `refs` | `.symtab` | which statement declares and reads which name |
| `relocations` | `.rela` | every place code refers to a name, by offset |
| `dependencies` | `DT_NEEDED` | each import and what it resolved to |
| `load_image` | program headers | what the loader reads at startup |

Because the bundle is a plain SQLite file, the tools you would build for a bundler already exist. `ldd` is a view:

```sh
# ./demos/hello
rowpack build index.js -o hello.sqlite
sqlite3 -box hello.sqlite "SELECT importer, specifier, resolves_to FROM ldd"
```

```text
┌────────────┬───────────────┬───────────────┐
│  importer  │   specifier   │  resolves_to  │
├────────────┼───────────────┼───────────────┤
│ ./index.js │ ./math.js     │ ./math.js     │
│ ./index.js │ ./config.json │ ./config.json │
│ ./index.js │ ./style.css   │ ./style.css   │
│ ./index.js │ ./logo.svg    │ ./logo.svg    │
└────────────┴───────────────┴───────────────┘
```

The page built from it can even carry a small SQL console, so the browser tab you are looking at is literally a database you can query.

![A demo page linked by SQL, with a SQL console in the corner listing the bundle's dependencies from the ldd view](/img/posts/sqlite-javascript-bundles/inspector.png)

## Linking is a recursive query

Linking means answering one question for every import: which binding does this name point to? With `export { x } from './a.js'` and `export * from './b.js'`, the answer can be several modules away, and the ECMAScript spec has an exact algorithm for it, called [ResolveExport](https://tc39.es/ecma262/#sec-resolveexport). It follows re-export chains, expands `export *`, and drops any name that two `export *` statements resolve to different bindings.

That is a graph walk, and SQL has graph walks built in: recursive common table expressions. Here is the heart of it, trimmed:

```sql
-- ./src/sql.js (trimmed): every name a module exports, and where it points
WITH RECURSIVE names(module_id, name, target_id, target_key) AS (
  -- names written in the module itself
  SELECT e.module_id, e.name,
         CASE e.kind WHEN 'local' THEN e.module_id ELSE d.resolved_id END,
         CASE WHEN e.kind = 'local' THEN 'L:' || e.local_name ELSE 'E:' || e.imported_name END
  FROM exports e LEFT JOIN dependencies d ON d.importer_id = e.module_id AND d.idx = e.dep_idx
  WHERE e.kind IN ('local', 'indirect')
  UNION
  -- names that arrive through "export * from", unless the module exports them itself
  SELECT s.module_id, n.name, n.module_id, 'E:' || n.name
  FROM exports s
  JOIN dependencies d ON d.importer_id = s.module_id AND d.idx = s.dep_idx
  JOIN names n ON n.module_id = d.resolved_id
  WHERE s.kind = 'star' AND n.name <> 'default'
)
SELECT * FROM names;
```

A second recursive query follows each `E:` hop until it lands on a real binding, and a `GROUP BY ... HAVING count(*) = 1` drops the ambiguous names. The whole linker runs in about 3 ms on lodash-es's 641 modules, and it is the same query whether you run it from rowpack or paste it into the `sqlite3` shell.

## Tree-shaking is another recursive query

Tree-shaking is the same idea pointed the other way. Every top-level statement is a row. A statement must stay if it has side effects, or if a statement that stays reads a name it declares. Start from the side effects and the entry point, walk the reference rows, and whatever you never reach can go.

The walk honours `"sideEffects": false` in `package.json`, the convention bundlers use to know which files are safe to drop. On lodash-es with five functions imported, rowpack keeps 157 of 641 modules and 456 of 1,927 statements. esbuild keeps 156. The extra one is `lodash.js`, the package's entry point, which holds nothing but 322 re-exports: rowpack keeps its row to wire the namespace through it, but it adds zero bytes to the static output, so the shipped code has the same set of modules.

Those re-export-only files bit us once. Our first version of the walk skipped straight past one, `value.js`, deleted it, and silently dropped one function from lodash's namespace. Comparing the output against Node caught it, and it is a test now.

## The numbers against esbuild

A database is a nice thing to inspect and a slow thing to boot, so rowpack has two ways to run a bundle.

The first is the SQL engine: the page ships SQLite compiled to WebAssembly, fetches everything the entry needs with one recursive query, and links modules at runtime. The second is a static linker that works like `ld`: it lays every module out in evaluation order in one scope, gives every name a unique identifier, and patches each relocation to point straight at the binding it names. What comes out is a flat script, which is what you would ship.

All numbers are medians on an Apple M5 Pro, Node 26, esbuild 0.28 and Chrome 156. Both outputs are minified with esbuild's minifier, so the size comparison measures the bundling alone.

| Build time (warm) | rowpack | esbuild |
|---|---:|---:|
| TodoMVC | 32 ms | 14 ms |
| lodash-es, 5 functions | 129 ms | 64 ms |
| lodash-es, everything | 120 ms | 59 ms |

| Size, minified and brotli | rowpack static | esbuild |
|---|---:|---:|
| TodoMVC | 243.0 KB | 240.6 KB |
| lodash-es, 5 functions | 8.3 KB | 8.5 KB |
| lodash-es, everything | 30.6 KB | 30.2 KB |

| Chrome, app ready | esbuild | rowpack static | rowpack SQL engine |
|---|---:|---:|---:|
| TodoMVC | 26 ms | 29 ms | 63 ms |
| lodash-es, 5 functions | 10 ms | 9 ms | 40 ms |
| lodash-es, everything | 19 ms | 21 ms | 59 ms |

The static output lands within a few percent of esbuild on size and startup. esbuild still builds about twice as fast, which is fair: it is a production tool written in Go, and rowpack is a toy written in JavaScript that talks to SQLite. The SQL engine adds 30 to 40 ms, and about half of that is booting 685 KB of SQLite before the first module is linked.

For scale, the prototype took 1.6 seconds to build TodoMVC on my desktop and 2.4 to 2.8 seconds for lodash-es on the laptop, with no tree-shaking and an 8 MB database.

## distcc for JavaScript

The next question was obvious, at least to me: can I spread the build across more machines? In the C world, [distcc](https://www.distcc.org/) ships each file to another machine, compiles it there and sends the result back. Compiling one module in rowpack is also a pure function, from source text to rows, so the same trick should work with AWS Lambda.

We put the same compile code behind three front doors:

- **A Lambda function** (what the docs now call an [Event Function](https://docs.aws.amazon.com/lambda/latest/dg/lambda-functions-chapter.html)), called through the Invoke API: one request per execution environment, scaled out by Lambda
- **A [Lambda Web Function](https://docs.aws.amazon.com/lambda/latest/dg/web-functions.html) with one thread**: an HTTPS endpoint, where one environment serves many requests at once
- **A Lambda Web Function with a worker thread per vCPU**: the same, with the CPU work spread across threads

![The laptop runs the graph walk and SQLite, and sends module sources to three backends in eu-west-1: a Lambda function through the Invoke API, and two Lambda Web Functions over HTTPS with SigV4](/img/posts/sqlite-javascript-bundles/distributed-architecture.png)

The laptop walks the import graph, ships the source of each module it finds, and stores the rows that come back. We built three apps sending anywhere from 1 to 512 requests at the same time, with 1 or 25 modules in each request, and checked that every remote build was byte-identical to the local one. Best warm times:

| App | Local | Lambda function | Web Function, 1 thread | Web Function, threads |
|---|---:|---:|---:|---:|
| lodash-es, 641 modules | 112 ms | 863 ms | 836 ms | 885 ms |
| date-fns, 827 modules | 279 ms | 1,087 ms | 1,016 ms | 1,011 ms |
| three.js, 388 modules | 179 ms | 1,453 ms | 1,314 ms | 1,423 ms |

Distributed rowpack is four to eight times slower than rowpack on a laptop! The reason is the shape of the problem. The bundler only learns which modules a file imports after compiling it, so it discovers the graph one level at a time, and every level costs a round trip to the cloud plus the compile, 100 ms or so. These apps are six to eight levels deep, and that floor stays put however many functions you add: past 8 to 32 requests at once, the curves go flat. Batching mattered far more: one module per request took up to five seconds, 25 per request brought it under one.

One result fooled me for a while. The first runs showed every Web Function request taking about 230 ms, against 70 ms for the Lambda function. It looked like a service difference. It was my client: I had set `pipelining: 0` in the HTTP library, which quietly turns off keep-alive, so every request paid for a new TLS handshake. With connections reused, both sit around 50 ms. Measure your client before you blame the service!

The two kinds of function are different tools, and this benchmark suits one of them. A compile request is a short burst of pure CPU, and a Lambda function, with one request per environment, scales out to a burst like that with no configuration. A Web Function is built for many concurrent requests in one environment: an HTTP server you write as usual, streaming responses, and [pricing](https://aws.amazon.com/lambda/pricing/) that charges CPU only while it is active (plus memory while an environment exists), so a request that mostly waits barely touches the CPU bill. So we built something that needs exactly that.

## A website with no JavaScript until you visit it

This is where the experiment stops having any excuse to be useful, and that is why I like it. What if a website did not have its JavaScript bundled at all, until the first person opened it?

![The browser calls CloudFront. CloudFront forwards the page request to an IamAuth Lambda Web Function, signed with origin access control, and serves bundles from S3. The Web Function sends cache misses to a Lambda function and stores object files and bundles in S3](/img/posts/sqlite-javascript-bundles/serve-architecture.png)

The first visitor's request reaches Amazon CloudFront, which forwards it to a Lambda Web Function. The function:

1. hashes the source of every module of the app it ships with
2. looks in Amazon S3 for an object file with that hash
3. sends the modules S3 does not have to the compile function, in batches, and stores what comes back
4. links the bundle with SQL, uploads it to S3, and finishes the page

While that happens, the response streams to the browser: "No JavaScript exists for this page yet", then a progress bar as modules compile. When the bundle is ready, the page loads it. Everyone after that gets the page and the bundle from CloudFront.

The object files are the piece that makes it more than a toy. Each compiled module becomes its own tiny SQLite database, about 1 KB gzipped, and the bundler links them with SQLite's `ATTACH DATABASE` and one `INSERT ... SELECT` per table, the same way a linker combines `.o` files. Named by the hash of their source, they form a build cache in S3, like the ones real build tools use.

The numbers, from the deployed site:

- **First visit, empty cache:** 388 modules compiled on Lambda in 42 requests, built in 2.25 seconds
- **After a one-line change to the app:** 1 module compiled, 387 reused from S3, built in 1.2 seconds
- **Every visit after that:** about 0.2 seconds, from CloudFront

If several people open the page at the same moment, only one build runs. The function takes a lock with an S3 conditional write (`If-None-Match: *`), which only succeeds if the object does not exist yet, and the others see "another visitor started this build" until the result is ready. I tested it with three simultaneous first visits: one build, three finished pages.

The page itself is a three.js scene with one box per module of its own bundle, sized by the bytes it shipped and read from the bundle database. The site draws its own build.

![A three.js scene of 256 boxes, one per module of the bundle, with a note saying the page was built on first visit: 388 modules compiled on Lambda in 42 requests, built in 2,251 ms](/img/posts/sqlite-javascript-bundles/serve-first-visit.png)

This is the shape Web Functions are made for: one long request that streams and spends most of its time waiting on S3 and Lambda.

Only the page is public. The function accepts requests from this CloudFront distribution alone, the bucket is private, and the function can only build the one app it ships with, whatever the request says.

## What did I learn?

Unfortunately, our findings do not show that bundling into SQLite is useful in the real world. esbuild is faster to build, and once you link the output into a flat script, the database is gone anyway. What the experiment does show is a different way of looking at the problem:

- **A bundler is a linker, and a linker is a set of queries.** Writing ResolveExport and tree-shaking as recursive SQL made them shorter and easier to check than the code I would have written by hand.
- **A build artifact you can query is a debugging tool.** Asking "why is this module in my bundle?" is one `SELECT` away.
- **Object files are a cache by construction.** Content-addressed per-module output is what made the second visit fast, and it would work the same way in any build system.
- **Distribution is limited by the shape of the work.** The depth of the import graph set the floor, whatever the number of functions. Before you spread work across many machines, measure how deep your dependency chain is.
- **Different serverless tools fit different shapes.** Short CPU bursts suited one request per environment; a long, streaming, mostly waiting request suited a Web Function.

And about working with an agent: the vibe-coded prototype was impressive and mostly wrong, and steering is what turned it into something that works. Write tests against a reference, read the diffs, ask why, push back, and measure before you believe anything. Kiro Crew wrote most of the code. Knowing how webpack handles imports, deciding what to test and noticing when a number smelled wrong was still my job.

The code is on GitHub at [edodusi/rowpack](https://github.com/edodusi/rowpack), MIT licensed, with the benchmarks, the AWS deployment (CDK, with a teardown script) and the architecture diagrams.

Your bundle can be a database. It just shouldn't have to boot one.
