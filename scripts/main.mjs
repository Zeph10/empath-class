import {ID,profile,levelOf,AURAS,clamp} from './core.mjs';
import {FEATURES,PASSIVE,featureKey} from './features.mjs';
import {EmpathManager} from './app.mjs';
import {runAction,gainDepth,syncAuras} from './actions.mjs';
import {guardMovement,seedPositions,previousPosition,fatigueCost,offerFollow,resetFollow,cloudHidden,refreshCloud} from './enforce.mjs';
import {apathyMarkers,applyApathy,attackIsRelevant,onAttack,terrorizeTurn,intrusiveTurn,jumpScareOffers} from './triggers.mjs';
import {state,saveState,primaryGM,isAuthority,allActors,markers,deleteMarkers,linkedActor,linkedToken,actorToken,distance,eligibility,targetEligibility,armorBlocked,breakLink,expireCast,chat,confirm,prompt,esc,saveRoll,damage,castAuth,ctx,rpcServe,rpcReply,setting} from './runtime.mjs';
let app,queue=Promise.resolve();const inFlight=new Set(),combatBefore=new Map(),seenTurns=new Set();
function enqueue(fn,requester=null){const p=queue.then(fn).catch(e=>{console.error('Empath',e);ui.notifications.error(`Empath: ${e.message}`);if(requester)notify(requester,`Empath: ${e.message}`,'error');});queue=p;return p;}
// Sends a toast to a specific player's client (GM → player feedback for requested actions).
function notify(user,text,level='info'){if(!user||user.id===game.user.id)return;game.socket.emit(`module.${ID}`,{type:'notice',userId:game.user.id,to:user.id,text:String(text).slice(0,300),level});}
function owner(actor,user){return user?.isGM||actor?.testUserPermission(user,'OWNER');}
function targeted(){return [...game.user.targets].map(t=>t.document.uuid);}
// Foundry 14 removed User#updateTokenTargets. Targeting is only a convenience for native roll dialogs (target AC),
// so it must never block an action: try each API in turn and swallow failures.
function setTargets(ids){
 try{
  const layer=canvas?.tokens;
  if(typeof layer?.setTargets==='function')return void layer.setTargets(ids,{mode:'replace'});
  if(typeof game.user.updateTokenTargets==='function')return void game.user.updateTokenTargets(ids);
  for(const t of [...game.user.targets])t.setTarget?.(false,{releaseOthers:false,groupSelection:true});
  for(const id of ids)layer?.get?.(id)?.setTarget?.(true,{releaseOthers:false,groupSelection:true});
 }catch(e){console.warn('Empath: could not set targets',e);}
}
async function dispatch(actor,key,param='',targets=targeted(),requester=null){
 if(!actor||!owner(actor,game.user)&&!requester)throw new Error('You do not own this Empath.');
 const gm=primaryGM();if(!gm)throw new Error('An active GM is required for Empath guided automation.');
 if(!isAuthority()){game.socket.emit(`module.${ID}`,{type:'action',userId:game.user.id,actorUuid:actor.uuid,key,param,targets:targets.slice(0,50)});return;}
 return enqueue(async()=>{
  // GM-only routing keeps the old up-front confirmation; otherwise the player decides and the GM approves NPC effects.
  if(requester&&setting('promptRouting','owner')==='gm'&&!await confirm('Empath player action',`${requester.name} requests ${FEATURES.find(f=>f.key===key)?.name??key} for ${actor.name}. Resolve now?`))return notify(requester,'Empath: the GM declined or postponed that request.','warn');
  const old=targeted(),ids=[];for(const u of targets){const t=await fromUuid(u);if(t?.parent?.id===canvas.scene?.id)ids.push(t.id);}
  setTargets(ids);
  ctx.decider=requester;
  try{await runAction(actor,key,targets,param);}finally{ctx.decider=null;setTargets(old.map(u=>u.split('.').at(-1)));game.empath.refresh();}
 },requester);
}
Hooks.once('init',()=>{
 game.settings.register(ID,'spellPack',{name:'Spell compendium collection ID',hint:'Leave blank to find the Item compendium named Spells 2024. If its label differs, enter its collection ID, e.g. world.spells-2024.',scope:'world',config:true,type:String,default:''});
 const S=(k,o)=>game.settings.register(ID,k,{scope:'world',config:true,...o});
 S('promptRouting',{name:'Who answers Empath prompts',hint:'Player decides: players make their own choices and roll their own saves, with no GM step. The other options add a GM approval for effects on NPCs, or put everything on the GM screen.',type:String,choices:{owner:'Player decides (no GM step)',both:'Player decides, GM approves NPC effects',gm:'GM only'},default:'owner'});
 S('promptTimeout',{name:'Player prompt timeout (seconds)',hint:'After this, an unanswered player prompt falls back to the GM.',type:Number,default:90});
 S('autoRollNpc',{name:'Auto-roll module saves for NPCs',hint:'Fast-forward saves and attacks the module rolls for NPCs. Players still roll their own saves with the dnd5e dialog.',type:Boolean,default:true});
 S('confirmDamage',{name:'GM confirms module damage',hint:'Off: Pain Resonance, Violence, Fear’s End, Body Fuel and forced attacks apply immediately, and the chat card has an Undo button. On: the GM is asked first.',type:Boolean,default:false});
 S('npcTerrorize',{name:'Terrorize: NPC choice',hint:'What a Terrorized NPC does at its turn start. Player characters are always asked.',type:String,choices:{act:'Act normally and save at turn end',forfeit:'End its turn to end the fear',ask:'Ask the GM'},default:'act'});
 S('enforceMovement',{name:'Enforce aura movement limits',hint:'Block moves that break Trouble or Challenge Heart (with an override for forced movement) and report Fatigue’s difficult-terrain cost.',type:Boolean,default:true});
 S('offerFollow',{name:'Offer “The Right Place at the Right Time”',hint:'When a linked creature moves in combat, offer the Empath a one-click follow move.',type:Boolean,default:true});
 S('cloudVisibility',{name:'Cloud Mind hides the Empath from affected players',hint:'Players whose character failed the Cloud Mind save no longer see the Empath’s token.',type:Boolean,default:true});
 game.settings.register(ID,'autoDepth',{name:'Prompt depth saves at linked turn end',scope:'world',config:true,type:Boolean,default:true});
 game.settings.register(ID,'rangeChecks',{name:'Check link range when tokens move',hint:'Uses nearest token edges and elevation; full cover and unusual grid distances are GM judgments.',scope:'world',config:true,type:Boolean,default:true});
 game.settings.register(ID,'rollBonuses',{name:'Apply supported Empath roll modifiers',hint:'Fervor, Mantle, Fear of Disappointment, Valor and Trepidation. See AUTOMATION.md for conditional damage limits.',scope:'world',config:true,type:Boolean,default:true});
 game.empath={open(actor){if(!app)app=new EmpathManager(actor);else if(actor)app.actor=actor;app.render({force:true});return app;},use:dispatch,refresh:(foundry.utils.debounce??(f=>f))(()=>{if(app?.rendered)app.render();},100),version:'1.6.1'};
});
Hooks.once('ready',()=>{
 if(game.system.id!=='dnd5e')return ui.notifications.error('Empath requires the dnd5e system.');
 // Accept any dnd5e 6.x (6.0.5 and 6.0.6 verified); warn only on a different major version.
 if(String(game.system.version).split('.')[0]!=='6')ui.notifications.warn(`Empath was built for D&D5e 6.x (verified 6.0.6); this world runs ${game.system.version}. Check compatibility before play.`);
 game.socket.on(`module.${ID}`,async msg=>{
  if(msg?.type==='rpc'){if(msg.to===game.user.id&&game.users.get(msg.userId)?.isGM)rpcServe(msg);return;}
  if(msg?.type==='rpc-reply'){if(msg.to===game.user.id)rpcReply(msg);return;}
  if(msg?.type==='notice'){if(msg.to===game.user.id&&game.users.get(msg.userId)?.isGM)ui.notifications[['info','warn','error'].includes(msg.level)?msg.level:'info'](String(msg.text));return;}
  if(!isAuthority()||!msg||typeof msg.userId!=='string')return;const user=game.users.get(msg.userId);if(!user?.active)return;
  try{
   if(msg.type==='attack'){if(typeof msg.attacker==='string')enqueue(()=>onAttack({attacker:msg.attacker,attackerToken:typeof msg.attackerToken==='string'?msg.attackerToken:null,targets:Array.isArray(msg.targets)?msg.targets.filter(u=>typeof u==='string').slice(0,20):[],hit:[true,false].includes(msg.hit)?msg.hit:null,ranged:Boolean(msg.ranged),weapon:Boolean(msg.weapon)}));return;}
   if(msg.type==='apathy-spent'){const src=await fromUuid(msg.actorUuid);if(src&&typeof msg.messageId==='string')enqueue(()=>spendApathy(src,msg.messageId));return;}
   const actor=await fromUuid(msg.actorUuid);if(!owner(actor,user))return;
   if(msg.type==='consume'){const e=actor.effects.get(msg.effectId);if(!e?.getFlag(ID,'key'))return;if(['advPending','damagePending'].includes(msg.field))await e.setFlag(ID,msg.field,false);return;}
   const allowed=new Set([...FEATURES.map(f=>f.key),'spells','cast','depth-gain','edit','controls','energize','end-aura','end-cast','contest','resolve','react-turbulence','undo-damage']);
   if(msg.type!=='action'||!levelOf(actor)||!allowed.has(msg.key)||['edit','controls'].includes(msg.key)&&!user.isGM)return;
   if(inFlight.has(user.id)){ui.notifications.warn(`Empath: ${user.name} already has a queued request.`);notify(user,'Empath: your previous action is still resolving. Answer its open dialog first.','warn');return;}inFlight.add(user.id);
   await dispatch(actor,msg.key,String(msg.param??'').slice(0,100),Array.isArray(msg.targets)?msg.targets.filter(u=>typeof u==='string'&&u.length<160).slice(0,50):[],user);inFlight.delete(user.id);
  }catch(e){inFlight.delete(user.id);console.error('Empath socket',e);ui.notifications.error(`Empath: ${e.message}`);notify(user,`Empath: ${e.message}`,'error');}
 });
 if(!primaryGM()&&[...game.actors].some(a=>a.isOwner&&levelOf(a)))ui.notifications.warn('Empath: no GM is connected. Empath actions need a GM logged in (the GM’s client applies effects to other creatures).');
});
Hooks.on('dnd5e.preUseActivity',(activity,usage)=>{
 const item=activity.item,actor=activity.actor;if(!actor)return;
 if(item.getFlag(ID,'castInstance')){
  // Only the module's own castSpell() may activate a cast copy; sheet clicks would otherwise recast for free.
  if(!castAuth.has(item.getFlag(ID,'castId'))){ui.notifications.warn('Empath: this is a held casting copy. Cast again from the Empath Manager (or use the chat card buttons of the original cast).');return false;}
  usage.concentration={begin:false,end:null};usage.consume=usage.consume===false?false:{...usage.consume,spellSlot:false};return;
 }
 let key=activity.getFlag?.(ID,'action')??activity.flags?.[ID]?.action;
 // Plutonium-imported features may arrive without activity flags (or with auto-generated activities): route by item.
 if(!key&&levelOf(actor)){const k=featureKey(item);if(k)key=PASSIVE.has(k)?'manager':k;}
 if(key){if(key==='manager')game.empath.open(actor);else dispatch(actor,key).catch(e=>ui.notifications.error(e.message));return false;}
 if(item.getFlag(ID,'knownSpell')){dispatch(actor,'cast',item.id).catch(e=>ui.notifications.error(e.message));return false;}
 if(state(actor).links.length&&activity.requiresConcentration&&levelOf(actor)){
  ui.notifications.warn('Empath: ordinary concentration is unavailable while linked.');return false;
 }
 if(isAuthority())enqueue(async()=>{for(const target of allActors())await deleteMarkers(target,f=>f.caster===actor.uuid&&f.key==='cloud');});
});
function consumeFlag(actor,e,field){
 if(actor.isOwner)e.setFlag(ID,field,false).catch(console.error);
 else game.socket.emit(`module.${ID}`,{type:'consume',userId:game.user.id,actorUuid:actor.uuid,effectId:e.id,field});
}
function rollActor(config){return config.subject?.actor??config.subject;}
function nativeRollEffects(config,type,message={}){
 if(!game.settings.get(ID,'rollBonuses'))return;const actor=rollActor(config);if(!actor?.effects)return;
 const originItem=message.data?.system?.item?.uuid?fromUuidSync(message.data.system.item.uuid):null;
 const magicalSave=originItem?.type==='spell'||originItem?.system?.properties?.has?.('mgc');
 const effects=markers(actor),attack=type==='attack',skill=['skill','check'].includes(type),save=type==='save',weapon=config.subject?.item?.type==='weapon'||config.subject?.type==='attack'&&config.subject?.attack?.type?.classification!=='spell';
 for(const r of config.rolls??[]){r.options??={};r.parts??=[];
  for(const e of effects){const f=e.flags[ID];
   if(attack&&f.key==='apathy'&&!f.spentOn)r.options.criticalSuccess=21;
   if(attack&&f.key==='fervor'&&weapon){if(f.advPending)r.options.advantage=true;if(f.crit)r.options.criticalSuccess=Math.max(1,(r.options.criticalSuccess??20)-f.crit);}
   if(attack&&f.key==='mantle'){r.parts.push(String(f.bonus));if(f.crit)r.options.criticalSuccess=Math.max(1,(r.options.criticalSuccess??20)-f.crit);}
   if(attack&&f.key==='disappointment')r.options.advantage=true;
   if(attack&&f.key==='jump-ally'&&[...(game.user.targets??[])].some(t=>t.actor?.uuid===f.foe))r.options.advantage=true;
   if(f.key==='valor'&&(skill||f.energized&&(attack||save)))r.parts.push('1d4');
   if(f.key==='vigilance'&&save&&magicalSave){r.options.advantage=true;if(f.energized&&originItem?.type==='spell'){r.options.empathVigilance=originItem.name;}}
   if(f.key==='trepidation'&&(attack||save))r.parts.push(f.energized?'-2d4kh1':'-1d4');
  }
  // Apathy suppression wins over every critical expansion.
  if(attack&&apathyMarkers(actor).length)r.options.criticalSuccess=21;
 }
}
// Skill and tool rolls also fire preRollAbilityCheck in dnd5e 6.x, so listening to Skill too would double Valor.
for(const [hook,type]of [['Attack','attack'],['AbilityCheck','check'],['SavingThrow','save']])Hooks.on(`dnd5e.preRoll${hook}`,(config,_dialog,message)=>nativeRollEffects(config,type,message));
Hooks.on('dnd5e.postRollAttack',(rolls,{subject})=>{
 if(!rolls?.length||!subject?.actor||!(subject.item?.type==='weapon'||subject.type==='attack'&&subject.attack?.type?.classification!=='spell'))return;for(const e of markers(subject.actor,'fervor'))if(e.getFlag(ID,'advPending'))consumeFlag(subject.actor,e,'advPending');
});
Hooks.on('dnd5e.preRollDamage',config=>{
 if(!game.settings.get(ID,'rollBonuses'))return;const subject=config.subject,actor=subject?.actor;if(!actor)return;
 const e=markers(actor,'fervor').find(e=>e.getFlag(ID,'damagePending'));
 if(e&&(subject.item?.type==='weapon'||subject.type==='attack'&&subject.attack?.type?.classification!=='spell')&&config.rolls?.[0]){config.rolls[0].parts??=[];config.rolls[0].parts.push(String(e.getFlag(ID,'bonus')));config.empathFervor=e.id;}
 const buff=markers(actor,'disappointment');if(buff.length&&subject.type==='attack'){let extra=0;for(const e of buff){const f=e.flags[ID],caster=fromUuidSync(f.caster);const linked=state(caster??actor).links.some(l=>[...game.user.targets].some(t=>t.document.uuid===l.tokenUuid));extra+=Number(f.extra)*(linked?8:2);}if(extra>0)config.rolls.push({parts:[String(extra)],data:{},options:{type:'psychic',critical:{multiplyNumeric:false}}});}
 if(apathyMarkers(actor).length){config.isCritical=false;for(const r of config.rolls??[]){r.options??={};r.options.isCritical=false;}}
});
Hooks.on('dnd5e.rollDamage',(rolls,{subject})=>{
 if(!rolls?.length||!subject?.actor)return;
 if((subject.item?.type==='weapon'||subject.type==='attack'&&subject.attack?.type?.classification!=='spell')&&game.settings.get(ID,'rollBonuses'))for(const e of markers(subject.actor,'fervor'))if(e.getFlag(ID,'damagePending'))consumeFlag(subject.actor,e,'damagePending');
 if(isAuthority())enqueue(async()=>{
  await deleteMarkers(subject.actor,f=>f.key==='apathy'&&f.spentOn);
  const ap=apathyMarkers(subject.actor);if(ap.length)await chat(subject.actor,'Apathy',`When this damage is applied it is automatically reduced by ${ap.reduce((n,e)=>n+Number(e.getFlag(ID,'reduction')??0),0)} (minimum 0), then Apathy ends.`);
  const death=markers(subject.actor,'death').filter(e=>!e.getFlag(ID,'noted'));for(const e of death)await e.setFlag(ID,'noted',true);
  if(death.length)await chat(subject.actor,'Fear of Death','The native Apply Damage button doubles this damage when its source is identifiable. Do not also double the roll manually. For external/manual damage without a source message, the GM doubles it.');
 });
});

