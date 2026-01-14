// FILE PATH: src/modules/endpoint/endpoint.repository.ts
import { Endpoint, EndpointOutput, EndpointParameter, HttpMethod, Prisma } from "@prisma_client";

import prisma from '../../prisma';

/**
 * Repository Layer: Handles raw database operations for the Endpoint resource.
 */
export class EndpointRepository {
  async findEndpointByMethodAndPath(appId: string, method: HttpMethod, path: string): Promise<Endpoint | null> {
    return prisma.endpoint.findFirst({ where: { app_id: appId, method: method, path: path } });
  }

  async registerEndpoint(data: Prisma.EndpointCreateInput): Promise<Endpoint> {
    return prisma.endpoint.create({ data });
  }

  async updateEndpoint(endpointId: string, data: Prisma.EndpointUpdateInput): Promise<Endpoint> {
    return prisma.endpoint.update({
      where: { id: endpointId },
      data,
    });
  }

  async getEndpoints(filter: Prisma.EndpointWhereInput = {}): Promise<Endpoint[]> {
    return prisma.endpoint.findMany({
      where: filter,
      include: {
        parameters: true,
        outputs: true
      }
    });
  }

  async hardDeleteEndpoint(endpointId: string): Promise<void> {
    await prisma.endpoint.delete({ where: { id: endpointId } });
  }

  async getEndpointById(endpointId: string): Promise<Endpoint | null> {
    return prisma.endpoint.findUnique({
      where: { id: endpointId },
      include: {
        parameters: true,
        outputs: true
      }
    });
  }

  async deleteParametersForEndpoint(endpointId: string): Promise<void> {
    await prisma.endpointParameter.deleteMany({ where: { endpoint_id: endpointId } });
  }

  async createEndpointParameter(data: Prisma.EndpointParameterCreateInput): Promise<EndpointParameter> {
    return prisma.endpointParameter.create({ data });
  }

  async deleteOutputsForEndpoint(endpointId: string): Promise<void> {
    await prisma.endpointOutput.deleteMany({ where: { endpoint_id: endpointId } });
  }

  async createEndpointOutput(data: Prisma.EndpointOutputCreateInput): Promise<EndpointOutput> {
    return prisma.endpointOutput.create({ data });
  }

  async getEndpointsForDocumentation() {
    return prisma.endpoint.findMany({
      where: { deleted_at: null },
      include: {
        outputs: true,
        parameters: true,
      },
    });
  }
}