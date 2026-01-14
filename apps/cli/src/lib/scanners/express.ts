import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class ExpressScanner {
  constructor(private projectRoot: string, private entryFile: string) { }

  async scan(envFile?: string) {
    const tempFileName = '.1x1-express-inspector.ts';
    const tempFilePath = path.join(this.projectRoot, tempFileName);
    const entryImport = path.relative(this.projectRoot, path.resolve(this.projectRoot, this.entryFile)).replace(/\.ts$/, '');

    // 1. INLINE ROUTE PARSER (No external dependencies needed!)
    // This function recursively dives into the Express stack to find routes.
    const INJECTED_CODE = `// @ts-nocheck
      const fs = require('fs');
      const path = require('path');
      
      // 1. SETUP THE TRAP
      const expressPath = require.resolve('express');
      const originalExpress = require(expressPath);
      
      let capturedApp = null;

      function expressSpy() {
          const app = originalExpress();
          capturedApp = app; 
          const originalListen = app.listen.bind(app);
          app.listen = function(...args) {
              console.log('🛑 [Scanner] Suppressed app.listen()');
              return { close: () => {} };
          };
          return app;
      }
      Object.assign(expressSpy, originalExpress);
      require.cache[expressPath].exports = expressSpy;

      // --- HELPER: Traverse Express Stack ---
      function getRoutes(app) {
         const routes = [];

         // 👇 UPDATED CLEANER: Aggressively removes Regex Groups and Artifacts
         function cleanPath(path) {
             if (!path) return '';
             let p = path;

             // 1. Remove anchors (^ and $)
             p = p.replace(/^\\^/, '').replace(/\\$$/, '');
             
             // 2. Remove specific Express artifacts
             // Matches (/|) which usually means "slash or empty" -> Replace with "/"
             p = p.replace(/\\(\\/\\|\\)/g, '/'); 
             // Matches (?=...) lookaheads -> Remove
             p = p.replace(/\\(\\?=[^)]+\\)/g, ''); 
             // Matches (?:...) non-capturing -> Remove the group, keep content
             p = p.replace(/\\(\\?:/g, ''); 
             
             // 3. Clean standard regex chars
             p = p.replace(/\\\\\\//g, '/'); // Replace escaped slash \/ with /
             p = p.replace(/\\\\/g, '');     // Remove remaining backslashes
             p = p.replace(/[?^$]/g, '');    // Remove modifiers
             p = p.replace(/[()|]/g, '');    // Remove remaining parens and pipes

             // 4. Final Polish
             p = p.replace(/\\/\\//g, '/');  // Fix double slashes
             if (p.length > 1) p = p.replace(/\\/$/, ''); // Remove trailing slash
             
             return p;
         }

         function print(path, layer) {
            if (layer.route) {
              layer.route.stack.forEach((stackItem) => {
                  const fullPath = path + layer.route.path;
                  routes.push({
                      path: cleanPath(fullPath),
                      method: stackItem.method.toUpperCase()
                  });
              });
            } else if (layer.name === 'router' && layer.handle.stack) {
              layer.handle.stack.forEach((subLayer) => {
                  let mountPath = '';
                  if (layer.regexp) {
                      const source = layer.regexp.source;
                      if (source !== '^\\\\/?$' && source !== '^\\\\/?(?=\\\\/|$)' ) {
                          mountPath = source;
                      }
                  }
                  print(path + mountPath, subLayer);
              });
            }
         }

         if (app._router && app._router.stack) {
             app._router.stack.forEach((layer) => print('', layer));
         }
         return routes;
      }

      async function run() {
        try {
          require('./${entryImport}');

          if (!capturedApp) {
             console.log('---ERROR---'); 
             console.error('App executed, but express() was never called.');
             process.exit(1);
          }

          setTimeout(() => {
              const endpoints = getRoutes(capturedApp);
              console.log('---JSON_START---');
              console.log(JSON.stringify(endpoints));
              console.log('---JSON_END---');
              process.exit(0);
          }, 1500);

        } catch (err) {
          console.log('---ERROR---');
          console.error(err);
          process.exit(1);
        }
      }

      run();
    `;

    try {
      fs.writeFileSync(tempFilePath, INJECTED_CODE);

      // Execute via ts-node
      const envFlag = envFile ? `-e ${envFile}` : '';
      const { stdout } = await execAsync(
        `npx dotenv ${envFlag} -- ts-node -r tsconfig-paths/register ${tempFileName}`,
        {
          cwd: this.projectRoot,
          maxBuffer: 1024 * 1024 * 10
        }
      );

      // Parse Output
      const jsonStr = stdout.split('---JSON_START---')[1]?.split('---JSON_END---')[0];
      if (!jsonStr) throw new Error('Failed to capture output. Check app compilation.');

      return JSON.parse(jsonStr);

    } finally {
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    }
  }
}