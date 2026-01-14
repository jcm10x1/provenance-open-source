// FILE PATH: src/modules/endpoint/endpoint.service.ts
import { AnalysisStatus, HttpMethod, Prisma } from '@prisma_client';
import { createHash } from 'crypto';
import { EndpointCreateInput } from 'generated/prisma/models';
import { NotFoundError } from "../../types/http_errors";
import { AppRepository } from '../app/app.repository';
import { endpointEvents } from './endpoint.events';
import { EndpointRepository } from './endpoint.repository';
import { generateOpenApiSpecDeterministic } from './openapi.generator';

// Define the shape of data coming from Provenance Service
export interface EndpointUpsertData {
    path: string;
    method: string;
    description?: string;
    service_name?: string;
    client_function_name?: string;
    // New fields for Provenance
    sourceCode?: string;
    code_hash?: string;
    analysisStatus?: AnalysisStatus;
    parameters?: any[];
    outputs?: any[];
    relevent_schema?: string;
}

interface ScanItem {
    path: string;            // e.g., "/users/:id"
    method: string;          // e.g., "GET", "POST"
    code: string;            // The actual source code snippet of the route handler
    relevent_schema?: string; // (Optional) The Prisma schema or type definitions context
}

export class EndpointService {
    private endpointRepo = new EndpointRepository();
    private appRepo = new AppRepository();

    /**
     * ✅ NEW: ENTRY POINT FOR CLI SCAN
     * 1. Ingests raw source code.
     * 2. Checks hashes to skip expensive AI if code hasn't changed.
     * 3. Queues valid changes for the Background Worker.
     */
    async syncFromScan(appId: string, scanItems: ScanItem[], enhanced: boolean) {
        const trackedIds: string[] = [];
        let queuedCount = 0;

        // 1. Snapshot: Get all currently active IDs for this App
        const currentEndpoints = await this.endpointRepo.getEndpoints({
            app_id: appId,
            deleted_at: null
        });
        const activeEndpointIds = new Set(currentEndpoints.map(e => e.id));
        const processedEndpointIds = new Set<string>(); // We will track what we see

        // 2. Process Incoming Scan (Upsert)
        for (const item of scanItems) {
            // A. Calculate Hash
            const newHash = createHash('sha256').update(item.code).digest('hex');

            // B. Find existing
            const existing = await this.endpointRepo.findEndpointByMethodAndPath(
                appId,
                item.method as HttpMethod,
                item.path
            );

            // C. Determine Analysis Needs
            const isNew = !existing;
            const codeChanged = existing && existing.code_hash !== newHash;
            // @ts-ignore
            const prevFailed = existing && existing.analysis_status === 'FAILED';

            const needsAnalysis = isNew || codeChanged || prevFailed || enhanced;
            const nextStatus: AnalysisStatus = needsAnalysis ? 'PENDING' : 'COMPLETED';

            // D. Upsert Logic
            let endpointId = existing?.id;

            if (existing) {
                await this.endpointRepo.updateEndpoint(existing.id, {
                    source_code: item.code,
                    code_hash: newHash,
                    analysis_status: nextStatus,
                    last_synced_at: new Date(),
                    deleted_at: null, // Resurrect if it was previously deleted
                    relevent_schema: item.relevent_schema,
                });
                processedEndpointIds.add(existing.id); // Mark as "Seen"
            } else {
                const newEp = await this.endpointRepo.registerEndpoint({
                    app: { connect: { id: appId } },
                    path: item.path,
                    method: item.method as HttpMethod,
                    source_code: item.code,
                    code_hash: newHash,
                    analysis_status: nextStatus,
                    description: "Pending Analysis...",
                    last_synced_at: new Date(),
                    relevent_schema: item.relevent_schema,
                });
                endpointId = newEp.id;
                // New IDs aren't in 'activeEndpointIds' anyway, so no need to "remove" them
            }

            if (endpointId) trackedIds.push(endpointId);

            // E. Trigger AI
            if (needsAnalysis && endpointId) {
                endpointEvents.emit('endpoint.analyze', endpointId);
                queuedCount++;
            }
        }

        // 3. Handle Deletions (The "Cleanup" Phase)
        // Find IDs that were in the DB but NOT in the scan we just processed
        const idsToDelete = [...activeEndpointIds].filter(id => !processedEndpointIds.has(id));

        for (const id of idsToDelete) {
            await this.endpointRepo.updateEndpoint(id, { deleted_at: new Date() });
        }

        return {
            user_message: 'Sync processed successfully',
            count: scanItems.length,
            queued_count: queuedCount,
            tracked_ids: trackedIds,
            deleted_count: idsToDelete.length // Useful for logs
        };
    }

