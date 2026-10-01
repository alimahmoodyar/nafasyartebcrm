import {AsyncLocalStorage} from 'node:async_hooks';
import type {Session} from '@/lib/permissions';
// Only server-validated MCP authentication may populate this request-local context.
export const mcpActor = new AsyncLocalStorage<Session>();