function damageSource(options){const msg=options.origin??options.originatingMessage;const u=msg?.system?.item?.uuid??msg?.getFlag?.('dnd5e','item')?.uuid;const item=u?fromUuidSync(u):null;return item?.actor??null;}
Hooks.on('dnd5e.preCalculateDamage',(target,damages,options)=>{
 if(!game.settings.get(ID,'rollBonuses'))return;const source=damageSource(options);if(!source)return;
 const immune=markers(source,'terrorize').some(e=>e.getFlag(ID,'caster')===target.uuid);
 const doubled=markers(source,'death').length>0;
 for(const d of damages){if(Number(d.value)<=0||['healing','temphp','maximum'].includes(d.type))continue;if(immune)d.value=0;else if(doubled)d.value*=2;}
 // Apathy: the marked creature's next damage instance is reduced (also shown in dnd5e's damage previews).
 const msg=options.origin??options.originatingMessage;const ap=apathyMarkers(source,msg?.id);
 if(ap.length)applyApathy(damages,ap.reduce((n,e)=>n+Number(e.getFlag(ID,'reduction')??0),0));
});
// Apathy is spent only when damage is actually applied (calculateDamage also runs for previews).
Hooks.on('dnd5e.applyDamage',(target,amount,options)=>{
 if(!game.settings.get(ID,'rollBonuses'))return;const source=damageSource(options),msg=options.origin??options.originatingMessage;
 if(!source||!msg?.id||!apathyMarkers(source).some(e=>!e.getFlag(ID,'spentOn')))return;
 if(isAuthority())enqueue(()=>spendApathy(source,msg.id));else game.socket.emit(`module.${ID}`,{type:'apathy-spent',userId:game.user.id,actorUuid:source.uuid,messageId:msg.id});
});
async function spendApathy(source,messageId){
 const fresh=markers(source,'apathy').filter(e=>!e.getFlag(ID,'spentOn'));if(!fresh.length)return;
 for(const e of fresh)await e.setFlag(ID,'spentOn',messageId);
 const total=fresh.reduce((n,e)=>n+Number(e.getFlag(ID,'reduction')??0),0);
 await chat(source,'Apathy',`${source.name}’s damage was reduced by ${total} (minimum 0). Apathy ends after this damage instance.`);
}
// Attack results drive Fear of Missing Out, reaction offers (Fear of Failure, Meeting of Minds, Turbulence) and Turbulence misses.
Hooks.on('dnd5e.rollAttack',(rolls,{subject}={})=>{
 const actor=subject?.actor,r=rolls?.[0];if(!actor||!r)return;
 const targets=[...game.user.targets].filter(t=>t.document).map(t=>t.document);
 const atkTok=(actor.token??actorToken(actor))?.uuid??null;
 if(!attackIsRelevant(actor,atkTok,targets.map(t=>t.actor).filter(Boolean)))return;
 const hit=r.isCritical?true:r.isFumble?false:(r.options?.target!==undefined&&r.options?.target!==null&&Number.isFinite(Number(r.options.target)))?Boolean(r.isSuccess):null;
 const actionType=String(subject.getActionType?.(r.options?.attackMode)??subject.actionType??'');
 const payload={attacker:actor.uuid,attackerToken:atkTok,targets:targets.map(t=>t.uuid),hit,ranged:actionType.startsWith('r'),weapon:actionType.endsWith('wak')};
 if(isAuthority())enqueue(()=>onAttack(payload));else game.socket.emit(`module.${ID}`,{type:'attack',userId:game.user.id,...payload});
});
for(const h of ['updateActiveEffect','createActiveEffect','deleteActiveEffect'])Hooks.on(h,()=>game.empath?.refresh());

