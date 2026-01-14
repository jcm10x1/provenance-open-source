export default interface ScanResult {
    method: string;
    path: string;
    current_hash: string;
    file_path: string;
    start_line: number;
    end_line: number;
    code: string;
    relevent_schema?: string;
}