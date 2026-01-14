// Initially, I also attempted to generate the OpenAPI spec with AI. THe oonly model that was able to produce a spec file was gpt-5.2.  The mini and nano models failed to include every method, model, and more. Even though it worked, it took too long and was not economically viable to use with every codebase change.


// import dotenv from "dotenv";
// import crypto from "node:crypto";
// import fs from "node:fs";
// import path from "node:path";
// import OpenAI from "openai";

// dotenv.config();

// const OPENAI_API_KEY = process.env.OPENAI_API_KEY as string;
// const AI_MODEL = "gpt-5.2";
// const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// type AppContext = { name: string; version: string };

// function extractPrismaModelNames(prismaSchema: string): string[] {
//   const names: string[] = [];
//   const re = /^\s*model\s+([A-Za-z_]\w*)\s*\{/gm;
//   let m: RegExpExecArray | null;
//   while ((m = re.exec(prismaSchema))) names.push(m[1]);
//   return names;
// }

// function extractPrismaEnumNames(prismaSchema: string): string[] {
//   const names: string[] = [];
//   const re = /^\s*enum\s+([A-Za-z_]\w*)\s*\{/gm;
//   let m: RegExpExecArray | null;
//   while ((m = re.exec(prismaSchema))) names.push(m[1]);
//   return names;
// }

// function normalizeOpenApiPath(p: string): string {
//   let out = p.trim();
//   if (!out.startsWith("/")) out = `/${out}`;
//   // Express :id -> {id}
//   out = out.replace(/:([A-Za-z_]\w*)/g, "{$1}");
//   // strip patterns like {id}(...regex...)
//   out = out.replace(/\{([A-Za-z_]\w*)\}\([^)]*\)/g, "{$1}");
//   out = out.replace(/\/{2,}/g, "/");
//   return out;
// }

// function hasAuthorizationParameter(endpoint: any): boolean {
//   const params = endpoint?.parameters ?? [];
//   return params.some((p: any) => String(p?.name || "").toLowerCase() === "authorization");
// }

// function findMissingComponentSchemaRefs(spec: any): string[] {
//   const missing = new Set<string>();
//   const schemas = spec?.components?.schemas ?? {};

//   const walk = (node: any) => {
//     if (!node || typeof node !== "object") return;

//     if (typeof node.$ref === "string") {
//       const m = node.$ref.match(/^#\/components\/schemas\/(.+)$/);
//       if (m) {
//         const name = m[1];
//         if (!schemas[name]) missing.add(name);
//       }
//     }
//     for (const v of Object.values(node)) walk(v);
//   };

//   walk(spec);
//   return [...missing];
// }

// function findIllegalSchemaRefs(spec: any, allowed: Set<string>): string[] {
//   const illegal = new Set<string>();

//   const walk = (node: any) => {
//     if (!node || typeof node !== "object") return;

//     if (typeof node.$ref === "string") {
//       const m = node.$ref.match(/^#\/components\/schemas\/(.+)$/);
//       if (m) {
//         const name = m[1];
//         if (!allowed.has(name)) illegal.add(name);
//       }
//     }
//     for (const v of Object.values(node)) walk(v);
//   };

//   walk(spec);
//   return [...illegal];
// }

// const BUILTIN_SCHEMA_NAMES = [
//   "SuccessResponse",
//   "ErrorResponse",
//   "NotFoundResponse",
//   "AccountDeletedResponse",
//   "Session",

//   // common auth / http wrappers the model keeps inventing:
//   "BadRequestResponse",
//   "UnauthorizedResponse",
//   "ForbiddenResponse",
//   "NoContentResponse",
// ] as const;

// type BuiltinSchemaName = (typeof BUILTIN_SCHEMA_NAMES)[number];

