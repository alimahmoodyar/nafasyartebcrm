import {trainingContext,trainingDatabase} from "./training-context";
import {env} from "cloudflare:workers";
export function storage(){if(!env.DB) throw new Error("Database unavailable"); return trainingContext.getStore()?trainingDatabase(env.DB):env.DB;}
