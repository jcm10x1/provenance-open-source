import express from 'express';
import { validate } from '../../middleware/validate.middleware';
import { EndpointController } from './endpoint.controller';
import {
    CreateEndpointRequestSchema,
    SyncEndpointsRequestSchema,
    UpdateEndpointRequestSchema
} from './endpoint.schema';

const router = express.Router();
const controller = new EndpointController();

// List endpoints
router.get('/', controller.listEndpoints);

// Check batch status
router.get('/batch-status', controller.checkBatchStatus);

// Get openapi spec
router.get('/openapi-spec', controller.getOpenApiSpec);

// Get endpoint by ID
router.get('/:endpointId', controller.getEndpointById);

// Add permission requirement
router.post('/:endpointId/:permissionId', controller.addPermissionRequirement);

// Remove permission requirement
router.delete('/:endpointId/:permissionId', controller.removePermissionRequirement);

// Create endpoint
router.post('/', validate(CreateEndpointRequestSchema, 'body'), controller.createEndpoint);

// Update endpoint
router.patch('/:id', validate(UpdateEndpointRequestSchema, 'body'), controller.updateEndpoint);

// Delete endpoint (soft delete)
router.delete('/:id', controller.deleteEndpoint);

// Restore endpoint
router.put('/restore/:id', controller.restoreEndpoint);

// Sync endpoints
router.post('/sync', validate(SyncEndpointsRequestSchema, 'body'), controller.syncEndpoints);

export default router;