Hooks.on('createActiveEffect',(e,_options,userId)=>{
 if(!isAuthority()||e.getFlag(ID,'key'))return;enqueue(async()=>{
  const origin=e.origin?await fromUuid(e.origin):null,item=origin?.item??(origin?.documentName==='Item'?origin:null);const f=item?.flags?.[ID];if(!f?.castInstance)return;
  await e.update({[`flags.${ID}.caster`]:f.caster,[`flags.${ID}.linkId`]:f.linkId,[`flags.${ID}.castId`]:f.castId,[`flags.${ID}.key`]:'spell-effect'});
 });
});
// dnd5e 6: tag spell-area Regions with the cast id before creation (runs on the placing client; no GM update needed).
Hooks.on('dnd5e.createMeasuredTemplate',(activity,regionData)=>{const f=activity?.item?.flags?.[ID];if(!f?.castInstance||!Array.isArray(regionData))return;for(const r of regionData){r.flags??={};r.flags[ID]={castId:f.castId,caster:f.caster};}});
Hooks.on('createMeasuredTemplate',(t)=>{
 if(!isAuthority())return;enqueue(async()=>{const activity=t.getFlag('dnd5e','origin')?await fromUuid(t.getFlag('dnd5e','origin')):null,item=activity?.item??activity;const f=item?.flags?.[ID];if(f?.castInstance)await t.update({[`flags.${ID}.castId`]:f.castId,[`flags.${ID}.caster`]:f.caster});});
});
async function expireTimed(){
 for(const caster of allActors().filter(a=>levelOf(a))){
  const s=state(caster);let changed=false;for(const l of s.links)for(const h of l.held??[])if(h.endsAt&&h.endsAt<=game.time.worldTime)await expireCast(caster,h.castId);
  const current=state(caster);const expired=current.auras.filter(a=>a.endsAt<=game.time.worldTime);if(expired.length){current.auras=current.auras.filter(a=>a.endsAt>game.time.worldTime);await saveState(caster,current);for(const a of allActors())await deleteMarkers(a,f=>expired.some(x=>x.id===f.auraId)&&f.caster===caster.uuid);}
 }
 for(const a of allActors())await deleteMarkers(a,f=>f.endsAt&&f.endsAt<=game.time.worldTime);
}
Hooks.on('updateWorldTime',()=>{if(isAuthority())enqueue(expireTimed);});
async function checkRanges(){
 if(!game.settings.get(ID,'rangeChecks'))return;
 for(const caster of allActors().filter(a=>levelOf(a))){const s=state(caster),p=profile(caster);
  // GM-disabled aura or armor suspends link use (actions refuse) but does not destroy links and depth.
  const over=s.links.filter(l=>l.depth>p.capacity);if(over.length){for(const l of s.links)l.depth=Math.min(l.depth,p.capacity);await saveState(caster,s);}
  for(const link of s.links){const target=await linkedToken(link),source=await fromUuid(link.sourceToken);if(!target||!source){await breakLink(caster,link.id,{forced:true});continue;}
   const out=distance(source,target)>p.range;const invalid=targetEligibility(caster,target.actor).length>0&&!link.override;
   if(invalid){await breakLink(caster,link.id,{forced:true});continue;}
   if(out&&!link.lingering){if(p.level>=7&&await confirm('Lingering Link',`${caster.name}: retain the link to ${target.name} until your turn ends?`,{to:caster})){const fresh=state(caster);const l=fresh.links.find(x=>x.id===link.id);if(l){l.lingering=true;await saveState(caster,fresh);}}else await breakLink(caster,link.id,{forced:true});}
   if(!out&&link.lingering){const fresh=state(caster),l=fresh.links.find(x=>x.id===link.id);if(l){l.lingering=false;await saveState(caster,fresh);}}
  }
  await syncAuras(caster);
 }
}
Hooks.on('preUpdateToken',(doc,change,options,userId)=>guardMovement(doc,change,options,userId));
// Foundry 13+ token drags also run through preMoveToken; guard there too (destination shape varies by version).
Hooks.on('preMoveToken',(doc,movement,operation)=>{try{const d=movement?.destination??movement?.waypoints?.at?.(-1)??movement;if(!d||(d.x===undefined&&d.y===undefined))return;const change={};for(const k of ['x','y','elevation'])if(d[k]!==undefined)change[k]=d[k];return guardMovement(doc,change,operation??{},game.user.id);}catch(e){console.warn('Empath movement guard',e);}});
Hooks.on('updateToken',(doc,change,options)=>{const prior=isAuthority()&&('x'in change||'y'in change)?previousPosition(doc,options):null;if(isAuthority()&&doc.actor&&['x','y','elevation','width','height','disposition'].some(k=>k in change))enqueue(async()=>{
 const before=new Set(markers(doc.actor).filter(e=>['violence','fatigue'].includes(e.getFlag(ID,'key'))).map(e=>e.id));before.trouble=new Set(markers(doc.actor,'trouble').map(e=>e.id));
 await checkRanges();
 for(const e of markers(doc.actor,'intrusive-fear')){const caster=await fromUuid(e.getFlag(ID,'caster'));if(caster&&distance(actorToken(caster),doc)>profile(caster).range)await doc.actor.deleteEmbeddedDocuments('ActiveEffect',[e.id]);}
 await entryTriggers(doc,change,before);
 if(prior){await fatigueCost(doc,prior);await offerFollow(doc,prior);}
});});
Hooks.on('deleteToken',()=>{if(isAuthority())enqueue(checkRanges);});
Hooks.on('updateToken',(_doc,change)=>{if('x'in change||'y'in change)game.empath?.refresh();});
Hooks.on('targetToken',user=>{if(user?.id===game.user.id)game.empath?.refresh();});
Hooks.on('canvasReady',()=>{seedPositions();refreshCloud();if(isAuthority())enqueue(checkRanges);});
Hooks.on('createToken',doc=>{if(isAuthority())previousPosition(doc);});
// Cloud Mind: affected players stop seeing the Empath's token.
Hooks.on('refreshToken',token=>{if(cloudHidden(token.document))token.visible=false;});
for(const h of ['createActiveEffect','deleteActiveEffect'])Hooks.on(h,e=>{if(e.getFlag?.(ID,'key')==='cloud')refreshCloud();});
Hooks.on('updateActor',(actor,change)=>{game.empath?.refresh();if(isAuthority()&&change.system&&levelOf(actor))enqueue(checkRanges);});
Hooks.on('updateItem',(item,change)=>{game.empath?.refresh();if(isAuthority()&&item.actor&&change.system&&levelOf(item.actor))enqueue(checkRanges);});
async function entryTriggers(token,change,before=new Set()){
 // Only markers created by this move count as an entry into the aura.
 for(const e of markers(token.actor,'violence').filter(e=>!before.has(e.id))){
  // "Willingly moves into": entering on its own turn counts as willing; being moved on someone else's turn does not.
  const willing=game.combat?.started&&game.combat.combatant?.tokenId===token.id;
  if(!willing){await chat(token.actor,'Violence',`${token.name} entered Violence outside its own turn (treated as involuntary). It still saves if it starts its turn there.`,{gm:true});continue;}
  const caster=await fromUuid(e.getFlag(ID,'caster'));if(caster)await violence(caster,token.actor,e);
 }
 for(const caster of allActors().filter(a=>profile(a).icon==='terror'&&profile(a).level>=13)){
  const ownFear=markers(token.actor).some(e=>e.getFlag(ID,'caster')===caster.uuid&&e.statuses?.has?.('frightened'));
  if(!setting('enforceMovement',true)&&ownFear&&distance(actorToken(caster),token)>profile(caster).range)await chat(caster,'Challenge Heart','A frightened creature moved outside the aura. The GM checks whether that movement was voluntary; undo or adjust it if forbidden.',{gm:true});
 }
 if(!setting('enforceMovement',true))for(const e of markers(token.actor,'fatigue').filter(e=>!before.has(e.id)))await chat(token.actor,'Fatigue movement',`Movement inside the aura costs ${e.getFlag(ID,'energized')?3:2} feet per foot. Adjust the ruler/movement allowance manually.`,{gm:true});
 // Trouble: enemies cannot leave the aura. The marker is removed by syncAuras when they exit, so detect that.
 const now=new Set(markers(token.actor).map(e=>e.id));if(!setting('enforceMovement',true)&&[...(before.trouble??[])].some(id=>!now.has(id)))await chat(token.actor,'Trouble boundary',`GM: ${token.name} left the Trouble aura. Enemies cannot leave it; undo the move if it was voluntary.`,{gm:true});
}
async function violence(caster,target,e){const saved=await saveRoll(caster,target);if(saved===false)await damage(caster,target,`${3+Number(e.getFlag(ID,'energized')??0)}d8`,'Violence');}
async function expireAt(actor,phase){
 for(const a of allActors())for(const e of markers(a)){
  const f=e.flags[ID],x=f.expiry;if(x?.caster!==actor.uuid||x.phase!==phase)continue;
  if(x.remaining>1)await e.setFlag(ID,'expiry',{...x,remaining:x.remaining-1});else await a.deleteEmbeddedDocuments('ActiveEffect',[e.id]);
 }
}
async function endTurn(combatant){
 if(!combatant?.actor)return;const actor=combatant.actor;
 if(combatant.token?.uuid)resetFollow(combatant.token.uuid);
 await deleteMarkers(actor,f=>f.key==='apathy'&&f.spentOn);
 await expireAt(actor,'end');
 for(const caster of allActors().filter(a=>levelOf(a))){
  const s=state(caster);if(caster.uuid===actor.uuid){for(const l of s.links){if(l.lingering){const source=await fromUuid(l.sourceToken),target=await linkedToken(l);if(distance(source,target)>profile(caster).range)await breakLink(caster,l.id,{forced:true});}}
   const fresh=state(caster);if(fresh.moodBlocked&&fresh.moodBlocked.created!==combatant.stamp){fresh.moodBlocked=null;await saveState(caster,fresh);}for(const observer of allActors())for(const e of markers(observer,'cloud').filter(e=>e.getFlag(ID,'caster')===caster.uuid)){const ot=actorToken(observer);if(distance(actorToken(caster),ot)>profile(caster).range)await observer.deleteEmbeddedDocuments('ActiveEffect',[e.id]);}
  }
  const link=state(caster).links.find(l=>l.tokenUuid===combatant.token?.uuid);if(link&&game.settings.get(ID,'autoDepth'))await gainDepth(caster,link);
 }
 for(const e of markers(actor,'terrorize')){const caster=await fromUuid(e.getFlag(ID,'caster'));if(caster&&await saveRoll(caster,actor)===true)await actor.deleteEmbeddedDocuments('ActiveEffect',[e.id]);}
}
async function startTurn(combatant){
 if(!combatant?.actor)return;const actor=combatant.actor;await expireAt(actor,'start');
 if(levelOf(actor)){
  for(const l of state(actor).links)for(const h of l.held??[])if(h.instant)await expireCast(actor,h.castId,{quiet:true});
  for(const aura of state(actor).auras){const cost=AURAS[aura.key]?.sustain??0;if(!cost)continue;const link=state(actor).links.find(l=>l.id===aura.linkId);if(!link||link.depth<cost){await runAction(actor,'end-aura',[],aura.id);await chat(actor,AURAS[aura.key].name,`${AURAS[aura.key].name} ends: not enough depth to sustain it (${cost} needed).`);continue;}
   if(!aura.autoSustain){const r=await prompt('Sustain empowered aura',`<p>${esc(actor.name)}: pay ${cost} depth to sustain ${esc(AURAS[aura.key].name)} (link has ${link.depth})? While sustaining you can only use Empath abilities as your action.</p>`,[{action:'yes',label:'Sustain',default:true},{action:'always',label:'Always sustain'},{action:'no',label:'End aura'}],{to:actor});
    if(!r||r.action==='no'){await runAction(actor,'end-aura',[],aura.id);continue;}
    if(r.action==='always'){const st=state(actor),x=st.auras.find(x=>x.id===aura.id);if(x){x.autoSustain=true;await saveState(actor,st);}}}
   const s=state(actor),l=s.links.find(l=>l.id===aura.linkId);l.depth-=cost;await saveState(actor,s);
  }
  await syncAuras(actor);
 }
 for(const e of markers(actor,'violence')){const caster=await fromUuid(e.getFlag(ID,'caster'));if(caster)await violence(caster,actor,e);}
 if(await terrorizeTurn(actor))return; // turn forfeited
 // Jump Scare: the ally who acted early skips its next regular turn.
 const skip=markers(actor,'jump-skip');if(skip.length){await actor.deleteEmbeddedDocuments('ActiveEffect',skip.map(e=>e.id));await chat(actor,'Jump Scare',`${actor.name} already acted (Jump Scare) and skips this turn.`);if(game.combat?.combatant?.actor===actor)await game.combat.nextTurn();return;}
 await jumpScareOffers(actor,combatant.token);
 if(markers(actor,'excitement').length)await chat(actor,'Excitement',`${actor.name} has an extra action this turn: Dash, Disengage, Hide or Utilize.`,{owners:true});
 await intrusiveTurn(actor,combatant.token);
}
Hooks.on('preUpdateCombat',(combat,change)=>{if('turn'in change||'round'in change)combatBefore.set(combat.id,{actor:combat.combatant?.actor,token:combat.combatant?.token,started:combat.started,stamp:`${combat.id}:${combat.round}:${combat.turn}`});});
Hooks.on('updateCombat',(combat,change)=>{
 if(!isAuthority()||!('turn'in change||'round'in change)||!combat.started)return;const stamp=`${combat.id}:${combat.round}:${combat.turn}`;if(seenTurns.has(stamp))return;seenTurns.add(stamp);if(seenTurns.size>500)seenTurns.clear();const previous=combatBefore.get(combat.id);const current={actor:combat.combatant?.actor,token:combat.combatant?.token};
 const prior=combat.previous,priorCombatant=prior?.combatantId?combat.combatants.get(prior.combatantId):null;
 // combat.previous is set on every client; preUpdateCombat only fires for whoever clicked Next/End Turn.
 const ended=priorCombatant&&Number(prior.round)>0?{actor:priorCombatant.actor,token:priorCombatant.token,started:true,stamp:`${combat.id}:${prior.round}:${prior.turn}`}:(previous?.started&&game.user.id===primaryGM()?.id&&previous.stamp?previous:null);
 combatBefore.delete(combat.id);
 enqueue(async()=>{if(ended)await endTurn(ended);await expireTimed();await checkRanges();await startTurn(current);});
});
Hooks.on('deleteCombat',(combat)=>{combatBefore.delete(combat.id);seenTurns.clear();if(isAuthority())enqueue(async()=>{for(const a of allActors().filter(a=>levelOf(a))){const s=state(a);if(s.moodBlocked){s.moodBlocked=null;await saveState(a,s);}}});});
Hooks.on('dnd5e.restCompleted',(actor,result,config)=>{if(!isAuthority())return;enqueue(async()=>{
 if(config.type==='long'||result.longRest){for(const a of allActors())await deleteMarkers(a,f=>f.key==='probe-immune'&&f.defender===actor.uuid);}
});});
Hooks.on('renderActorSheetV2',(sheet,element)=>{
 if(!sheet.actor?.isOwner||!levelOf(sheet.actor))return;const header=element.querySelector?.('.window-header');if(!header||header.querySelector('.empath-sheet-button'))return;const button=document.createElement('button');button.type='button';button.className='header-control icon fa-solid fa-link empath-sheet-button';button.dataset.tooltip='Open Empath Manager';button.title='Open Empath Manager';button.addEventListener('click',()=>game.empath.open(sheet.actor));const close=header.querySelector('[data-action="close"]');if(close)close.before(button);else header.append(button);
});
Hooks.on('renderChatMessageHTML',(_message,element)=>{
 for(const button of element.querySelectorAll?.('[data-empath-action]')??[]){
  let known=null;try{known=fromUuidSync(button.dataset.caster);}catch{}if(known&&!owner(known,game.user)){button.remove();continue;}
  button.addEventListener('click',async()=>{const actor=await fromUuid(button.dataset.caster);if(!owner(actor,game.user))return;button.disabled=true;dispatch(actor,button.dataset.empathAction,button.dataset.param??'').catch(e=>{button.disabled=false;ui.notifications.error(e.message);});});
 }
});

Hooks.on('dnd5e.postBuildAttackRollConfig',(process,config)=>{if(process.empathMode===undefined)return;config.options??={};config.options.advantageMode=process.empathMode;config.options.advantage=process.empathMode===1;config.options.disadvantage=process.empathMode===-1;});

// Energized Vigilance: a successful save against a spell means the spell has no effect on that creature.
Hooks.on('dnd5e.rollSavingThrow',(rolls,data={})=>{
 const r=rolls?.[0],spell=r?.options?.empathVigilance;if(!spell||!r.isSuccess)return;const actor=data.subject??null;
 if(isAuthority()||game.user.isGM||actor?.isOwner)ChatMessage.create({speaker:ChatMessage.getSpeaker({actor}),whisper:game.users.filter(u=>u.isGM||actor?.testUserPermission?.(u,'OWNER')).map(u=>u.id),content:`<div class="empath-card"><h3>Vigilance</h3><p>${esc(actor?.name??'The creature')} succeeded on its save: ${esc(spell)} has no effect on it. Do not apply its damage or riders.</p></div>`});
});
