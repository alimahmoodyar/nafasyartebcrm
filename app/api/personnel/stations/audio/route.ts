import {checkOrigin} from '@/lib/authorization';
import {stationResponse,stationBody} from '@/lib/personnel-stations';
import {stationSounds,uploadStationSound,removeStationSound} from '@/lib/personnel-stations-audio';
export function GET(){return stationResponse(stationSounds)}
export function PUT(req:Request){return stationResponse(()=>{checkOrigin(req);return uploadStationSound(req)})}
export function DELETE(req:Request){return stationResponse(async()=>{checkOrigin(req);return removeStationSound((await stationBody(req)).kind)})}
