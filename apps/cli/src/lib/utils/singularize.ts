/**
 * Naive singularization helper.
 * Useful for normalizing resource names.
 * Example: "users" -> "user", "categories" -> "category"
 */
export default function singularize(str: string): string {
    if (!str) return '';
    const lower = str.toLowerCase();
    
    // Basic rules for English pluralization
    if (lower.endsWith('ies')) return str.slice(0, -3) + 'y';
    if (lower.endsWith('s') && !lower.endsWith('ss')) return str.slice(0, -1);
    
    return str;
}