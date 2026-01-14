// Past version of the spec generator.

// // FILE PATH: src/modules/endpoint/build_spec_deterministic.ts
// import { EndpointParameter, EndpointParameterLocation } from "@prisma_client";
// import fs from "node:fs";
// import path from "node:path";

// type AppContext = { name: string; version: string };

// function safeParse(input: any): any {
//   if (typeof input === 'string') {
//     try {
//       const parsed = JSON.parse(input);
//       if (typeof parsed === 'string') return JSON.parse(parsed);
//       return parsed;
//     } catch (e) {
//       return input;
//     }
//   }
//   return input;
// }

// function fixReferencePathsAndTypes(schemaObject: any): any {
//   if (!schemaObject || typeof schemaObject !== "object" || schemaObject === null) return schemaObject;
//   if (Array.isArray(schemaObject)) return schemaObject.map(fixReferencePathsAndTypes);

//   let processedObject = schemaObject;
//   if (schemaObject.anyOf && schemaObject.anyOf.length === 2) {
//     const refNode = schemaObject.anyOf.find((node: any) => node && node.$ref);
//     const nullNode = schemaObject.anyOf.find((node: any) => node && node.type === "null");
//     if (refNode && nullNode) processedObject = { ...refNode, nullable: true };
//   }

//   const newSchemaObject: any = {};
//   for (const [key, value] of Object.entries(processedObject)) {
//     if (key === "$ref" && typeof value === "string") {
//       newSchemaObject[key] = value.replace(/^#\/(\$defs|definitions|defs)\//, "#/components/schemas/");
//     } else {
//       newSchemaObject[key] = fixReferencePathsAndTypes(value);
//     }
//   }
//   return newSchemaObject;
// }

// function sanitizeSchemaType(rawTypeDefinition: any): any {
//   const parsedDef = safeParse(rawTypeDefinition);

//   if (typeof parsedDef === 'string') {
//     const lower = parsedDef.toLowerCase().trim();
//     if (lower === 'bool' || lower === 'boolean') return { type: 'boolean' };
//     if (lower === 'int' || lower === 'integer') return { type: 'integer' };
//     if (lower === 'float' || lower === 'number') return { type: 'number' };
//     if (lower === 'array') return { type: 'array', items: { type: 'string' } };
//     if (['string', 'object'].includes(lower)) return { type: lower };
//     return { type: 'string' };
//   }

//   if (typeof parsedDef === 'object' && parsedDef !== null) {
//     const sanitized = fixReferencePathsAndTypes({ ...parsedDef });
//     if (sanitized.type && typeof sanitized.type === 'string') {
//       const lower = sanitized.type.toLowerCase().trim();
//       if (lower === 'bool' || lower === 'boolean') sanitized.type = 'boolean';
//       else if (lower === 'int' || lower === 'integer') sanitized.type = 'integer';
//       else if (lower === 'number') sanitized.type = 'number';
      
//       if (lower === 'array' && !sanitized.items) sanitized.items = { type: 'string' };
//     }
//     return sanitized;
//   }
//   return { type: 'string' };
// }

// // Helper: Normalize Prisma Model names
// function cleanModelName(name: string) {
//   return name.toLowerCase()
//     .replace(/record$/, "")
//     .replace(/entity$/, "")
//     .replace(/model$/, "");
// }

// // Helper: Structural Matcher with Logging
// function findModelByStructure(jsonObj: any, dbModels: Set<string>, componentSchemas: any): string | null {
//   if (!jsonObj || typeof jsonObj !== 'object' || Array.isArray(jsonObj)) return null;
  
//   // jsonObj is usually the Schema Object (val)
//   const properties = jsonObj.properties || jsonObj; 
//   const jsonKeys = Object.keys(properties);
  
//   // Log what keys we are looking for
//   // console.log(`[Structural] Inspecting object with keys: [${jsonKeys.join(', ')}]`);

//   if (jsonKeys.length < 2) return null; 

//   for (const modelName of dbModels) {
//     const modelDef = componentSchemas[modelName];
//     if (!modelDef || !modelDef.properties) continue;

//     const modelKeys = new Set(Object.keys(modelDef.properties));
//     const allKeysMatch = jsonKeys.every(key => modelKeys.has(key));
    
//     if (allKeysMatch) {
//       console.log(`[Structural] MATCH FOUND: Object matches model "${modelName}"`);
//       return modelName;
//     }
//   }
//   return null;
// }

// function resolveResponseSchema(
//   outputResponse: any, 
//   dbModels: Set<string>, 
//   opId: string, 
//   componentSchemas: any,
//   contentType: string,
//   statusCode: string,
//   appendWithStatusCode: boolean
// ): any {
//   // 1. Binary Check
//   const isBinary = contentType && (
//     contentType.includes("octet-stream") || 
//     contentType.includes("pdf") || 
//     contentType.includes("image") || 
//     opId.toLowerCase().includes("download") // heuristic fallback
//   );
//   if (isBinary) return { type: "string", format: "binary" };

