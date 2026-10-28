---
name: meltingspot-errors
description: How to read and handle the error messages returned by MeltingSpot MCP tools. Load it as soon as a MeltingSpot tool call fails or returns an error result, such as a refused access, an entity not found, invalid parameters (including a list over its limit), an unexpected error, or when the MeltingSpot connector is disconnected or unreachable. Gives the cause of each message and the action to propose to the user.
---

# MeltingSpot errors

A failed tool call returns an error result with one message. The server only
sends two kinds of messages:

- a message written for you: a refused access, or an error of the operation;
- `An unexpected error occurred.` for anything else. The detail stays on the
  server.

In the messages below, `${...}` stands for a value filled in by the server,
such as an id. Match a message by its meaning, not character by character:
the values change, and punctuation can vary from one tool to another. Relay
the meaning to the user in their language, then propose the action. Never
retry in a loop (see `meltingspot-write-safely`).

## Refused access

The server checks the access of the connection before each call. A refusal
does not change by retrying.

| Message | Cause | Action to propose |
| --- | --- | --- |
| `The MCP server is not enabled for this Spot.` | The MCP server is turned off for the Spot of the connection. | Ask MeltingSpot to enable the MCP server for this Spot. |
| `You must be an administrator of this Spot to use this tool.` | The connected user is no longer an administrator of the Spot. | Reconnect with an administrator account, or ask an administrator to restore the role. |
| `Your session no longer gives access to this Spot. Reconnect to restore access.` | The web session that approved the connection no longer gives access to the Spot, for example because of the SSO rules of the Spot. | Reconnect the MeltingSpot connector, signing in the way the Spot requires. |
| `This connection cannot read this Spot: this tool requires read permission.` | The connection was approved without the read permission. | Reconnect and approve the read permission. |
| `This connection is read-only: this tool requires write permission.` | The connection was approved without the write permission. | Reconnect and approve the write permission, or stay on read tools. |
| `This connection cannot delete: this tool requires delete permission.` | The connection was approved without the delete permission. | Reconnect and approve the delete permission, or do the deletion in MeltingSpot. |

## Invalid parameters

A message that starts with `Invalid parameters: ` means the input did not
match the schema of the tool: a missing field, a wrong type, a value out of
bounds (`limit` above 100, an empty list, more than 100 ids, more than 50
groups…). The tool was not run. Read the rest of the message, fix the input,
and call again once. When a list is too long, split it into smaller calls,
after confirmation.

## Errors of the operation

These messages come from the operation itself. Typical ones:

| Message | Cause | Action to propose |
| --- | --- | --- |
| `Tag with id ${tagId} does not exist.` | No tag with this id in the Spot of the connection. | Find the right id with `tag_list`. |
| `Cannot find group with id ${groupId}` | No group with this id in the Spot. | Find the right id with `group_list`. |
| `Cannot find live with id ${liveId}.` | No live with this id in the Spot. | Find the right id with `live_list`. |
| `Group with ID ${id} cannot be deleted.` | This group is protected against deletion. | Tell the user; do not try another way to remove it. |
| `Tag with ID ${id} cannot be deleted.` | This tag is protected against deletion. | Tell the user; do not try another way to remove it. |
| `Live with ID ${liveId} is marked as not deletable.` | This live is protected against deletion. | Tell the user; do not try another way to remove it. |
| `Invalid email: ${email}` | An email of the invitation is not valid. | Show the email to the user and ask for the right one. |

An entity of another Spot is always reported as not found: the tools only see
the Spot of the connection (see `meltingspot-conventions`).

Other messages of the same kind follow the same logic: read them, explain them
to the user, and fix the input only when the message tells you how.

## Connector not connected

When the MeltingSpot tools are missing, or a call fails before reaching a
tool because the authentication expired or was revoked, the connection
itself is the problem, not the request. Ask the user to reconnect the
MeltingSpot connector in their assistant, then try again.

## Server unreachable

When a call times out or the server cannot be reached, nothing tells you
whether a write happened. Wait, then try once more; read the state first if
the call was a write. If it fails again, tell the user and stop.

## Unexpected error

`An unexpected error occurred.` hides an internal problem. The message carries
no detail, so do not guess the cause.

- On a read: you may try the same call once more.
- On a write: read the state first. The write may have happened before the
  error. Do not repeat it blindly.
- If it persists, tell the user and suggest contacting MeltingSpot support with
  the time of the call and the tool name.
