export function createSlug(str: string): string {
    return str.toLowerCase().replace(/[^\w ]+/g, '').replace(/ +/g, '-');
}