//   // 2. Initial Parse
//   const returnData = safeParse(outputResponse.return_json);
//   if (!returnData || typeof returnData !== "object") return { type: "object" };

//   // 3. Direct Model Reference
//   if (returnData.name && dbModels.has(returnData.name)) {
//     return { $ref: `#/components/schemas/${returnData.name}` };
//   }
  
//   // 4. Process Properties
//   if (returnData.type === "object" && returnData.properties) {
//     const newProps: any = {};
//     const modelList = Array.from(dbModels);

//     for (const [key, val] of Object.entries(returnData.properties) as [string, any][]) {
      
//       // --- STRATEGY 1: Structural Match ---
//       const structuralMatch = findModelByStructure(val, dbModels, componentSchemas);
//       if (structuralMatch) {
//         if (val.type === "array") {
//            newProps[key] = { type: "array", items: { $ref: `#/components/schemas/${structuralMatch}` } };
//         } else {
//            newProps[key] = { $ref: `#/components/schemas/${structuralMatch}` };
//         }
//       }

//       // --- STRATEGY 2: Smart Name Match ---
//       else {
//         let singular = key;
//         if (key.endsWith("ies")) singular = key.replace(/ies$/, "y");
//         else singular = key.replace(/s$/, ""); 
//         const lowerProp = singular.toLowerCase();

//         const nameMatch = modelList.find(m => {
//           const lowerModel = m.toLowerCase();
//           const cleanedModel = cleanModelName(m);
//           return lowerModel === lowerProp || 
//                  lowerModel.endsWith(lowerProp) || 
//                  cleanedModel === lowerProp; 
//         });

//         if (nameMatch) {
//           console.log(`  -> Name match: "${key}" matched to model "${nameMatch}"`);
          
            
//             if (val.type === "array") {
//                 const schema = { type: "array", items: { $ref: `#/components/schemas/${nameMatch}` } }; 
//                 newProps[key] = schema;
//             } else {
//                 const schema = { $ref: `#/components/schemas/${nameMatch}` };
//                 newProps[key] = schema;
//             }
         
//         }
        
//         // --- STRATEGY 3: Nested Object Recursion ---
//         else if (val.type === 'object' && val.properties) {
//           const nestedOutput = { return_json: JSON.stringify(val), type: contentType || "application/json" };
//           const uniqueNestedOpId = opId + key.charAt(0).toUpperCase() + key.slice(1);

//           // Recurse
//           const resolvedChild = resolveResponseSchema(
//               nestedOutput, 
//               dbModels, 
//               uniqueNestedOpId, 
//               componentSchemas,
//               contentType || "application/json",
//               statusCode,
//               appendWithStatusCode
//           );
          
//           newProps[key] = resolvedChild;
//         } else {
//           // --- STRATEGY 4: Primitive ---
//           newProps[key] = fixReferencePathsAndTypes(val);
//         }
//       }
//     }
    
//     // Final Register
//     let responseTypeName = toPascalCase(opId) + "Response";
//     if (appendWithStatusCode) responseTypeName += statusCode;

//     componentSchemas[responseTypeName] = enforceRequired({ ...returnData, properties: newProps });
//     return { $ref: `#/components/schemas/${responseTypeName}` };
//   }

//   return enforceRequired(fixReferencePathsAndTypes(returnData));
// }



 

// function enforceRequired(schema: any): any {
//   if (!schema || typeof schema !== "object") return schema;
//   if (schema.type === "array" && schema.items) schema.items = enforceRequired(schema.items);
//   if (schema.type === "object" && schema.properties) {
//     const reqs: string[] = [];
//     for (const [k, v] of Object.entries(schema.properties) as [string, any][]) {
//       schema.properties[k] = enforceRequired(v);
//       if (v.nullable !== true) reqs.push(k);
//     }
//     if (reqs.length) schema.required = Array.from(new Set([...(schema.required || []), ...reqs])).sort();
//   }
//   return schema;
// }

// // Helper: Just converts "verify_otp" -> "VerifyOtp" for naming the Type
// function toPascalCase(str: string) {
//     return str.replace(/(^\w|_\w)/g, m => m.replace(/_/, "").toUpperCase());
// }

// function sanitizeComponents(componentSchemas: any, dbModels: Set<string>) {
//   console.log("--- Sanitizing Component Schemas (Making Relations Nullable) ---");
  
//   for (const [modelName, schema] of Object.entries(componentSchemas)) {
//     if (!schema || (schema as any).type !== 'object' || !(schema as any).properties) continue;

//     const props = (schema as any).properties;
    
//     for (const [propKey, propVal] of Object.entries(props)) {
//       // Check if this property is a reference to another Database Model
//       // e.g., "policy": { "$ref": "#/components/schemas/Policy" }
//       const isRef = (propVal as any).$ref;
//       const isArrayRef = (propVal as any).type === 'array' && (propVal as any).items?.$ref;
      
