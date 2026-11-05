# HTTP contract

Business endpoints default to URI version 1 (/v1/...). Infrastructure is
version-neutral. Swagger at /api outside production describes the example's
actual success envelope:

```json
{
  "status": 200,
  "success": true,
  "data": { "id": 1, "name": "Example Item" },
  "error": null,
  "timestamp": "2026-11-04T00:00:00.000Z"
}
```

Errors contain success=false, data=null, requestId, and error.code/error.message.
Validation can provide error.errors. Unexpected production failures return
Internal server error, with diagnostics retained in logs. Request correlation
is available through x-request-id.

Health and metrics bypass envelopes, including failures. @RawResponse() bypasses
wrapping for another handler/controller. Empty 204 responses, StreamableFile,
streams, and buffers are not JSON-enveloped. Specify their content type and
OpenAPI contract on the endpoint.

Use createZodDto for DTOs. TypeScript return types do not validate runtime data.
Keep generated consumers aligned with the real envelope. The frontend client
returns envelopes unchanged; use a decoder to validate and unwrap them.

For collections introduced by a project, use one convention such as
`data: { items, nextCursor }`, bounded page size, and opaque cursors. Add schemas
and HTTP tests together. Pagination is not implemented before a collection exists.
