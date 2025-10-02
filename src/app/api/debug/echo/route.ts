export async function GET() {
    return Response.json({ ok: true, route: '/api/debug/echo' });
  }
  export async function POST(req: Request) {
    const form = await req.formData().catch(() => null);
    return Response.json({ ok: true, hasForm: !!form });
  }