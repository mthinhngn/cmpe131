import test from 'node:test';
import assert from 'node:assert/strict';
import { readChatSession, writeChatSession, newChatSession } from '../src/chat-session.ts';

test('chat sessions preserve thread, pending requests and receipts across document loads', () => {
  const values = new Map();
  globalThis.sessionStorage = {getItem:key=>values.get(key) ?? null,setItem:(key,value)=>values.set(key,value)};
  const session = newChatSession();
  session.items.push({query:'Add CS146',request:{request_id:'pending',status:'running'}});
  session.receipts.push(['action',{status:'succeeded',code:'saved',message:'Saved',context:{revision:'1'}}]);
  writeChatSession('guest:ce',session);
  assert.deepEqual(readChatSession('guest:ce'),session);
  assert.notEqual(readChatSession('account:ce').threadId,session.threadId);
  assert.notEqual(readChatSession('guest:se').threadId,session.threadId);
  values.clear();
  assert.deepEqual(readChatSession('guest:ce').items,[]);
  values.set('course-radar-chat-session-v1:guest:ce','broken json');
  assert.deepEqual(readChatSession('guest:ce').items,[]);
});
