// FILE PATH: src/index.ts
// import { withOptimize } from "@prisma/extension-optimize";
import cors from 'cors';
import express from 'express';
import router from "./routes/api.routes";

import prisma from './prisma';

const PORT = process.env.PORT || 8080;


const app = express();

const cleanup = async () => {
  console.log('Closing Prisma client...');
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);



app.get('/test', (req, res) => {
  res.send("I'm Alive!");
});

// --- 2. GLOBAL MIDDLEWARE (from old index.ts) ---
app.use(cors());
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ limit: '200mb', extended: true }));

// --- 3. MODULAR ROUTES ---
app.use('/', router);

// app.use(errorHandler);

app.listen(Number(PORT), async () => {
  console.log(`Server running on port ${PORT}`);

});

