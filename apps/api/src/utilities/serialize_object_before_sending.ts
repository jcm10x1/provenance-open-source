import { convertBigIntToString, convertDbDateToIsoString, toSnakeCase } from "@onexone/core";

export default function serializeObjectBeforeSending(obj: any | any[]): any {
    if (Array.isArray(obj)) {
        return obj.map(item => ({
            ...convertBigIntToString(item),
            ...convertDbDateToIsoString(item),
            ...toSnakeCase(item)
        }));
    }
    
    return {
        ...convertBigIntToString(obj),
        ...convertDbDateToIsoString(obj),
        ...toSnakeCase(obj)
    };
}