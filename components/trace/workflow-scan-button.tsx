'use client';
import {ScanLine} from 'lucide-react';
export function openWorkflowScan(code=''){window.dispatchEvent(new CustomEvent('nafasyar-workflow-scan',{detail:{code}}));}
export function WorkflowScanButton({title='اسکن کالا یا بسته'}:{title?:string}){return <button type="button" className="btn primary" onClick={()=>openWorkflowScan()}><ScanLine size={22}/>{title}</button>}
