// FILE PATH: src/routes/api.routes.ts
import express from 'express';

import endpointRoutes from '../modules/endpoint/endpoint.routes';

const router = express.Router();

const V2 = express.Router();

V2.use('/endpoints', endpointRoutes);

router.use('/v2', V2);

export default router;