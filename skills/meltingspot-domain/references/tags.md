Status: delivered

# Tags

## What it is

A tag is an ordered label of the Spot, with an optional emoji. Through the
tools, tags are assigned to members, to describe or segment them.

Other resources can carry the tags of the Spot too: channels, topics, lives
and the documents of collections. No tool assigns or removes those tags.

## Key fields

- `name`: required, 1 to 255 characters.
- `emoji`: an emoji, or `null` when the tag has none.
- `order`: the position of the tag in the Spot, from 1.

## Relations

- A tag is carried by members. A member can carry several tags.
- The rules of a smart group can use a tag (see `groups.md`). Such a tag
  cannot be deleted.

## Tools

| Tool | Use | Bounds |
| --- | --- | --- |
| `tag_list` | List the tags, in the order of the Spot. | Paginated; `name` filter with `eq` or `contains`. |
| `tag_get` | Read one tag. | `tagId`. |
| `tag_create` | Create a tag, placed last and assigned to no one. | `name` required; `emoji`. |
| `tag_create_many` | Create several tags. | `tags`: 1 to 100 `{ name, emoji }`. |
| `tag_update` | Rename a tag or change its emoji. | `name`, `emoji` (`null` removes it). |
| `tag_delete` | Delete a tag. | Returns `{ deleted: true, tagId }`. |
| `tag_assign_members` | Assign a tag to members. | `spotMemberIds`: 1 to 100. |
| `tag_unassign_members` | Remove a tag from members. | `spotMemberIds`: 1 to 100. |
| `tag_list_members` | List the members who carry a tag. | Paginated; same filters as `member_list`: `email`, `firstname`, `lastname` (exact values, 1 to 50 each, none containing a comma), `role`, `status`, `customRoleId`, `invitationDate`, `registrationDate`, `updatedAt` ranges. |

## Pitfalls

- `tag_create_many` is partial: it returns `created` and `failed` (the
  invalid names or emojis), without an error. Check `failed`.
- `tag_update` changes neither the order nor the members who carry the tag.
- `tag_delete` removes the tag from every member who carries it, and the other
  tags are ordered again. It cannot be undone. A tag used by a smart group
  cannot be deleted: `Tag with ID ... cannot be deleted.`
- `tag_assign_members` returns `addedSpotMemberIds`, which includes members
  who already carried the tag, and `failedSpotMemberIds`, ids that are not
  members of the Spot.
- `tag_unassign_members` returns `removedSpotMemberIds`, which includes
  members who did not carry the tag, and `failedSpotMemberIds`. It deletes
  neither the tag nor the members.
- The tools take `spotMemberIds`, not user ids.