// function builtinSchemas(): Record<BuiltinSchemaName, any> {
//   return {
//     SuccessResponse: {
//       type: "object",
//       properties: {
//         success: { type: "boolean" },
//         message: { type: "string" },
//         userMessage: { type: "string" },
//         data: {},
//       },
//       required: ["success"],
//       additionalProperties: true,
//     },
//     ErrorResponse: {
//       type: "object",
//       properties: {
//         success: { type: "boolean" },
//         error: { type: "string" },
//         userMessage: { type: "string" },
//       },
//       required: ["success"],
//       additionalProperties: true,
//     },
//     NotFoundResponse: {
//       type: "object",
//       properties: {
//         success: { type: "boolean" },
//         message: { type: "string" },
//       },
//       required: ["success"],
//       additionalProperties: true,
//     },
//     AccountDeletedResponse: {
//       type: "object",
//       properties: {
//         success: { type: "boolean" },
//         message: { type: "string" },
//       },
//       required: ["success"],
//       additionalProperties: true,
//     },
//     Session: {
//       type: "object",
//       properties: {
//         sessionId: { type: "string" },
//         token: { type: "string" },
//         user: { $ref: "#/components/schemas/User" },
//       },
//       additionalProperties: true,
//     },
//     UnauthorizedResponse: {
//       type: "object",
//       properties: {
//         success: { type: "boolean" },
//         message: { type: "string" },
//       },
//       required: ["success"],
//       additionalProperties: true,
//     },
//     ForbiddenResponse: {
//       type: "object",
//       properties: {
//         success: { type: "boolean" },
//         message: { type: "string" },
//       },
//       required: ["success"],
//       additionalProperties: true,
//     },
//     NoContentResponse: {
//       type: "object",
//       properties: {
//         success: { type: "boolean" },
//         message: { type: "string" },
//       },
//       required: ["success"],
//       additionalProperties: true,
//     },
//     BadRequestResponse: {
//       type: "object",
//       properties: {
//         success: { type: "boolean" },
//         message: { type: "string" },
//       },
//       required: ["success"],
//       additionalProperties: true,
//     },
//   };
// }

// function ensureSecuritySchemes(componentsObj: any) {
//   componentsObj.components ??= {};
//   componentsObj.components.securitySchemes ??= {};
//   componentsObj.components.securitySchemes.bearerAuth = {
//     type: "http",
//     scheme: "bearer",
//     bearerFormat: "JWT",
//   };
// }

// function buildComponentsPrompt(appContext: AppContext, prismaSchema: string): string {
//   const modelNames = extractPrismaModelNames(prismaSchema);
//   const enumNames = extractPrismaEnumNames(prismaSchema);
//   const validNames = [...modelNames, ...enumNames, ...BUILTIN_SCHEMA_NAMES];

//   return `
// You are an expert OpenAPI 3.0 Specification Generator.

// TASK:
// Generate ONLY the "components" object for an OpenAPI 3.0.0 document using the provided Prisma schema
// AND the required built-in API schemas listed below.

// APP INFO:
// Title: ${appContext.name}
// Version: ${appContext.version}

// PRISMA SCHEMA:
// ${prismaSchema}

// REQUIRED BUILT-IN SCHEMAS (MUST be included in components.schemas exactly by these names):
// ${JSON.stringify(BUILTIN_SCHEMA_NAMES)}

// CRITICAL RULES:
// 1) Output MUST be a JSON object with EXACTLY this key at the root:
//    - "components"
// 2) In components.schemas:
//    - Include ALL Prisma models and ALL Prisma enums.
//    - Names MUST match Prisma EXACTLY (case-sensitive). Even if there's an @@map annotation, ignore the annotation. An example if this is FileRecord, the name should be FileRecord and not File.
//    - Include ALL fields for every model (including relations).
//    - Enums must be: { "type":"string", "enum":[...] }.
//    - ALSO include the built-in schemas above (same names).
// 3) Security:
//    - components.securitySchemes MUST include "bearerAuth" exactly:
//      { "type":"http", "scheme":"bearer", "bearerFormat":"JWT" }
// 4) IMPORTANT:
//    - You may NOT reference any schemas outside this allowed list:
//      ${JSON.stringify(validNames)}
// 5) Return ONLY raw JSON. No markdown, no commentary.
// `.trim();
// }

