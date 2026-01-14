import { Command, Help, Interfaces } from '@oclif/core';
import chalk from 'chalk';

export default class CustomHelp extends Help {
  
  // 1. HEADER: Branding at the top
  protected formatRoot(): string {
    return `
${chalk.bold('1x1 CLI')}
${chalk.dim('To access flags for a specific command, run:')}
${chalk.dim('1x1 [command] --help\n')}
${super.formatRoot()}
`;
  }

  // 2. COMMANDS: Styling for specific commands (e.g., 1x1 scan --help)
  protected formatCommand(command: Command.Loadable): string {
    // Generate the standard output (which includes our custom flags() below)
    let output = super.formatCommand(command);

    // Style "USAGE" header
    output = output.replace('USAGE', chalk.bold.yellow('USAGE'));

    // Highlight the command description in Cyan
    if (command.description) {
      output = output.replace(command.description, chalk.cyan(command.description));
    }

    return output;
  }

  // 3. TOPICS: Ensure flags print for Topic-Commands (e.g., 1x1 provenance --help)
  protected formatTopic(topic: Interfaces.Topic): string {
    // Standard Topic Output (Description + Subcommands)
    let output = super.formatTopic(topic);

    // Check if this Topic is ALSO a Command (e.g. src/commands/provenance/index.ts)
    const cmd = this.config.findCommand(topic.name);

    // If it is a command and has flags, manually append the flags table
    if (cmd && cmd.flags) {
      const flagsArray = Object.entries(cmd.flags).map(([name, def]) => ({
        ...def,
        name,
      }));

      // Only print if there are actual flags
      if (flagsArray.length > 0) {
        output += this.flags(flagsArray);
      }
    }

    return output;
  }

  // 4. FLAGS: The "Amazing" formatting logic
  protected flags(flags: any[]): string | undefined {
    if (flags.length === 0) return;

    const body = flags
      .map((flag) => {
        // Left Column: -f, --force
        let left = flag.char ? `-${flag.char}, --${flag.name}` : `    --${flag.name}`;
        left = chalk.green(left.padEnd(25)); 

        // Right Column: Description + Required/Default
        let right = flag.description || '';
        
        if (flag.required) right += chalk.red(' (REQUIRED)');
        if (flag.default) right += chalk.dim(` [default: ${flag.default}]`);

        return ` ${left} ${right}`;
      })
      .join('\n');

    // Return the styled header and body directly
    return `\n${chalk.bold.yellow('AVAILABLE FLAGS')}\n${body}\n`;
  }
}