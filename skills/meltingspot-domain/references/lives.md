Status: delivered

# Lives

## What it is

A live is a scheduled live event of the Spot. Its video `solution` is one of:

- `BuiltIn`: hosted by MeltingSpot, as a `Workshop` (everyone is in the video
  room) or a `Conference` (only hosts and speakers are in the room, the others
  watch the stream);
- `Youtube` or `Vimeo`: an external video, which needs a `videoUrl`;
- `NoSolution`.

## Key fields and statuses

- `title`: 3 to 200 characters. `descriptionMarkdown`: empty when none.
- `startDate`, `endDate`: ISO 8601, to the second. The start is before the
  end. A `BuiltIn` live starts in the future, and its duration is capped by a
  limit of the Spot.
- `status` (as saved) and `computedStatus` (deduced from the dates):
  `Planned`, `Live`, `Ended`.
- `privacy.visibility`: `AnyOne`, `OnlySpotMembers`, `InvitedMembersOnly`.
- `privacy.participation`: `AnySpotMembers`, `InvitedMembersOnly`.
- `config.chatVisibility`, `config.participantsVisibility`: `Display` or
  `Hidden`.
- `hostSpotMemberIds`: the hosts, the creator first.
- `metrics`: `averageViewTime` (seconds), `invited`, `registrant`,
  `attendee`, `attendanceRate`, `noShow`, `totalReplayView`.
- `builtInConfig`: recording, replay availability, breakout rooms, raise hand,
  picture in picture, and the recorded `videos`.

## People of a live

Hosts, speakers and participants are all Spot members, each with a `type`:

- `Host`: a speaker with the rights to manage the live;
- `Speaker`: presents in the live;
- `Participant`: attends the live.

Participant `status`: `Invited` (no answer yet), `Accepted` (registered),
`Declined`.

## Relations

- **Host.** `live_create` makes `spotMemberHostId`, or the connected user by
  default, the first host. The host must be an administrator or hold a live
  permission.
- **Inviter.** Every invitation made through the tools is made by the
  connected user.
- **Linked groups.** The members of a linked group are invited to the live,
  in the background, and the future members of the group too. Unlinking a
  group leaves the members already invited through it invited.
- A live can be a step of a learning path (see `learning-paths.md`).

## Tools

| Tool | Use | Bounds |
| --- | --- | --- |
| `live_list` | List the lives. | Paginated; `title`, `status`, `startDate`, `solution`, `builtInType`, `replay`; metric ranges (`averageViewTime` in minutes here). |
| `live_get` | Read one live. Read it before `live_update`. | `liveId`. |
| `live_create` | Create a live. | `title`, `startDate`, `endDate`, `solution` required; `description` in Markdown, 40,000 characters at most; `builtInType` for `BuiltIn`; `videoUrl` for `Youtube` or `Vimeo`. |
| `live_update` | Change the given fields. | `description` in Markdown, 80,000 characters at most. `record`, `recordAvailable`, `enableBreakoutRooms` apply only with `solution: BuiltIn` and `builtInType` in the same call. |
| `live_delete` | Delete a live. | Returns `{ deleted: true, liveId }`. |
| `live_list_participants` | List everyone: participants, speakers and hosts, oldest first. | Paginated; `firstname`, `lastname`, `email` (`equals`, `contains`); `status`; `type`; `hasReplayed`; `hasParticipated`. |
| `live_list_speakers` | List the speakers and hosts, oldest first. | Paginated; same filters, without `type`. |
| `live_invite_participants` | Invite members, or people by email, as participants. | `spotMemberIds` and `emails`: 100 people at most in all; `withEmailNotification` (default `false`). |
| `live_invite_speakers` | Invite members as speakers or hosts. | `spotMemberIds`: 100 at most; `grantHostRights`, `highlighted`, `withEmailNotification` (all default `false`). |
| `live_invite_speaker_by_email` | Invite one person as speaker by email. | `email`, `firstName`, `lastName` required; `title`, `biography`, `grantHostRights`, `highlighted`. |
| `live_list_groups` | List the linked groups, with their notification settings. | Paginated. |
| `live_add_groups` | Link groups. | `groupIds`: 1 to 50; `withEmailNotification` (default `false`), `withInAppNotification` (default `true`). |
| `live_remove_groups` | Unlink groups. | `groupIds`: 1 to 50. |

## Pitfalls

- Defaults of `live_create`: `visibility` and `participation` are
  `InvitedMembersOnly`, chat and participant list are `Display`, and a
  `BuiltIn` live is recorded. Tell the user when the live is invite-only.
- `live_create` invites nobody and links no group: call
  `live_add_groups` or the invitation tools afterwards.
- `live_update` changes neither the hosts, the participants nor the linked
  groups.
- When `live_update` changes a date or the solution, the status is computed
  again from the resulting dates. A `BuiltIn` live must then start in the
  future: moving its start to the future works, but changing only the end of
  a `BuiltIn` live whose start is past, or switching to `BuiltIn` a live whose
  start is past, fails with
  `Invalid input : Start date must be after now in builtIn live`.
- `replayVideoUrl` must be the URL of one of the `builtInConfig.videos` of a
  `BuiltIn` live. Any other value fails, `null` included, although the tool
  describes `null` as removing the replay.
- A description that cannot be read as Markdown fails with
  `The description cannot be read as Markdown.`
- `live_delete` cannot be undone. A live used in a learning path or in the
  rules of a smart group cannot be deleted.
- Inviting by email someone who is not a member of the Spot invites that
  person to the Spot too, with the role `Member` and the status `Invited`.
- Invitations by member id accept members whose status is `Accepted`,
  `Invited`, `Pending` or `DeclinedInvitation`. A `Pending` registration is
  accepted.
- The invitation tools return `{ items }`: only the people invited by this
  call. People already invited are missing, without an error.
- `live_invite_speakers` turns existing participants into speakers. Existing
  speakers and hosts stay unchanged and are missing from the result.
- `live_invite_speaker_by_email` sends no email. On a person already in the
  live, it overwrites the type and the highlight: without `grantHostRights`,
  it turns a host into a speaker. It returns `{ speaker }`; when `speaker` is
  `null`, check with `live_list_speakers`.
- `live_add_groups` returns `addedGroupIds`, which includes groups already
  linked, and `failedGroupIds`, the groups not found in the Spot. The
  notification settings apply only to newly linked groups.
- `live_remove_groups` returns `removedGroupIds` and `failedGroupIds`.
- Dates are in UTC: confirm the time zone with the user before scheduling.
