import {openStream} from '@/lib/mcp/sse';
export async function GET(request:Request){return openStream(request);}
