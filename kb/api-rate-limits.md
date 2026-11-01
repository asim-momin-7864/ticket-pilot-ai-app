---
title: API rate limits and 429 errors
collection: api-and-webhooks
visibility: public
status: current
plan: all
last_updated: 2026-10-05
---

## Limits per plan

| Plan     | Requests per minute |
| -------- | ------------------- |
| Free     | 60                  |
| Pro      | 300                 |
| Business | 1000                |

Enterprise limits are set in your contract.

## What a 429 means

When you exceed your limit, the API returns HTTP 429 (Too Many Requests). The response includes a `Retry-After` header with the number of seconds to wait.

## How to fix it

1. Read the `Retry-After` header and wait that long before retrying.
2. Add exponential backoff: wait 1s, then 2s, then 4s.
3. Cache responses that do not change often.
4. If you still hit the limit regularly, upgrade your plan.
