import { Endpoint } from "@prisma_client";

const ROUTE_EXTRACTION_RULES_OPENAPI_COMPLIANT =
  `## PURPOSE
Given an Express endpoint, output:
- path (OpenAPI-style)
- parameters (PATH/QUERY/BODY)
- return_json (OpenAPI Schema Object, NOT sample data)
- return type (such as application/json, application/octet-stream, application/pdf, image/jpeg, image/png, image/gif, image/webp, image/svg+xml, audio/mpeg, audio/mp3, audio/mp4, audio/ogg, audio/wav, audio/webm, video/mp4, video/webm, video/ogg, video/quicktime, video/avi, video/mov, video/wmv, video/flv, video/avi, video/mov, video/wmv, video/flv)
- examples (literal objects passed to res.json(...) / res.status(...).json(...))

No guessing. No invented fields. No flattening wrappers.

---

## 1) REST Paths
Convert Express params to OpenAPI format:
- \`/:userId\` → \`/{userId}\`
Example:
- \`/api/users/:userId/apps/:appId\` → \`/api/users/{userId}/apps/{appId}\`

---

## 2) Strict Types
Use ONLY standard OpenAPI Schema \`type\` values:
- \`string\`, \`number\`, \`integer\`, \`boolean\`, \`array\`, \`object\`

Do NOT use:
- \`any\`, \`null\`, \`Date\`, custom types, or nonstandard OpenAPI types.

---

## 3) return_json IS A STRICT OPENAPI SCHEMA

### 3.1 Use the FINAL JSON response call
Locate the endpoint’s FINAL response call:
- \`res.json({ ... })\`
- \`res.status(X).json({ ... })\`

The object literal passed to \`.json(...)\` is the response WRAPPER.

### 3.2 Wrapper objects are mandatory (NEVER flatten)
1. Extract the EXACT keys inside the wrapper object literal.
2. Build \`return_json\` so its schema matches this wrapper structure EXACTLY.
3. NEVER flatten the wrapper.

Example code:
\`\`\`js
return res.status(200).json({ product, user_message: "ok" });
\`\`\`

Treat shorthand as explicit:
- \`{ product: product, user_message: "ok" }\`

So \`return_json\` MUST be an object schema with BOTH properties:
- \`product\`
- \`user_message\`

### 3.3 STRICT OpenAPI 3.0 Structure (The "Root" Rule)
**CRITICAL:** This output must be a valid OpenAPI 3.0 Schema Object.
1. The root object MUST contain \`"type": "object"\`.
2. **ALL** data fields (e.g., \`id\`, \`name\`, \`product\`, \`user_message\`) **MUST** be placed inside a \`"properties"\` object.
3. **NO** data fields are allowed at the root level. The root level is reserved ONLY for schema keywords: \`type\`, \`properties\`, \`required\`, \`description\`, \`enum\`.

**BAD (Invalid OpenAPI):**
\`\`\`json
{
  "type": "object",
  "user_message": { "type": "string" }, // WRONG! Leaked to root level (not inside properties)
  "properties": { ... }
}
\`\`\`

**GOOD (Valid OpenAPI):**
\`\`\`json
{
  "type": "object",
  "properties": {
    "user_message": { "type": "string" } // CORRECT! Inside properties object
  }
}
\`\`\`

### 3.4 Snake case property names everywhere
All property names you output MUST be \`snake_case\` at every level:
- wrapper keys
- nested keys
- array item keys
- keys in \`examples\`

### 3.5 Schema context for database models
If a wrapper key contains a Database Model (or array of models):
1. Look up the model in the Database Schema Context.
2. Define it as a nested object inside \`properties\`.
3. **Inline all model fields:** Copy every field from the DB model into the \`properties\` map of that nested object.
4. Do NOT omit relation fields (e.g., \`file_links\`, \`owner\`) if they exist in the model definition.

### 3.6 No $ref
- NEVER output the string \`$ref\`.
- Inline all model definitions fully.

### 3.7 No generic objects
Not allowed:
\`\`\`json
{ "type": "object" }
\`\`\`
You MUST define \`properties\` (and nested structure) using real keys supported by the code + schema context.

---

## 4) Description
- The description should be a clear summary of the endpoint's purpose.
- Don't assume fucntionality. Use the code as context, but make sure it's the correct code. 
  - For example, you might see the code for paths: /v2/fonts and /v2/fonts/variations. 
    /v2/fonts/variations is a sub-resource of /v2/fonts. /v2/fonts/variations works with variations of a font, but /v2/fonts works with the font itself. I should not see any mention of variants in the description for /v2/fonts even if you see the code for /v2/fonts/variations.

---

## 5) Naming Rules

### 5.1 service_name
- service_name comes from the FILE NAME that the endpoint belongs to.
- if the file name doesn't end with "service.ts", that's not a service file. All endpoints are in "*.routes.ts" files, but you can use services and controllers to better understand the context. All service_names should be PascalCase and end with "Service".
- Do NOT pluralize unless the filename already is plural.
- Do NOT invent service names.
- Do not include "Controller" or "Routes" in any service name.

Examples:
- \`endpoint.service.ts\` → \`EndpointService\`
- \`file.service.ts\` → \`FileService\`

Rules:
- PascalCase
- must end with \`Service\`
- do NOT pluralize unless the filename already is plural
- do NOT invent service names
- endpoints are in \`*.routes.ts\`; services/controllers can inform context, but do not fabricate names

### 5.2 client_function_name
- camelCase name of the frontend client function:
  - \`getProduct\`, \`restoreApp\`, \`listProducts\`, etc.
  - if the client_function_name is not present, use the path and method to generate a name.
  - Don't assume fucntionality. Use the code as context, but make sure it's the correct code. For example, you might see the code for paths: /v2/fonts and /v2/fonts/variations. The names must be different. A GET request to /v2/fonts should not be have a name of getFontsVariations even if you see the code for /v2/fonts/variations. A POST request to /v2/fonts/variations should not be have a name of createFont even if you see the code for /v2/fonts. You must understand which endpoint you are analyzing and ignore the code for other endpoints.
  - Don't fabricate resource names. For example, if this isn't a font variant, don't name it createFontVariant. Even if you see the code for /v2/fonts/variations, don't name it createFontVariant if this is the endpoint for /v2/fonts. Consider the path.
  - Here's the naming convention: [Verb][Resource][SubResource/Action]
    - Verb: Use standard prefixes: \`get\`, \`list\`, \`create\`, \`update\`, \`delete\`, \`restore\`, \`search\`, \`download\`, \`validate\`, \`end\`.
    - Resource: The primary noun of the endpoint (e.g., \`App\`, \`User\`, \`Notification\`).
    - SubResource/Action: If the path targets a sub-entity or a specific action, append it to the end.
    - List is for a GET request to a collection of resources. The expected response is an array of resources. Use list if the path is a collection of resources. For example, /v2/products.
    - Get is for a GET request to a single resource. The expected response is a single resource. Use get if the path is a single resource., For example, /v2/products/:id.
    - Download is for a GET request to a file. The expected response is a file. Use download if there's binary data being returned. The return type is "application/octet-stream".
    - Validate is for a POST request to a resource to validate the resource. The expected response is a boolean. Use validate if the path is a validation endpoint. For example, /v2/sessions/validate.
    - End is for a POST, PUT or DELETE request to a resource to end the resource or terminate the session. For example, a DELETE request to /v2/session should be called endSession.
    - Never add 'Details' to the name if the path doesn't contain 'details'. For example, /v2/products/:id does not contain  'details', so the name should not be 'getProductDetails'.
    - Never add a parameter to a client_function_name. For example, don't add 'ById' to the name if the path doesn't contain 'byId'. For example, /v2/products/:id does not contain 'byId', so the name should be be 'getProduct' not 'getProductById'.
    - [Verb][Resource][SubResource/Action] might not be enough. The name might need to be more specific or longer.
    - Rules for Uniqueness:
      1. Never use generic names: Do not use \`deleteApp\` if the endpoint is deleting a specific sub-component like a setting. 
         - BAD: \`DELETE /v2/notification-settings/{id}\` -> \`deleteApp\`
         - GOOD: \`DELETE /v2/notification-settings/{id}\` -> \`deleteNotificationSetting\`
      2. Contextual Awareness: Look at the full URI path. If the path contains \`/apps/\` and then \`/notification-settings/\`, the \`operationId\` must reflect the most specific (right-most) resource.
      3. Format: Always use camelCase. No spaces, hyphens, or underscores.
    - Examples:
      - \`GET /v2/apps\` -> \`listApps\`
      - \`POST /v2/apps\` -> \`createApp\`
      - \`GET /v2/apps/{id}\` -> \`getAppDetails\`
      - \`DELETE /v2/apps/{id}\` -> \`deleteAppInstance\`
      - \`PUT /v2/apps/{id}/restore\` -> \`restoreArchivedApp\`
      - \`DELETE /v2/notification-settings/{id}\` -> \`deleteNotificationSetting\`


---

## 6) examples
- Extract the actual object literal(s) passed into:
  - \`res.json(...)\`
  - \`res.status(...).json(...)\`
- Output as an array of example objects.
- Do NOT invent values.
- Include 2-3 real-world examples.

---

## 7) Parameters
All parameter names must be snake_case.
Do not include headers.
Do not fabricate path parameters.
The location field should be set to the location of the parameter. You must also output the locaiton based on the context of the code.
You may be accidentally given code that is to get one object or multiple. Make sure you don't confuse the parameters for the different requests. You must be aware of the correct code you should consider.
For example, router.get("/", ProductController.getProducts); is one request, and router.get("/:idOrSlug", ProductController.getProduct); is another request. Don't use idOrSlug in the parameters for the first request.

### 7.1 Path parameters (location: PATH)
If the route path contains a parameter, the location should be PATH.
From the route path:
- \`/api/products/:id\` → \`id\`.
An ":" indicates a path parameter. If there is not an ":" in an endpoint path, there is not a path parameter. For example, path 'session/validate'; does not have a path parameter, but path 'session/products/:id'; does have a path parameter ('id').
Do not assume that a path parameter is present.

### 7.2 Query parameters (location: QUERY)
If the code uses query strings, the location should be QUERY.
- query strings like \`?limit=10&offset=0\`
- code usage like \`req.query.limit\`

### 7.3 Body parameters (location: BODY)
If the code uses body access/destructuring, the location should be BODY.
\`\`\`here's an example of body parameters:
const { phone_number, country, app_id } = req.body;
You might also see request.body or req.body used directly. Figure out the values and types fom the context.
\`\`\`
Body params are the request JSON keys:
- \`phone_number\`, \`country\`, \`app_id\`
Use JSON key names (not local variable names).
The parameter name should not be body or requestBody. Remove these layers if present.

### 7.4 Header parameters
Do not include headers. For example, this should not be considered: const token = req.headers.authorization.

## 8) Outputs
- Outputs contain the return_json schema and examples for the response.
- In adition, the output should contain the content type of the response.
- The type should be the content type of the response. For example, if the response is a JSON object, the content type should be "application/json". If the response is a file, the content type should be the file extension.
- Return all possible outputs.
- If there is file download, the content type might be "application/octet-stream". Infer from the code.
- res.json({ ... }) is a common response indicator and the type should be "application/json". But you should not assume that. res.setHeader(...); res.setHeader("Content-Type", file.mime_type); is a common response indicator and the type should be the mime type of the file. Or, it's a download/stream.
- In the response_json and examples, you should not hullucinate the response. It should be the actual response from the code. If there's not a user_message, do not include it. If it's not an application/json response, that's a good sign that there might be a string response that is not a user_message and a different format that's applicable. In these cases, it's ok to not include examples for that output.
  if you see a something lile this: stream.pipe(res), res is the response object. Thee is a response! Whatever is being returned is a stream piped in from something else. In this case, the proper return_json usually looks something like this: { "type": "string", "format": "binary" }.

## 9) Anti-hallucination rule
- If it’s not in the final \`.json({ ... })\` wrapper, do NOT include it.
- If DB schema context is missing for a model, do NOT invent fields.
- Only include what code + provided schema context supports.`

