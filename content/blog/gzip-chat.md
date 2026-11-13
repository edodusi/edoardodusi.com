---
title: "LLMs are compressors. So I chatted with gzip"
date: "2026-11-12"
tags: ["Compression", "LLM", "gzip", "AWS Lambda"]
excerpt: "I chatted with gzip, for real. It answers questions about me with zero learned weights, and it says \"i don't know\" when a question surprises it too much. To see how that is possible, we need to understand why compressing and predicting are the same job."
draft: true
---

I had a conversation with a chatbot this morning:

```text
› who is edo?
● a senior developer advocate at aws, turning hard tech into talks developers remember.

› what talk did edo give at oredev?
● bundlers: a deep dive into modern javascript build tools, nov 2025; honey, i shrunk
  the bits: how modern http compression works, nov 2025.

› what is the capital of italy?
● i don't know. that question surprises me too much.
```

First answer is correct, second is correct, third is an honest refusal. Nothing special for a chatbot, right? Except that this one has no neural network, no GPU and no weights. Every letter of every answer was chosen by **gzip** (except the refusal, I'll get to that). At each step it tries every possible next letter and keeps the one that compresses smallest. The same DEFLATE algorithm that compresses the HTTP responses of the page you're reading.

![The gzip chat page in dark mode: a header that says model gzip, parameters 0, and four questions with their answers, the last one a refusal](/img/posts/gzip-chat/chat-trained.png)

You can [try it yourself](https://d2v8qi14yayt65.cloudfront.net): click a question, then switch to *untrained* to see what gzip writes with no data. But to understand why this apparently silly experiment (not my original idea, BTW) works at all, we have to talk about what *compressing* really means.

What's in this article:

- why compressing and predicting are the same job
- what gzip "predicts", and how to make it write
- what it took to turn it into a chat, and where it breaks
- why, in the end, the code around the model does most of the work.

Oh, about the POC itself, I built it with [Kiro Crew](https://github.com/kirodotdev/KiroCrew), an AI agent that wrote the code while I steered the design, so when I say "we" below, that's the two of us.

## LLMs are compressors

In 2023 a team at **Google DeepMind** published a paper whose title is also its thesis: [Language Modeling Is Compression](https://arxiv.org/abs/2309.10668). They took 1 GB of English Wikipedia and compressed it with classic tools and with language models.

*gzip*, given the whole file at once, shrinks it to 32.3% of its size. But a language model can only read a few kilobytes at a time, so for a like-for-like test they also cut the file into 2 KB pieces, and on those pieces gzip only gets to 48.1% (each piece starts with no context, so gzip has less to copy).

Chinchilla, a 70 billion parameter model, on the same 2 KB pieces, compressed the same file to **8.3%** of its size. About *six times better than gzip*.

To be fair, if you count the model itself as part of the compressed file (the receiver needs it to decompress), Chinchilla's rate becomes 14,008%. gzip's whole program is a few kilobytes. That's why LLMs are impractical compressors, at least for a 1 GB file.

Then in section 3.4, the paper argues that if a predictor can be used as a compressor, then a compressor can also be used as a predictor...so they made gzip write text. After reading a page of Wikipedia, this is what it wrote:

```text
(0k5Ezatme,isbebmvcsouL(nxscbiife peu7vevwt parr,iswfommeeaa are nombban hm
```

It's gibberish, and the authors explain why: their setup only looks one step ahead, which is biased for gzip, and "it's likely that looking multiple steps ahead would improve the results". That wasn't the purpose of their paper, so they stopped there.

But it's the purpose of my article, so I tried.

If you want the long, friendly version of the theory, Annie Sexton's [Compression is prediction](https://ngrok.com/blog/compression-is-prediction) on the ngrok blog is a great read. This is the short version.

## Why compressing means predicting

Think about your phone keyboard. I want to write "see you tomorrow", and it suggests "see", "you" and "tomorrow", one tap each: fourteen letters, three taps. Now give me a phone whose keyboard learned Italian, and while I type "home" it suggests "ho", "hai", "hanno". All wrong, so I type every letter by hand. The guesser changed, so the message became more expensive.

Now imagine the person receiving my message has exactly the same keyboard. When the guess is right, I don't send the word at all, I send "yes, take your guess". Only when the guess is wrong do I need to send the correction. **You only send what the receiver can't guess.** That's compression! Every compressor works like this: the same guesser is on both sides, and only the misses must travel.

This isn't a metaphor I made up.

In 1951 Claude Shannon ran exactly this game in [Prediction and Entropy of Printed English](https://archive.org/details/bstj30-1-50). He asked a person to guess a phrase letter by letter, and wrote a dash every time they got it right on the first try:

```text
THE ROOM WAS NOT VERY LIGHT A SMALL OBLONG
----ROO------NOT-V-----I------SM----OBL---
```

On the full passage (where spaces count as letters too), 89 letters out of 129 were dashes. Shannon's point was that the second line contains the same information as the first. If you have an *identical twin* of the person who guessed, the twin can rebuild the sentence from the dashes alone.

The price of a letter is its **surprise**. A guess the model is sure about costs almost nothing, a surprise is expensive. In bits, a symbol you expected with probability p costs `-log2(p)`: a coin flip is 1 bit, a sure thing is 0. With this game Shannon estimated that ordinary English carries something like one bit per letter, instead of the 4.7 bits of a random letter.

So a compressor is exactly as good as its guesses. Take one sentence and three different guessers:

| "To be or not to be, that is the question." | Size |
| --- | --- |
| Plain text, 41 bytes | 328 bits |
| DEFLATE, the algorithm inside gzip | 320 bits |
| A small LLM (Qwen2.5-0.5B, about 1 GB of weights) on both sides | 30 bits |

The LLM has read Shakespeare, so after "to be" almost nothing is a surprise. gzip has read nothing, so it saves one byte (BTW a `.gz` file, with its 18 bytes of header, ends up bigger than the text).

This is a demo I ran on stage. For every token, the model lists its guesses, and the sender only notes where the real token was in that list: rank 1 means the first guess was right. Only those ranks travel, and the receiver runs the same model, picks the guess at each rank, and rebuilds the sentence byte for byte. Ranks are just the easy way to see it: the 30 bits in the table is what a real coder (arithmetic coding) pays with the model's probabilities, about `-log2(p)` per token, so a confident guess costs a fraction of a bit.

![A terminal running Qwen2.5-0.5B on "To be or not to be, that is the question.": each token gets a rank and a cost in bits, "To", "be" and "or" are expensive, almost everything after is rank 1 and nearly free, the ranks 40 4 97 1 1 1 2 1 1 1 1 2 travel, and the receiver rebuilds the sentence byte for byte](/img/posts/gzip-chat/qwen-rank.gif)

"To", "be" and "or" cost 24 of the 30 bits, because until then the model doesn't know it's Shakespeare. Everything after is a first guess and almost free. (The "gzip 456 bits" on screen is the `.gz` file made by Python, header included. Python's zlib gets the stream to 39 bytes, one less than Node's.) Let's look at what gzip guesses with.

## gzip's model is its own past

DEFLATE is two algorithms stacked. The first, **LZ77**, replaces repeated text with a pointer: "copy 12 bytes from 40 bytes back". The second, Huffman coding, gives shorter codes to the things that show up more often. What matters here is the first one: text that repeats is cheap, text that's new is expensive.

Oh, and gzip can only look 32 KB back, that's its whole context window.

So gzip predicts exactly one thing: that the text will repeat what it has already seen. On a long Wikipedia dump that's a decent bet, because a lot of patterns repeat. On one line of Shakespeare there's nothing to copy, so the bet loses.

## Making gzip write

If gzip's guess is "whatever compresses best", we can ask it to write with a simple loop. Take the text so far, add every possible next character, compress each version, and keep the one that came out smallest. That's the character gzip "expected". Then repeat. In an LLM this is called *greedy decoding*, at temperature 0.

We never touch gzip's code, the only question we ask it is "how many bytes is this?"

```ts
// src/engine.ts (simplified)
import zlib from 'node:zlib';

const ALPHABET = "abcdefghijklmnopqrstuvwxyz .,':;0123456789\n";

// The only thing we ever ask gzip
const size = (text: string, dictionary?: Buffer) =>
  zlib.deflateRawSync(text, { level: 9, dictionary }).length;

// The next character gzip "expects": the one that keeps the output smallest
function nextChar(text: string, dictionary?: Buffer): string {
  let best = ALPHABET[0];
  let bestSize = Infinity;
  for (const c of ALPHABET) {
    const s = size(text + c, dictionary);
    if (s < bestSize) [best, bestSize] = [c, s];
  }
  return best;
}
```

That's the naive version, and if you run it on the sentence about the cat below, it writes "mat" and then "aaaa" forever. The talk version of this demo did the same at first. The reason is that sizes come in whole bytes, so a preference of a few bits disappears, all 43 characters tie, and the first one in the alphabet wins. The fix has two parts, and only ever uses sizes. When characters tie, the real engine continues each one for 4 more characters and keeps the one whose continuation compresses best. This is the paper's "looking multiple steps ahead". To compare those continuations it has to see differences smaller than a byte. DEFLATE writes bits but rounds the output up to whole bytes, so a difference of a few bits usually doesn't show. Adding filler of different lengths moves where that rounding falls, so the engine compresses each continuation 16 times with a different filler, and the sum shows the small differences.

This is untrained gzip, with no data and nothing but the text you type:

![The untrained mode of gzip chat: the cat sentence continued by copying, the Hamlet line looping on itself, and xyz turning into a row of a](/img/posts/gzip-chat/chat-untrained.png)

- "the cat sat on the mat. the dog sat on the log. the cat sat on the " becomes "**mat. the dog sat on the log. the cat sat**". It copies.
- "to be or not to be, that is the " becomes "**or not to be, that is the or not to be**". It loops, because the cheapest thing to write is a copy of what it just wrote.
- "xyz" becomes "**aaaaaaaa**". Nothing to copy, no preference.

So gzip can write, but only what it has already read. Let's give it something to read!

## Training gzip

zlib has a feature called the **preset dictionary**: text that gzip reads before it starts compressing, as if it had already seen it. (Strictly speaking it's a DEFLATE feature: the `.gz` file format has no room for a dictionary, so the code calls raw DEFLATE.) Whatever is in the dictionary becomes cheap to copy. That's gzip's "training data", and like its memory, it's capped at 32 KB.

I first did this for a talk. I gave gzip the talk's own notes plus a few questions and answers, and let the room ask it things. Highlight of the talk, if you ask me.

The trick that turns completion into a chat is the format. If the dictionary is full of lines like `q: who is edo? a: a senior developer advocate...`, and I give gzip `q: <your question>? a:`, the cheapest continuation is an answer copied from a line that looks like yours. That's a chat template, the same trick as giving a base LLM a few example questions and answers in its prompt.

It also hallucinates, with zero parameters. Ask it something it doesn't know, and it confidently copies the answer of whatever line looks closest.

## RAG, with gzip only

In the demo, the knowledge comes from my website: 477 questions sharing 104 answers, 26 KB. The answers are sentences from the site, lightly shortened (apart from a few about the chat itself), and a script turns the lists of talks and articles into pairs. The questions, and the many ways to word each one, were written by Kiro Crew. So yes, an LLM wrote gzip's training data.

To answer, gzip first has to find the right pair. The idea is old and lovely: two texts that share a lot cost little more to compress together than apart. Compare one question with two stored ones:

| "which city is edo in?" with... | Alone | Together | Extra bytes |
| --- | --- | --- | --- |
| "which city does edo live in?" | 26 + 33 | 40 | **7** |
| "what is the schema tax?" | 26 + 28 | 48 | **20** |

The first pair shares "which city ... edo ... in?", so gzip copies those words and adding the question costs almost nothing. Turn that into a number between 0 and 1 (the size together, minus the smaller one alone, divided by the bigger one) and you get the [normalized compression distance](https://en.wikipedia.org/wiki/Normalized_compression_distance): close to 0 means the same text, close to 1 means nothing in common.

That number also gives gzip a way to say no. If even the closest stored question is too far away (a distance above 0.45), it doesn't copy anything. It answers "i don't know. that question surprises me too much". If your question is too surprising, gzip has nothing to copy, and my code says so with a sentence I wrote.

Then it writes, with only the closest pairs as its dictionary. How many? We measured it on the 15 test questions that have an answer, with the refusal turned off, and fewer pairs work better:

| What gzip reads while writing | Right answers (of 15) |
| --- | --- |
| the closest pair | 10 |
| **the 3 closest pairs** | **11** |
| the 10 closest | 8 |
| the 30 closest | 6 |
| all 477, closest last | 5 |
| all 477, no retrieval | 3 |

(Written out as pairs, all 477 take 54 KB, so in the last two rows gzip only sees the last 32 KB.)

Every extra pair is one more place to copy from by mistake. A nice side effect: retrieval also removes the 32 KB limit, because gzip only ever reads a few hundred bytes per answer.

How good is it? We scored it on 20 questions written before scoring and never added to the data. It answered 10 of the 15 it had an answer for (the refusal costs one right answer, the MCP one), and refused all 5 it had no answer for, like the president of Italy or my email address. It's a demo number, not a benchmark, before you quote it.

The failures are more interesting than the score.

![gzip chat answering "does edo have kids?" correctly, and "does edo have offspring?" with the description of the podcast](/img/posts/gzip-chat/chat-bytes-not-meaning.png)

"does edo have kids?" works, because someone wrote "kids" down. To gzip, "does edo have offspring?" is exactly as far from "does edo have a podcast?" as from "does edo have kids?" (eight stored questions tie). The podcast one comes first in the file, so I get my podcast described to me. gzip matches **bytes**, not **meaning**.

The second kind is subtler: even when retrieval finds the right question, gzip can copy the wrong answer, when two answers cost exactly the same bytes and the alphabet breaks the tie.

## How it runs

gzip chat is one Node.js HTTP server with no dependencies, deployed as an [AWS Lambda Web Function](https://docs.aws.amazon.com/lambda/latest/dg/web-functions.html) behind Amazon CloudFront.

![The browser calls Amazon CloudFront, which caches answers. The first time a question is asked, CloudFront forwards it, signed with SigV4, to the gzip-chat Lambda Web Function in eu-west-1, which holds zlib and 26 KB of Q&A](/img/posts/gzip-chat/architecture.png)

gzip is deterministic: the same question always gets the same answer. So CloudFront caches every answer for a day (the question travels in the URL, so it's the cache key), and only the first person to ask something new wakes the function. A new answer takes from a few milliseconds to under two seconds of CPU, and the function scales to zero when nobody is asking.

One confession: the letter-by-letter typing on the page is theatre. The server sends the whole answer at once, and the page animates it so you can watch it like a chat. In the next version I will add some "discombobulating..." somewhere.

The code is on [GitHub](https://github.com/edodusi/gzip-chat), with the eval (`npm run eval`), a one-command deploy and a teardown script.

## So, is gzip an LLM?

NO!

gzip makes almost every choice: every letter of an answer, which stored question is closest, when an answer ends. I wrote the rules and the data: the knowledge file, the `q: ... a:` template, the 0.45 cutoff, the 3 pairs, the refusal sentence. When it answers right, it has almost always copied a stored answer word for word. It's a search engine with a copy machine attached. A RAG in miniature.

In my opinion that's still a good way to understand how an LLM chatbot works, just in reverse. An LLM chatbot has the same parts: a model that predicts the next token, and around it the chat template, the retrieval, the system prompt and the stop rules, code that people wrote. We call this the **harness**. In gzip chat the harness does almost all the work, because the model can only copy.

An LLM learned from billions of sentences that "kids" and "offspring" show up in the same places, so it knows they mean the same thing, and nobody has to write down every wording or decide for it when to say "i don't know". gzip only remembers bytes, so every way to say something has to be written down for it. That's what all those parameters buy you: a thin harness. And it's why an LLM had to write gzip's "training data".

Both of them only send you what you couldn't guess. The better the guesser, the less the rest of the system has to do.
