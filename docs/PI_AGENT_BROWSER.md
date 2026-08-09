# PI Browser Agent

PI Browser Agent runs in the extension side panel and uses the `browser_actions`
tool to inspect and operate Chrome tabs. The browser action contract is defined
in `src/agent/agentPayload.ts`; execution and permission checks live under
`src/agent/`.

## Approval modes

The side panel and **Settings > AI Agent** expose three modes:

| Mode   | Behavior                                                                                                                       |
| ------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Manual | Pause before every batch of browser actions. Approval applies to the current batch only.                                       |
| Auto   | Continue automatically on saved allowed sites. Unknown sites and protected actions pause for approval.                         |
| Skip   | Continue without site prompts, but still pause for protected actions. Blocked sites and prohibited actions cannot be bypassed. |

The old `ai-agent-bypass-mode-v1` switch is migrated on read: `true` becomes
Skip and `false` becomes Manual. New installations default to Auto.

Every tool follow-up batch is assessed again. Approving one batch never grants
implicit approval to later batches returned by the model.

## Site decisions

Site decisions are stored by normalized origin, such as
`https://forum.example.com`. The approval card supports:

- allow once;
- always allow the displayed sites;
- deny the current batch;
- block the displayed sites.

Saved allow/block decisions and recent permission history can be reviewed,
changed, or revoked from either the side panel or AI Agent settings. Changes are
synchronized between open extension pages with the browser `storage` event.

## Protected actions

Protected actions always require a current user confirmation. The deterministic
classifier currently covers:

- local file writes;
- closing a tab, which can discard unsaved page state;
- inputs whose selector or action note identifies password, OTP, token, payment,
  or identity fields;
- clicks whose selector or action note identifies deletion, payment, publishing,
  authorization, sending, or similar consequential operations;
- navigation URLs containing sensitive query parameter names.

The system prompt requires the model to describe consequential actions honestly
in the action `note`; it must not disguise intent to bypass approval.

## Prohibited actions

The deterministic hard-stop classifier runs before any approval UI and cannot
be overridden by Manual, Auto, Skip, “allow once,” or a saved site permission.
It refuses browser actions that attempt to:

- complete a purchase, checkout, or payment;
- create or register an account;
- permanently delete accounts, emails, files, messages, or other data;
- execute financial trades or transfer funds;
- enter payment-card or government-identity credentials;
- modify system paths.

The approval card exposes only **Stop this batch** for a hard-blocked action.
The runtime also ignores an attempted approval bypass and returns a failed tool
result so the model can propose a safer, human-completed step. Page, email,
document, and DOM text are explicitly treated as untrusted instructions in the
agent system prompt.

## Browser capabilities

Supported capabilities include:

- DOM tree and Markdown extraction;
- pointer, keyboard, text input, drag, select, scroll, and touch actions;
- per-action `tabId` targeting;
- list/open/activate/close/reload/history operations across tabs;
- tab grouping and ungrouping;
- navigation load waiting;
- exact-tab screenshots with previous-tab restoration;
- user-uploaded images and visible-tab screenshot regions as multimodal context;
- Console, JavaScript exception, and Network diagnostics through
  `chrome.debugger`;
- folder access and configured MCP tools.

For developer diagnostics, run `debug-start`, reproduce the issue, read evidence
with `read-console` or `read-network`, and finish with `debug-stop`. Sensitive
URL query values are redacted before diagnostic entries reach the model.

## Visual context

The PI composer accepts up to four PNG, JPEG, WebP, or GIF images. It can also
capture the active tab and lets the user drag a region before attaching it. A
thumbnail tray supports review and removal before sending, and an image-only
message receives a clear default analysis prompt.

Images are validated, bounded to 12 MB input, resized to at most 2048 pixels on
the longest edge, and capped at 6 MB after processing. The PI SDK receives them
as native multimodal `ImageContent` blocks alongside the text prompt. Raw pixel
data is deliberately excluded from the visible-message store, session store,
and persisted PI thread transcript; only filename, dimensions, source, and size
metadata remain. This means retrying an older image message requires attaching
the image again.

## Recorded workflows and shortcuts

The **Workflows** control in the side panel can record a real browser session,
including clicks, text input, select changes, Enter/Escape keys, scrolling, and
navigation. The active recording session is kept in `chrome.storage.session`,
so capture resumes after a full page navigation or service-worker restart.

Stopping a recording opens a save dialog. Saved workflows provide:

- a deterministic `/shortcut` in the PI composer;
- a searchable MD3 workflow library;
- sequential replay through the same site/protected-action approval gate used
  for model-generated actions;
- per-action results in the PI timeline;
- optional recurring execution with `chrome.alarms`.

Password, OTP, access-token, payment, identity/contact (for example email,
phone, address, or date of birth), and file-input values are never serialized.
Sensitive URL credentials, query values, and token-like fragments are redacted
too. A workflow containing any redacted field remains visible for audit, but
automatic replay and scheduling are disabled; re-record a safe, non-sensitive
portion instead.

Creating a schedule requires an explicit acknowledgement of its exact origin
allowlist and a local-time first run. It supports custom intervals plus daily,
weekly, monthly, and yearly calendar recurrence. Month-end and leap-day anchors
are clamped to the last valid day without permanently drifting the original
anchor. Chrome uses a one-shot alarm for each occurrence and computes the next
calendar date after completion; **Run now** does not move the planned cadence.

Scheduled runs are limited to deterministic, non-protected actions.
The service worker validates the workflow again before each run, opens an
inactive tab, runs actions sequentially, closes the tab on success, and leaves
a failed tab open for inspection. A later explicit site block cancels execution
even if the schedule was created earlier. The result and next run time are
persisted, and Chrome sends a completion/failure notification.

## Verification

```bash
node --test scripts/performance/agent-permission-policy.test.mjs
node --test scripts/performance/agent-multitab-actions.test.mjs
node --test scripts/performance/agent-debugger.test.mjs
node --test scripts/performance/agent-browser-workflows.test.mjs
node --test scripts/performance/agent-visual-context.test.mjs
pnpm exec playwright test scripts/tests/agent-permissions-md3.spec.ts
pnpm exec playwright test scripts/tests/agent-workflows-md3.spec.ts
pnpm exec playwright test scripts/tests/agent-visual-context.spec.ts
pnpm type-check
pnpm build
```
