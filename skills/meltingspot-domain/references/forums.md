Status: delivered

# Forums

## What it is

A forum is a space of discussion threads, called topics (see `topics.md`).
It is not a channel: a forum holds topics, and each topic is its own thread.

## Key fields

- `name`: required, trimmed, 1 to 80 characters.
- `description`: 400 characters at most, empty string when there is none.
- `emoji`: a single emoji, or `null`.
- `privacy`:
  - `Private`: open to every member of the Spot. This is the default.
  - `Secret`: open only to the members invited to the forum.
- `createdAt`: ISO 8601.

## Relations

- **Topics.** A forum contains topics. A topic belongs to one forum.
- **Creator.** A forum created through `forum_create` is created by the
  connected user.
- **Members and linked groups exist only on a `Secret` forum.** A `Private`
  forum is open to every member of the Spot, so it has no members or groups of
  its own. The member and group tools refuse a `Private` forum.
- **Forum members** are Spot members. A member joins a secret forum directly
  or through a linked group.
- **Linked groups.** Linking a group to a secret forum makes its members join
  the forum, in the background, and the future members of the group too.
  Unlinking it makes the members who joined only through that group leave the
  forum, in the background. The group itself is not deleted. A forum link has
  no notification settings, unlike the links of lives, courses and learning
  paths.

## Tools

| Tool | Use | Bounds |
| --- | --- | --- |
| `forum_list` | Find a forum by its name before acting on it. | Paginated; `nameContains` filter. |
| `forum_get` | Read one forum. | `forumId`. |
| `forum_create` | Create a forum, as the connected user. | `name` required; `description`, `emoji`, `privacy` (default `Private`). |
| `forum_update` | Change the given fields only. | `name`, `description`, `emoji`, `privacy`; `description: null` empties it, `emoji: null` removes it. |
| `forum_delete` | Delete a forum. | Returns `{ deleted: true, forumId }`. |
| `forum_list_members` | List the members of a secret forum. | Paginated; filters `email`, `firstname`, `lastname` (exact values, 1 to 50 each), `role` (`Member`, `Admin`), `registrationDate`. |
| `forum_add_members` | Add Spot members to a secret forum. | `spotMemberIds`: 1 to 100. |
| `forum_remove_members` | Remove members from a secret forum. | `spotMemberIds`: 1 to 100. |
| `forum_list_groups` | List the groups linked to a forum, oldest first. | Paginated. |
| `forum_add_groups` | Link groups to a secret forum. | `groupIds`: 1 to 50. |
| `forum_remove_groups` | Unlink groups from a secret forum. | `groupIds`: 1 to 50. |

## Pitfalls

- `forum_create` adds no member and no group. For a secret forum, call
  `forum_add_members` or `forum_add_groups` afterwards.
- `forum_update` does not change the members or the groups. To give a forum
  its own members, first switch it from `Private` to `Secret` with
  `forum_update`, then call the member and group tools.
- `forum_delete` cannot be undone. The members stay in the Spot; they only
  leave the forum.
- To add every member of a group, link the group with `forum_add_groups`
  instead of adding its members one by one.
- `forum_add_members` returns `addedSpotMemberIds` and `failedSpotMemberIds`.
  An id that is ignored appears in neither list: unknown, from another Spot,
  already a member, or a Spot member whose invitation was declined, who left,
  or who was deactivated. Only members with the status `Accepted`, `Invited`
  or `Pending` are added. When the `Channels` module is enabled, the added
  members get an in-app notification.
- `forum_remove_members` returns `removedSpotMembersCount`,
  `removedSpotMemberIds` and `failedSpotMemberIds` (not members of the
  forum). The removed members stay
  in the Spot and in its other forums.
- `forum_add_groups` returns `addedGroupIds`, which includes the groups that
  were already linked, and `failedGroupIds`, the groups not found in the Spot.
- `forum_remove_groups` returns `removedGroupIds` and `failedGroupIds`: groups
  not linked or not found.
- `Forum <id> is not a Secret Forum.` (or, from `forum_remove_members`,
  `Forum with id <id> is not a secret forum.`) means the tool was called on a
  `Private` forum.
