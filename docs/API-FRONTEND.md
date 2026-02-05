### Snippet Manager API — Frontend Docs

**Audience:** Frontend developers consuming this API from a browser app.

---

### Base URL

- **Production (HTTPS — use this in frontends):** After `cdk deploy`, use the **ApiUrl** output (e.g. `https://d1234abcd.cloudfront.net`). This avoids mixed-content blocking when your app is served over HTTPS.
- **Production (HTTP ALB):** `http://InfraS-Alb16-BFNklFjq8r8j-642511015.us-east-1.elb.amazonaws.com` — use only for non-browser or local testing.
- **Local (if running locally):** `http://localhost:3000`

---

### Headers

- **JSON requests:** `Content-Type: application/json`

---

### CORS

- CORS middleware is enabled (`cors()`), so browser requests are allowed by default.

---

### Health & Info

#### `GET /health`

- **Description:** Health check used by the load balancer.
- **Response 200**

```json
{ "status": "ok" }
```

#### `GET /`

- **Description:** Basic service info.
- **Response 200**

```json
{ "ok": true, "service": "snippet-manager-api" }
```

---

### Snippets

#### Snippet shape

```json
{
  "id": "ck... (cuid)",
  "title": "string",
  "code": "string",
  "language": "string",
  "createdAt": "2026-02-04T00:00:00.000Z",
  "updatedAt": "2026-02-04T00:00:00.000Z"
}
```

#### `GET /snippets`

- **Description:** List all snippets, ordered by most recently updated first.
- **Response 200:** `Snippet[]`

**Example**

```bash
curl "$API_BASE/snippets"
```

#### `POST /snippets`

- **Description:** Create a snippet.
- **Request body**
  - `title` (string, **required**, 1–255 chars)
  - `code` (string, **required**)
  - `language` (string, **required**, 1–50 chars)
- **Response 201:** `Snippet`
- **Response 400:** validation error

**Example**

```bash
curl -X POST "$API_BASE/snippets" \
  -H "Content-Type: application/json" \
  -d '{"title":"Hello","language":"javascript","code":"console.log(1);"}'
```

**Validation error shape (400)**

```json
{
  "error": "Validation failed",
  "details": {
    "formErrors": [],
    "fieldErrors": {
      "title": ["Title is required"]
    }
  }
}
```

#### `PUT /snippets/:id`

- **Description:** Update a snippet.
- **Path params**
  - `id` (string, required)
- **Request body (all optional)**
  - `title` (string, 1–255 chars)
  - `code` (string)
  - `language` (string, 1–50 chars)
- **Response 200:** updated `Snippet`
- **Response 400:** validation error (or invalid `id`)
- **Response 404:** snippet not found

**Example**

```bash
curl -X PUT "$API_BASE/snippets/$ID" \
  -H "Content-Type: application/json" \
  -d '{"title":"Updated title"}'
```

**Not found (404)**

```json
{ "error": "Snippet not found" }
```

#### `DELETE /snippets/:id`

- **Description:** Delete a snippet.
- **Path params**
  - `id` (string, required)
- **Response 204:** no body
- **Response 400:** invalid `id`
- **Response 404:** snippet not found

**Example**

```bash
curl -X DELETE "$API_BASE/snippets/$ID" -i
```

---

### Error responses

#### `500 Internal Server Error`

```json
{ "error": "Internal server error" }
```

---

### Frontend usage examples

#### Fetch list (browser)

```ts
// Use ApiUrl (HTTPS) from CDK output for production to avoid mixed content
const API_BASE =
  import.meta.env.VITE_API_BASE_URL ??
  "https://YOUR_CLOUDFRONT_DOMAIN.cloudfront.net";

export async function listSnippets() {
  const res = await fetch(`${API_BASE}/snippets`);
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return (await res.json()) as Array<{
    id: string;
    title: string;
    code: string;
    language: string;
    createdAt: string;
    updatedAt: string;
  }>;
}
```

#### Create snippet (browser)

```ts
export async function createSnippet(input: {
  title: string;
  code: string;
  language: string;
}) {
  const res = await fetch(`${API_BASE}/snippets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // 400 validation returns { error, details }
    throw new Error(data?.error ?? `Failed: ${res.status}`);
  }
  return data;
}
```