export const PROCESS_ENDPOINT_WITH_AI_PROMPT = (endpoint: Endpoint, modelList: string) => {
  return `
You are an expert OpenAPI 3.0 Specification generator. 
Analyze the provided Express.js code to extract metadata for this endpoint: ${endpoint.method} ${endpoint.path}.
You should be given the router, relevant controller and service code, in addition to the prisma model. Consider the endpoint path, look for the matching route, and then see which controller method is being called. 

${modelList}

${ROUTE_EXTRACTION_RULES_OPENAPI_COMPLIANT}

**Required JSON Structure:**
{
  "description": "Clear summary of the endpoint's purpose.",
  "service_name": "ResourceService",
  "client_function_name": "methodName",
  "parameters": [
    {
      "name": "param_name",
      "type": "string", 
      "description": "description",
      "required": true,
      "default_value": "null"
      "location": "PATH"
    }
  ],
  "outputs": [
    {
      "name": "SuccessResponse",
      "status_code": 200,
      "type": "application/json",
      "description": "Successful response",
      "return_json": {
        "type": "object",
        "properties": {
           "payload_key": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" } } } },
           "user_message": { "type": "string" }
        }
      },
      "examples": [
        { "payload_key": [], "user_message": "Success!" }
      ]
    }
  ]
}

**Source Code to Analyze:**
${endpoint.source_code}
`;
}