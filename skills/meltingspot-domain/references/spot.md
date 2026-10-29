Status: delivered

# Spot

## What it is

A Spot is a MeltingSpot community: its members, its groups and tags, and its
content (channels, forums, lives, courses, learning paths, collections). A
connection gives access to exactly one Spot, and every tool acts on it.

## Key fields

- `name`: 4 to 255 characters.
- `description`: 300 characters at most; an empty string is allowed.
- `privacy`: `Public` or `Private`.
- `ownerId`: the user id of the owner of the Spot.
- `lang`: the language of the Spot: `en`, `fr`, `de`, `it`, `es`, `pt`, `nl`.
- `theme`: `null`, or `fonts.default` plus a `light` and a `dark` palette.
  Each palette has `primary`, `primaryText`, `secondary`, `secondaryText` and
  `link`, as hex colors or `null`.
- `modules`: the modules of the Spot, each with `type`, `enabled` and `order`
  (from 0), sorted by `order`.

## Modules

A module is a section of the Spot that the administrators turn on or off.
The types are `SpotHomePage`, `Channels`, `Lives`, `Courses`,
`LearningPaths`, `Collections`, `MemberDirectory`, and `Roleplays` when it is
available to the Spot.

- The `Channels` module holds the channels, the forums and their topics.
- `search_spot` also returns the content of a disabled module, because the
  connection is an administrator of the Spot. For the members who are not
  administrators, search leaves that content out.

## Relations

- A Spot has members (see `members.md`), each with a role: `Admin` or
  `Member`.
- Groups, tags and custom properties belong to one Spot. An id of another Spot
  is reported as not found.

## Tools

| Tool | Use | Bounds |
| --- | --- | --- |
| `spot_get` | Read the Spot of the connection. | No input. |
| `spot_list_for_me` | List the Spots of the connected user, sorted by name, with its `role` in each and `current` on the Spot of the connection. | Paginated. |
| `spot_update` | Change the given fields of the Spot. | `name`, `description`, `privacy`, `lang`, `theme`, `spotModuleConfigs` (8 at most, each with `type` and optional `enabled`, `order`). |

## Pitfalls

- Every tool requires the connected user to be an administrator of the Spot
  of the connection; otherwise it answers
  `You must be an administrator of this Spot to use this tool.`
- `spot_list_for_me` lists the Spots where the membership of the user is
  accepted, as administrator or member, with its `role` in each. The other
  tools act only on the current Spot: to act on another Spot, the user adds a
  connection to it, as an administrator of that Spot.
- `spot_update` neither creates nor deletes a Spot, and cannot change its
  owner.
- Setting `privacy: Public` in `spot_update`, even on a Spot that is already
  public, accepts every `Pending` member and adds the members of the Spot to
  every channel with `autoJoin`. Confirm with the user first.
- `theme` is merged with the current theme: send only the values that change.
  `theme: null` removes the whole theme.
- In `spotModuleConfigs`, each module is designated by its `type`, at most
  once. A type the Spot does not have is ignored without an error. After a
  change of order, the modules are numbered again from 0.
- An invalid module change fails with
  `Invalid Spot update input for field spotModuleConfigs.`: check that each
  type appears once and that the orders are distinct.
