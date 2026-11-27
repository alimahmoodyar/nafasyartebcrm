import {checkOrigin} from '@/lib/authorization';
import {stationResponse,stationBody,listStations,createTicket,revokeStation} from '@/lib/personnel-stations';
export function GET(req:Request){return stationResponse(()=>listStations(req))}
export function POST(req:Request){return stationResponse(async()=>{checkOrigin(req);return createTicket(await stationBody(req))})}
export function DELETE(req:Request){return stationResponse(async()=>{checkOrigin(req);return revokeStation(await stationBody(req))})}
