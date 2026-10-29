Status: delivered

# Custom roles

## What it is

A custom role is a set of extra permissions that the Spot defines. It gives
those permissions to the members who carry it, on top of their member role
(`Admin` or `Member`). A member carries at most one custom role: its
`customRoleId`, or `null`.

## Key fields

- `id`: the id of the custom role, the `customRoleId` of the members who
  carry it.
- `label`: required, not empty, 20 characters at most. Spaces around it are
  removed.
- `description`: 100 characters at most. Empty (`""`) when the role has none.
- `permissions`: at least one of:
  - `live.full.*`: create and manage lives, with access to all the lives of
    the Spot;
  - `live.limited.*`: create and manage lives, limited to the lives the member
    can already access;
  - `live.*`: legacy value, grants the same as `live.full.*`;
  - `moderation.*`: access the moderation and delete messages;
  - `spot.member.invite.*`: invite members to join the Spot;
  - `course.full.*` and `course.limited.*`: create and manage courses, with
    access to all the courses of the Spot, or limited to the courses the
    member can already access;
  - `collection.full.*` and `collection.limited.*`: create and manage
    collections and their documents, with access to all the collections, or
    limited to the collections the member can already access.
- `audienceScope`: the members the permissions apply to. `All` (every member
  of the Spot) or `GroupsLimited` (only the members of the groups of
  `audienceScopeGroupIds`).
- `audienceScopeGroupIds`: the groups of a `GroupsLimited` role, empty
  otherwise.

## Relations

- **Members.** A member carries a custom role through its `customRoleId`
  (see `members.md`). `member_list` filters the members by `customRoleId`.
- **Groups.** A `GroupsLimited` custom role limits its permissions to the
  members of some groups (see `groups.md`).
- **Smart groups.** The rules of a smart group can use a custom role. Such a
  custom role cannot be deleted.

## Tools

| Tool | Use | Bounds |
| --- | --- | --- |
| `custom_role_list` | List the custom roles, sorted by label. | Paginated; `label` filter with `eq`, `contains`, or `in` (1 to 50 exact labels, none containing a comma). |
| `custom_role_get` | Read one custom role. | `customRoleId`. |
| `custom_role_create` | Create a custom role, carried by no one. | `label` required; `description`; `permissions` required, at least one. |
| `custom_role_update` | Change the given fields. | `label`, `description` (`null` removes it), `permissions` (replace the current ones, at least one). |
| `custom_role_delete` | Delete a custom role. | Returns `{ deleted: true, customRoleId }`. |

## Pitfalls

- No `custom_role_*` tool gives a custom role to a member or takes it back.
  Use `member_update` with `customRoleId`; `null` takes it back.
- `custom_role_list` and `custom_role_get` do not return the members who carry
  the role, nor their number. To list them, use `member_list` with
  `customRoleId`.
- The tools read `audienceScope` and `audienceScopeGroupIds` but cannot change
  them. A role created by `custom_role_create` applies to every member who
  carries it, whatever their groups.
- `custom_role_update` applies at once to every member who carries the role.
  The `permissions` it receives replace the current ones: send the full list.
- `custom_role_delete` cannot be undone. The members who carry the role stay
  in the Spot and lose it, with the permissions it granted: their
  `customRoleId` becomes `null`. Say so to the user before deleting a role
  that is still carried.
- A custom role used by the rules of a smart group cannot be deleted:
  `Spot member custom role with ID ... is marked as not deletable.`
- An unknown custom role, or one of another Spot, is reported as
  `Spot member custom role with ID ... does not exists.`
