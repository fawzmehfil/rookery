export function GET() {
  return Response.json(
    {
      status: "ok",
      service: "rookery-web",
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
