Status: delivered

# Members and custom properties

## What it is

A member (Spot member) is the membership of a person in the Spot. It exists
from the invitation, before the person registers, so its `userId` can be
`null`. A member is designated by its `spotMemberId`, which is not a user id.

Custom properties are fields that the Spot defines for its members (job,
company, plan…). Each member can have a value for each property.

## Key fields and statuses

- `email`, `firstname`, `lastname`, `title`, `avatarUrl`, `lang`,
  `lastActivityAt`, `warnings` (number of moderation warnings),
  `customRoleId`.
- `role`: `Admin` or `Member`.
- `status`:
  - `Invited`: invited, not registered yet;
  - `Pending`: registered, waiting for the approval of an administrator;
  - `Accepted`: active member;
  - `Rejected`: registration refused;
  - `Deactivated`: deactivated by an administrator;
  - `DeclinedInvitation`: declined the invitation;
  - `Left`: left the Spot.
- Custom property: `slug` (unique in the Spot), `label`, `description`,
  `type`, `possibleValues` (the option slugs of a select type).
- Custom property `type`: `Text`, `Boolean`, `Number`, `SingleSelect`,
  `MultipleSelect`, `Date`.

## Relations

- A member belongs to groups (see `groups.md`) and carries tags (see
  `tags.md`).
- A member is the person behind every participation: channel and forum
  members, live speakers and participants, course and learning path
  participants are all designated through Spot members.
- Custom properties can feed the rules of smart groups.
- A member carries at most one custom role, its `customRoleId`, which gives
  it extra permissions (see `custom-roles.md`). `member_list` filters the
  members by `customRoleId`; `member_update` gives or takes back the role.

## Tools

| Tool | Use | Bounds |
| --- | --- | --- |
| `member_list` | List the members. | Paginated; `email`, `firstname`, `lastname` (exact values, 1 to 50 each, none containing a comma); `role`; `status`; `customRoleId`; `invitationDate`, `registrationDate`, `updatedAt` ranges. |
| `member_get` | Read one member. | `spotMemberId`. |
| `member_invite` | Invite people to the Spot by email. | `emails`: 1 to 100; `withEmailNotification` (default `false`). |
| `member_update` | Change a member. | `firstname`, `lastname`, `title`, `role`, `status` (`Accepted`, `Rejected`, `Deactivated`), `avatarUrl`, `embedBaseUrls`, `customRoleId`. |
| `custom_property_list` | List the custom properties of the Spot, oldest first. | Paginated. |
| `member_list_custom_properties` | Read the values of a member. | `spotMemberId`; paginated. |
| `member_set_custom_properties` | Write values for a member, by property slug. | `values`: 1 to 100 `{ customPropertySlug, value }`. |
| `member_list_form_answers` | Read the answers of a member to the registration form of the Spot, in the order of the questions. | `spotMemberId`; paginated; `questionLabel` filter with `contains`. |

## Pitfalls

- `member_list` has no free-text search: names and emails must match exactly.
  To find someone by part of a name, use `search_spot` (see `search.md`). An
  exact value that contains a comma is refused (`Invalid parameters`).
- No tool deletes a member. To remove someone, deactivate the member with
  `member_update`.
- `member_invite`:
  - sends the invitation email only when `withEmailNotification` is `true`;
  - creates new members with the role `Member` and the status `Invited`;
  - returns `{ items }`: the new members first, then the emails that were
    already members, returned unchanged whatever their status. A member who
    left, declined, was rejected or was deactivated is not invited again by
    `member_invite`;
  - fails as a whole on one invalid email;
  - is capped by the invitation limit of the Spot, counted on the members
    still `Invited` plus the full list sent.
- Inviting by email to a live (`live_invite_participants` with `emails`,
  `live_invite_speaker_by_email`) works differently: a member who was
  `Rejected`, `DeclinedInvitation`, `Deactivated` or `Left` goes back to
  `Invited`, and counts against the invitation limit of the Spot.
- No tool lists the groups or the tags of a member. `tag_list_members` lists
  the members of one tag.
- `member_update` allows only these status changes: `Pending` to `Accepted`
  or `Rejected`; `Accepted` to `Deactivated`; `Rejected` or `Deactivated` to
  `Accepted`. The owner of the Spot cannot be deactivated. A request to
  deactivate the connected user is ignored, while the other fields still
  change. Demoting the last administrator fails with the generic unexpected
  error.
- In `member_update`, `null` clears only `title`, `avatarUrl` and
  `customRoleId`.
- `member_list_custom_properties` lists only the properties that have a value.
- `member_set_custom_properties`:
  - designates properties by slug, from `custom_property_list`;
  - skips without an error an unknown slug, a value of the wrong type, or
    select options that do not exist. Compare the returned `items` with what
    you sent;
  - takes option slugs for a select; `SingleSelect` takes exactly one;
  - deletes a value when it is `null`.
- No tool creates or changes the custom properties themselves.
- `member_list_form_answers`:
  - Each answer comes with its question: `questionLabel`,
    `questionContentMarkdown` (the text of the question, in Markdown),
    `type`, `visibility` (`Public` or `Private`), `isRequired` and
    `possibleAnswers`.
  - `answers` is always text: a `CheckBox` answers `"true"` or `"false"`, a
    `Number` its number as text, a select the labels of its choices, `""` for
    a choice deleted since the answer.
  - Answers to private questions are listed too. A `Description` block of
    the form has no answer and is never listed.
  - A Spot without registration form returns an empty list. A member of
    another Spot is not found.
