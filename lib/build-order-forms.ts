import {qfail,qfields,qvalues} from './qms';
import type {QField} from './qms-contract';

export type CustomerOrderForm={id:string;title:string;productId:string;version:number;fields:QField[]};

// A sales intake receives the explicitly published schema, never the QMS record,
// design attachments, related records, reviewer identities or approval notes.
export function customerOrderForms(rows:any[],productId=''):CustomerOrderForm[]{
 return rows.filter(r=>r.type==='qms_record'&&r.data.kind==='form'&&r.data.formPurpose==='customer_order'&&r.data.private===false&&r.data.state==='approved'&&(!productId||r.data.productId===productId)).map(r=>({id:r.id,title:r.data.title,productId:r.data.productId,version:r.data.version,fields:qfields(r.data.fields)}));
}

export function customerOrderForm(rows:any[],templateId:string,productId:string):CustomerOrderForm{
 const form=customerOrderForms(rows,productId).find(f=>f.id===templateId);
 if(!form||!productId||form.productId!==productId)return qfail('فرم مصوب مشخصات سفارش همان محصول را انتخاب کنید.');
 return form;
}

export function snapshotCustomerOrderForm(rows:any[],templateId:string,productId:string,answers:unknown,complete=true){
 const template=customerOrderForm(rows,templateId,productId);
 return {template,answers:qvalues(template.fields,answers,complete)};
}