// /**
//  * Paths generation helpers (batch + verify + repair)
//  */
// type OpKey = string; // "GET /v2/foo/{id}"

// function toOpKey(method: string, p: string): OpKey {
//   return `${String(method).toUpperCase()} ${normalizeOpenApiPath(String(p))}`;
// }

// function extractOpsFromPaths(pathsObj: any): Set<OpKey> {
//   const out = new Set<OpKey>();
//   const HTTP = new Set(["get", "post", "put", "patch", "delete", "options", "head", "trace"]);
//   const paths = pathsObj?.paths ?? pathsObj ?? {};
//   for (const [p, item] of Object.entries(paths)) {
//     if (!item || typeof item !== "object") continue;
//     for (const [k, _op] of Object.entries(item as any)) {
//       if (!HTTP.has(String(k).toLowerCase())) continue;
//       out.add(`${String(k).toUpperCase()} ${normalizeOpenApiPath(p)}`);
//     }
//   }
//   return out;
// }

// function deepMergePaths(into: any, from: any) {
//   into.paths ??= {};
//   const a = into.paths;
//   const b = from?.paths ?? from ?? {};
//   for (const [p, ops] of Object.entries(b)) {
//     a[p] ??= {};
//     for (const [m, op] of Object.entries(ops as any)) {
//       (a[p] as any)[m] = op; // repairs overwrite
//     }
//   }
//   return into;
// }

// function chunk<T>(arr: T[], size: number): T[][] {
//   const out: T[][] = [];
//   for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
//   return out;
// }

// function buildPathsPrompt(endpoints: any[], schemaNames: string[]): string {
//   const sanitizedEndpoints = endpoints.map((e) => ({
//     path: normalizeOpenApiPath(String(e.path || "")),
//     method: String(e.method || "").toLowerCase(),
//     description: e.description ?? "",
//     operationId: e.client_function_name ?? "",
//     tag: e.service_name ? String(e.service_name).replace(/Service$/i, "") : "",
//     parameters: e.parameters ?? [],
//     requestBody: e.requestBody ?? null,
//     responses: e.outputs ?? [],
//     hasAuthorizationParam: hasAuthorizationParameter(e),
//     opKey: `${String(e.method || "").toUpperCase()} ${normalizeOpenApiPath(String(e.path || ""))}`,
//   }));

//   return `
// You are an expert OpenAPI 3.0 Specification Generator.

// TASK:
// Generate ONLY the "paths" object for an OpenAPI 3.0.0 document using the provided list of endpoints.

// INPUT DATA (List of Endpoints):
// ${JSON.stringify(sanitizedEndpoints, null, 2)}

// CRITICAL RULES:
// 1) Output MUST be a JSON object with EXACTLY this key at the root:
//    - "paths"
// 2) COMPLETENESS (NON-NEGOTIABLE):
//    - You MUST include EVERY endpoint in the input exactly once as an operation.
//    - For each endpoint, create paths[path][method] where path and method are exactly as provided.
// 3) Group endpoints by path and merge methods under the same path key.
// 4) OpenAPI key names MUST be correct (case-sensitive):
//    - Use "operationId" (NOT operation_id)
//    - Use "requestBody" (NOT request_body)
//    - Use "security" at the OPERATION level (NOT inside responses)
// 5) Tags:
//    - Operation "tags" MUST be [tag]
// 6) Security:
//    - DEFAULT: set operation.security = [{"bearerAuth": []}]
//    - EXCEPTION: if hasAuthorizationParam is true, OMIT operation.security entirely
// 7) Add vendor extension: operation["x-op-key"] MUST equal opKey for EVERY endpoint.
// 8) $ref allowlist:
//    - You may ONLY use $ref to #/components/schemas/<Name> where <Name> is in:
//      ${JSON.stringify(schemaNames)}
// 9) Return ONLY raw JSON. No markdown, no commentary.
// `.trim();
// }

