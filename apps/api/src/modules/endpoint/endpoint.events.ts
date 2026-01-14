import { DbNull } from '@prisma/client/runtime/client';
import { AnalysisStatus } from '@prisma_client';
import { EventEmitter } from 'events';
import prisma from '../../prisma';
import { analyzeEndpointWithAI } from './ai/analyze_endpoint_ai';
import { EndpointRepository } from './endpoint.repository';

export const endpointEvents = new EventEmitter();
const endpointRepo = new EndpointRepository();

endpointEvents.on('endpoint.analyze', async (endpointId: string) => {
    console.log(`🤖 [AI Worker] Starting analysis for Endpoint ID: ${endpointId}`);

    try {
        // A. Fetch the Endpoint
        // We no longer need 'include: { app: ... }' because relevent_schema is right here.
        const endpoint = await prisma.endpoint.findUnique({
            where: { id: endpointId }
        });

        if (!endpoint || !endpoint.source_code) {
            console.warn(`⚠️ [AI Worker] Endpoint ${endpointId} has no source code.`);
            return;
        }

        // B. Get User's Domain Context (Schema/Types)
        // We check the specific field you added to the Endpoint model..
        const userModels = endpoint.relevent_schema
            ? [endpoint.relevent_schema]
            : [];

        // C. Call OpenAI
        const batchId = Date.now();

        const analysisResult = await analyzeEndpointWithAI(
            endpoint,
            userModels,
            batchId
        );

        if (!analysisResult.success) {
            throw new Error("AI Analysis reported failure");
        }

        // D. Update "Identity" Fields
        await prisma.endpoint.update({
            where: { id: endpointId },
            data: {
                description: analysisResult.endpoint.description,
                service_name: analysisResult.endpoint.service_name,
                client_function_name: analysisResult.endpoint.client_function_name,
                analysis_status: AnalysisStatus.COMPLETED,
                ai_raw_output: analysisResult.endpoint.ai_raw_output ?? DbNull,
                last_synced_at: new Date()
            }
        });

        // E. Update Relations: Parameters
        await endpointRepo.deleteParametersForEndpoint(endpointId);

        if (analysisResult.parameters && Array.isArray(analysisResult.parameters)) {
            for (const param of analysisResult.parameters) {
                // Safely determine location (handle 'in' vs 'location' mismatch from AI)
                const rawLocation = param.location || (param as any).in || 'QUERY';

                await endpointRepo.createEndpointParameter({
                    endpoint: { connect: { id: endpointId } },
                    name: param.name || 'unknown',
                    description: param.description || '',
                    required: param.required || false,
                    type: param.type || 'string',
                    location: rawLocation.toUpperCase() as any,
                    default_value: String(param.default_value ?? '')
                });
            }
        }

        // F. Update Relations: Outputs
        await endpointRepo.deleteOutputsForEndpoint(endpointId);

        if (analysisResult.outputs && Array.isArray(analysisResult.outputs)) {
            for (const output of analysisResult.outputs) {
                await endpointRepo.createEndpointOutput({
                    endpoint: { connect: { id: endpointId } },
                    name: 'response',
                    description: output.description || 'Success',
                    status_code: output.status_code || 200,
                    type: 'application/json',
                    return_json: output.return_json || {}
                });
            }
        }

        console.log(`✅ [AI Worker] Completed: ${endpoint.method} ${endpoint.path}`);

    } catch (error) {
        console.error(`❌ [AI Worker] Failed: ${endpointId}`, error);
        await prisma.endpoint.update({
            where: { id: endpointId },
            data: { analysis_status: AnalysisStatus.FAILED }
        });
    }
});