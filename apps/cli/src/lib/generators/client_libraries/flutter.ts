import chalk from 'chalk';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export function generateFlutter(specPath: string, outDir: string, appId: string) {
  console.log(chalk.blue('📱 Generating Dart client (swagger_parser)...'));

  // 1. Create the YAML config dynamically
  const tempConfigPath = path.join(process.cwd(), 'swagger_parser_temp.yaml');

  const yamlContent = `swagger_parser:
  schema_path: "${specPath}"
  headers:
    X-App-Id: "${appId}"
  output_directory: ${outDir}
  json_serializer: freezed
  use_freezed3: true
  add_openapi_metadata: true
  root_client: false
  put_clients_in_folder: false
  merge_clients: true
  dio_options_parameter_by_default: true
  path_method_name: false
  name: one_x_one_api
`;

  fs.writeFileSync(tempConfigPath, yamlContent);
  console.log(chalk.gray(`   Created temp config: ${tempConfigPath}`));

  try {
    // 2. Run swagger_parser
    console.log(chalk.cyan('   Running swagger_parser...'));
    execSync(`dart run swagger_parser -f "${tempConfigPath}"`, { stdio: 'inherit' });

    // 3. Run build_runner
    console.log(chalk.cyan('   Running build_runner...'));
    execSync(`dart run build_runner build --delete-conflicting-outputs`, {
      stdio: 'inherit',
    });

    console.log(chalk.green(`✅ Mobile Client generated in: ${outDir}`));
  } catch (error) {
    throw error;
  } finally {
    // Cleanup
    if (fs.existsSync(tempConfigPath)) fs.unlinkSync(tempConfigPath);
  }
}