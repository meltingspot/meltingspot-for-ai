---
name: meltingspot-write-safely
description: Safety rules for every MeltingSpot MCP tool that writes or deletes (create, update, invite, add, remove, delete, assign, validate). Load it before calling any MeltingSpot tool that is not read-only, and before any change to the Spot itself, its members, custom properties, groups, tags, channels, lives, collections or reported content, in particular a bulk change. Covers reading before writing, explicit confirmation of destructive and bulk operations, partial results, attribution of writes and retries.
---

# Write safely on MeltingSpot

Every write is real and visible to the members of the Spot. Follow these rules
for every tool that is not read-only.

## Read before you write

- Read the current state first: the `*_get` or `*_list` tool of the entity.
- Check that the entity exists, belongs to the Spot of the connection, and is
  the one the user means. When several entities match a name, ask the user
  which one.
- Show the user what will change when it is not obvious from the request.

## Confirm before destructive or bulk operations

Ask the user for an explicit confirmation, and wait for it, before calling:

- any tool annotated `destructiveHint: true`. It removes something: a
  resource, a link, or members. Examples: `group_delete`, `tag_delete`,
  `channel_delete`, `live_delete`, `group_remove_members`,
  `tag_unassign_members`, `channel_remove_members`, `channel_remove_groups`,
  `live_remove_groups`;
- `moderation_validate_reported_resources`. The server does not annotate it
  as destructive, but this plugin requires a confirmation: accepting notifies
  the members concerned, and the reports take the same status;
- any write that affects several entities at once: invitations, adding or
  removing members, assigning tags, or a series of calls that splits a large
  batch.

The confirmation names the Spot, the operation, the target and the number of
items. A confirmation covers only the operation it describes: ask again if the
scope changes.

A modification can also erase data without being destructive: an update can
overwrite a value or set it to `null`. Treat it with the same care: say what
the previous value was.

## Read partial results

Bulk tools can succeed for some items and fail for others. They return the
detail:

- `addedSpotMemberIds` / `failedSpotMemberIds`;
- `removedSpotMemberIds` / `failedSpotMemberIds`;
- `addedGroupIds` / `removedGroupIds` / `failedGroupIds`;
- `updatedReportedResources` / `failedReportedResourceIds`: a resource
  already in the requested status is in neither list.

Always report both sides to the user: how many succeeded, how many failed,
and which ones failed. Never report a bulk call as fully successful without
reading these fields.

Some tools return less than what was requested:

- `live_invite_participants` and `live_invite_speakers` return the people
  invited by this call in `items`: a requested person missing from `items` was
  already invited, or cannot be invited;
- `member_invite` also returns, in `items`, the emails that were already
  members of the Spot, unchanged;
- `live_invite_speaker_by_email` can return `null`: check with
  `live_list_speakers`;
- `member_custom_properties_set` ignores an unknown slug or a value of the
  wrong type: compare its output with what you sent.

A deletion returns `{ deleted: true, <entity>Id }`, for example
`{ deleted: true, groupId }`.

## Writes are attributed to the connected user

The server attributes each write to the user who approved the connection: for
example, that user is the inviter of the invited members or the creator of
the group. Remind the user of it before writes that members will notice, such
as invitations.

## Do not retry in a loop

- After an error, read the message and follow the `meltingspot-errors` skill.
- Retry only when you changed something that addresses the cause, at most
  once. Never repeat the same failing call.
- A refused access will not change by retrying: tell the user what to do.
- After an unexpected error on a write, read the state again before any new
  attempt: the write may have happened.
