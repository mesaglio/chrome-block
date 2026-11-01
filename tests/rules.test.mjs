import test from 'node:test';
import assert from 'node:assert/strict';
import { createRules } from '../src/background/rules.ts';

test('rules apply only to selected exact main-frame hosts with granted access', () => {
  const rules = createRules({ enabled:true, sites:['example.com','missing.test'] }, ['example.com']);
  assert.equal(rules.length, 1);
  const rule = rules[0];
  assert.deepEqual(rule.condition.resourceTypes, ['main_frame']);
  const re = new RegExp(rule.condition.regexFilter);
  for(const url of ['https://example.com/','http://example.com:8765/a']) assert.equal(re.test(url),true,url);
  for(const url of ['https://www.example.com/','https://example.com.evil/','https://other.test/?example.com/']) assert.equal(re.test(url),false,url);
  assert.equal(rule.action.type,'modifyHeaders');
  const header=rule.action.responseHeaders[0];
  assert.equal(header.header,'content-security-policy');
  assert.equal(header.operation,'append'); // Never overwrite a site's existing policy.
  const tokens=header.value.split(' ');
  assert.equal(tokens[0],'sandbox');
  assert.equal(tokens.includes('allow-popups'),false);
  for(const value of ['allow-scripts','allow-same-origin','allow-forms','allow-downloads','allow-presentation']) assert.equal(tokens.includes(value),true,value);
});
test('suspending protection removes rules without changing sites', () => {
  const settings={enabled:false,sites:['example.com']};
  assert.deepEqual(createRules(settings,['example.com']),[]);
  assert.deepEqual(settings.sites,['example.com']);
});
test('rule IDs are unique and hostnames cannot escape the URL matcher', () => {
  const rules=createRules({enabled:true,sites:['example.com','127.0.0.1','[::1]']},['example.com','127.0.0.1','[::1]']);
  assert.equal(new Set(rules.map(r=>r.id)).size,3);
  assert.equal(new RegExp(rules[1].condition.regexFilter).test('http://127x0x0x1/'),false);
  assert.equal(new RegExp(rules[2].condition.regexFilter).test('http://[::1]:80/'),true);
});
