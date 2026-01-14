// FILE PATH: src/modules/provenance/ai/analyze_endpoint_ai.ts

// ----- OLD CODE -----

// import dotenv from 'dotenv';
// import fs from 'fs';
// import OpenAI from 'openai';
// import path from 'path';
// import { PROCESS_ENDPOINT_WITH_AI_PROMPT } from './prompts';

// dotenv.config();

// const OPENAI_API_KEY = process.env.OPENAI_API_KEY as string;
// const AI_MODEL = 'gpt-4o-mini';
// const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// const runId = new Date().toISOString().replace(/[:.]/g, "-"); // compute ONCE

// const logDirAnalysis = path.join(process.cwd(), `ai-logs/analysis_${runId}`);

// // create ONCE
// fs.mkdirSync(logDirAnalysis, { recursive: true });
// console.log("LOG DIR:", logDirAnalysis);


// function makeEndpointLogStreamAnalysis(endpoint: { method: string; path: string }, batchNumber: number) {
//   const fileName =
//     `${batchNumber}_${endpoint.method}_${endpoint.path.replace(/[^a-zA-Z0-9]/g, "-")}.log`;

//   const logPath = path.join(logDirAnalysis, fileName);

//   const stream = fs.createWriteStream(logPath, { flags: "a" });
//   stream.on("error", (err) => console.error("Log stream error:", err));
//   return stream;
// }

 
// /**
//  * AI Helper: Analyzes endpoint code to extract OpenAPI-compliant metadata.
//  * Optimized for ChatGPT JSON Mode.
//  */

// export async function analyzeEndpointWithAI(endpoint: any, code: string, availableModels: string[], batchNumber: number): Promise<any> {

//   const logFile = makeEndpointLogStreamAnalysis(endpoint, batchNumber);

//   logFile.on("error", (err) => console.error("Log stream error:", err));

//   logFile.write(`--- STARTING ENDPOINT AI ANALYSIS ---`);
//   logFile.write(`\nBATCH NUMBER: ${batchNumber}`);
//   logFile.write(`\nENDPOINT: ${JSON.stringify(endpoint)}`);
//   logFile.write(`\nAVAILABLE MODELS: ${availableModels.join(', ')}`);
//   logFile.write(`\n\n\nEndpoint code under analysis:\n\n\n${code}\n\n\n`);
//   const modelList = availableModels.length > 0 
//     ? `IMPORTANT: The following Database Models exist in this project. Use these names exactly in property definitions if the response returns them: ${availableModels.join(', ')}.`
//     : '';

//   const prompt = PROCESS_ENDPOINT_WITH_AI_PROMPT(endpoint, code, modelList);
  
//   try {
//     logFile.write(`\n--- PROMPT ---\n`);
//     logFile.write(prompt);
//     logFile.write(`\n--- CREATING COMPLETION ---`);
//     const completion = await openai.chat.completions.create({
//       model: AI_MODEL,
//       messages: [
//         { role: 'user', content: prompt }
//       ],
//       response_format: { type: "json_object" }, // Force OpenAI to return valid JSON
//       // temperature: 0, 
//     });

//     logFile.write(`\n--- COMPLETION ---\n`);
//     logFile.write(JSON.stringify(completion, null, 2));

//     const aiResponse = completion.choices[0]?.message?.content?.trim();
//     if (!aiResponse) return {};

//     const parsedData = JSON.parse(aiResponse);

//     // Validation
//     if (!parsedData.parameters) parsedData.parameters = [];
//     if (!parsedData.outputs) parsedData.outputs = [];

//     logFile.write(`\nAI RESPONSE: ${JSON.stringify(parsedData, null, 2)}`);
//     logFile.write(`\n--- ENDPOINT AI ANALYSIS COMPLETE ---`);
//     logFile.end();
//     return parsedData;

//   } catch (error: any) {
//     console.error(`AI Analysis Failed for ${endpoint.method} ${endpoint.path}: ${error.message || error}. See log file for more details.`);
//     logFile.write(`\nAI Analysis Failed for ${endpoint.method} ${endpoint.path}: ${error.message || error}`);
//     logFile.write(`\n--- ENDPOINT AI ANALYSIS COMPLETE ---`);
//     logFile.end();
//     return {};
//   }
// }



