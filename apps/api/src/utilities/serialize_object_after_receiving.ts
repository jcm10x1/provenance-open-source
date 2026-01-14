import { convertBigIntToString, toSnakeCase } from '@onexone/core';
import { NextFunction, Request, Response } from 'express';

export default function serializeObjectAfterRecieving(req: Request, res: Response, next: NextFunction): void {
    if (req.body) {
        const serializedBody = Array.isArray(req.body) 
            ? req.body.map(item => ({
                ...convertBigIntToString(item),
                ...toSnakeCase(item)
            }))
            : {
                ...convertBigIntToString(req.body),
                ...toSnakeCase(req.body)
            };
            
        req.body = serializedBody;
    }
    
    next();
}