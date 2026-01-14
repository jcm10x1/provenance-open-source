/**
 * FALLBACK: Manual code block extractor.
 * NOTE: We primarily use ts-morph for AST extraction now, 
 * but this is kept as a fallback for non-standard files or 
 * simple text processing where AST might be overkill or fail.
 * * @param fullText - The complete source file text
 * @param startIndex - The index where the opening brace '{' begins
 */
export default function extractCodeBlock(fullText: string, startIndex: number): string {
    let openBraces = 0;
    let foundStart = false;
    let endIndex = startIndex;
    
    for (let i = startIndex; i < fullText.length; i++) {
        if (fullText[i] === '{') { 
            openBraces++; 
            foundStart = true; 
        } 
        else if (fullText[i] === '}') { 
            openBraces--; 
        }
        
        // If we found the start and braces match back up to 0, we found the closing brace
        if (foundStart && openBraces === 0) { 
            endIndex = i + 1; 
            break; 
        }
    }
    
    // Safety net: if parsing fails (e.g. unclosed braces), just grab the next 500 chars
    // to give the user *something* to look at in the documentation.
    if (!foundStart || endIndex === startIndex) {
        return fullText.substring(startIndex, startIndex + 500);
    }
    
    return fullText.substring(startIndex, endIndex);
}