// ---- NEW CODE ----
// FILE PATH: src/modules/endpoint/ai/analyze_endpoint_ai.ts
import { AnalysisStatus, Endpoint, EndpointOutput, EndpointParameter } from '@prisma_client';
import crypto from 'crypto';
import fs from 'fs';
import OpenAI from 'openai';
import path from 'path';
import { PROCESS_ENDPOINT_WITH_AI_PROMPT } from './prompts';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const ENABLE_DEBUG_LOGS = process.env.AI_DEBUG === 'true'; // Set this in .env to turn it on

// --- LOGGING HELPER ---
function logInteraction({ endpoint, batchId, prompt, response, error }: { endpoint: Endpoint, batchId: number, prompt: string, response: any, error: any }) {
    if (!ENABLE_DEBUG_LOGS) return;

    try {
        const runId = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const logDir = path.join(process.cwd(), 'logs', '.endpoint_ai_analysis', runId);
        
        // Ensure directory exists
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }

        const safePath = endpoint.path.replace(/[^a-zA-Z0-9]/g, "-");
        const fileName = `${batchId}_${endpoint.method}_${safePath}.log`;
        const logPath = path.join(logDir, fileName);

        const content = `
--- METADATA ---
TIMESTAMP: ${new Date().toISOString()}
ENDPOINT: ${endpoint.method} ${endpoint.path}
BATCH ID: ${batchId || 0}

--- INPUT CODE ---
${endpoint.source_code}

--- PROMPT ---
${prompt}

--- AI RESPONSE (RAW) ---
${JSON.stringify(response, null, 2)}

--- ERROR (IF ANY) ---
${error ? JSON.stringify(error, null, 2) : 'None'}
`;

        fs.writeFileSync(logPath, content);
        console.log(`📝 [AI Log] Written to ${fileName}`);
    } catch (err) {
        console.error("Failed to write AI log:", err);
    }
}

// --- MAIN FUNCTION ---

// ... imports and logInteraction stay the same ...

interface AnalyzeEndpointRespsonse {
   endpoint: Endpoint;
   parameters?: Partial<EndpointParameter>[];
   outputs?: Partial<EndpointOutput>[];
   success: boolean;
}

export async function analyzeEndpointWithAI(
    endpoint: Endpoint, 
    models: string[],
    batchId: number
): Promise<AnalyzeEndpointRespsonse> {
    let prompt = "";
    
    try {
        const modelContext = models.length > 0 ? `MODELS: ${models.join(', ')}` : '';
        prompt = PROCESS_ENDPOINT_WITH_AI_PROMPT(endpoint, modelContext);
        
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini', // Good choice for speed/cost. Use 'gpt-4o' if complex.
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: "json_object" },
            temperature: 0.1 // 🟢 ADDED: Lower temperature = more consistent JSON structure
        });

        let rawContent = completion.choices[0]?.message?.content || '{}';
        
        // 🟢 FIX 1: Sanitize Markdown Fences
        // Sometimes AI returns ```json ... ``` despite instructions
        if (rawContent.startsWith('```')) {
            rawContent = rawContent.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
        }

        const parsed = JSON.parse(rawContent);

        // 🟢 FIX 2: Basic Validation / Defaults
        // Ensure the keys actually exist so the rest of your app doesn't crash
        const randomId = crypto.randomUUID();

        // Success Log
        logInteraction({
            endpoint,
            batchId,
            prompt,
            response: rawContent,
            error: null
        });

        const sanitizedResult: AnalyzeEndpointRespsonse = {
            endpoint: {
                ...endpoint,
                service_name: parsed.service_name || 'DEFAULT',
                client_function_name: parsed.client_function_name || 'method' + randomId,
                description: parsed.description || 'No description provided',
                analysis_status: AnalysisStatus.COMPLETED,
                last_synced_at: new Date(),
                ai_raw_output: parsed,
            },
            parameters: parsed.parameters || [],
            outputs: parsed.outputs || [],
            success: true
        };

        return sanitizedResult;

    } catch (e: any) {
        console.error(`❌ AI Analysis Failed for ${endpoint.method} ${endpoint.path}`, e.message);
        
        // Error Log
        logInteraction({
            endpoint,
            batchId,
            prompt,
            response: null,
            error: e
        });

        return {
            endpoint: {
                ...endpoint,
                analysis_status: AnalysisStatus.FAILED,
                last_synced_at: new Date(),
                ai_raw_output: null
            },
            success: false
            
        };
    }
}