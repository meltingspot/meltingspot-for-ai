Status: delivered

# Channels

## What it is

A channel is a chat space of the Spot, where members post messages. The
channel tools act only on channels: never on a forum, a topic or a private
discussion between members.

## Key fields

- `name`: required, trimmed, 1 to 80 characters.
- `description`: 400 characters at most; empty when there is none.
- `emoji`: a single emoji, or `null`.
- `privacy`:
  - `Public`: open to every member of the Spot;
  - `Private`: open only to its members.
- `autoJoin`: new members of the Spot join the channel on their own. Must be
  `false` for a private channel.
- `readonly`: only administrators can post.
- `showMembers`: members see the member list.

## Relations

- **Owner.** A channel created through `channel_create` is owned by the
  connected user, who also becomes its first member.
- **Channel members** are Spot members. A member joins directly or through a
  linked group.
- **Linked groups.** Linking a group makes its members join the channel, in
  the background, and the future members of the group too. Unlinking it makes
  the members who joined only through that group leave the channel, in the
  background. Members added directly stay. The group itself is not deleted.

## Tools

| Tool | Use | Bounds |
| --- | --- | --- |
| `channel_list` | List the channels, oldest first, private ones included. | Paginated. No name filter. |
| `channel_get` | Read one channel. | `channelId`. |
| `channel_create` | Create a channel, owned by the connected user. | `name`, `privacy`, `autoJoin`, `showMembers` required; `description`, `emoji`, `readonly` (default `false`). |
| `channel_update` | Change the given fields. | `description: null` empties it, `emoji: null` removes it. |
| `channel_delete` | Delete a channel. | Returns `{ deleted: true, channelId }`. |
| `channel_list_members` | List the members of a channel. | Paginated; `email`, `firstname`, `lastname` (exact values, 1 to 50 each); `role`; `registrationDate`. |
| `channel_add_members` | Add Spot members to a channel. | `spotMemberIds`: 1 to 100. |
| `channel_remove_members` | Remove members from a channel. | `spotMemberIds`: 1 to 100. |
| `channel_list_groups` | List the groups linked to a channel, oldest first. | Paginated. |
| `channel_add_groups` | Link groups to a channel. | `groupIds`: 1 to 50. |
| `channel_remove_groups` | Unlink groups from a channel. | `groupIds`: 1 to 50. |

## Pitfalls

- `channel_create` adds no member and no group besides its owner: call
  `channel_add_members` or `channel_add_groups` afterwards.
- A private channel with `autoJoin: true` is refused, on create and on update.
  Making a channel private stops new members from joining it on their own.
- `channel_update` does not change the members or the groups.
- `channel_delete` cannot be undone. The members stay in the Spot; they only
  leave the channel.
- To add every member of a group, link the group with `channel_add_groups`.
- `channel_add_members` returns `addedSpotMemberIds` and `failedSpotMemberIds`
  (save failures). An id that is ignored appears in neither list: unknown,
  from another Spot, already in the channel, or a member whose invitation was
  declined, who left, or who was deactivated. Only members with the status
  `Accepted`, `Invited` or `Pending` are added.
- `channel_remove_members` returns `removedSpotMembersCount`,
  `removedSpotMemberIds` and `failedSpotMemberIds` (not members of the
  channel). The members stay in the
  Spot and in its other channels.
- `channel_add_groups` returns `addedGroupIds`, which includes the groups that
  were already linked, and `failedGroupIds`, the groups not found in the Spot.
- `channel_remove_groups` returns `removedGroupIds` and `failedGroupIds`:
  groups not linked or not found.
- Joins and leaves through groups run in the background: right after a link
  change, `channel_list_members` may not show them yet.
- `channel_add_groups` and `channel_remove_groups` return group ids in lower
  case, and `channel_remove_members` returns member ids in lower case.
