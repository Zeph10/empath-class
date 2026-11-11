import test from 'node:test';
import assert from 'node:assert/strict';
const registry=new Map(),callbacks=new Map(),dialogs=[];let cancelNative=false;const nativeUsages=[];
const collection=(values=[])=>Object.assign(values,{get(id){return this.find(i=>i.id===id||i._id===id);}});
function setPath(obj,path,v){const keys=path.split('.');let o=obj;for(const key of keys.slice(0,-1))o=o[key]??={};o[keys.at(-1)]=structuredClone(v);}
globalThis.Hooks={on:(k,f)=>{const a=callbacks.get(k)??[];a.push(f);callbacks.set(k,a);},once:(k,f)=>{const a=callbacks.get(k)??[];a.push(f);callbacks.set(k,a);}};
const call=(name,...args)=>{let result;for(const f of callbacks.get(name)??[])if(f(...args)===false)result=false;return result;};
let next=0;globalThis.foundry={utils:{randomID:()=>`test${String(++next).padStart(12,'0')}`,deepClone:structuredClone},applications:{api:{ApplicationV2:class{},HandlebarsApplicationMixin:x=>x,DialogV2:{wait:async()=>dialogs.shift()??null,confirm:async()=>true}}}};
globalThis.ui={notifications:{warn:()=>{},error:()=>{},info:()=>{}}};
globalThis.CONFIG={Dice:{},DND5E:{}};
const gm={id:'gm',active:true,isGM:true,name:'GM',targets:new Set(),updateTokenTargets:()=>{}};
const settings=new Map();globalThis.game={user:gm,users:collection([gm]),actors:collection(),scenes:collection(),packs:new Map(),settings:{register:(id,k,c)=>settings.set(k,c.default),get:(_id,k)=>settings.get(k)},system:{id:'dnd5e',version:'6.0.5'},time:{worldTime:100},socket:{emit:()=>{},on:()=>{}}};
globalThis.canvas={tokens:{controlled:[]},scene:null};globalThis.fromUuid=async u=>registry.get(u)??null;globalThis.fromUuidSync=u=>registry.get(u)??null;
const chats=[];globalThis.ChatMessage={getSpeaker:({actor})=>({actor:actor.id}),create:async d=>{chats.push(d);return d;}};
function item(data,actor){const out=structuredClone(data);out.id=out._id??`i${++next}`;out.uuid=`${actor.uuid}.Item.${out.id}`;out.actor=actor;out.getFlag=(id,key)=>out.flags?.[id]?.[key];out.toObject=()=>{const d=structuredClone(data);d._id=out.id;d.system.properties=[...(out.system.properties??[])];d.system.activities=Object.fromEntries((out.system.activities??[]).map(a=>[a.id,{_id:a.id,type:a.type,duration:{concentration:a.duration?.concentration??false},consumption:{spellSlot:true,targets:[],scaling:{}},range:{},target:{affects:{}},flags:{}}]));return d;};out.system.properties=new Set(out.system.properties??[]);const activities=Object.values(out.system.activities??{}).map(d=>{const a={...d,id:d._id??'act1',actor,item:out,type:d.type??'utility',use:async (usage)=>{nativeUsages.push({usage,item:out});return cancelNative?null:{message:{id:'chat'}};}};return a;});out.system.activities=collection(activities);registry.set(out.uuid,out);return out;}
function actor(id,level=3,icon='sorcery'){
 const a={id,name:id,uuid:`Actor.${id}`,isOwner:true,flags:{},items:collection([{id:'class',type:'class',system:{identifier:'empath',levels:level}},{id:'subclass',type:'subclass',system:{identifier:`icon-of-${icon}`}}]),effects:collection(),system:{abilities:{cha:{mod:3},wis:{mod:4},int:{value:10}},attributes:{prof:2,ac:{value:14},hp:{value:30,temp:0}},traits:{ci:{value:new Set()},dr:{value:new Set()},di:{value:new Set()}},details:{type:{value:'humanoid'}}},getRollData:()=>({}),getActiveTokens:()=>[],testUserPermission:()=>true};
 for(const i of a.items)i.getFlag=()=>null;
 a.getFlag=(id,k)=>a.flags[id]?.[k];a.setFlag=async(id,k,v)=>{a.flags[id]??={};a.flags[id][k]=structuredClone(v);};a.unsetFlag=async(id,k)=>{delete a.flags[id]?.[k];};
 a.createEmbeddedDocuments=async(type,list)=>list.map(d=>{if(type==='Item'){const i=item(d,a);a.items.push(i);return i;}const e=structuredClone(d);e.id=e._id??`e${++next}`;e.flags??={};e.statuses=new Set(e.statuses??[]);e.getFlag=(id,k)=>e.flags[id]?.[k];e.setFlag=async(id,k,v)=>{e.flags[id]??={};e.flags[id][k]=structuredClone(v);};e.update=async changes=>{for(const [k,v]of Object.entries(changes))setPath(e,k,v);};e.uuid=`${a.uuid}.ActiveEffect.${e.id}`;a.effects.push(e);registry.set(e.uuid,e);return e;});
 a.deleteEmbeddedDocuments=async(type,ids)=>{const arr=type==='Item'?a.items:a.effects;for(let i=arr.length-1;i>=0;i--)if(ids.includes(arr[i].id)){registry.delete(arr[i].uuid);arr.splice(i,1);}};
 a.update=async changes=>{for(const[k,v]of Object.entries(changes))setPath(a,k,v);};registry.set(a.uuid,a);game.actors.push(a);return a;
}
await import('../scripts/main.mjs');call('init');
const {state,saveState,effect,breakLink,distance,eligibility,targetEligibility,castAuth,markers}=await import('../scripts/runtime.mjs');
const {castSpell}=await import('../scripts/spells.mjs');
const {ID}=await import('../scripts/core.mjs');
test('Link break removes only its effects and held spell copies, preserving unrelated effects',async()=>{
 const caster=actor('cleanup'),target=actor('target');await saveState(caster,{...state(caster),links:[{id:'one',depth:3,held:[{castId:'c1'}]},{id:'two',depth:2,held:[]}],auras:[{id:'a1',linkId:'one'},{id:'a2',linkId:'two'}]});
 await effect(target,caster,{id:'one'},'mantle');await effect(target,caster,{id:'two'},'fervor');await target.createEmbeddedDocuments('ActiveEffect',[{name:'Unrelated',flags:{}}]);await caster.createEmbeddedDocuments('Item',[{name:'Cast copy',type:'spell',system:{properties:[],activities:{}},flags:{[ID]:{castId:'c1'}}}]);
 await breakLink(caster,'one',{forced:true});assert.deepEqual(state(caster).links.map(l=>l.id),['two']);assert.equal(state(caster).links[0].depth,2);assert.equal(target.effects.length,2);assert.equal(target.effects[0].getFlag(ID,'key'),'fervor');assert.equal(caster.items.filter(i=>i.getFlag?.(ID,'castId')).length,0);assert.deepEqual(state(caster).auras.map(a=>a.id),['a2']);
});
test('Range handles token edges, elevations, and separate scenes',()=>{
 const scene={id:'s',grid:{size:100,distance:5}};const a={parent:scene,x:0,y:0,width:1,height:1,elevation:0},b={parent:scene,x:300,y:0,width:1,height:1,elevation:0};assert.equal(distance(a,b),10);assert.equal(distance(a,{...b,elevation:25}),25);assert.equal(distance(a,{...b,parent:{id:'other'}}),Infinity);
});
test('Numeric eligibility rejects constructs, low Intelligence, and psychic resistance',()=>{
 const c=actor('eligible');const t=actor('construct');t.system.details.type.value='construct';t.system.abilities.int.value=1;t.system.traits.dr.value.add('psychic');assert.equal(eligibility(c,t).length,3);
});
test('Native roll modifiers stack and Apathy always wins critical suppression',async()=>{
 const c=actor('rolls'),t=actor('rolling');await effect(t,c,{id:'link'},'fervor',{data:{advPending:true,crit:3,bonus:3,damagePending:true}});await effect(t,c,{id:'link'},'mantle',{data:{bonus:2,crit:2}});await effect(t,c,{id:'link'},'apathy',{data:{reduction:5}});
 const config={subject:{actor:t,item:{type:'weapon'}},rolls:[{parts:['1d20'],options:{criticalSuccess:19}}]};call('dnd5e.preRollAttack',config,{},{});assert.equal(config.rolls[0].options.criticalSuccess,21);assert.equal(config.rolls[0].options.advantage,true);assert.ok(config.rolls[0].parts.includes('2'));
});
test('Damage source rules double harm, preserve healing, and enforce Terrorize immunity',async()=>{
 const caster=actor('damagecaster'),source=actor('damagesource'),victim=actor('victim');const i={uuid:'Actor.damagesource.Item.weapon',actor:source};registry.set(i.uuid,i);const options={origin:{system:{item:{uuid:i.uuid}}}};
 await effect(source,caster,{id:'x'},'death');const d=[{value:7,type:'slashing'},{value:4,type:'healing'},{value:2,type:'temphp'}];call('dnd5e.preCalculateDamage',victim,d,options);assert.deepEqual(d.map(x=>x.value),[14,4,2]);
 await effect(source,caster,{id:'x'},'terrorize');const immune=[{value:12,type:'fire'}];call('dnd5e.preCalculateDamage',caster,immune,options);assert.equal(immune[0].value,0);
});
test('Casting cancellation preserves depth and removes the temporary item',async()=>{
 const c=actor('cancelcast');await saveState(c,{...state(c),links:[{id:'a',depth:3,hostile:false,held:[],actorUuid:c.uuid,tokenUuid:'missing'}]});const i=item({_id:'spell',name:'Bless',type:'spell',system:{level:1,properties:['concentration'],duration:{units:'minute',value:1},activities:{act1:{_id:'act1',type:'utility',duration:{concentration:true}}}},flags:{[ID]:{knownSpell:true}}},c);c.items.push(i);cancelNative=true;dialogs.push({level:'1',activity:'act1',targets:'on',origin:'caster',a:'2'});await castSpell(c,'spell');assert.equal(state(c).links[0].depth,3);assert.equal(c.items.filter(i=>i.getFlag?.(ID,'castInstance')).length,0);cancelNative=false;
});
test('Successful casting spends depth, holds custom concentration, and suppresses native slots',async()=>{
 const c=actor('successcast');await saveState(c,{...state(c),links:[{id:'a',depth:3,hostile:false,held:[],actorUuid:c.uuid,tokenUuid:'missing'}]});const i=item({_id:'spell',name:'Bless',type:'spell',system:{level:1,properties:['concentration'],duration:{units:'minute',value:1},activities:{act1:{_id:'act1',type:'utility',duration:{concentration:true}}}},flags:{[ID]:{knownSpell:true}}},c);c.items.push(i);dialogs.push({level:'1',activity:'act1',targets:'on',origin:'caster',a:'2'});await castSpell(c,'spell');assert.equal(state(c).links[0].depth,1);assert.equal(state(c).links[0].held[0].concentration,true);const last=nativeUsages.at(-1);assert.equal(last.usage.consume.spellSlot,false);assert.equal(last.usage.concentration.begin,false);assert.equal(last.item.system.properties.has('concentration'),false);
});
test('Sheet spell activations route to manager and cast instances preserve non-slot resources',()=>{
 const c=actor('route');const savedUser=game.user;game.user={...gm,id:'player',isGM:false};const out=call('dnd5e.preUseActivity',{actor:c,item:{getFlag:(id,k)=>k==='knownSpell'},flags:{}},{});assert.equal(out,false);game.user=savedUser;
 const copy={getFlag:(id,k)=>k==='castInstance'?true:k==='castId'?'cx':null};assert.equal(call('dnd5e.preUseActivity',{actor:c,item:copy},{}),false,'sheet recast of a cast copy is refused');
 castAuth.add('cx');const usage={consume:{resources:[1],spellSlot:true}};call('dnd5e.preUseActivity',{actor:c,item:copy},usage);castAuth.delete('cx');assert.equal(usage.consume.spellSlot,false);assert.deepEqual(usage.consume.resources,[1]);assert.equal(usage.concentration.begin,false);
});

