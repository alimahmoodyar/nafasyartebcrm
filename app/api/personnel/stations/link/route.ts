import {checkOrigin} from '@/lib/authorization';
import {stationResponse,stationBody,linkStation} from '@/lib/personnel-stations';
export function POST(req:Request){return stationResponse(async()=>{checkOrigin(req);return linkStation(await stationBody(req))})}
