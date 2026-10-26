---
title: "Is stateless MCP just REST? I ran 180 tests to find out"
date: "2026-10-26"
tags: ["AI", "Agents", "MCP", "API"]
excerpt: "The July 2026 MCP spec dropped sessions, and the internet decided the argument was over. I exposed one backend as both a stateless MCP server and a plain REST API, gave both to the same agent, and recorded what actually changed."
---

In July 2026 the Model Context Protocol [dropped sessions](https://blog.modelcontextprotocol.io/posts/2026-07-28/). The handshake is gone, the `Mcp-Session-Id` header is gone, and every request now stands on its own. Within a week the internet did what the internet does, compressing that change into a slogan: MCP is dead, REST won, it was always just REST with extra steps.

In the [2026-07-28 MCP spec](https://modelcontextprotocol.io/specification/2026-07-28/changelog), `tools/list` no longer varies per connection, and a server that needs cross-call state now mints an explicit handle and passes it back as an ordinary tool argument. In other words, a stateless MCP server is now a list of tool names with JSON schemas, presented to the model, which emits a tool call that the host dispatches.

Say that out loud and the REST comparison writes itself. Maybe even the slogan. A REST API is *also* stateless HTTP.

I always loved that "computer scientist" has the word **scientist** in it, so I want proof and measurements, even for silly slogans. I found no measurement, so I built one.

I took a single backend and exposed it twice, once as a stateless MCP server and once as a plain REST API, handed both to the same agent with the same tasks, and recorded what changed across 180 runs. I'm surprised that the result is less dramatic than the slogan and actually more useful: on a small tool surface the two are a tie, and on a realistic one they diverge for one structural reason each.

I'm not here to tell you "which protocol is better". But I will tell you that these two carry the **same information in different places**. MCP puts the tool surface in front of the model on every turn. REST puts the contract in front of the model once, then leans on a single generic HTTP call. That difference in placement is the whole ballgame, and it is measurable.

I'm giving you the data, the harness, and a way to make a decision based on your case, not your mood.

## The experiment

I wanted any difference I measured to be the shape of the contract instead of the business logic. There is exactly one backend, a classic demo: a small store with products, inventory, orders and customers, that answers the same way every run.

Two interfaces wrap that same backend over the same six operations:

- **MCP** is modeled as native tool use on [Amazon Bedrock's Converse API](https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference.html), because this is exactly the stateless MCP shape: the model receives tool names and JSON schemas every turn and emits a `toolUse` block that the host dispatches
- **REST** gives the model one tool, `http_request`, plus an OpenAPI-style contract in the system prompt, that is read once. The model constructs the path itself. This interface also implements a real `ETag` and `304 Not Modified` cache, because conditional reads are the one thing REST can express that MCP tool use currently cannot

I gave both the same set of tasks: a simple lookup, a two-hop (order to customer name), an aggregate across a customer's orders, a missing-information recovery (an order that does not exist), a conditional (can I order an out-of-stock item?), and a repeated read that I use to test caching.

The setup:

- Model: Claude Haiku 4.5 on Amazon Bedrock, `eu-central-1`, temperature 0. I picked this small, fast model because it keeps the sandbox cost down, and a smaller model is the harder test: it is quicker to fumble a schema or burn tokens, so a difference between the two interfaces shows up instead of being hidden by a frontier model's reasoning
- Five trials per task per interface, so thirty runs each per condition
- Metrics per run: success, input and output tokens, latency, round-trips, tool calls, cache hits. A round-trip here is one model turn, so a task that makes a single tool call and then answers counts as two

## Result 1: on a small surface, it is a tie

With six tools, the internet slogan seems to be correct!

*Six tools, five trials per task, thirty runs per interface.*

| Metric | MCP | REST |
| --- | --- | --- |
| Success rate | 100% | 100% |
| Avg total tokens | 2,838 | 2,867 |
| Avg input tokens | 2,705 | 2,692 |
| Median latency | 2,116 ms | 2,070 ms |
| Avg round-trips | 2.5 | 2.5 |
| Cache hits (304) | 0 | 5 |

You can see we have the same correctness, number of round-trips, token counts and latency. If you have a handful of tools, the choice between a small MCP server and a small REST contract is just a matter of taste, not efficiency. But look at that `Cache hits` column...I'll come back to it.

## Result 2: the schema tax is real, and it scales

Then I changed the one thing I figured was about to matter: the API surface size. I ran the whole suite again with twenty-four extra endpoints, modeling a realistic store API with roughly thirty operations. On the MCP side those are *twenty-four more tool schemas*. On the REST side they are *twenty-four more lines in a contract the model reads once*.

Let's see how that changed our bill:

*Thirty tools, five trials per task, thirty runs per interface.*

| Metric | MCP | REST | Delta |
| --- | --- | --- | --- |
| Success rate | 100% | 100% | tie |
| Avg total tokens | 6,558 | 4,231 | **MCP +35%** |
| Avg input tokens | 6,406 | 4,038 | **MCP +37%** |
| Median latency | 1,996 ms | 1,810 ms | MCP +9% |
| Avg round-trips | 2.67 | 2.67 | tie |

Again, same success rate and same round-trips, but **35% more tokens**. The reason is simple: a stateless MCP server re-sends every tool schema on every turn, so the model pays for the full catalog every time, even if it doesn't use every tool. REST's single `http_request` primitive does not grow when the API does, because the contract is only read once.

Per task, the gap is remarkable:

| Task | MCP input tokens | REST input tokens | MCP overhead |
| --- | --- | --- | --- |
| order_status | 4,673 | 2,850 | +1,823 |
| customer_total | 4,732 | 2,910 | +1,822 |
| missing_order | 4,647 | 2,805 | +1,842 |
| order_customer | 7,181 | 4,500 | +2,681 |
| repeat_read | 7,318 | 4,687 | +2,631 |
| stock_mech | 9,884 | 6,475 | +3,409 |

Roughly 1,800 extra input tokens for a one-call task, and more for multi-call tasks, because the schema tax is paid **once per round-trip**. The more the agent has to go back to the tools, the more times it re-reads the whole catalog.

To be fair, this is the worst case for MCP and the best case for REST. Prompt caching on the provider side, and filtering the tool list down to what a task plausibly needs, both cut this cost. But neither is free and neither is automatic, and the structural fact remains that MCP's token cost is a function of surface size in a way REST's is not.

This is my measurement, so I invite you to test on your own setup and challenge my findings.

## Result 3: where REST wins outright

The `repeat_read` task asks the agent to read an order, report the total, then read it again to confirm it is unchanged. This is deliberate, to test caching.

The REST agent read the order, got an `ETag`, and on the second read sent `If-None-Match` with that tag. The server answered `304 Not Modified` with an empty body, and the agent reused the value it already had. Five cache hits in five trials. The MCP agent could not do this, because MCP tool use has no standard notion of a conditional read or a revalidation header. It called the tool again and paid for the full result a second time. No cache, baby!

The boring and old HTTP protocol with its caching mechanisms, conditional requests and revalidation, easily beats the shiny new MCP protocol on re-reads, because when your agent calls a tool it always starts from scratch, even when reading multiple times data that rarely changes.

## Result 4: where MCP wins outright

So far everything seems to be in favour of REST. I tried to build a scenario that should favour MCP.

Picture a strict, unfamiliar API. A reporting endpoint whose region codes are `EUR`, `NAM` and `APC`, not `EU` or `Europe` or `EMEA`. Metric names you cannot guess from a description. A date format that must be exactly `YYYY-MM-DD`. The kind of API an agent meets for the first time.

MCP gives the model its normal typed tool schema: the enum values are correctly spelled, the format is declared, and the host validates the call before it is dispatched. REST gets what people actually write for a terse API: a contract that names the endpoint and the parameters but does not enumerate every valid value. The agent has to infer them. I asked both, in plain language, questions like "what was net revenue in Europe on 2026-10-20?"

*Strict API, one operation, six trials per task, thirty runs per interface.*

| Metric | MCP | REST (terse contract) |
| --- | --- | --- |
| Final success | 100% | 100% |
| **First-call success** | **100%** | **0%** |
| Malformed calls | 0 | 30 (one per task) |
| Avg tool calls | 1.0 | 2.0 |
| Avg round-trips | 2.0 | 3.0 |
| Avg total tokens | 1,841 | 3,041 (**+65%**) |
| Median latency | 1,720 ms | 3,006 ms (**+75%**) |

Both get there in the end, so this is not about MCP being "more correct." It is about getting it right the first time. The MCP agent mapped "Europe" to `EUR` on the first call, every single run, because the schema told it the allowed values up front. The REST agent guessed `EU` or `Europe`, got a `400`, read the error, and fixed it on the second call, every single run. That self-correction is impressive, but it costs an extra round-trip, 65% more tokens and nearly double the latency, every time.

To be honest, I could make REST match MCP by pasting the full JSON schema, enums and all, into the contract. But that is exactly the per-turn token tax that made MCP lose Result 2. The schema has to live somewhere. MCP puts it in front of the model and pays for it every turn. A terse REST contract saves those tokens right up until the API is strict enough that the saving turns into a wrong guess. No free lunch, only a choice about where you spend.

## What this does not measure

A benchmark you cannot poke holes in is a benchmark that is lying! Here are mine.

This is a very controlled scenario. One model, one small domain, six tasks. There is no authentication, no streaming, no *human in the loop*. The "wire bytes" I counted are a proxy, not a packet capture. Latency differences stayed inside the noise and were dominated by the model, not the protocol, so do not read the 9% as a protocol verdict.

And to be very clear, this measures per-request efficiency, which is not why most people reach for MCP. MCP's actual value is the ecosystem. Write one server and any agent can use it, without a previous knowledge of the contract. That portability is real and this harness does not price it. REST's hidden cost is the opposite: every consumer writes and maintains its own client, based on a shared contract.

Efficiency is one axis, but it's not the only one.

There is also a safety axis, which this harness does not touch: a stateless, per-request boundary is easier to reason about than a long-lived session, with authorization checked per call and no sticky server-side state to ride. That deserves its own measurement, so I'm thinking of a follow-up here.

## How to decide

Is stateless MCP just REST with extra steps? No.

It is REST with no cache, but with a typed, self-describing discovery layer bolted on top. Batteries included. Which one you want depends on your specific scenario:

- **Small, stable, portable tool set** that you want many agents to reuse: MCP wins. The schema tax is small and the ecosystem payoff is real.
- **Strict or unfamiliar API** with non-obvious parameters: MCP wins again. Typed, validated discovery means the agent calls correctly on the first try instead of guessing, failing, and retrying.
- **Large, loose API with cache-heavy reads and a single consumer**: a cache-friendly REST contract is the better developer experience. You avoid the schema tax and you get `304`s for free.
- **Somewhere in between**: measure it. That is the whole point of the harness.

There is no winner-take-all. It is a trade-off about where the cost of describing your API lives, and now I hope it is a trade-off you can put some numbers on.

## Run it yourself

The full harness is on GitHub: [mcp-vs-rest-bench](https://github.com/edodusi/mcp-vs-rest-bench). The backend, the two interfaces, the task suite, the runner, and the raw results JSON. It runs against Amazon Bedrock on demand, so there is nothing to tear down, no standing infrastructure, and a full five-trial sweep costs a few cents of Haiku tokens. Point it at your own stack, your own tasks, your own model, and settle your own version of the argument.

Don't decide with vibes. Decide with data.
