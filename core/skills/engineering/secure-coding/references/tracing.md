# Tracing input and data

## Contents

- Tracing untrusted input to its sinks
- Tracing sensitive data to its exits
- Verifying a finding before reporting it

## Tracing untrusted input to its sinks

Follow each piece of external input from where it enters to where it does something. Every hop
where it is neither validated nor escaped is a candidate.

| Sink | The failure | The fix |
|---|---|---|
| SQL | Injection via string interpolation | Parameterised queries; never build SQL by concatenation |
| Shell | Command injection | Pass argv arrays, never a formatted string; avoid a shell at all |
| Filesystem | Path traversal via `../` | Resolve, then assert the result is inside the allowed root |
| HTTP client | SSRF to internal addresses | Allow-list hosts; block link-local and private ranges |
| Template/DOM | XSS | Escape by default; treat any raw-HTML insertion as a review point |
| Deserialisation | Object injection | Parse with a schema; never revive arbitrary types |
| Redirect | Open redirect | Allow-list destinations; never reflect a user-supplied URL |

`atrix_impact` on the handler tells you where the input can reach.

## Tracing sensitive data to its exits

The mirror image, and the one people skip. From the table outward:

- **Responses** — is the serializer allow-list or deny-list? Deny-lists leak on the next migration
  that adds a column.
- **Logs** — request bodies, headers, and full error objects are the usual culprits.
- **Error messages** — an upstream provider's error can carry account identifiers.
- **Analytics and third parties** — anything sent for observability leaves your boundary.
- **Generated files** — PDFs, exports, and caches inherit whatever you put in them.

## Verifying a finding before reporting it

State the request, the state it requires, and the result. If you cannot make it concrete, it is a
question, not a finding — label it that way or drop it.

A report full of theoretical findings gets skimmed, and then the real one is skimmed too.

Fix the **class**, not the instance. If one endpoint forgot the tenant filter, the others probably
did too, and the durable fix is the helper that makes forgetting impossible.
