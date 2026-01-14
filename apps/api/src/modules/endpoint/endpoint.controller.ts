// FILE PATH: src/modules/endpoint/endpoint.controller.ts
import { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { NotFoundError } from '../../types/http_errors';
import serializeObjectBeforeSending from '../../utilities/serialize_object_before_sending';
import { EndpointService } from './endpoint.service';

export class EndpointController {
    private endpointService = new EndpointService();

    public syncEndpoints = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { app_id, scan_items, enhanced } = req.body;

            // Returns { tracked_ids: [...] } so the CLI knows what to pollx
            const result = await this.endpointService.syncFromScan(app_id, scan_items, enhanced || false);

            let statusCode = 200;
            if (result.queued_count > 0) {
                statusCode = 202;
            }
            return res.status(200).json({
                ...result
            });
        } catch (error) {
            next(error);
        }
    };

    public checkBatchStatus = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { ids } = req.query;

            const status = await this.endpointService.checkBatchStatus(ids as string[]);

            return res.status(200).json(status);
        } catch (error) {
            next(error);
        }
    };

    public getOpenApiSpec = async (req: Request, res: Response, next: NextFunction) => {
        try {
            // Read the generated Prisma JSON Schema
            const jsonSchemaPath = path.join(__dirname, '../../generated/json-schema/json-schema.json');

            let prismaSchemaJson = "{}";
            if (fs.existsSync(jsonSchemaPath)) {
                prismaSchemaJson = fs.readFileSync(jsonSchemaPath, 'utf-8');
            } else {
                console.warn(`[getOpenApiSpec] Warning: JSON schema not found at ${jsonSchemaPath}`);
            }

            const openApiSpec = await this.endpointService.buildOpenApiSpec(
                { name: "Generated API Documentation", version: "1.0.0" },
                prismaSchemaJson
            );

            return res.status(200).json(openApiSpec);
        } catch (error) {
            next(error);
        }
    };


    public listEndpoints = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const filters = req.query || {};
            // Pass filters directly (Service typically expected { appId } but we will update it to accept Prisma input)
            const endpoints = await this.endpointService.listEndpoints(filters);

            return res.json({ endpoints });
        } catch (error) {
            next(error);
        }
    };

    public getEndpointById = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { endpointId } = req.params;
            const endpoint = await this.endpointService.getEndpointById(endpointId);

            if (!endpoint) {
                throw new NotFoundError("Endpoint not found");
            }

            return res.status(200).json({
                user_message: 'Endpoint found',
                endpoint: serializeObjectBeforeSending(endpoint),
            });
        } catch (error) {
            next(error);
        }
    };

    public createEndpoint = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const endpointData = req.body;

            const endpoint = await this.endpointService.createEndpoint(endpointData);
            return res.status(201).json({
                user_message: 'Endpoint created successfully!',
                endpoint: serializeObjectBeforeSending(endpoint)
            });

        } catch (error) {
            next(error);
        }
    };

    public updateEndpoint = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const data = req.body;

            // Service updateEndpoint expects Partial<EndpointUpsertData> (mostly matching our custom schema)
            const updatedEndpoint = await this.endpointService.updateEndpoint(id, data);

            return res.status(200).json({
                user_message: 'Endpoint updated successfully!',
                endpoint: serializeObjectBeforeSending(updatedEndpoint)
            });
        } catch (error) {
            next(error);
        }
    };

    public deleteEndpoint = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            await this.endpointService.markEndpointForDeletion(id);

            return res.status(200).json({
                user_message: 'Endpoint marked as deleted successfully!',
            });
        } catch (error) {
            next(error);
        }
    };

    public restoreEndpoint = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const restoredEndpoint = await this.endpointService.restoreEndpoint(id);

            return res.status(200).json({
                user_message: 'Endpoint restored successfully!',
                endpoint: serializeObjectBeforeSending(restoredEndpoint)
            });
        } catch (error) {
            next(error);
        }
    };


    public addPermissionRequirement = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { endpointId, permissionId } = req.params;

            const endpoint = await this.endpointService.addPermissionRequirement(endpointId, permissionId);

            return res.status(200).json({
                user_message: 'Endpoint updated successfully!',
                endpoint: serializeObjectBeforeSending(endpoint),
            });
        } catch (error) {
            next(error);
        }
    };

    public removePermissionRequirement = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { endpointId, permissionId } = req.params;

            const endpoint = await this.endpointService.removePermissionRequirement(endpointId, permissionId);

            return res.status(200).json({
                user_message: 'Endpoint updated successfully!',
                endpoint: serializeObjectBeforeSending(endpoint),
            });
        } catch (error) {
            next(error);
        }
    };
}