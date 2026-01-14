import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { Node, Project, SyntaxKind } from 'ts-morph';
import ScanResult from '../types/ScanResult.js';
import { ExpressScanner } from './express.js';

/**
 * The "Manager" Scanner.
 * Recursively extracts code context (Route -> Controller -> Service).
 */
export class Scanner {
    private projectRoot: string;
    private entryFile: string;
    private project?: Project;

    // Safety: Prevent infinite loops or massive payloads
    private readonly MAX_DEPTH = 4;

    constructor(projectRoot: string = process.cwd(), entryFile: string = 'src/index.ts') {
        this.projectRoot = projectRoot;
        this.entryFile = entryFile;
    }

    public async scan(envFile?: string) {
        const framework = this.detectFramework();
        if (framework === 'express') {
            console.log(chalk.green('✅ Detected Express.js'));
            return this.scanExpress(envFile);
        }
        if (framework === 'nestjs') {
            console.log(chalk.yellow('🚧 NestJS detected (Support coming soon)'));
            return [];
        }
        throw new Error('❌ Unsupported framework. Currently supporting: Express');
    }

    private async scanExpress(envFile?: string): Promise<ScanResult[]> {
        console.log(chalk.blue('🕵️  Running Runtime Analysis (Spying on routes)...'));
        const runtimeEngine = new ExpressScanner(this.projectRoot, this.entryFile);
        const runtimeEndpoints = await runtimeEngine.scan(envFile);

        console.log(chalk.blue('📖 Running Deep Static Analysis (Controller -> Service -> Repo)...'));
        const staticEndpoints = this.performStaticCodeAnalysis();
        const schema = this.getDomainContext();

        console.log(chalk.blue('🔗 Correlating Runtime Routes with Deep Source Code...'));

        return runtimeEndpoints.map((runtimePt: any) => {
            // Sanitize Path: Remove regex artifacts (e.g. [/]+ from Express)
            // 1. Remove [/]+ (often used for optional slashes)
            // 2. Normalize duplicate slashes
            let cleanPath = runtimePt.path
                .replace(/\[\/?\]\+/g, '')  // Remove [/]+
                .replace(/\/{2,}/g, '/');   // Fix // -> /

            // Should not end in slash unless root
            if (cleanPath.length > 1 && cleanPath.endsWith('/')) {
                cleanPath = cleanPath.slice(0, -1);
            }

            // Temporarily patch the object for matching
            const runtimeForMatch = { ...runtimePt, path: cleanPath };

            const match = this.findBestMatch(runtimeForMatch, staticEndpoints);

            return {
                path: cleanPath, // Return the CLEAN path
                method: runtimePt.method,
                middleware: runtimePt.middleware || [],
                relevent_schema: schema,
                current_hash: runtimePt.current_hash,
                file_path: runtimePt.file_path,
                start_line: runtimePt.start_line,
                end_line: runtimePt.end_line,
                // Now contains the full call chain
                code: match ? match.code : '// Source code not found (Dynamic or complex route)'
            } as ScanResult;
        });
    }

