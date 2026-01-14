import chalk from 'chalk';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export function generateNpm(specPath: string, outDir: string, packageName: string) {
  console.log(chalk.blue('🌍 Generating TypeScript/Axios client...'));

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  // 1. Generate to a temp directory to avoid polluting the root or src with package.json
  const tempDir = path.join(outDir, '.gen-tmp');
  if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
  fs.mkdirSync(tempDir, { recursive: true });

  const relativeSpecPath = path.relative(process.cwd(), specPath);
  const relativeTempDir = path.relative(process.cwd(), tempDir);

  const args = [
    '@openapitools/openapi-generator-cli',
    'generate',
    '-i', relativeSpecPath,
    '-g', 'typescript-axios',
    '-o', relativeTempDir,
    '--skip-validate-spec',
    `--additional-properties=enumPropertyNaming=original,npmName=${packageName},supportsES6=true,withSeparateModelsAndApi=true,apiPackage=api,modelPackage=models,apiNameSuffix=`,
    '--global-property', 'apiTests=false,modelTests=false,apiDocs=false,modelDocs=false',
  ];

  try {
    const result = spawnSync('npx', args, { stdio: 'inherit', encoding: 'utf-8' });

    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`Generator exited with code ${result.status}`);

    // 2. Move ONLY source files to the actual src directory
    // We want: *.ts, api/, models/
    // We DO NOT want: package.json, tsconfig.json, .gitignore, etc.

    // Ensure src exists
    const srcDir = path.join(outDir, 'src');
    if (!fs.existsSync(srcDir)) fs.mkdirSync(srcDir, { recursive: true });

    // Copy *.ts files
    const files = fs.readdirSync(tempDir);
    for (const file of files) {
      const srcPath = path.join(tempDir, file);
      const destPath = path.join(srcDir, file);
      const stat = fs.statSync(srcPath);

      if (stat.isFile() && file.endsWith('.ts')) {
        fs.copyFileSync(srcPath, destPath);
      } else if (stat.isDirectory() && (file === 'api' || file === 'models')) {
        // Recursive copy for directories
        // Remove destination first to prevent nesting (e.g. api/api)
        if (fs.existsSync(destPath)) {
          fs.rmSync(destPath, { recursive: true, force: true });
        }
        // Using cpSync (Node 16.7.0+) or fallback to shell for simplicity in this env
        spawnSync('cp', ['-R', srcPath, destPath]);
      }
    }

    // 3. Cleanup temp dir
    fs.rmSync(tempDir, { recursive: true, force: true });

    console.log(chalk.green(`✅ Web Client generated in: ${srcDir}`));
  } catch (error) {
    throw error;
  }
}