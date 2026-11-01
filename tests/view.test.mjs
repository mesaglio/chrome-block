import test from 'node:test';
import assert from 'node:assert/strict';
import { statusFor } from '../src/popup/view.ts';
const base={host:'example.com',settings:{enabled:true},selected:true,permission:true,configured:true,pending:false,controlled:false,error:null};
test('pending reload takes precedence over an off preference',()=>{
  const status=statusFor({...base,settings:{enabled:false},pending:true});
  assert.equal(status.tone,'warning');assert.match(status.title,/recarga/i);
});
test('missing access is visible instead of pretending the site is protected',()=>{
  const status=statusFor({...base,permission:false,configured:false});
  assert.equal(status.tone,'warning');assert.match(status.title,/permiso/i);
});
test('service-worker controlled documents show partial coverage',()=>{
  const status=statusFor({...base,controlled:true});
  assert.equal(status.tone,'warning');assert.match(status.title,/parcial/i);
});
test('unselected and privileged pages do not show active protection',()=>{
  assert.equal(statusFor({...base,selected:false}).tone,'off');
  assert.match(statusFor({...base,host:null}).title,/compatible/i);
  assert.equal(statusFor(base).tone,'on');
});
