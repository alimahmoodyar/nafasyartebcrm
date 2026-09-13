import {env} from "cloudflare:workers";
export function storage(){if(!env.DB) throw new Error("Database unavailable"); return env.DB;}
