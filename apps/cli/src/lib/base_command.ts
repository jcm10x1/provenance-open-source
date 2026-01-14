import { Command, Config } from '@oclif/core';
import { Configuration } from '@onexone/api-client';
import chalk from 'chalk';

export abstract class BaseCommand extends Command {
  protected apiConfig: Configuration;

  constructor(argv: string[], config: Config) {
    super(argv, config);
    this.apiConfig = new Configuration({
      basePath: 'http://localhost:8080',
      baseOptions: {
        headers: {
          'X-App-Id': '',
        },
      },
    });
  }

  public async init(): Promise<void> {
    await super.init();

    this.log(chalk.dim('---------------------------------------------------'));
    this.log(chalk.dim(`🌍 Env      : ${process.env.NODE_ENV || 'development'}`));
    this.log(chalk.dim(`🔗 API URL  : ${this.apiConfig.basePath}`));
    this.log(chalk.dim(`📦 Version  : ${this.config.version}`));
    this.log(chalk.dim('---------------------------------------------------'));
  }

  // 👇 CENTRALIZED ERROR HANDLER
  public async catch(error: any): Promise<any> {
    // 1. Handle normal exits (e.g. this.exit(0))
    if (error.code === 'EEXIT') {
      throw error;
    }

    // 2. Check for Oclif Parser Errors (missing flags, invalid args)
    // Oclif errors usually have a specific code or structure we can check.
    const isParserError = error.code === 'REQUIRED_FLAG'
      || error.code === 'INVALID_FLAG_ARGUMENT'
      || (error.message && error.message.includes('Missing required flag'));

    // 3. Format the Output
    if (isParserError) {
      this.log('');
      this.log(chalk.red.bold('🚫 Invalid Usage'));
      this.log(chalk.red(`   ${error.message}`));
      this.log('');
      this.log(chalk.cyan(`💡 Tip: Run with ${chalk.bold('--help')} to see available options.`));
      this.log('');
    } else {
      // General Application Errors (API failures, logic bugs)
      this.log('');
      this.log(chalk.red.bold('❌ Error'));
      this.log(chalk.red(`   ${error.message}`));

      // Optional: Print stack trace only if VERBOSE or DEV is set
      if (process.env.NODE_ENV === 'development' || process.env.VERBOSE) {
        this.log(chalk.dim(error.stack));
      }
      this.log('');
    }

    // 4. Force non-zero exit code
    return this.exit(1);
  }
}