//       let targetModel = "";
//       if (isRef) {
//         targetModel = isRef.split('/').pop()
//         console.log(`  -> DISCARDING: targetModel: ${targetModel} from ${isRef}`);
//       };
//       if (isArrayRef) {
//         targetModel = (propVal as any).items.$ref.split('/').pop();
//         console.log(`  -> DISCARDING: targetModel: ${targetModel} from ${isArrayRef}`);
//       };

//       // If this property points to a known DB Model, it MUST be nullable
//       // to handle circular dependencies (breaking the loop with null).
//       if (dbModels.has(targetModel)) {
//          // console.log(`  -> Marking relation ${modelName}.${propKey} as Nullable`);
//          (props[propKey] as any).nullable = true;
//       }
//     }
//   }
// }

// export async function generateOpenApiSpecDeterministic(
//   appContext: AppContext,
//   endpoints: any[],
//   prismaSchemaJson: string,
//   destinationPath: string
// ) {
//   const componentSchemas: any = { 
//     SuccessResponse: { type: "object", properties: { success: { type: "boolean" }, message: { type: "string" } }, required: ["success"] } 
//   };
//   const dbModels = new Set<string>();
//   const prismaDefs = JSON.parse(prismaSchemaJson).$defs || {};

//   for (const [name, def] of Object.entries(prismaDefs)) {
//     dbModels.add(name);
//     componentSchemas[name] = enforceRequired(fixReferencePathsAndTypes(def));
//   }

//   // 2. *** NEW STEP: Sanitize Definitions ***
//   // This ensures PolicyRevision.policy is 'Policy?' instead of 'Policy' globally.
//   sanitizeComponents(componentSchemas, dbModels);

//   const paths: any = {};

//   for (const e of endpoints) {
//     let route = (e.path || "").startsWith("/") ? e.path : `/${e.path}`;
//     // --- FIX: Convert Express ":slug" -> OpenAPI "{slug}" ---
//     route = route.replace(/:([a-zA-Z0-9_]+)/g, "{$1}");
//     const method = String(e.method || "get").toLowerCase();
//     if (!e.client_function_name) {
//       console.log('e.client_function_name is not present for endpoint path: ', e.path);
//     }
//     const opId = e.client_function_name;
    
//     if (!paths[route]) paths[route] = {};

//     const rawParams = e.parameters || [];
    
//     // --- PARAMETER SEPARATION ---
//     const openApiParams: any[] = [];
//     const bodyProperties: any = {};
//     const bodyRequired: string[] = [];

//     rawParams.forEach((p: EndpointParameter & { schema: any }) => {
//         if (!p || !p.name) return;

//         let schema;
//         if (p.schema) schema = sanitizeSchemaType(p.schema);
//         else if (p.type) schema = sanitizeSchemaType(p.type);
//         else schema = { type: 'string' };

//         if (p.location === EndpointParameterLocation.BODY) {
//             bodyProperties[p.name] = schema; 
//             if (p.required) bodyRequired.push(p.name);
//         } else {
//             openApiParams.push({
//                 name: p.name, 
//                 in: p.location.toLowerCase(), 
//                 required: p.required,
//                 schema
//             });
//         }
//     });

//     // 3. Construct Request Body
//     let requestBody = undefined;
//     if (Object.keys(bodyProperties).length > 0) {
//         // Name the request type (e.g. VerifyOtpRequest)
//         const requestSchemaName = toPascalCase(opId) + "Request";
        
//         componentSchemas[requestSchemaName] = {
//             type: "object",
//             properties: bodyProperties,
//             required: bodyRequired.length ? bodyRequired : undefined
//         };

//         requestBody = {
//             required: true,
//             content: {
//                 "application/json": {
//                     schema: {
//                         $ref: `#/components/schemas/${requestSchemaName}`
//                     }
//                 }
//             }
//         };
//     }

//     const responses: any = {};
//     let status200Counter = 0;
//  for (const out of (e.outputs || [])) {
//       const statusCode = String(out.status_code);
//       if (statusCode.startsWith('2')) status200Counter++;
//       let appendWithStatusCode = false;
//       if (!statusCode .startsWith('2')) appendWithStatusCode = true;
//       if (status200Counter > 1) appendWithStatusCode = true;
//       responses[String(out.status_code || "200")] = {
//         description: out.description || "OK",
//         content: { 
//           [out.type || "application/json"]: { 
//             // PASS componentSchemas here!
//             schema: resolveResponseSchema(out, dbModels, opId, componentSchemas, out.type || "application/json", String(out.status_code || "200"), appendWithStatusCode) 
//           } 
//         }
//       };
//     }

//     paths[route][method] = { 
//       operationId: opId, 
//       tags: [e.service_name?.replace(/Service$/i, "") || "Default"], 
//       parameters: openApiParams,
//       requestBody: requestBody,
//       responses 
//     };
//   }

//   const spec = { openapi: "3.0.0", info: appContext, paths, components: { schemas: componentSchemas, securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } } } };
//   if (!fs.existsSync(destinationPath)) fs.mkdirSync(destinationPath, { recursive: true });
//   fs.writeFileSync(path.join(destinationPath, "spec.json"), JSON.stringify(spec, null, 2));
// }