test('Valor applies once to a skill roll (skill rolls fire the ability-check hook too)',async()=>{
 const c=actor('valorc',3,'crowds'),t=actor('valort');await effect(t,c,{id:'l'},'valor',{data:{energized:0}});
 const config={subject:t,rolls:[{parts:[],options:{}}]};call('dnd5e.preRollSkill',config,{},{});call('dnd5e.preRollAbilityCheck',config,{},{});
 assert.equal(config.rolls[0].parts.filter(p=>p==='1d4').length,1);
});
test('Armor or GM-disabled aura is a caster problem, not a reason to break links',async()=>{
 const c=actor('armored'),t=actor('armortarget');await saveState(c,{...state(c),disabled:true});
 assert.ok(eligibility(c,t).includes('Aura disabled by GM'));assert.equal(targetEligibility(c,t).length,0);
});
test('Round-counted effects in combat rely on turn expiry, not world time',async()=>{
 const c=actor('mantlec'),t=actor('mantlet');game.combat={started:true};
 const e=await effect(t,c,{id:'l'},'mantle',{duration:12,expiry:{caster:c.uuid,phase:'start',remaining:2}});assert.equal(e.flags[ID].endsAt,null);
 game.combat=null;const e2=await effect(t,c,{id:'l'},'mantle',{duration:12,expiry:{caster:c.uuid,phase:'start',remaining:2}});assert.equal(e2.flags[ID].endsAt,112);
});
test('Turn end is processed from combat.previous even when another client advanced the turn',async()=>{
 const c=actor('turncaster',5,'terror'),ally=actor('turnally');registry.set('Scene.s.Token.ally',{uuid:'Scene.s.Token.ally',actor:ally,name:'ally'});
 await saveState(c,{...state(c),links:[{id:'L',tokenUuid:'Scene.s.Token.ally',actorUuid:ally.uuid,sourceToken:'none',hostile:false,depth:0,held:[],autoFail:true,worthy:true}]});
 const combatants=collection([{id:'cA',actor:ally,token:{uuid:'Scene.s.Token.ally'}},{id:'cB',actor:c,token:{uuid:'Scene.s.Token.caster'}}]);
 const combat={id:'cmb',started:true,round:1,turn:1,combatants,combatant:combatants[1],previous:{round:1,turn:0,combatantId:'cA'}};
 const before=chats.length;call('updateCombat',combat,{turn:1});
 for(let i=0;i<50&&!chats.slice(before).some(m=>m.content.includes('Link depth'));i++)await new Promise(r=>setTimeout(r,5));
 assert.ok(chats.slice(before).some(m=>m.content.includes('Link depth')),'depth gained at the ally’s turn end without preUpdateCombat');
});
test('A Plutonium-imported feature without activity flags is still routed to the module',()=>{
 const c=actor('plutoroute');const savedUser=game.user;const sent=[];game.user={...gm,id:'player',isGM:false};const emit=game.socket.emit;game.socket.emit=(n,m)=>sent.push(m);
 const item={type:'feat',name:'Fervor',flags:{},system:{identifier:'fervor'},getFlag:()=>null};
 const out=call('dnd5e.preUseActivity',{actor:c,item,flags:{}},{});game.user=savedUser;game.socket.emit=emit;
 assert.equal(out,false);assert.equal(sent.at(-1)?.key,'fervor');
});
test('Actions run on Foundry 14 where User#updateTokenTargets no longer exists',async()=>{
 const c=actor('v14targets');const saved=gm.updateTokenTargets;delete gm.updateTokenTargets;const errors=[];const err=ui.notifications.error;ui.notifications.error=m=>errors.push(m);
 let set=null;canvas.tokens.setTargets=(ids,o)=>{set={ids,o};};
 dialogs.push({action:'ok',disabled:'on'});await game.empath.use(c,'controls',[]);
 ui.notifications.error=err;gm.updateTokenTargets=saved;delete canvas.tokens.setTargets;
 assert.deepEqual(errors,[]);assert.equal(state(c).disabled,true,'the action itself ran');assert.equal(set?.o?.mode,'replace');
});
test('Feature descriptions carry the source wording',async()=>{
 const {FEATURES,toHtml,toEntries}=await import('../scripts/features.mjs');
 const t=FEATURES.find(f=>f.key==='terrorize');assert.ok(t.text.startsWith('Fear sparks within the heart of your enemies'));
 const a=FEATURES.find(f=>f.key==='aura');assert.ok(toHtml(a.blocks).includes('<li>Are not constructs</li>'));
 const s=FEATURES.find(f=>f.key==='sorcery');assert.equal(toEntries(s.blocks).find(e=>e.type==='table').rows.length,18);
});
const settle=async(pred)=>{for(let i=0;i<100&&!pred();i++)await new Promise(r=>setTimeout(r,5));};
function sceneWith(...specs){const scene={id:'sc',grid:{size:100,distance:5},tokens:[]};for(const [id,a,x,disp]of specs){const t={id,uuid:`Scene.sc.Token.${id}`,name:id,actor:a,parent:scene,x,y:0,width:1,height:1,elevation:0,disposition:disp};a.token=t;scene.tokens.push(t);registry.set(t.uuid,t);}return scene;}
test('Apathy reduces the marked creature’s next damage instance automatically, then ends',async()=>{
 const c=actor('apc',5,'terror'),foe=actor('apfoe'),pc=actor('appc'),pc2=actor('appc2');
 const weapon={uuid:'Actor.apfoe.Item.claw',actor:foe};registry.set(weapon.uuid,weapon);
 await effect(foe,c,{id:'L'},'apathy',{data:{reduction:5}});
 const m1={id:'m1',system:{item:{uuid:weapon.uuid}}};
 const d=[{value:3,type:'slashing'},{value:4,type:'fire'},{value:6,type:'healing'}];call('dnd5e.preCalculateDamage',pc,d,{origin:m1});
 assert.deepEqual(d.map(x=>x.value),[0,2,6],'5 removed across damage types, healing untouched');
 const preview=[{value:9,type:'slashing'}];call('dnd5e.preCalculateDamage',pc,preview,{origin:m1});assert.equal(preview[0].value,4,'previews do not spend it');
 call('dnd5e.applyDamage',pc,2,{origin:m1});await settle(()=>foe.effects[0]?.flags[ID].spentOn);
 assert.equal(foe.effects[0].flags[ID].spentOn,'m1');
 const same=[{value:9,type:'slashing'}];call('dnd5e.preCalculateDamage',pc2,same,{origin:m1});assert.equal(same[0].value,4,'same instance on a second target is reduced');
 const next=[{value:9,type:'slashing'}];call('dnd5e.preCalculateDamage',pc,next,{origin:{id:'m2',system:{item:{uuid:weapon.uuid}}}});assert.equal(next[0].value,9,'a later instance is not reduced');
 const atk={subject:{actor:foe,item:{type:'weapon'}},rolls:[{parts:[],options:{criticalSuccess:20}}]};call('dnd5e.preRollAttack',atk,{},{});assert.equal(atk.rolls[0].options.criticalSuccess,20,'crit suppression ends with the effect');
});
test('Fear of Missing Out bursts automatically on the ally’s next hit',async()=>{
 const c=actor('fomoc',9,'terror'),ally=actor('fomoally'),victim=actor('fomovic'),near=actor('fomonear'),far=actor('fomofar');
 near.rollSavingThrow=async()=>[{total:1}];
 sceneWith(['emp',c,0,1],['ally',ally,0,1],['vic',victim,100,-1],['near',near,200,-1],['far',far,900,-1]);c.getActiveTokens=()=>[c.token];
 await effect(ally,c,{id:'L'},'fomo',{name:'FOMO'});
 game.user.targets=new Set([{document:victim.token}]);
 call('dnd5e.rollAttack',[{isCritical:true,options:{}}],{subject:{actor:ally,getActionType:()=>'mwak'}});
 await settle(()=>near.effects.length);game.user.targets=new Set();
 assert.equal(near.effects[0]?.flags[ID].key,'fomo-fear');assert.ok(near.effects[0].statuses.has('frightened'));
 assert.equal(far.effects.length,0,'creatures beyond 15 ft are not affected');assert.equal(markers(ally,'fomo-fear').length,0,'the Empath\u2019s own side is not frightened');assert.equal(markers(ally,'fomo').length,0,'FOMO consumed');
});
test('A linked ally’s hit offers Fear of Failure as a one-click reaction card',async()=>{
 const c=actor('foFc',13,'terror'),ally=actor('foFally'),victim=actor('foFvic');sceneWith(['fa',ally,0,1],['fv',victim,100,-1]);
 await saveState(c,{...state(c),links:[{id:'L',tokenUuid:ally.token.uuid,actorUuid:ally.uuid,sourceToken:'x',hostile:false,depth:6,held:[]}]});
 game.user.targets=new Set([{document:victim.token}]);const before=chats.length;
 call('dnd5e.rollAttack',[{isCritical:false,isFumble:false,isSuccess:true,options:{target:12}}],{subject:{actor:ally,getActionType:()=>'mwak'}});
 await settle(()=>chats.slice(before).some(m=>m.content.includes('data-empath-action="failure"')));game.user.targets=new Set();
 const card=chats.slice(before).find(m=>m.content.includes('data-empath-action="failure"'));assert.ok(card,'reaction card posted');assert.ok(card.content.includes(`data-param="${ally.token.uuid}|${victim.token.uuid}"`));
});
test('Terrorize: forfeiting the turn ends the fear and advances combat',async()=>{
 const c=actor('terc',3,'terror'),foe=actor('terfoe');await effect(foe,c,{id:'L'},'terrorize',{statuses:['frightened']});
 const {terrorizeTurn}=await import('../scripts/triggers.mjs');let advanced=false;game.combat={combatant:{actor:foe},nextTurn:async()=>{advanced=true;}};
 assert.equal(await terrorizeTurn(foe),false,'default: an NPC acts normally, no GM prompt');assert.equal(markers(foe,'terrorize').length,1);
 settings.set('npcTerrorize','forfeit');assert.equal(await terrorizeTurn(foe),true);settings.set('npcTerrorize','act');game.combat=null;assert.equal(markers(foe,'terrorize').length,0);assert.ok(advanced);
});
globalThis.Roll??=class{constructor(f){this.formula=f;}async evaluate(){this.total=5;return this;}async toMessage(){}};
test('Depth rebuilds after being spent to zero, on allied and hostile links',async()=>{
 const {runAction}=await import('../scripts/actions.mjs');
 const c=actor('dz',5,'terror'),ally=actor('dzally'),foe=actor('dzfoe');foe.system.details.cr=3;foe.applyDamage=async()=>{};
 registry.set('Scene.s.Token.dza',{uuid:'Scene.s.Token.dza',actor:ally,name:'ally'});registry.set('Scene.s.Token.dzf',{uuid:'Scene.s.Token.dzf',actor:foe,name:'foe'});
 ally.rollSavingThrow=foe.rollSavingThrow=async()=>[{total:1}];
 await saveState(c,{...state(c),links:[{id:'A',tokenUuid:'Scene.s.Token.dza',actorUuid:ally.uuid,sourceToken:'x',hostile:false,depth:0,held:[]},{id:'H',tokenUuid:'Scene.s.Token.dzf',actorUuid:foe.uuid,sourceToken:'x',hostile:true,depth:0,held:[]}]});
 const d=id=>state(c).links.find(l=>l.id===id).depth;
 const before=dialogs.length;
 await runAction(c,'depth-gain',[],'A');assert.equal(d('A'),1,'allied NPC fails willingly without a dialog');
 await runAction(c,'depth-gain',[],'H');assert.equal(d('H'),1,'hostile NPC rolls automatically');
 dialogs.push({number:'1'});await runAction(c,'pain',['Scene.s.Token.dzf']);assert.equal(d('H'),0);
 await runAction(c,'depth-gain',[],'H');assert.equal(d('H'),1,'hostile link rebuilds from 0');
 dialogs.push({number:'1'});await runAction(c,'mantle',['Scene.s.Token.dza']);assert.equal(d('A'),0);
 await runAction(c,'depth-gain',[],'A');assert.equal(d('A'),1,'allied link rebuilds from 0');assert.equal(dialogs.length,before,'no GM dialogs used');
});
test('Depth refusals explain the reason instead of silently doing nothing',async()=>{
 const {runAction}=await import('../scripts/actions.mjs');
 const c=actor('dr',3,'terror'),foe=actor('drfoe');foe.system.details.cr=0;c.system.abilities.cha.mod=1;
 registry.set('Scene.s.Token.drf',{uuid:'Scene.s.Token.drf',actor:foe,name:'foe'});foe.rollSavingThrow=async()=>[{total:30}];
 const warns=[],w=ui.notifications.warn;ui.notifications.warn=m=>warns.push(m);
 await saveState(c,{...state(c),links:[{id:'H',tokenUuid:'Scene.s.Token.drf',actorUuid:foe.uuid,sourceToken:'x',hostile:true,depth:1,held:[]}]});
 await runAction(c,'depth-gain',[],'H');assert.match(warns.at(-1),/at capacity \(1\/1\).*Charisma modifier/);
 await saveState(c,{...state(c),links:[{...state(c).links[0],depth:0}]});
 await runAction(c,'depth-gain',[],'H');assert.match(warns.at(-1),/Not a worthy foe: CR 0 must be above 0.*GM Controls/);
 foe.system.details.cr=2;const before=chats.length;await runAction(c,'depth-gain',[],'H');
 assert.ok(chats.slice(before).some(m=>m.content.includes('succeeded on its Wisdom save')));
 c.items.push({id:'plate',type:'equipment',name:'Plate',system:{equipped:true,type:{value:'heavy'}},getFlag:()=>null});
 await runAction(c,'depth-gain',[],'H');assert.match(warns.at(-1),/Plate is equipped/);ui.notifications.warn=w;
});
// ---- Prompt routing, enforcement ----
const rt=await import('../scripts/runtime.mjs');
const player={id:'p1',name:'Player',active:true,isGM:false};
function ownedBy(a,user){a.testUserPermission=(u,l)=>u.id===user.id||u.isGM;a.hasPlayerOwner=true;return a;}
function withPlayer(fn){return async()=>{game.users.push(player);const emit=game.socket.emit;try{await fn();}finally{game.users.splice(game.users.indexOf(player),1);game.socket.emit=emit;rt.ctx.decider=null;}};}
function answer(reply){game.socket.emit=(_n,m)=>{if(m.type==='rpc')setTimeout(()=>rt.rpcReply({id:m.id,result:reply(m.payload)}),0);};}
test('A player rolls their own creature’s save on their client; the result comes back to the GM',withPlayer(async()=>{
 const c=actor('rsc',3,'sorcery'),pc=ownedBy(actor('rspc'),player);let asked=null;answer(p=>{asked=p;return {total:20};});
 assert.equal(await rt.saveRoll(c,pc),true);assert.equal(asked.op,'save');assert.equal(asked.dc,14);
}));
test('Choices go to the requesting player; GM approval is asked only for NPC effects',withPlayer(async()=>{
 const npc=actor('rnpc');npc.testUserPermission=(u)=>u.isGM;npc.hasPlayerOwner=false;const pc=ownedBy(actor('rpc2'),player);
 rt.ctx.decider=player;answer(p=>p.op==='prompt'?{action:'ok',link:'x'}:null);
 const r=await rt.prompt('Pick','<p>x</p>');assert.equal(r.link,'x','dialog answered by the player');
 const confirms=[];const orig=foundry.applications.api.DialogV2.confirm;foundry.applications.api.DialogV2.confirm=async o=>{confirms.push(o.window.title);return true;};
 assert.equal(await rt.approve('Pain Resonance on PC',[pc]),true);assert.equal(confirms.length,0,'no approval for player-owned creatures');
 assert.equal(await rt.approve('Pain Resonance on NPC',[npc]),true);assert.equal(confirms.length,0,'default: no GM approval step at all');
 settings.set('promptRouting','both');assert.equal(await rt.approve('Pain Resonance on NPC',[npc]),true);settings.set('promptRouting','owner');assert.deepEqual(confirms,['Approve Empath action'],'opt-in approval still works');
 foundry.applications.api.DialogV2.confirm=orig;
}));
test('An unanswered player prompt falls back to the GM after the timeout',withPlayer(async()=>{
 settings.set('promptTimeout',0.01);rt.ctx.decider=player;game.socket.emit=()=>{};dialogs.length=0;dialogs.push({action:'ok',v:'gm'});
 const r=await rt.prompt('Pick','<p>x</p>');settings.set('promptTimeout',90);assert.equal(r.v,'gm');
}));
test('An allied player creature chooses for itself whether to fail the depth save',withPlayer(async()=>{
 const {runAction}=await import('../scripts/actions.mjs');const c=actor('rdc',3,'crowds'),pc=ownedBy(actor('rdpc'),player);
 registry.set('Scene.s.Token.rdpc',{uuid:'Scene.s.Token.rdpc',actor:pc,name:'pc'});
 await saveState(c,{...state(c),links:[{id:'A',tokenUuid:'Scene.s.Token.rdpc',actorUuid:pc.uuid,sourceToken:'x',hostile:false,depth:0,held:[]}]});
 let title=null;answer(p=>{title=p.title;return {action:'fail'};});
 await runAction(c,'depth-gain',[],'A');assert.equal(title,'Link depth: your choice');assert.equal(state(c).links[0].depth,1);
}));
const en=await import('../scripts/enforce.mjs');
test('Challenge Heart blocks a frightened creature from leaving the aura (with an override)',async()=>{
 const c=actor('chc',13,'terror'),foe=actor('chfoe');foe.statuses=new Set(['frightened']);
 const scene={id:'chs',grid:{size:100,distance:5},tokens:[]};const src={id:'cs',uuid:'Scene.chs.Token.cs',parent:scene,x:0,y:0,width:1,height:1,elevation:0,disposition:1,actor:c};
 const ft={id:'cf',uuid:'Scene.chs.Token.cf',name:'foe',parent:scene,x:300,y:0,width:1,height:1,elevation:0,disposition:-1,actor:foe};scene.tokens.push(src,ft);c.getActiveTokens=()=>[src];
 let reissued=null;ft.update=async(ch,o)=>{reissued={ch,o};};
 assert.equal(en.guardMovement(ft,{x:600},{},game.user.id),undefined,'moving within the 50 ft aura is fine');
 assert.equal(en.guardMovement(ft,{x:1200},{},game.user.id),false,'leaving the aura is blocked');
 await new Promise(r=>setTimeout(r,5));assert.deepEqual(reissued,{ch:{x:1200},o:{empathOverride:true}},'confirmed override re-issues the move');
 assert.equal(en.guardMovement(ft,{x:1200},{empathOverride:true},game.user.id),undefined);
});
test('The Right Place at the Right Time moves the Empath the same way, capped by speed',async()=>{
 const c=actor('rpc',3,'sorcery');c.system.attributes.movement={walk:30};const ally=actor('rpally');
 const scene={id:'rps',grid:{size:100,distance:5},tokens:[]};const src={id:'s',uuid:'Scene.rps.Token.s',parent:scene,x:0,y:0,width:1,height:1,elevation:0,actor:c};
 const at={id:'a',uuid:'Scene.rps.Token.a',name:'ally',parent:scene,x:900,y:0,width:1,height:1,actor:ally};registry.set(at.uuid,at);c.getActiveTokens=()=>[src];
 let moved=null;src.update=async ch=>{moved=ch;};
 await en.doFollow(c,`${at.uuid}|900|0`);assert.deepEqual(moved,{x:600,y:0},'45 ft move capped to 30 ft speed');
 await assert.rejects(en.doFollow(c,`${at.uuid}|100|0`),/already used/);en.resetFollow(at.uuid);
});
test('Cloud Mind hides the Empath only from players whose character was affected',async()=>{
 const c=actor('cmc',15,'sorcery'),pc=actor('cmpc');c.isOwner=false;await effect(pc,c,null,'cloud');
 const saved=game.user;game.user={...player,character:pc};assert.equal(en.cloudHidden({actor:c}),true);
 game.user={...player,character:actor('cmother')};assert.equal(en.cloudHidden({actor:c}),false);game.user=saved;assert.equal(en.cloudHidden({actor:c}),false,'GM always sees');
});
test('Forced attacks pick the strongest weapon and resolve the hit against AC without GM input',async()=>{
 const {weaponResolution}=await import('../scripts/actions.mjs');
 globalThis.Roll=class{constructor(f){this.f=f;}evaluateSync({minimize,maximize}={}){const m=this.f.match(/(\d+)d(\d+)\s*\+?\s*(\d+)?/);const n=+m[1],d=+m[2],b=+(m[3]??0);this.total=(minimize?n:maximize?n*d:n)+b;return this;}async evaluate(){this.total=5;return this;}async toMessage(){}};
 const c=actor('wrc',17,'terror'),npc=actor('wrnpc');npc.testUserPermission=u=>u.isGM;npc.hasPlayerOwner=false;npc.system.attributes.ac.value=15;
 const mk=(id,formula,total)=>({id,type:'attack',name:id,attack:{type:{classification:'weapon'}},getDamageConfig:()=>({rolls:[{parts:[formula],data:{}}]}),rollAttack:async(cfg,dlg)=>{mk.used={id,cfg,dlg};return [{total,isCritical:false,isFumble:false}];},rollDamage:async()=>[{total:9,options:{type:'slashing'}}]});
 const dagger=mk('dagger','1d4+2',20),axe=mk('greataxe','1d12+4',16);
 npc.items.push({id:'w1',type:'weapon',name:'Dagger',system:{activities:[dagger]}},{id:'w2',type:'weapon',name:'Greataxe',system:{activities:[axe]}});dagger.item={name:'Dagger'};axe.item={name:'Greataxe'};
 const dmg=[];npc.applyDamage=async d=>dmg.push(d);settings.set('confirmDamage',false);
 const before=dialogs.length;assert.equal(await weaponResolution(c,npc,npc,{mode:1,title:'Fear’s End'}),true);settings.set('confirmDamage',true);
 assert.equal(mk.used.id,'greataxe','strongest average damage chosen');assert.equal(mk.used.dlg.configure,false,'NPC attack fast-forwarded');
 assert.equal(dmg.length,1,'16 vs AC 15 hits and damage applies');assert.equal(dialogs.length,before,'no GM dialogs');
});
test('Total cover is detected from walls when forming links',async()=>{
 const rt2=await import('../scripts/runtime.mjs');const scene={id:'cov',grid:{size:100}};canvas.ready=true;canvas.scene=scene;
 globalThis.CONFIG.Canvas={polygonBackends:{sight:{testCollision:(a,b)=>b.x>500}}};
 const a={parent:scene,x:0,y:0,width:1,height:1},b={parent:scene,x:300,y:0,width:1,height:1},c={parent:scene,x:600,y:0,width:1,height:1};
 assert.equal(rt2.totalCover(a,b),false);assert.equal(rt2.totalCover(a,c),true);
 canvas.ready=false;canvas.scene=null;delete globalThis.CONFIG.Canvas;assert.equal(rt2.totalCover(a,c),false,'no canvas: defer to GM');
});
test('Jump Scare: chosen ally gets advantage against the foe and skips its next turn automatically',async()=>{
 const {runAction}=await import('../scripts/actions.mjs');
 const c=actor('jsc',13,'terror'),foe=actor('jsfoe'),ally=actor('jsally');foe.statuses=new Set(['frightened']);
 sceneWith(['jse',c,0,1],['jsa',ally,100,1],['jsf',foe,200,-1]);c.getActiveTokens=()=>[c.token];
 await saveState(c,{...state(c),links:[{id:'H',tokenUuid:foe.token.uuid,actorUuid:foe.uuid,sourceToken:c.token.uuid,hostile:true,depth:3,held:[]}]});
 dialogs.push({action:'ok',ally:ally.token.uuid});await runAction(c,'jump',[],foe.token.uuid);
 assert.equal(state(c).links[0].depth,0);assert.equal(markers(ally,'jump-skip').length,1);
 game.user.targets=new Set([{actor:foe}]);const cfg={subject:{actor:ally,item:{type:'weapon'}},rolls:[{parts:[],options:{}}]};call('dnd5e.preRollAttack',cfg,{},{});game.user.targets=new Set();
 assert.equal(cfg.rolls[0].options.advantage,true);
});
// ---- 1.6.0: player-facing flows ----
const hpDamage=a=>{a.applyDamage=async d=>{a.system.attributes.hp.value-=d.reduce((n,x)=>n+x.value,0);};return a;};
test('Spell payment is worked out automatically: casting link first, hostile depth worth 2',async()=>{
 const {autoPayment,planPayment}=await import('../scripts/core.mjs');
 const links=[{id:'A',depth:3,hostile:false},{id:'H',depth:2,hostile:true}];
 assert.deepEqual(autoPayment(links,'A',1),{A:2,H:0});
 assert.deepEqual(autoPayment(links,'A',3),{A:3,H:2},'6 energy: 3 allied + 2 hostile (7, one over, allowed)');
 assert.deepEqual(autoPayment(links,'H',2),{A:0,H:2});
 assert.deepEqual(autoPayment(links,'A',2,{bodyFuel:true}),{A:2,H:0});
 for(const [c,l]of [['A',1],['A',3],['H',2],['H',3]])planPayment(links,autoPayment(links,c,l),l);
 assert.throws(()=>autoPayment(links,'A',4),/Not enough link depth/);
});
test('Form Link with nothing targeted offers the linkable creatures; type comes from disposition',async()=>{
 const {runAction}=await import('../scripts/actions.mjs');const c=actor('flc',5,'crowds'),foe=actor('flfoe'),golem=actor('flgolem'),far=actor('flfar');golem.system.details.type.value='construct';
 sceneWith(['e',c,0,1],['f',foe,200,-1],['g',golem,100,-1],['x',far,5000,-1]);c.getActiveTokens=()=>[c.token];let shown=null;
 const wait=foundry.applications.api.DialogV2.wait;foundry.applications.api.DialogV2.wait=async o=>{shown=o.content;return {action:'ok',token:foe.token.uuid};};
 try{await runAction(c,'link',[]);}finally{foundry.applications.api.DialogV2.wait=wait;}
 assert.ok(shown.includes('flfoe')||shown.includes('>f '),'eligible creature offered');assert.ok(!shown.includes(golem.token.uuid)&&!shown.includes(far.token.uuid),'constructs and out-of-range creatures are not offered');
 assert.deepEqual(state(c).links.map(l=>[l.tokenUuid,l.hostile]),[[foe.token.uuid,true]]);
});
test('A player cannot override link eligibility',withPlayer(async()=>{
 const {runAction}=await import('../scripts/actions.mjs');const c=actor('poc',5,'crowds'),golem=actor('pogolem');golem.system.details.type.value='construct';
 sceneWith(['pe',c,0,1],['pg',golem,100,-1]);golem.token.documentName='Token';c.getActiveTokens=()=>[c.token];rt.ctx.decider=player;answer(()=>({action:'ok',override:'on',hostile:'on'}));
 await assert.rejects(runAction(c,'link',[golem.token.uuid]),/Cannot link with pg: Construct/);assert.equal(state(c).links.length,0);
}));
test('Module damage applies immediately and the card’s Undo restores the HP',async()=>{
 const {runAction}=await import('../scripts/actions.mjs');const c=actor('udc',3,'terror'),foe=hpDamage(actor('udfoe'));
 registry.set('Scene.s.Token.udf',{uuid:'Scene.s.Token.udf',actor:foe,name:'foe'});
 await saveState(c,{...state(c),links:[{id:'H',tokenUuid:'Scene.s.Token.udf',actorUuid:foe.uuid,sourceToken:'x',hostile:true,depth:1,held:[]}]});
 const before=chats.length;dialogs.length=0;dialogs.push({number:'1'});await runAction(c,'pain',[],'L:H');
 assert.equal(foe.system.attributes.hp.value,25,'5 damage applied with no confirmation');
 const card=chats.slice(before).find(m=>m.content.includes('data-empath-action="undo-damage"'));assert.ok(card);assert.ok(card.content.includes('HP 30 → 25'));
 const id=card.content.match(/data-param="([^"]+)"/)[1];await runAction(c,'undo-damage',[],id);assert.equal(foe.system.attributes.hp.value,30);
 await assert.rejects(runAction(c,'undo-damage',[],id),/no longer be undone/);
});
test('A player’s spell is used on the player’s own client, not the GM’s',withPlayer(async()=>{
 const c=ownedBy(actor('psc'),player);await saveState(c,{...state(c),links:[{id:'a',depth:3,hostile:false,held:[],actorUuid:c.uuid,tokenUuid:'missing'}]});
 const i=item({_id:'spell',name:'Bless',type:'spell',system:{level:1,properties:[],duration:{units:'minute',value:1},activities:{act1:{_id:'act1',type:'utility',duration:{concentration:false}}}},flags:{[ID]:{knownSpell:true,spellSource:'x'}}},c);c.items.push(i);
 let asked=null;rt.ctx.decider=player;answer(p=>{if(p.op==='use'){asked=p;return {ok:true};}return {action:'ok',origin:'caster',auto:'on'};});
 const used=nativeUsages.length;await castSpell(c,'spell',[]);
 assert.equal(asked?.op,'use');assert.equal(asked.usage.consume.spellSlot,false);assert.equal(nativeUsages.length,used,'GM client did not use the activity');
 assert.equal(state(c).links[0].depth,1,'2 energy paid automatically from the casting link');assert.equal(state(c).links[0].held.length,1);
}));
test('Cloud Mind never targets the Empath, and skips allies unless asked',async()=>{
 const {runAction}=await import('../scripts/actions.mjs');const c=actor('cl2',15,'sorcery'),foe=actor('cl2foe'),ally=actor('cl2ally');
 c.items.push({id:'cm',type:'feat',name:'Cloud Mind',flags:{[ID]:{key:'cloud'}},system:{uses:{max:1,spent:0}},getFlag:(i,k)=>k==='key'?'cloud':null,update:async()=>{}});
 sceneWith(['ce',c,0,1],['cf',foe,100,-1],['ca',ally,200,1]);c.getActiveTokens=()=>[c.token];for(const a of [c,foe,ally])a.rollSavingThrow=async()=>[{total:1}];
 dialogs.length=0;dialogs.push({action:'ok'});await runAction(c,'cloud',[]);
 assert.equal(markers(foe,'cloud').length,1);assert.equal(markers(ally,'cloud').length,0);assert.equal(markers(c,'cloud').length,0);
});
test('Players are stopped by movement limits without an override; only the GM is asked',async()=>{
 const c=actor('mgc',13,'terror'),foe=actor('mgfoe');foe.statuses=new Set(['frightened']);
 const scene={id:'mgs',grid:{size:100,distance:5},tokens:[]};const src={id:'ms',uuid:'Scene.mgs.Token.ms',parent:scene,x:0,y:0,width:1,height:1,elevation:0,disposition:1,actor:c};
 const ft={id:'mf',uuid:'Scene.mgs.Token.mf',name:'foe',parent:scene,x:300,y:0,width:1,height:1,elevation:0,disposition:-1,actor:foe};scene.tokens.push(src,ft);c.getActiveTokens=()=>[src];
 let reissued=false;ft.update=async()=>{reissued=true;};const saved=game.user;game.user={...player};
 assert.equal(en.guardMovement(ft,{x:1200},{},'p1'),false);await new Promise(r=>setTimeout(r,5));game.user=saved;assert.equal(reissued,false,'no override offered to players');
});
