# MCP Admin Friend

MCP Admin Friend is an example Salesforce administrator Lightning Web Component that demonstrates authenticated Lightning Out 2.0 components communicating with an MCP client through an MCP App Bridge.

The `mcpAdminFriend` LWC provides a read-only view of Salesforce user context, object metadata, fields, and recent records. It communicates with its host through JSON-serializable custom events, providing a practical reference for building and testing exposed LWCs outside Salesforce.

## Package Info
Install the managed package using the following link
`/packaging/installPackage.apexp?p0=04tP3000002D4HZIA0`

## Event envelope

Input commands and output actions use the same envelope shape:

```json
{
  "version": "1.0",
  "source": "host-or-component-name",
  "type": "action.type",
  "timestamp": "2026-09-22T12:00:00.000Z",
  "correlationId": "unique-request-id",
  "payload": {}
}
```

| Field | Description |
| --- | --- |
| `version` | Contract version. Currently `1.0`. |
| `source` | Name of the sender. |
| `type` | Command or action type. |
| `timestamp` | ISO 8601 timestamp. |
| `correlationId` | Unique ID used to relate actions and errors to a request. |
| `payload` | JSON object containing command or action data. |

## Input: host to LWC

Dispatch an `adminfriendcommand` event on the Lightning Out component:

```js
const command = {
  version: '1.0',
  source: 'mcpAppHost',
  type: 'object.select',
  timestamp: new Date().toISOString(),
  correlationId: crypto.randomUUID(),
  payload: {
    objectApiName: 'Opportunity'
  }
};

component.dispatchEvent(
  new CustomEvent('adminfriendcommand', {
    bubbles: true,
    composed: true,
    detail: JSON.stringify(command)
  })
);
```

When the LWC is used by another Salesforce component in the same context, its public method can also be called directly:

```js
const result = await component.handleHostAction(JSON.stringify(command));
```

The method returns a serializable result:

```json
{
  "success": true,
  "type": "object.select",
  "correlationId": "unique-request-id"
}
```

Supported input commands:

| Type | Payload | Result |
| --- | --- | --- |
| `context.refresh` | `{}` | Reloads the current user and organization. |
| `object.select` | `{ "objectApiName": "Opportunity" }` | Selects an accessible object and loads its metadata and recent records. |
| `metadata.refresh` | `{}` | Reloads metadata for the selected object. |
| `records.refresh` | `{}` | Reloads recent records for the selected object. |
| `tab.select` | `{ "tab": "admin" }` | Opens `admin`, `metadata`, or `records`. An object must be selected before opening the latter two. |
| `ui.notify` | `{ "message": "Message from host" }` | Displays a plain-text message inside the component. |

Malformed or unsupported commands return `success: false` from `handleHostAction` and cause the component to emit `component.error`. When calling this public method through Lightning Out, pass the command as a JSON string. Passing an object can expose an LWS proxy to Lightning Out's `structuredClone()` call.

## Output: LWC to host

Listen for the `adminfriendaction` event:

```js
component.addEventListener('adminfriendaction', (event) => {
  const envelope = JSON.parse(event.detail);
  console.log(envelope.type, envelope.payload);
});
```

Every output event is dispatched with `bubbles: true` and `composed: true`. Its `detail` is a JSON string rather than an object. Lightning Web Security can proxy object-valued event details at the global DOM boundary, and Lightning Out cannot pass those proxies through `structuredClone()`. Parse `event.detail` to recover the envelope.

Supported output actions:

| Type | Payload |
| --- | --- |
| `component.ready` | Supported command names and whether user context is available. |
| `context.loaded` | Current user and organization context. |
| `context.refreshed` | Refreshed user and organization context. |
| `object.selected` | Selected object summary and originating action. |
| `field.selected` | Selected object and field metadata. |
| `record.selected` | Selected object, record ID, display label, displayed fields, and originating action. |
| `component.error` | Operation name and a safe display message. |

Example `record.selected` output:

```json
{
  "version": "1.0",
  "source": "mcpAdminFriend",
  "type": "record.selected",
  "timestamp": "2026-09-22T12:00:00.000Z",
  "correlationId": "adminfriend-generated-id",
  "payload": {
    "objectApiName": "Opportunity",
    "objectLabel": "Opportunity",
    "recordId": "006000000000001AAA",
    "recordDisplayLabel": "Example Opportunity",
    "fields": [
      {
        "apiName": "Name",
        "label": "Opportunity Name",
        "dataType": "STRING",
        "value": "Example Opportunity"
      }
    ],
    "originatingAction": "user.sendRecord"
  }
}
```

Only fields already loaded for display are included in `record.selected`. The component does not send complete Salesforce records, session IDs, OAuth tokens, or other credentials.

## Lightning Out note

Lightning Out 2.0 mirrors custom events across its iframe boundary. Attach the output listener before the component finishes loading so that the host receives `component.ready`.

### Run the host over HTTP

