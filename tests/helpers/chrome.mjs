export function fakeChrome() {
  const local={},session={};
  const storage=state=>({
    get:async key=>key===null?structuredClone(state):Object.fromEntries((Array.isArray(key)?key:[key]).filter(k=>k in state).map(k=>[k,structuredClone(state[k])])),
    set:async value=>Object.assign(state,structuredClone(value)),
    remove:async keys=>{for(const key of Array.isArray(keys)?keys:[keys])delete state[key];},
  });
  let rules=[],scripts=[];
  const tabs=new Map([[1,{id:1,url:'https://example.com/video'}],[2,{id:2,url:'https://other.test/'}],[3,{id:3,url:'https://example.com/other'}]]);
  const granted=new Set(['http://example.com/*','https://example.com/*']);
  const reloaded=[],opened=[];let nextId=100;
  const api={
    runtime:{id:'abc',getURL:path=>`chrome-extension://abc/${path}`},
    storage:{local:storage(local),session:storage(session)},
    permissions:{contains:async({origins})=>origins.every(x=>granted.has(x))},
    declarativeNetRequest:{getDynamicRules:async()=>structuredClone(rules),updateDynamicRules:async({removeRuleIds,addRules=[]})=>{rules=[...rules.filter(r=>!removeRuleIds.includes(r.id)),...structuredClone(addRules)];}},
    scripting:{getRegisteredContentScripts:async()=>structuredClone(scripts),unregisterContentScripts:async({ids})=>{scripts=scripts.filter(s=>!ids.includes(s.id));},registerContentScripts:async value=>scripts.push(...structuredClone(value))},
    tabs:{
      get:async id=>{if(!tabs.has(id))throw Error('Tab not found');return structuredClone(tabs.get(id));},
      query:async()=>[...tabs.values()].map(x=>structuredClone(x)),
      reload:async(id,options)=>{if(!tabs.has(id))throw Error('Tab not found');reloaded.push({id,options});},
      create:async({url})=>{opened.push(url);return {id:nextId++,url};},
    },
    action:{setBadgeText:async()=>{},setBadgeBackgroundColor:async()=>{},setTitle:async()=>{}},
  };
  return {api,local,session,tabs,granted,reloaded,opened,rules:()=>rules};
}
export const popup={id:'abc',url:'chrome-extension://abc/popup/popup.html'};
export function content(tabId=1,frameId=0){return {id:'abc',tab:{id:tabId,url:'https://example.com/video'},frameId,documentId:`doc-${tabId}-${frameId}`,documentLifecycle:'active'};}
