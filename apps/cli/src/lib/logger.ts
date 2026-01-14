// src/logic/logger.ts
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';

export function saveLocalLogs(scanItems: any[]) {
    const runId = new Date().toISOString().replace(/[:.]/g, "-");
    const logDir = path.join(process.cwd(), '.1x1', 'logs', 'provenance', runId);
    
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }

    console.log(chalk.dim(`📝 Writing debug logs to ${logDir}...`));

    scanItems.forEach(item => {
        const safePath = item.path.replace(/\//g, '-').replace(/[^a-zA-Z0-9-]/g, '');
        const filename = `${item.method.toUpperCase()}_${safePath}.md`;
        
        // 👇 ADDED CODE BLOCK BACK
        const fileContent = `
# Endpoint Analysis
**Method:** ${item.method}
**Path:** ${item.path}
**Date:** ${new Date().toISOString()}

## 1. Runtime Middleware
\`\`\`json
${JSON.stringify(item.middleware, null, 2)}
\`\`\`

## 2. Matched Source Code
\`\`\`typescript
${item.code || '// No matching source code found'}
\`\`\`

## 3. Schema Context
\`\`\`prisma
${item.relevent_schema || 'No schema context found'}
\`\`\`
`; 
        fs.writeFileSync(path.join(logDir, filename), fileContent);
    });

    console.log(chalk.green(`✅ Created local log files.`));
}