// function buildMissingRepairPrompt(args: {
//   missingEndpoints: any[];
//   schemaNames: string[];
//   existingPaths: any;
// }) {
//   const { missingEndpoints, schemaNames, existingPaths } = args;

//   const sanitizedMissing = missingEndpoints.map((e) => ({
//     path: normalizeOpenApiPath(String(e.path || "")),
//     method: String(e.method || "").toLowerCase(),
//     description: e.description ?? "",
//     operationId: e.client_function_name ?? "",
//     tag: e.service_name ? String(e.service_name).replace(/Service$/i, "") : "",
//     parameters: e.parameters ?? [],
//     requestBody: e.requestBody ?? null,
//     responses: e.outputs ?? [],
//     hasAuthorizationParam: hasAuthorizationParameter(e),
//     opKey: `${String(e.method || "").toUpperCase()} ${normalizeOpenApiPath(String(e.path || ""))}`,
//   }));

//   return `
// You are an expert OpenAPI 3.0 Specification Generator.

// TASK:
// You are given:
// 1) an EXISTING "paths" object (partial).
// 2) a list of MISSING endpoints that MUST be added.

// Return ONLY a JSON object with root key "paths", representing the UPDATED paths object after adding ALL missing endpoints.
// - Preserve existing paths/methods unless a missing endpoint requires adding a new method under an existing path.
// - Add ONLY the missing endpoints. Do not invent any new endpoints.

// EXISTING PATHS:
// ${JSON.stringify({ paths: existingPaths?.paths ?? existingPaths ?? {} }, null, 2)}

// MISSING ENDPOINTS (MUST ALL APPEAR IN OUTPUT):
// ${JSON.stringify(sanitizedMissing, null, 2)}

// CRITICAL RULES:
// 1) Output MUST be: { "paths": { ... } } only.
// 2) For each missing endpoint, you MUST create exactly one operation at paths[path][method].
// 3) Tags: operation.tags MUST be [tag]
// 4) Security:
//    - DEFAULT: set operation.security = [{"bearerAuth": []}]
//    - EXCEPTION: if hasAuthorizationParam is true, OMIT operation.security entirely
// 5) Add vendor extension: operation["x-op-key"] MUST equal the provided opKey string for every missing endpoint.
// 6) $ref allowlist:
//    - You may ONLY use $ref to #/components/schemas/<Name> where <Name> is in:
//      ${JSON.stringify(schemaNames)}
// 7) Return ONLY raw JSON. No markdown, no commentary.
// `.trim();
// }

// function stripVendorExtensions(spec: any) {
//   // Optional: remove x-op-key before final write (keeps raw artifacts with it).
//   const HTTP = new Set(["get", "post", "put", "patch", "delete", "options", "head", "trace"]);
//   const paths = spec?.paths ?? {};
//   for (const item of Object.values(paths)) {
//     if (!item || typeof item !== "object") continue;
//     for (const [k, op] of Object.entries(item as any)) {
//       if (!HTTP.has(String(k).toLowerCase())) continue;
//       if (op && typeof op === "object" && "x-op-key" in op) delete (op as any)["x-op-key"];
//     }
//   }
// }

// function buildFinalMerge(appContext: AppContext, components: any, paths: any): any {
//   return {
//     openapi: "3.0.0",
//     info: { title: appContext.name, version: appContext.version },
//     paths: paths.paths ?? {},
//     components: components.components ?? {},
//     security: [{ bearerAuth: [] }],
//   };
// }

// async function streamChatJsonToFile(args: {
//   openai: OpenAI;
//   model: string;
//   system: string;
//   user: string;
//   outPath: string;
//   responseFormatJsonObject?: boolean;
// }): Promise<{ raw: string; parsed: any }> {
//   const { openai, model, system, user, outPath, responseFormatJsonObject } = args;

//   const dir = path.dirname(outPath);
//   if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

//   const file = fs.createWriteStream(outPath, { flags: "w" });

//   try {
//     const stream = await openai.chat.completions.create({
//       model,
//       stream: true,
//       ...(responseFormatJsonObject ? { response_format: { type: "json_object" } } : {}),
//       messages: [
//         { role: "system", content: system },
//         { role: "user", content: user },
//       ],
//     });

