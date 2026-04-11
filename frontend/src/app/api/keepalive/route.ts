// frontend/src/app/api/keepalive/route.ts
export async function GET() {
    return Response.json({ ok: true });
}