    /**
     * Scans for route definitions and recursively resolves the entire call chain.
     */
    private performStaticCodeAnalysis() {
        if (!this.project) {
            this.project = new Project({
                tsConfigFilePath: path.join(this.projectRoot, 'tsconfig.json'),
                skipAddingFilesFromTsConfig: false,
            });
        }

        const results: any[] = [];
        const sourceFiles = this.project.getSourceFiles();

        for (const sourceFile of sourceFiles) {
            const calls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);

            for (const call of calls) {
                const expr = call.getExpression();
                if (!expr) continue;

                const lastProp = expr.getLastChildByKind(SyntaxKind.Identifier);
                if (!lastProp) continue;

                const method = lastProp.getText().toUpperCase();
                if (['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {

                    const args = call.getArguments();
                    if (args.length > 0) {
                        let routePath = args[0].getText().replace(/['"`]/g, '');

                        // 1. Base: The Route Definition
                        let fullCode = `// --- ENTRY: ROUTE DEFINITION (${sourceFile.getBaseName()}) ---\n${call.getText()}`;

                        // 2. Deep Dive: Resolve the Handler Chain
                        const handlerArg = args[args.length - 1];
                        const visited = new Set<string>(); // Prevent circular loops

                        const deepContext = this.resolveDeepContext(handlerArg, 0, visited);
                        if (deepContext) {
                            fullCode += `\n${deepContext}`;
                        }

                        results.push({
                            file: sourceFile.getBaseName(),
                            filePath: path.relative(this.projectRoot, sourceFile.getFilePath()),
                            partialPath: routePath,
                            method: method,
                            code: fullCode
                        });
                    }
                }
            }
        }
        return results;
    }

    /**
     * 👇 RECURSIVE RESOLVER
     * Follows function calls deeper into the codebase (Controller -> Service -> etc.)
     */
    private resolveDeepContext(node: Node, depth: number, visited: Set<string>): string {
        if (depth >= this.MAX_DEPTH) return "";

        // 1. Find the Definition of the function/method being called
        const definitions = this.getDefinitions(node);
        if (!definitions || definitions.length === 0) return "";

        let accumulatedCode = "";

        for (const def of definitions) {
            // Avoid node_modules (we only want YOUR source code)
            if (def.getSourceFile().isInNodeModules()) continue;

            // Avoid infinite recursion (e.g. recursive functions)
            const defId = `${def.getSourceFile().getFilePath()}:${def.getStart()}`;
            if (visited.has(defId)) continue;
            visited.add(defId);

            // 2. Add the text of this function
            const label = `// --- DEPTH ${depth + 1}: ${this.getNodeName(def)} (${def.getSourceFile().getBaseName()}) ---`;
            accumulatedCode += `\n\n${label}\n${def.getText()}`;

            // 3. Scan THIS function body for further downstream calls
            const internalCalls = def.getDescendantsOfKind(SyntaxKind.CallExpression);
            for (const subCall of internalCalls) {
                const subExpr = subCall.getExpression();

                // Recurse!
                accumulatedCode += this.resolveDeepContext(subExpr, depth + 1, visited);
            }
        }

        return accumulatedCode;
    }

    /**
     * Helper to safely get the name of a node
     */
    private getNodeName(node: Node): string {
        if (Node.isFunctionDeclaration(node) || Node.isMethodDeclaration(node)) {
            return node.getName() || 'Anonymous Function';
        }
        if (Node.isVariableDeclaration(node)) {
            return node.getName();
        }
        return 'Unknown Block';
    }

    /**
     * Helper to resolve a node (Identifier, PropertyAccess, etc.) to its Definition
     */
    private getDefinitions(node: Node): Node[] {
        // If it's a direct function (arrow func in route), return it directly
        if (Node.isArrowFunction(node) || Node.isFunctionExpression(node)) {
            return [node];
        }

        try {
            const symbol = node.getSymbol();
            if (symbol) {
                // If it's an alias (e.g. import { x as y }), resolve the original
                const targetSymbol = symbol.getAliasedSymbol() || symbol;
                return targetSymbol.getDeclarations();
            }
        } catch (e) {
            // ignore resolution errors
        }
        return [];
    }

    /**
     * 👇 REWRITTEN: Strict matching to solve the "Generic Route" problem.
     */
    private findBestMatch(runtime: any, staticEndpoints: any[]) {
        // 1. Filter by Method (Must be exact match)
        let candidates = staticEndpoints.filter(s => s.method === runtime.method);

        // 2. Filter by Suffix (The static path must be at the end of the runtime path)
        candidates = candidates.filter(candidate => {
            const rPath = runtime.path.endsWith('/') ? runtime.path.slice(0, -1) : runtime.path;
            const sPath = candidate.partialPath.endsWith('/') ? candidate.partialPath.slice(0, -1) : candidate.partialPath;

            // Segment-based Suffix Match
            const rSegments = rPath.split('/').filter(Boolean).reverse();
            const sSegments = sPath.split('/').filter(Boolean).reverse();

            if (sSegments.length > rSegments.length) return false;

            for (let i = 0; i < sSegments.length; i++) {
                const rSeg = rSegments[i];
                const sSeg = sSegments[i];

                if (rSeg === sSeg) continue;
                if (rSeg.startsWith(':') && sSeg.startsWith(':')) continue;
                return false;
            }

            return true;
        });

        if (candidates.length === 0) return null;

        // 3. Score Candidates to find the best match
        const scored = candidates.map(candidate => {
            let score = 0;
            let hasContextMatch = false;

            // Define Helpers & Variables once
            const cleanName = candidate.file.toLowerCase()
                .replace('.controller', '')
                .replace('.service', '')
                .replace('.routes', '')
                .replace('.route', '')
                .replace('.ts', '')
                .replace('.js', '');

            const sPath = candidate.partialPath.endsWith('/') ? candidate.partialPath.slice(0, -1) : candidate.partialPath;
            const sSegments = sPath.split('/').filter(Boolean);

            const getMatchingSegmentIndex = (urlPath: string, token: string): number => {
                const segments = urlPath.split('/').filter(Boolean);
                const t = token.toLowerCase();
                for (let i = 0; i < segments.length; i++) {
                    const s = segments[i].toLowerCase();
                    if (/^[^a-z0-9]/i.test(s)) continue; // Ignore artifacts

                    if (s === t) return i;
                    if (s === `${t}s`) return i;
                    if (s === `${t}es`) return i;
                    // Handle "y" -> "ies" (policy -> policies)
                    if (t.endsWith('y') && s === `${t.slice(0, -1)}ies`) return i;

                    if (s.includes('-') && s.split('-').includes(t)) return i;
                }
                return -1;
            };

            let maxAnchorIndex = -1;

            // A. Filename Match & Anchor Logic
            if (!['index', 'app', 'main', 'server', 'routes'].includes(cleanName)) {
                const anchorIndex = getMatchingSegmentIndex(runtime.path, cleanName);
                if (anchorIndex !== -1) {
                    score += 1000;
                    score += anchorIndex;
                    hasContextMatch = true;
                    if (anchorIndex > maxAnchorIndex) maxAnchorIndex = anchorIndex;
                }
            }

            // C. Directory Matching
            if (candidate.filePath) {
                const parts = candidate.filePath.split(path.sep);
                for (const part of parts) {
                    const cleanPart = part.toLowerCase();
                    if (['src', 'modules', 'controllers', 'routes', 'services', 'index.ts', 'channels'].includes(cleanPart)) continue;

                    const dirIndex = getMatchingSegmentIndex(runtime.path, cleanPart);
                    if (dirIndex !== -1) {
                        score += 500;
                        hasContextMatch = true;
                        if (dirIndex > maxAnchorIndex) maxAnchorIndex = dirIndex;
                    }
                }
            }

            // B. Length (Specificity)
            score += (sPath.length * 100);

            // D. Safety Check: All Wildcards must have context
            const isAllWildcards = sSegments.every((seg: string) => seg.startsWith(':'));
            if (isAllWildcards && !hasContextMatch) {
                return null;
            }

            // --- DEBUG INJECTION ---
            if (runtime.path.includes('notification-settings') || runtime.path.includes('policies')) {
                console.log(`[DEBUG] Path: ${runtime.path} | Candidate: ${candidate.partialPath} (${candidate.file}) | Score: ${score} | AnchorIdx: ${['index', 'app', 'main', 'server', 'routes'].includes(cleanName) ? 'N/A' : getMatchingSegmentIndex(runtime.path, cleanName)} | SuffixLen: ${['index', 'app', 'main', 'server', 'routes'].includes(cleanName) ? 'N/A' : (runtime.path.split('/').filter(Boolean).length - 1 - getMatchingSegmentIndex(runtime.path, cleanName))} | StaticLen: ${sSegments.length}`);
            }

            return { candidate, score };
        }).filter(item => item !== null && item.score > 0) as { candidate: any, score: number }[];

        scored.sort((a, b) => b.score - a.score);

        return scored.length > 0 ? scored[0].candidate : null;
    }

    private getDomainContext(): string {
        const prismaPath = path.join(this.projectRoot, 'prisma', 'schema.prisma');
        console.log(chalk.magenta(`[DEBUG] Checking for Prisma schema at: ${prismaPath}`));
        if (fs.existsSync(prismaPath)) {
            console.log(chalk.blue('📘 Found Prisma Schema. Attaching to context.'));
            try {
                const content = fs.readFileSync(prismaPath, 'utf-8');
                console.log(chalk.magenta(`[DEBUG] Prisma Schema loaded (${content.length} bytes). Content preview: ${content.slice(0, 100).replace(/\n/g, ' ')}...`));
                // Force resolving Enums from project if possible?
                return content;
            } catch (e) {
                console.error(chalk.red(`[DEBUG] Failed to read schema: ${e}`));
            }
        } else {
            console.log(chalk.red(`[DEBUG] Prisma schema NOT found at: ${prismaPath}`));
        }
        if (!this.project) {
            const tsConfigPath = path.join(this.projectRoot, 'tsconfig.json');
            if (fs.existsSync(tsConfigPath)) {
                this.project = new Project({ tsConfigFilePath: tsConfigPath, skipAddingFilesFromTsConfig: false });
            } else { return ""; }
        }
        const modelFiles = this.project.getSourceFiles().filter(sourceFile => {
            const fileName = sourceFile.getBaseName().toLowerCase();
            return (fileName.includes('.model.') || fileName.includes('.entity.') || fileName.includes('.schema.') || fileName === 'types.ts');
        });
        if (modelFiles.length > 0) {
            console.log(chalk.blue(`📘 Found ${modelFiles.length} potential model files.`));
            return modelFiles.map(f => `// --- FILE: ${f.getBaseName()} ---\n${f.getText()}`).join('\n\n');
        }
        return "";
    }

    private detectFramework(): 'express' | 'nestjs' | 'unknown' {
        const pkgPath = path.join(this.projectRoot, 'package.json');
        if (!fs.existsSync(pkgPath)) return 'unknown';
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        if (deps['@nestjs/core']) return 'nestjs';
        if (deps['express']) return 'express';
        return 'unknown';
    }
}