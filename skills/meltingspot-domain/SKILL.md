---
name: meltingspot-domain
description: What a MeltingSpot Spot is and how its resources relate. Load it for any question about the structure of a Spot, its resources or their links - members and their roles and statuses, custom properties, groups and linked groups, tags, channels, forums and topics, lives with their hosts, speakers and participants, courses, learning paths, collections and documents, moderation and search - and before acting on a resource whose meaning or side effects you are not sure of, for example who receives an invitation or what linking a group does. Holds one reference per domain.
---

# The MeltingSpot domain

What the resources of a Spot are, and how they relate. The rules for calling
the tools (pagination, batches, dates, ids) are in the
`meltingspot-conventions` skill.

## The Spot

- A Spot is a MeltingSpot academy: the training content, the knowledge of a
  company and the people who learn from it. It feeds an AI coach, the Learning
  Agent (see `references/spot.md`). **One connection = one Spot**: every tool
  acts on the Spot of the connection and never takes a `spotId`. Check it with
  `spot_get`.
- Every tool requires the connected user to be an administrator of the Spot
  (otherwise: `You must be an administrator of this Spot to use this tool.`).
  So the tools see resources that members may not see: private channels,
  secret courses and learning paths, draft documents, the content of disabled
  modules in search. `spot_list_for_me` still lists every Spot where the user
  is an administrator or a member, with its role.
- A Spot is organized in **modules** that the administrators turn on or off,
  `Channels` holding the channels, forums and topics. The list of modules is
  in `references/spot.md`.

## Members: roles and statuses

A **member** (Spot member) is the membership of a person in the Spot,
designated by its `spotMemberId`, which is not a user id. It exists from the
invitation, before the person registers.

- `role`: `Admin` or `Member`.
- `status`: `Invited` (not registered yet), `Pending` (waiting for approval),
  `Accepted` (active), `Rejected`, `Deactivated`, `DeclinedInvitation`,
  `Left`.
- No tool deletes a member: deactivate it with `member_update`.

## Map of the resources

Read the reference of a domain before a write in that domain, or when a
result surprises you.

| Resource | What it is | Reference |
| --- | --- | --- |
| Spot | The academy, its settings, theme and modules. | `references/spot.md` |
| Member | A person in the Spot; custom properties describe members. | `references/members.md` |
| Group | A named set of members, static or smart, linked to resources. | `references/groups.md` |
| Tag | An ordered label; the tools assign it to members. | `references/tags.md` |
| Channel | A chat space, public or private. | `references/channels.md` |
| Forum | A space of topics, private or secret. | `references/forums.md` |
| Topic | A discussion thread in a forum. | `references/topics.md` |
| Live | A scheduled live event, with hosts, speakers and participants. | `references/lives.md` |
| Course | A training: introduction, page and quiz steps, conclusion. | `references/courses.md` |
| Learning path | An ordered list of steps: courses, lives, pages, links. | `references/learning-paths.md` |
| Collection | A set of documents: pages written in the Spot, or links. | `references/collections.md` |
| Reported content | A message or topic reported by members, with its reports. | `references/moderation.md` |
| Search | Full-text search over the Spot, as the connected user. | `references/search.md` |

## How resources relate

### Members and groups

- A member belongs to groups and carries tags.
- A **static** group is filled by hand (`group_add_members`). A **smart**
  group fills itself from rules (tags, custom properties, other groups); the
  tools do not change its members.
- A group or a tag used by the rules of a smart group cannot be deleted.

### Linked groups and access

A group can be **linked** to a channel, a forum, a live, a course or a
learning path. Linking a group gives its members access to the resource, in
the background, and its future members too. Groups can also be linked to
collections and roleplays, but no tool manages those links:

| Resource | Linking the group | Unlinking the group |
| --- | --- | --- |
| Channel | Members join the channel. | Members who joined only through the group leave. |
| Forum (secret only) | Members join the forum. | Members who joined only through the group leave. |
| Live | Members are invited. | Members already invited stay invited. |
| Course | Members become participants. | Participants who joined only through the group are unenrolled. |
| Learning path | Members become participants. | Participants who joined only through the group are unenrolled. |

- Adding members to a linked group adds them to every resource linked to it.
- Unlinking never deletes the group, and members added directly stay.
- To give a whole group access, link the group instead of adding its members
  one by one.

### Participation

- **Channel and forum members** are Spot members. A private forum is open to
  every member of the Spot and has no member list of its own; a secret forum
  and a channel have their own members.
- **Live:** every person of a live is a Spot member with a type: `Host` (a
  speaker who manages the live), `Speaker` or `Participant`.
- **Course and learning path participants** are Spot members, each with a
  participant id different from its `spotMemberId`, a status (`Invited`,
  `Started`, `Completed`, `Unenrolled`) and a completion rate.
- **Learning path steps** point to whole resources: a course, a live, a page
  or a link. Inviting someone to a learning path also invites them, in the
  background, to its courses and lives.

### Owners, creators and authors

The writes of the tools are attributed to the connected user:

- the connected user owns the channels and collections it creates. It is the
  first member of the channels it creates, and of the collections it creates
  as private;
- it is the first host of the lives it creates, unless another host is given;
- it creates the forums and authors the topics it creates;
- it is the inviter of every invitation and the author of every moderation
  decision.

### Invitations: who receives what

- `member_invite` invites people to the Spot. The invitation email is sent
  only with `withEmailNotification: true`.
- Invitations to a course or a learning path always send an in-app
  notification. Invitations to a live, a course or a learning path send an
  email only with `withEmailNotification: true`; `live_invite_speaker_by_email`
  sends no email at all.
- Inviting someone by email to a live also invites that person to the Spot.
- A course in `Draft` notifies nobody: its participants are notified when the
  course is published.
- Re-inviting a former participant of a course or a learning path enrolls it
  again from the start: its progress is erased.
- Accepting reported content emails its author; accepting or declining it
  notifies each reporter in the app.
