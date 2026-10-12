import type {Session} from './permissions';
import {serviceRead} from './service-access';

// Keep the direct hospital route for assistant/task links, while the home page
// groups its icon inside after-sales for accounts that can use the service hub.
export function serviceHomeApps<T extends {key:string}>(apps:T[],user:Session):T[]{
 return apps.filter(app=>app.key!=='hospital'||!serviceRead(user));
}
