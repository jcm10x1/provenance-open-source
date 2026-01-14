import crypto from 'crypto';
import { CallExpression, Node } from 'ts-morph';
import ScanResult from '../types/ScanResult.js';

export const ExpressParser = {
    matches(call: CallExpression): boolean {
        const expr = call.getExpression();
        if (!Node.isPropertyAccessExpression(expr)) return false;
        
        const method = expr.getName();
        const validMethods = ['get', 'post', 'put', 'delete', 'patch'];
        
        if (!validMethods.includes(method)) return false;

        const args = call.getArguments();
        if (args.length < 2) return false;
        
        return Node.isStringLiteral(args[0]) || Node.isNoSubstitutionTemplateLiteral(args[0]);
    },

    /**
     * Returns a ScanResult or null if extraction failed.
     */
    extract(call: CallExpression): ScanResult | null { // 👈 Explicit return type
        const expr = call.getExpression();
        if (!Node.isPropertyAccessExpression(expr)) return null;

        const method = expr.getName().toUpperCase();
        const args = call.getArguments();
        
        // 1. Path
        const routePath = args[0].getText().replace(/['"`]/g, '');

        // 2. Surgical Code
        let surgicalCode = `// ROUTER CONTEXT (${call.getSourceFile().getBaseName()}:${call.getStartLineNumber()}):\n${call.getText()}\n\n`;

        const handler = args[args.length - 1];
        
        if (Node.isArrowFunction(handler) || Node.isFunctionExpression(handler)) {
            surgicalCode += `// INLINE HANDLER:\n${handler.getText()}`;
        } else if (Node.isIdentifier(handler) || Node.isPropertyAccessExpression(handler)) {
            const symbol = handler.getSymbol();
            const decl = symbol?.getDeclarations()[0];
            
            if (decl) {
                surgicalCode += `// CONTROLLER (${decl.getSourceFile().getBaseName()}):\n${decl.getText()}`;
            } else {
                surgicalCode += `// HANDLER: ${handler.getText()} (Definition not found)`;
            }
        }

        // 3. Hash
        const hash = crypto.createHash('md5').update(surgicalCode).digest('hex');

        return { 
            method, 
            path: routePath, 
            code: surgicalCode, 
            current_hash: hash,
            file_path: call.getSourceFile().getFilePath(),
            start_line: call.getStartLineNumber(),
            end_line: call.getEndLineNumber()
        };
    }
};