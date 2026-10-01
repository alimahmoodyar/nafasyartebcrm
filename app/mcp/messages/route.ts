import {postMessage} from '@/lib/mcp/sse';
export async function POST(request:Request){return postMessage(request);}
