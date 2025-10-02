// src/lib/schedule/pdfParseShim.node.ts
// Node-only shim: require() pdf-parse to avoid ESM/CJS bundling issues in Next.js
export async function pdfToText(buffer: Buffer): Promise<string> {
    if (!buffer?.length) throw new Error("Empty file upload");
  
    // eval('require') prevents Next from trying to bundle require on the edge
    const req = eval('require') as NodeRequire;
    const pdf: (buf: Buffer) => Promise<{ text?: string }> = req('pdf-parse');
  
    const result = await pdf(buffer);
    return (result.text || '').trim();
  }  