//     let full = "";
//     for await (const event of stream) {
//       const chunk = event.choices?.[0]?.delta?.content ?? "";
//       if (!chunk) continue;
//       full += chunk;
//       file.write(chunk);
//     }
//     file.end();

//     const parsed = JSON.parse(full);
//     return { raw: full, parsed };
//   } catch (err) {
//     file.destroy();
//     throw err;
//   }
// }

// function countOperations(spec: any) {
//   const HTTP = new Set(["get", "post", "put", "patch", "delete", "options", "head", "trace"]);
//   const paths = spec?.paths ?? {};
//   let opCount = 0;
//   for (const item of Object.values(paths)) {
//     if (!item || typeof item !== "object") continue;
//     for (const k of Object.keys(item as any)) {
//       if (HTTP.has(k.toLowerCase())) opCount++;
//     }
//   }
//   return { pathCount: Object.keys(paths).length, operationCount: opCount };
// }

// export async function generateOpenApiSpecWithAI(
//   appContext: AppContext,
//   endpoints: any[],
//   prismaSchema: string,
//   destinationPath: string,
// ): Promise<void> {
//   const uniqOps = new Set(endpoints.map((e) => `${String(e.method).toUpperCase()} ${String(e.path)}`));
//   console.log("endpoints.length =", endpoints.length);
//   console.log("unique operations =", uniqOps.size);

//   const prismaModelNames = extractPrismaModelNames(prismaSchema);
//   const prismaEnumNames = extractPrismaEnumNames(prismaSchema);

//   const allowedSchemaNames = new Set<string>([
//     ...prismaModelNames,
//     ...prismaEnumNames,
//     ...BUILTIN_SCHEMA_NAMES,
//   ]);

//   // Pass A: components
//   console.log("AI Pass A: generating components...");
//   const componentsPrompt = buildComponentsPrompt(appContext, prismaSchema);
//   const componentsOutPath = path.join(destinationPath, "components.raw.json");

//   const componentsResult = await streamChatJsonToFile({
//     openai,
//     model: AI_MODEL,
//     system: "You output valid JSON only.",
//     user: componentsPrompt,
//     outPath: componentsOutPath,
//     responseFormatJsonObject: true,
//   });

//   // Deterministic patches
//   componentsResult.parsed.components ??= {};
//   componentsResult.parsed.components.schemas ??= {};

//   for (const [name, schema] of Object.entries(builtinSchemas())) {
//     if (!componentsResult.parsed.components.schemas[name]) {
//       componentsResult.parsed.components.schemas[name] = schema;
//     }
//   }
//   ensureSecuritySchemes(componentsResult.parsed);

//   /**
//    * Pass B: paths (BATCHED + VERIFIED + REPAIRED)
//    */
//   console.log("AI Pass B: generating paths (batched + verified)...");
//   const expectedOps = new Set<OpKey>(
//     endpoints.map((e) => toOpKey(String(e.method), String(e.path))),
//   );

//   // Start with empty paths, then merge batch outputs
//   let mergedPaths: any = { paths: {} };

//   // Tune this if needed (lower if each endpoint object is huge)
//   const BATCH_SIZE = 80;
//   const endpointBatches = chunk(endpoints, BATCH_SIZE);

//   for (let i = 0; i < endpointBatches.length; i++) {
//     console.log(`  - batch ${i + 1}/${endpointBatches.length} (${endpointBatches[i].length} endpoints)`);
//     const pathsPrompt = buildPathsPrompt(endpointBatches[i], [...allowedSchemaNames]);
//     const batchOutPath = path.join(destinationPath, `paths.batch.${i + 1}.raw.json`);

//     const batchResult = await streamChatJsonToFile({
//       openai,
//       model: AI_MODEL,
//       system: "You output valid JSON only.",
//       user: pathsPrompt,
//       outPath: batchOutPath,
//       responseFormatJsonObject: true,
//     });