    /**
     * ✅ NEW: POLLING SUPPORT
     * Used by CLI to check if the batch is done.
     */
    async checkBatchStatus(endpointIds: string[]) {
        // You might need to add 'countPending' to your Repository
        // For now, I'll simulate it using a filter if your repo supports it, 
        // or you can add a direct Prisma call here.

        // Assumption: endpointRepo.getEndpoints supports filtering by ID array
        const endpoints = await this.endpointRepo.getEndpoints({
            id: { in: endpointIds }
        });

        // @ts-ignore
        const pending = endpoints.filter(e => e.analysisStatus === 'PENDING').length;
        // @ts-ignore
        const failed = endpoints.filter(e => e.analysisStatus === 'FAILED').length;
        let user_message = pending === 0 ? 'Batch completed successfully' : 'Batch is still processing';
        if (pending > 0) {
            user_message += `, ${pending} endpoints arepending.`;
        }
        if (failed > 0) {
            user_message += `, ${failed} endpoints failed.`;
        }

        return {
            user_message: user_message,
            is_complete: pending === 0,
            pending,
            failed
        };
    }

    /**
     * MANUAL UPDATE (PATCH /:id)
     * Handles updating an endpoint by ID, including replacing its parameters/outputs.
     */
    async updateEndpoint(id: string, data: Partial<EndpointUpsertData>) {
        const existing = await this.endpointRepo.getEndpointById(id);
        if (!existing) throw new NotFoundError("Endpoint not found");

        // 1. Update the base Endpoint record
        const updated = await this.endpointRepo.updateEndpoint(id, {
            description: data.description,
            service_name: data.service_name,
            client_function_name: data.client_function_name,
            code_hash: data.code_hash,
            // @ts-ignore
            analysisStatus: data.analysisStatus,
            // @ts-ignore
            aiRawOutput: data.aiRawOutput,
            deleted_at: null
        });

        // 2. Handle Parameters (Only if provided)
        if (data.parameters) {
            await this.endpointRepo.deleteParametersForEndpoint(id);
            for (const param of data.parameters) {
                const schema = param.schema || (typeof param.type === 'object' ? param.type : (param.type ? { type: param.type } : undefined));
                if (!schema) continue;

                let locationEnum = 'QUERY';
                const rawLocation = (param.location || param.in || '').toUpperCase();
                if (['PATH', 'QUERY', 'HEADER', 'BODY'].includes(rawLocation)) locationEnum = rawLocation;

                await this.endpointRepo.createEndpointParameter({
                    endpoint: { connect: { id: id } },
                    name: param.name,
                    description: param.description || '',
                    required: param.required || false,
                    type: schema,
                    location: locationEnum as any,
                    default_value: String(param.default_value ?? param.schema?.default ?? "null"),
                });
            }
        }

        // 3. Handle Outputs (Only if provided)
        if (data.outputs) {
            await this.endpointRepo.deleteOutputsForEndpoint(id);
            for (const output of data.outputs) {
                let schema: any = output.return_json || (output?.type?.schema) || {};
                await this.endpointRepo.createEndpointOutput({
                    endpoint: { connect: { id: id } },
                    name: output.name || 'response',
                    description: output.description || '',
                    type: output.type || 'application/json',
                    status_code: output.status_code || 200,
                    return_json: schema,
                    examples: Array.isArray(output.examples) ? output.examples : []
                });
            }
        }

        return updated;
    }

    // --- STANDARD CRUD ---
    async createEndpoint(data: EndpointCreateInput) {
        return this.endpointRepo.registerEndpoint(data);
    }
    async listEndpoints(filters: Prisma.EndpointWhereInput = {}) {
        const where: Prisma.EndpointWhereInput = {
            ...filters,
            deleted_at: null  // Enforce not deleted
        };
        return this.endpointRepo.getEndpoints(where);
    }
    async getEndpointById(id: string) { return this.endpointRepo.getEndpointById(id); }

    async markEndpointForDeletion(id: string) {
        const existing = await this.endpointRepo.getEndpointById(id);
        if (!existing) throw new NotFoundError("Endpoint not found");
        await this.endpointRepo.updateEndpoint(id, { deleted_at: new Date() });
    }

    async restoreEndpoint(id: string) {
        const existing = await this.endpointRepo.getEndpointById(id);
        if (!existing) throw new NotFoundError("Endpoint not found");
        return this.endpointRepo.updateEndpoint(id, { deleted_at: null });
    }

    async addPermissionRequirement(id: string, permId: string) {
        return this.endpointRepo.updateEndpoint(id, { required_permission_ids: { push: permId } });
    }

    async removePermissionRequirement(id: string, permId: string) {
        const ep = await this.getEndpointById(id);
        if (!ep) return null;
        return this.endpointRepo.updateEndpoint(id, {
            required_permission_ids: ep.required_permission_ids.filter((i: string) => i !== permId)
        });
    }

    async buildOpenApiSpec(appContext: { name: string, version: string }, prismaSchemaJson: string) {
        const endpoints = await this.listEndpoints({});

        const spec = await generateOpenApiSpecDeterministic(
            appContext,
            endpoints,
            prismaSchemaJson,
        );

        return spec;
    }
}