'use client';
import {Printer} from 'lucide-react';
export function BatchLabelLink({batchId}:{batchId:string}){return <a className="btn" href={'/api/batch-labels?id='+encodeURIComponent(batchId)} target="_blank" rel="noopener noreferrer"><Printer size={16}/>چاپ لیبل بچ</a>;}
