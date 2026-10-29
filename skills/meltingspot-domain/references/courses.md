Status: delivered

# Courses

## What it is

A course is a training made of an introduction page, ordered intermediate
steps, and a conclusion page. Each step is a `Page` or a `Quiz`. Participants
are Spot members invited to follow the course.

A course can itself be a step of a learning path (see `learning-paths.md`).

## Key fields and statuses

- Course: `id`, `title`, `description`, `privacy`, `status`,
  `navigationMode`, `modules` (`id`, `name`). `moduleName` is deprecated: it
  is the name of the first module only.
- `privacy`: `Public` or `Secret`. A `Secret` course is visible in the app only
  to its participants. The administrators of the Spot, and so this
  connection, see every course.
- `status`: `Draft` (not visible to the members yet) or `Published`.
- `navigationMode`: `Flexible` or `Sequential`.
- Step: `id`, `title`, `duration` (minutes, or `null`), `contentType`
  (`Page`, `Quiz`), `createdAt`.
- Participant: `id`, `spotMemberId`, `spotMemberEmail`, names, `status`,
  `invitedAt`, `startedAt`, `completedAt`, `unenrolledAt`, `lastActivityAt`,
  `completionRate` (0 to 100, the conclusion left out).
- Participant `status`: `Invited`, `Started`, `Completed`, `Unenrolled`.
- Step completion: `id`, `stepId`, `contentType`, `completedAt`. Read one with
  `course_get_step_completion` to get its `quizScore`: `totalQuestionsCount`,
  `correctAnswersCount`, and `score` from 0 to 1.

## Relations

- **Participants** are Spot members. A participant has its own id, different
  from its `spotMemberId`.
- **Learning paths.** A member invited to a learning path is invited, in the
  background, to the courses of that path.
- **Linked groups.** The members of a linked group are participants of the
  course. Linking a group enrolls its members in the background, and its
  future members too. Unlinking a group unenrolls, in the background, the
  participants who joined only through that group. The group itself is not
  deleted.

## Tools

| Tool | Use | Bounds |
| --- | --- | --- |
| `course_list` | List the courses, most recently created first. | Paginated; `status`; `privacy`; `moduleName` (`equals`, `contains`). No title filter. |
| `course_get` | Read one course with its modules. | `courseId`. |
| `course_list_steps` | List the steps, introduction and conclusion included, most recently created first (not in course order). | Paginated; `courseId`; `title` (`equals`, `contains`); `contentType`. |
| `course_list_participants` | List the participants. | Paginated; `courseId`; `status`; `firstname`, `lastname`, `email` (exact values, 1 to 50 each, none containing a space or a comma). |
| `course_get_participant` | Read one participant and its completion rate. | `courseId`, `courseParticipantId`. |
| `course_invite_participants` | Invite Spot members as participants, as the connected user. | `courseId`; `spotMemberIds`: 1 to 100; `withEmailNotification` (default `false`). |
| `course_list_step_completions` | List the steps a participant completed, most recently recorded first. | Paginated; `courseId`, `courseParticipantId`; `completedAt` range; `contentType`. |
| `course_get_step_completion` | Read one step completion, with its quiz score. | `courseId`, `courseParticipantId`, `stepCompletionId`. |
| `course_list_groups` | List the linked groups, with their notification settings. | Paginated; `courseId`. |
| `course_add_groups` | Link groups. | `courseId`; `groupIds`: 1 to 50; `withEmailNotification` (default `false`), `withInAppNotification` (default `true`). |
| `course_remove_groups` | Unlink groups. | `courseId`; `groupIds`: 1 to 50. |

## Pitfalls

- Every tool except `course_list` takes the `courseId`. The participant and
  step completion tools also take the participant id from
  `course_list_participants`, not the `spotMemberId`.
- `course_invite_participants`:
  - sends an in-app notification, and an email only when
    `withEmailNotification` is `true`;
  - notifies nobody while the course is a `Draft`: the participants are
    notified when the course is published, with the notification settings
    given at the invitation. Invited with no notification at all, they stay
    silent at publication;
  - needs the connected user to have a member account in the Spot;
  - can be invited: members whose status is `Accepted`, `Invited`, `Pending`
    or `DeclinedInvitation`. A `Pending` registration is accepted;
  - returns `{ items }`, the new and re-enrolled participants only, with a
    `completionRate` always at 0: read the real rate with
    `course_get_participant`. Members
    already participants, not found, who left the Spot or were deactivated
    are missing from the result, without an error;
  - enrolls a member who had left the course again: status `Invited`, and
    the previous step completions are erased. Confirm with the user before
    re-inviting a former participant (see the `meltingspot-write-safely`
    skill).
- `course_add_groups` returns `addedGroupIds`, which includes groups that were
  already linked, and `failedGroupIds`, the groups not found in the Spot. A
  group already linked keeps its old notification settings, and its members
  are not enrolled again.
- `course_remove_groups` returns `removedGroupIds` and `failedGroupIds`:
  groups not linked or not found.
- `course_get_step_completion` reports a step the participant has not
  completed as not found. A quiz completion without a recorded score returns
  an error instead of a result.
- In a `completedAt` range, both bounds are excluded, and `before` must be
  after `after`. The range must have `before`, `after` or both.
