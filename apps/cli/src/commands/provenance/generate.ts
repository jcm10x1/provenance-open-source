import { Config, Flags } from '@oclif/core';
import { EndpointService } from '@onexone/api-client';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { BaseCommand } from '../../lib/base_command.js';
import { generateFlutter } from '../../lib/generators/client_libraries/flutter.js';
import { generateNpm } from '../../lib/generators/client_libraries/npm.js';
import { Target } from '../../lib/types/Target.js';

export default class Generate extends BaseCommand {
  static description = 'Generate API clients (Web/Mobile) or download the OpenAPI spec.';

  private endpointApi: EndpointService;

  constructor(argv: string[], config: Config) {
    super(argv, config);
    this.endpointApi = new EndpointService(this.apiConfig);
  }

  static flags = {
    ...BaseCommand.baseFlags,
    target: Flags.string({
      char: 't',
      description: 'What to generate',
      options: Object.values(Target),
      default: Target.SPEC_ONLY,
    }),
    output: Flags.string({
      char: 'o',
      description: 'Output directory or file path',
      required: true,
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Skip status check and generate immediately',
    }),
    appId: Flags.string({
      char: 'a',
      description: 'App ID',
      required: true,
    }),
    packageName: Flags.string({
      char: 'p',
      description: 'Package name for NPM generation',
      required: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Generate);
    await this.init(); // 👈 Sets up this.apiConfig with Headers & Auth

    const appId = flags.appId;
    const packageName = flags.packageName;

    // Validation
    if (flags.target === Target.NPM && !packageName) {
      this.error(chalk.red('Package name (-p) is required for NPM generation'));
    }

    this.log(chalk.blue(`🔎 Checking analysis status for App: ${appId}...`));

    // 1. POLL (Uses internal method now)
    if (!flags.force) {
      try {
        await this.pollForCompletion(appId);
      } catch (e: any) {
        this.error(`Status check failed: ${e.message}`);
      }
    } else {
      this.log(chalk.yellow('⏩ Skipping status check (--force).'));
    }

    // 2. DOWNLOAD SPEC (Using Client Library)
    this.log(chalk.blue(`📥 Downloading OpenAPI Spec...`));

    let spec: any;

    try {
      const basePath = this.apiConfig.basePath || 'http://localhost:8080';
      const url = `${basePath}/v2/endpoints/openapi-spec`;
      const headers = this.apiConfig.baseOptions?.headers || {};

      const response = await this.endpointApi.getOpenApiSpec({
        params: {
          appId: appId
        }
      });
      console.log("getOpenApiSpec response status:", response.status);
      spec = response.data;

    } catch (error: any) {
      this.error(chalk.red(`Download failed: ${error.message}`));
    }

    // Prepare paths
    const outputPath = path.resolve(process.cwd(), flags.output);
    const tempSpecPath = path.join(process.cwd(), 'temp-spec.json');
    fs.writeFileSync(tempSpecPath, JSON.stringify(spec, null, 2));

    try {
      // 3. EXECUTE GENERATOR
      switch (flags.target) {
        case Target.SPEC_ONLY:
          fs.copyFileSync(tempSpecPath, outputPath);
          this.log(chalk.green(`✅ Saved OpenAPI spec to: ${outputPath}`));
          break;

        case Target.NPM:
          generateNpm(tempSpecPath, outputPath, packageName!);
          break;

        case Target.FLUTTER:
          generateFlutter(tempSpecPath, outputPath, appId);
          break;
      }
    } catch (e: any) {
      this.error(chalk.red(`Generation failed: ${e.message}`));
    } finally {
      if (fs.existsSync(tempSpecPath)) fs.unlinkSync(tempSpecPath);
    }
  }

  /**
   * Internal polling logic using the API Client
   */
  private async pollForCompletion(appId: string, maxAttempts = 30): Promise<void> {

    // TODO: Implement polling logic
    //const status = await this.endpointApi.();

    for (let i = 0; i < maxAttempts; i++) {
      // 1. Check Status
      // const res = await statusApi.getAnalysisStatus(); 
      // const status = res.data.status; 

      // MOCK implementation until you confirm the endpoint name:
      const status = 'COMPLETED'; // Placeholder

      if (status === 'COMPLETED') {
        return;
      }

      if (status === 'FAILED') {
        throw new Error('Analysis failed on server.');
      }

      // Wait 2 seconds
      await new Promise(resolve => setTimeout(resolve, 2000));
      process.stdout.write('.');
    }

    throw new Error('Timeout waiting for analysis to complete.');
  }
}