import {checkOrigin} from '@/lib/authorization';
import {stationResponse,employeeRoster,stationBody,enrollMember} from '@/lib/personnel-stations';
export function GET(req:Request){return stationResponse(()=>employeeRoster(req))}
export function POST(req:Request){return stationResponse(async()=>{checkOrigin(req);return enrollMember(await stationBody(req))})}
