import {AccessError} from './authorization';
import {inboxAccess} from './inbox';
import {inboxQuotableMessage,inboxQuotableThread,inboxReplyExcerpt,type InboxReplyQuote} from './inbox-contract';

type DirectThread={kind:string;recipientType:string;sender:string;recipientId:string;link?:unknown};

export async function prepareInboxReply(db:D1Database,user:Parameters<typeof inboxAccess>[1],destination:DirectThread,messageId:unknown){
 if(messageId===undefined)return null;
 if(typeof messageId!=='string'||!messageId.trim()||messageId.length>200||!inboxQuotableThread(destination))
  throw new AccessError('پاسخ به یک پیام مشخص در گفت‌وگوی مستقیم در دسترس است.',400);

 const missing=()=>new AccessError('پیام مورد پاسخ در این گفت‌وگو پیدا نشد.',404);
 const row=await db.prepare("SELECT data FROM flow_entities WHERE id=? AND type='inbox_message'").bind(messageId).first<{data:string}>();
 if(!row)throw missing();
 const message=JSON.parse(row.data) as {thread:string;authorName?:string;author:string;body:string;mode:string};
 if(typeof message.thread!=='string'||typeof message.body!=='string'||!inboxQuotableMessage(message.mode))throw missing();

 const source=await inboxAccess(message.thread,user);
 const participantIds=[source.data.sender,source.data.recipientId];
 if(!inboxQuotableThread(source.data)||source.data.sender===source.data.recipientId||
    !participantIds.includes(destination.sender)||!participantIds.includes(destination.recipientId)||
    !participantIds.includes(message.author))throw missing();

 const authorName=typeof message.authorName==='string'&&message.authorName.trim()
  ?message.authorName.slice(0,180)
  :message.author===source.data.sender?source.data.senderName:source.data.recipientName;
 const quote:InboxReplyQuote={messageId,authorName:typeof authorName==='string'?authorName.slice(0,180):'',excerpt:inboxReplyExcerpt(message.body)};
 return {quote,sourceId:source.id,sourceRevision:source.revision,messageData:row.data};
}

export function inboxReplyGuards(db:D1Database,operationId:string,threadId:string,reply:Awaited<ReturnType<typeof prepareInboxReply>>){
 if(!reply)return [];
 const guard=(clause:string,...values:(string|number)[])=>db.prepare('UPDATE inventory_operations SET guard=CASE WHEN '+clause+' THEN guard ELSE 0 END WHERE id=?').bind(...values,operationId);
 const checks=[guard("EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND type='inbox_message' AND data=?)",reply.quote.messageId,reply.messageData)];
 if(reply.sourceId!==threadId)checks.push(guard("EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND type='inbox_thread' AND revision=?)",reply.sourceId,reply.sourceRevision));
 return checks;
}