//     mergedPaths = deepMergePaths(mergedPaths, batchResult.parsed);
//   }

//   const MAX_REPAIR_ROUNDS = 6;
//   for (let round = 1; round <= MAX_REPAIR_ROUNDS; round++) {
//     const haveOps = extractOpsFromPaths(mergedPaths);
//     const missing: OpKey[] = [];
//     for (const op of expectedOps) if (!haveOps.has(op)) missing.push(op);

//     if (!missing.length) {
//       console.log(`  ✅ all operations present after ${round - 1} repair rounds`);
//       break;
//     }

//     console.warn(`  ⚠️ missing ${missing.length} operations (repair round ${round})`);

//     const missingEndpoints = endpoints.filter((e) => {
//       const k = toOpKey(String(e.method), String(e.path));
//       return missing.includes(k);
//     });

//     const repairPrompt = buildMissingRepairPrompt({
//       missingEndpoints,
//       schemaNames: [...allowedSchemaNames],
//       existingPaths: mergedPaths,
//     });

//     const repairOutPath = path.join(destinationPath, `paths.repair.${round}.raw.json`);
//     const repairResult = await streamChatJsonToFile({
//       openai,
//       model: AI_MODEL,
//       system: "You output valid JSON only.",
//       user: repairPrompt,
//       outPath: repairOutPath,
//       responseFormatJsonObject: true,
//     });

//     mergedPaths = deepMergePaths(mergedPaths, repairResult.parsed);

//     // progress check
//     const afterOps = extractOpsFromPaths(mergedPaths);
//     const stillMissing = missing.filter((op) => !afterOps.has(op));
//     if (stillMissing.length === missing.length) {
//       throw new Error(
//         `Repair round ${round} made no progress. Still missing: ${stillMissing.slice(0, 20).join(", ")}${
//           stillMissing.length > 20 ? "..." : ""
//         }`,
//       );
//     }
//   }

//   // Final verify (hard fail if still missing)
//   {
//     const haveOps = extractOpsFromPaths(mergedPaths);
//     const missingFinal: string[] = [];
//     for (const op of expectedOps) if (!haveOps.has(op)) missingFinal.push(op);

//     if (missingFinal.length) {
//       throw new Error(
//         `OpenAPI paths missing ${missingFinal.length} operations. Examples: ${missingFinal.slice(0, 25).join(", ")}${
//           missingFinal.length > 25 ? "..." : ""
//         }`,
//       );
//     }
//   }

//   // Merge
//   const spec = buildFinalMerge(appContext, componentsResult.parsed, mergedPaths);

//   // Optional: strip audit keys from final spec.json (raw artifacts keep them)
//   stripVendorExtensions(spec);

//   // Validate refs
//   const missingRefs = findMissingComponentSchemaRefs(spec);
//   if (missingRefs.length) {
//     throw new Error(
//       `OpenAPI spec has missing components.schemas refs: ${missingRefs
//         .map((s) => `#/components/schemas/${s}`)
//         .join(", ")}`,
//     );
//   }

//   const illegalRefs = findIllegalSchemaRefs(spec, allowedSchemaNames);
//   if (illegalRefs.length) {
//     throw new Error(
//       `OpenAPI spec uses schema refs not in allowlist: ${illegalRefs
//         .map((s) => `#/components/schemas/${s}`)
//         .join(", ")}`,
//     );
//   }

//   // Write final
//   if (!fs.existsSync(destinationPath)) fs.mkdirSync(destinationPath, { recursive: true });
//   const outPath = path.join(destinationPath, "spec.json");
//   fs.writeFileSync(outPath, JSON.stringify(spec, null, 2), "utf8");

//   const hash = crypto.createHash("sha256").update(JSON.stringify(spec)).digest("hex");
//   fs.writeFileSync(path.join(destinationPath, "spec.sha256.txt"), hash, "utf8");

//   const counts = countOperations(spec);
//   console.log("OpenAPI spec written to:", outPath);
//   console.log("Spec counts:", counts);
// }
