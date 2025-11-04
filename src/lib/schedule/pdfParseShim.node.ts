// src/lib/schedule/pdfParseShim.node.ts
// Node-only shim: dynamic import pdf-parse to avoid ESM/CJS bundling issues in Next.js
export async function pdfToText(buffer: Buffer): Promise<string> {
    if (!buffer?.length) throw new Error("Empty file upload");
  
    // Dynamic import to prevent Next from trying to bundle this on the edge
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfParse = await import('pdf-parse' as any);
    const pdf = pdfParse.default || pdfParse;
  
    const result = await pdf(buffer);
    return (result.text || '').trim();
  }  