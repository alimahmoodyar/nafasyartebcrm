import {stationResponse,stationBody,syncPunch} from '@/lib/personnel-stations';
export function POST(req:Request){return stationResponse(async()=>syncPunch(req,await stationBody(req)))}
