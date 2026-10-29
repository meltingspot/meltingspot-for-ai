Status: delivered

# Learning paths

## What it is

A learning path is an ordered list of steps. Each step points to a whole
resource of the Spot: a course, a live, a page or a link. Participants are
Spot members invited to follow the path.

A learning path step is not a course step: a course step is a page or a quiz
inside a course (see `courses.md`).

## Key fields and statuses

- Learning path: `id`, `title`, `description`, `privacy`, `navigationMode`.
  It has no creator and no publication status.
- `privacy`: `Public`, `Private` or `Secret`. A `Secret` path is visible in the
  app only to its participants. The administrators of the Spot, and so this
  connection, see every learning path.
- `navigationMode`: `Flexible` (steps in any order) or `Sequential` (the next
  content unlocks when the previous step is completed).
- Step: `id`, `title` (the title of its content), `contentType` (`Course`,
  `Link`, `Live`, `Page`), `contentId` (the id of that content), `createdAt`.
- Participant: `id`, `spotMemberId`, `spotMemberEmail`, names, `status`,
  `invitedAt`, `startedAt`, `completedAt`, `unenrolledAt`, `lastActivityAt`,
  `completionRate` (0 to 100: completed steps divided by the number of steps).
- Participant `status`: `Invited`, `Started`, `Completed`, `Unenrolled`.
- Step completion: `id`, `stepContentId` (a step id), `contentType`,
  `completedAt`.

## Relations

- **Participants** are Spot members; a member is a participant of a path at
  most once. A participant has its own id, different from its
  `spotMemberId`.
- **Inviting to the path invites to its contents.** In the background, the
  participant is also invited to the courses and lives of the path: all of
  them in a `Flexible` path, the available ones only in a `Sequential` path.
- **Linked groups.** The members of a linked group are participants of the
  path. Linking a group enrolls its members in the background, and its future
  members too. Unlinking a group unenrolls, in the background, the
  participants who joined only through that group. The group itself is not
  deleted.

## Tools

| Tool | Use | Bounds |
| --- | --- | --- |
| `learning_path_list` | List the learning paths, most recently created first. | Paginated; `privacy` filter. No title filter. |
| `learning_path_get` | Read one learning path. | `learningPathId`. |
| `learning_path_list_steps` | List the steps, last added first (not in path order). | Paginated; `learningPathId`; `contentTitle` (`equals`, `contains`); `contentType`. |
| `learning_path_list_participants` | List the participants, most recently added first. Find who has not started (`Invited`) or who completed. | Paginated; `learningPathId`; `status`; `firstname`, `lastname`, `email` (exact values, 1 to 50 each, none containing a space or a comma). |
| `learning_path_get_participant` | Read one participant and its completion rate. | `learningPathId`, `learningPathParticipantId`. |
| `learning_path_invite_participants` | Invite Spot members as participants, as the connected user. | `learningPathId`; `spotMemberIds`: 1 to 100; `withEmailNotification` (default `false`). |
| `learning_path_list_step_completions` | List the steps a participant completed, by date the step was assigned to the participant, most recent first (not by completion date). | Paginated; `learningPathId`, `learningPathParticipantId`; `completedAt` range; `contentType`. |
| `learning_path_get_step_completion` | Read one step completion. | `learningPathId`, `learningPathParticipantId`, `stepCompletionId`. |
| `learning_path_list_groups` | List the linked groups, most recently created groups first, with their notification settings. | Paginated; `learningPathId`. |
| `learning_path_add_groups` | Link groups. | `learningPathId`; `groupIds`: 1 to 50; `withEmailNotification` (default `false`), `withInAppNotification` (default `true`). |
| `learning_path_remove_groups` | Unlink groups. | `learningPathId`; `groupIds`: 1 to 50. |

## Pitfalls

- Every tool except `learning_path_list` takes the `learningPathId`. The
  participant and step completion tools also take the participant id from
  `learning_path_list_participants`, not the `spotMemberId`.
- `learning_path_invite_participants`:
  - always sends an in-app notification; an email only when
    `withEmailNotification` is `true`;
  - can be invited: members whose status is `Accepted`, `Invited`, `Pending`
    or `DeclinedInvitation`. A `Pending` registration is accepted;
  - returns `{ items }`, the new and re-enrolled participants only, with a
    `completionRate` always at 0: read the real rate with
    `learning_path_get_participant`. Members
    already participants, not found, who left the Spot, were deactivated or
    rejected are missing from the result, without an error;
  - enrolls a former participant again: status `Invited`, and all previous
    progress is erased. Confirm with the user before re-inviting a former
    participant (see the `meltingspot-write-safely` skill).
- `learning_path_add_groups` returns `addedGroupIds`, which includes groups
  that were already linked, and `failedGroupIds`, the groups not found in the
  Spot. A group already linked keeps its old notification settings.
- `learning_path_remove_groups` returns `removedGroupIds` and
  `failedGroupIds`: groups not linked or not found.
- `learning_path_get_step_completion` reports a step the participant has not
  completed as not found.
- In a `completedAt` range, both bounds are excluded, and `before` must be
  after `after`.
