import { companyNames } from "@/services/applying/manual";
export async function GET() { return Response.json({ names: await companyNames() }); }
