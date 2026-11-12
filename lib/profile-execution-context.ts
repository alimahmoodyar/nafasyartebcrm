import {AsyncLocalStorage} from 'node:async_hooks';
// Populated only while executing a server-validated administrator role profile.
// Not persisted, accepted from requests, or exposed as a permission grant.
export const profileExecutionContext=new AsyncLocalStorage<{actor:string;profileId:string}>();
