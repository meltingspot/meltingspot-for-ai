Status: delivered

# Groups

## What it is

A group is a named set of Spot members. Groups are used to give a set of
members access to resources at once: a group linked to a resource brings its
members into it.

There are two types of groups:

- a **static** group: its members are added and removed by hand;
- a **smart** group: its members follow rules (tags, custom properties,
  other groups…). The tools do not create smart groups and do not change their
  members.

## Key fields

- `name`: required, 255 characters at most.
- `description`: 4,000 characters at most, or `null`.
- `emoji`: an emoji, or `null` when the group has none.
- The tools do not return the type of a group.

## Relations

- **Members.** A group contains Spot members.
- **Linked resources.** A group can be linked to channels, forums, lives,
  courses, learning paths, collections and roleplays. The tools of the
  resource make the link: `channel_add_groups`, `live_add_groups`,
  `learning_path_add_groups`, and so on. No tool links a group to a
  collection or a roleplay.
- **Effect of a link.** The members of a linked group become members or
  participants of the resource, in the background. Members added to the group
  later follow: adding members to a group adds them to the resources linked
  to it. What unlinking does depends on the resource: see its reference.
- **Smart group rules** can use a group. Such a group cannot be deleted.

## Tools

| Tool | Use | Bounds |
| --- | --- | --- |
| `group_list` | List the groups, oldest first. | Paginated; `name` filter with `eq` or `contains`. |
| `group_get` | Read one group. | `groupId`. |
| `group_create` | Create an empty static group. | `name` required; `description`, `emoji`. |
| `group_update` | Change the given fields. | `name`, `description`, `emoji`. |
| `group_delete` | Delete a group. | Returns `{ deleted: true, groupId }`. |
| `group_add_members` | Add members to a static group. | `spotMemberIds`: 1 to 100. |
| `group_remove_members` | Remove members from a static group. | `spotMemberIds`: 1 to 100. |
| `group_list_members` | List the members of a static or smart group. | `groupId`; paginated; same filters as `member_list`: `email`, `firstname`, `lastname` (exact values, 1 to 50 each, none containing a comma), `role`, `status`, `customRoleId`, `invitationDate`, `registrationDate`, `updatedAt` ranges. |

## Pitfalls

- `group_list` and `group_get` do not return members: use
  `group_list_members`. It reads a smart group like a static one, the members
  who currently follow its rules; a member who has just come to follow the
  rules may appear only after a short delay. An unknown group, or a group of
  another Spot, is not found.
- `group_add_members` and `group_remove_members` work on static groups only. A
  smart group is reported as `Cannot find group with id ...`.
- `group_add_members` returns `addedSpotMemberIds` and `failedSpotMemberIds`.
  It ignores, in neither list, ids that are unknown, already in the group, or
  members whose status is `DeclinedInvitation`, `Left`, `Deactivated` or
  `Rejected`. `Invited` and `Pending` members can be added.
- `group_remove_members` returns `removedSpotMembersCount`,
  `removedSpotMemberIds` and `failedSpotMemberIds`: ids not in the group,
  unknown or of another Spot.
- Adding or removing members of a group changes the members of every resource
  linked to it. Say so to the user before a bulk change.
- `group_delete` cannot be undone. The members stay in the Spot. A group used
  by the rules of a smart group, or linked to the content of a learning path,
  cannot be deleted: `Group with ID ... cannot be deleted.`
- `group_update` ignores an empty `name`. `description: null` empties it.

