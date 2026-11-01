import test from 'node:test';
import assert from 'node:assert/strict';
import { addAttempt } from '../src/background/attempts.ts';
import { isPopupSender, isContentSender } from '../src/shared/messages.ts';

test('recent list is bounded while the count includes older attempts',()=>{
  let log={count:0,recent:[]};
  for(let i=0;i<35;i++)log=addAttempt(log,{url:`https://ad.test/${i}`,kind:'window'},String(i));
  assert.equal(log.count,35);assert.equal(log.recent.length,20);
  assert.equal(log.recent[0].id,'34');assert.equal(log.recent.at(-1).id,'15');
});
test('unsafe URLs and forms cannot be recovered by opening a tab',()=>{
  const log=addAttempt({count:0,recent:[]},{kind:'form',url:'https://checkout.test/pay'},'form');
  assert.equal(log.recent[0].recoverable,false);
  const unsafe=addAttempt(log,{kind:'window',url:'javascript:alert(1)'},'bad');
  assert.equal(unsafe.recent[0].url,null);assert.equal(unsafe.recent[0].recoverable,false);
  const safe=addAttempt(unsafe,{kind:'link',url:'https://example.com/?x=1'},'good');
  assert.equal(safe.recent[0].recoverable,true);
});
test('malformed messages cannot poison or reset the log',()=>{
  const original={count:2,recent:[]};
  for(const raw of [null,{},'x',{kind:'other',url:'https://example.com'}])assert.deepEqual(addAttempt(original,raw,'id'),original);
});
test('content pages cannot impersonate popup commands',()=>{
  const id='abc';
  assert.equal(isPopupSender({id,url:'chrome-extension://abc/popup/popup.html'},id),true);
  for(const sender of [{id,url:'https://example.com'}, {id:'other',url:'chrome-extension://abc/popup/popup.html'}, {id,url:'chrome-extension://abc/popup/popup.html/evil'},{}])assert.equal(isPopupSender(sender,id),false);
  assert.equal(isContentSender({id,tab:{id:1},frameId:0,documentId:'doc'},id),true);
  assert.equal(isContentSender({id,frameId:0},id),false);
  assert.equal(isContentSender({id,tab:{id:-1},frameId:0},id),false);
});
