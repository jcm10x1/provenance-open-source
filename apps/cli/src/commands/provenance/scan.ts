import { Config, Flags } from '@oclif/core';
import { EndpointService } from '@onexone/api-client';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { BaseCommand } from '../../lib/base_command.js';
import { saveLocalLogs } from '../../lib/logger.js';
import { Scanner } from '../../lib/scanners/index.js';

export default class Scan extends BaseCommand {
  static description = 'Scan local source code and upload for analysis.';

  private endpointApi: EndpointService;

  constructor(argv: string[], config: Config) {
    super(argv, config);
    this.endpointApi = new EndpointService(this.apiConfig);
  }

  static flags = {
    ...BaseCommand.baseFlags,
    entry: Flags.string({ char: 'f', description: 'Entry path (e.g., apps/api)', required: true }),
    dryRun: Flags.boolean({ char: 'd', description: 'Preview collected data without uploading' }),
    logs: Flags.boolean({ char: 'l', description: 'Save local log files', default: true }),
    appId: Flags.string({ char: 'a', description: 'App ID of the application to scan', required: true, env: 'PROVENANCE_SCAN_APP_ID' }),
    enhanced: Flags.boolean({ char: 'e', description: 'Force AI analysis', default: false }),
  };

  private findProjectRoot(startPath: string): string {
    let currentDir = startPath;
    // Check if startPath is a file, if so, start from its directory
    if (fs.existsSync(startPath) && fs.statSync(startPath).isFile()) {
      currentDir = path.dirname(startPath);
    }

    // Walk up 5 levels max to find package.json
    for (let i = 0; i < 5; i++) {
      if (fs.existsSync(path.join(currentDir, 'package.json'))) {
        return currentDir;
      }
      const parent = path.dirname(currentDir);
      if (parent === currentDir) break; // Reached system root
      currentDir = parent;
    }
    return startPath; // Fallback
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(Scan);

    const resolvedEntry = path.resolve(process.cwd(), flags.entry);
    const projectRoot = this.findProjectRoot(resolvedEntry);

    this.log(chalk.blue(`🔎 Initializing Scanner in: ${projectRoot}`));

    // 👇 FIX: Pass 'projectRoot' instead of 'process.cwd()'
    // This ensures the scanner looks for package.json in the API folder, not the CLI folder.
    const scanner = new Scanner(projectRoot, flags.entry);

    // Note: Assuming 'flags.env' comes from BaseCommand. If not, default to 'development'
    const env = (flags as any).env || process.env.NODE_ENV || 'development';
    const scanItems = await scanner.scan(env);

    if (!scanItems || scanItems.length === 0) {
      this.warn('⚠️ No endpoints found.');
      return;
    }

    this.log(chalk.green(`🚀 Found ${scanItems.length} endpoints.`));

    // 2. LOGGING (Do this before Dry Run exit so we can debug)
    if (flags.logs) {
      console.log('DEBUG: Attempting to save logs to', path.join(process.cwd(), '.1x1'));
      saveLocalLogs(scanItems);
    }

    // 3. DRY RUN (Exit early)
    if (flags.dryRun) {
      this.log(chalk.yellow('\n📝 DRY RUN: Listing detected endpoints (No upload)'));
      console.table(scanItems.map((i: any) => ({ method: i.method, path: i.path })));
      return;
    }


    // 4. UPLOAD
    try {
      await this.endpointApi.syncEndpoints({
        app_id: flags.appId,
        enhanced: flags.enhanced,
        scan_items: scanItems.map((i: any) => ({
          ...i,

        }))
      });
      // await fetch('http://localhost:8080/v2/endpoints/sync', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'X-App-Id': flags.appId,
      //   },
      //   body: JSON.stringify({
      //     app_id: flags.appId,
      //     enhanced: flags.enhanced,
      //     scan_items: scanItems.map((i: any) => ({
      //       ...i,

      //     }))
      //   })
      // });

    } catch (error: any) {
      // 👇 ADD THIS DEBUGGING BLOCK
      console.log('\n❌ UPLOAD FAILED DETAILS:');
      console.log('Code:', error.code);
      console.log('Message:', error.message);
      if (error.response) {
        console.log('Server Status:', error.response.status);
        console.log('Server Data:', JSON.stringify(error.response.data));
      }
      throw error; // Re-throw to exit
    }
  }
}