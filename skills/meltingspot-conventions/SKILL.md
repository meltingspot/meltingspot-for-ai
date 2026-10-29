---
name: meltingspot-conventions
description: Ground rules for every MeltingSpot MCP tool call. Load it before the first call to any MeltingSpot tool (Spot, members, custom properties, groups, tags, channels, lives, learning paths, collections, moderation, search) and whenever the user asks about their Spot, its members, groups, tags, channels, lives, learning paths, collections, moderation or search. Covers the Spot of the connection, pagination, batch limits, dates, Markdown, ids, the reply language and tools you cannot see.
---

# MeltingSpot conventions

Rules that apply to every tool of the MeltingSpot MCP server.

These rules say how to call the tools. For what the resources mean (a Spot, its
members, groups, linked groups, participants…) and how they relate, load the
`meltingspot-domain` skill.

## One connection = one Spot

- A connection gives access to exactly one Spot: the Spot chosen when the
  connection was approved.
- No tool takes a `spotId`. Every tool acts on the Spot of the connection.
- To act on another Spot, the user must add a connection to that Spot. Never
  try to reach another Spot through an id.

## Start by checking the Spot

Before the first action in a conversation, confirm which Spot you are working
on:

1. `spot_get` returns the Spot of the connection.
2. `spot_list_for_me` lists the Spots of the connected user, as administrator
   or member, with the role of the user in each. It marks the Spot of the
   connection as current.

If the user names a Spot that is not the current one, say so and explain that
the tools only act on the current Spot.

## Pagination

- Every list is paginated: `page` starts at 1, `limit` goes from 1 to 100 and
  defaults to 20.
- A list returns its `items` and the `total` count. Read `total` before
  claiming that a list is complete.
- `search_spot` returns at most 20 results per page.
- Fetch more pages only when the task needs them: each item consumes your
  context. Prefer filters to reading every page.

## Batches

- A tool that takes a list of ids accepts 100 items at most per call.
- Linking groups to a resource (`channel_add_groups`, `live_add_groups`)
  accepts 50 groups at most per call.
- Above the limit, split the work into several calls and follow the rules of
  the `meltingspot-write-safely` skill.

## Formats

- Dates are ISO 8601 in UTC, in input and output: `2026-10-19T14:00:00.000Z`.
- The user speaks in local time. Convert it to UTC before a call, and show
  dates in the user's time zone when you answer. When you schedule something
  (a live, for example), confirm the time zone with the user if it is not
  certain.
- Rich text is Markdown, in input and output.

## Designate by id

- Tools designate entities by id (`groupId`, `tagId`, `spotMemberId`…).
- Find the id with a list or search tool first, then act on it. Never guess
  an id or build one from a name.
- A few tools also accept a readable key when the API does: custom properties
  are designated by their slug, from `custom_property_list`.
- An entity of another Spot is reported as not found.

## Reply in the language of the user

The tools speak English. Always answer in the language the user writes in,
including when you relay a tool result or an error message.

## Tools you cannot see

- The tools available depend on the server version. Before using a tool you do
  not see, check the tools available to you in this session.
- If no tool covers the request, say so plainly. Do not work around it with
  another tool that does something different.
- A domain can be announced before it is delivered: the status line of each
  reference of the `meltingspot-domain` skill says which. Do not claim an
  announced domain works until its tools appear in the tool list.