Do not open `index.html` directly as a `file://` URL. Local files have an opaque `null` origin, so browsers block the JavaScript module import and do not provide a valid origin for Lightning Out, CORS, iframe messaging, or authentication cookies.

Serve the host directory locally:

```powershell
npx --yes http-server examples/host -p 8080 -c-1
```

Then open:

```text
http://localhost:8080/
```

In Salesforce Setup, open **Session Settings** and add the host origin to **Trusted Domains for Inline Frames** with **IFrame Type = Lightning Out**. For this example that is `http://localhost:8080`, provided your org accepts an HTTP localhost development origin. This setting controls the CSP `frame-ancestors` response and is required for the Salesforce iframe to render.

Salesforce recommends HTTPS for external hosts. For an integration beyond local development, serve the host over HTTPS and register its exact HTTPS origin. If Salesforce rejects the HTTP localhost origin, use an HTTPS-capable local server and trust that origin instead.

The CORS allowlist is separate. Add the host's HTTPS origin under **CORS** and enable CORS for OAuth endpoints when the browser itself calls the Lightning Out 2.0 UI Bridge endpoint. CORS configuration is not required when a server-side authentication flow generates the frontdoor URL, although other Salesforce resources can still require an allowed origin.

Cross-domain Salesforce session cookies and browser third-party cookies must be enabled. Under **My Domain → Routing and Policies**, make sure **Require first-party use of Salesforce cookies** is deselected. Do not disable browser CORS or web security.

If the console reports `frame-ancestors 'self'`, the current host origin is missing from **Trusted Domains for Inline Frames**, has the wrong IFrame Type, or does not exactly match the page origin. `localhost` and `127.0.0.1`, different schemes, and different ports are different origins. After changing Salesforce settings, generate a fresh frontdoor URL and reload the host page.

`net::ERR_BLOCKED_BY_CLIENT` for `ContentDomainCSPNoAuth` usually means a browser privacy extension, ad blocker, or tracking protection blocked Salesforce's CSP report request. It is normally secondary to the framing error. If Lightning Out still fails after fixing the trusted domain, test in a clean browser profile or allow the local host and Salesforce domains in the extension. Also confirm that third-party cookies are allowed.

### Start Lightning Out without editing HTML

The host page accepts two runtime values:

- The 18-character Lightning Out 2.0 app ID from Setup
- The complete `frontdoor_uri` returned by the Lightning Out UI Bridge API

Click **Start Lightning Out**. The host derives the Salesforce origin from the frontdoor URL, loads the current Lightning Out 2.0 library, creates `lightning-out-application`, and embeds MCP Admin Friend. Both the Lightning Out registration and browser custom-element tag use `x007-mcp-admin-friend`. Although the org namespace is `X007`, using the capitalized namespace causes Lightning Out 2.0 registration errors in this org; lowercase `x007` is the confirmed working form.

The frontdoor URL is sensitive, short-lived, and single-use. Treat every click on **Start Lightning Out** as consuming that URL, including a startup attempt that fails. Generate a fresh frontdoor URL after any failed attempt or page refresh. The test host keeps it only in memory, clears the input after use, and never writes it to the event trace, console, URL parameters, or browser storage.

A consumed, expired, or otherwise invalid frontdoor URL can leave the Salesforce iframe unauthenticated. One console symptom is a request to the scratch org's `*.lightning.force.com` domain followed by `Framing ... violates ... "frame-ancestors 'self'"`. Generate a fresh frontdoor URL and reload the host before diagnosing that message as a trusted-domain configuration problem. If it still occurs with a fresh URL, verify that the exact host origin is present in the Lightning Out configuration under **Host Page Domain Names**.

Lightning Out maintains a page-level component registry. Start it only once per page: refresh before retrying a failed startup or switching to another app or Salesforce org, then use a fresh frontdoor URL. Loading two scripts/apps on the same page can produce `already registered to another App` errors.

Salesforce documents the required attributes and startup lifecycle in [Lightning Out 2.0 architecture](https://developer.salesforce.com/docs/platform/lwc/guide/lightning-out-architecture.html) and explains how to obtain the URL in [Set Up Authentication for Lightning Out 2.0](https://help.salesforce.com/s/articleView?id=platform.lightning_out_auth.htm&type=5).

The sample host is available in [`examples/host/index.html`](examples/host/index.html). Its action composer provides editable examples for every supported command. Selecting an example fills the action type and JSON payload; either value can then be changed before dispatch. This makes the page useful as a command tester while preserving valid MCP Admin Friend examples.

Its session trace records both directions:

- **Host → LWC** commands dispatched as `adminfriendcommand`
- **LWC → Host** actions received as `adminfriendaction`

Each entry shows its time, direction, type, correlation ID, and expandable JSON envelope. The trace retains the newest 50 entries in memory, has a **Clear** button, and resets when the page refreshes. Commands, actions, command results, and trace clearing are also written to the browser console with an `[MCP Admin Friend]` prefix.
