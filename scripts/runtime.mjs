import {ID,profile,clamp} from './core.mjs';
export const esc = s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export const uid=()=>foundry.utils.randomID();
export const clone=x=>foundry.utils.deepClone(x);
// castIds currently being activated by castSpell(); preUseActivity refuses any other use of a cast copy.
export const castAuth=new Set();
// >0 while the module itself rolls an attack (Fear of Failure reroll, Fear's End…) so hit triggers do not re-offer reactions.
export const internalRolls={count:0};
// Core Foundry status icons (bundled with every install) so each marker is distinguishable at a glance.
const ICONS_BY_KEY={fervor:'icons/svg/sword.svg',mantle:'icons/svg/upgrade.svg',apathy:'icons/svg/sleep.svg',disappointment:'icons/svg/target.svg',terrorize:'icons/svg/terror.svg',fomo:'icons/svg/hazard.svg','fomo-fear':'icons/svg/terror.svg',intrusive:'icons/svg/daze.svg','intrusive-fear':'icons/svg/terror.svg',death:'icons/svg/skull.svg',cloud:'icons/svg/invisible.svg','probe-immune':'icons/svg/cancel.svg',valor:'icons/svg/bless.svg',trepidation:'icons/svg/downgrade.svg',turbulence:'icons/svg/wing.svg',violence:'icons/svg/fire.svg',excitement:'icons/svg/lightning.svg',fatigue:'icons/svg/net.svg',vigilance:'icons/svg/holy-shield.svg',trouble:'icons/svg/aura.svg','jump-ally':'icons/svg/lightning.svg','jump-skip':'icons/svg/cancel.svg','turbulence-miss':'icons/svg/wing.svg'};
export const state=actor=>({...{links:[],auras:[],disabled:false,armorOverride:false,moodBlocked:null},...clone(actor.getFlag(ID,'state')??{})});
export async function saveState(actor,s){await actor.setFlag(ID,'state',s);game.empath?.refresh?.();}
export function primaryGM(){return game.users.filter(u=>u.active&&u.isGM).sort((a,b)=>a.id.localeCompare(b.id))[0];}
export const isAuthority=()=>game.user.id===primaryGM()?.id;
/* ---------------- Prompt routing ----------------
   All automation runs on the designated GM client. Dialogs are shown to whoever should decide:
   - `to:'gm'`            GM adjudication (damage confirms, NPC choices, approvals).
   - `to:<Actor>`         that actor's active player owner, else the GM (e.g. the linked creature's own choice).
   - `to:<User>`          that user.
   - default              ctx.decider: the player who requested the current action (null = GM).
   A player who does not answer in time (or disconnects) falls back to the GM's own dialog. */
export const ctx={decider:null};
export function setting(key,fallback){try{return game.settings.get(ID,key);}catch{return fallback;}}
export function playerFor(actor){
 if(!actor?.testUserPermission)return null;
 const users=game.users.filter(u=>u.active&&!u.isGM&&actor.testUserPermission(u,'OWNER'));
 return users.find(u=>u.character?.id===actor.id)??users[0]??null;
}
export function hasPlayerOwner(actor){return Boolean(actor?.hasPlayerOwner??game.users.some(u=>!u.isGM&&actor?.testUserPermission?.(u,'OWNER')));}
function resolveUser(to){
 const mode=setting('promptRouting','owner');if(mode==='gm'||to==='gm')return null;
 if(to?.documentName==='User'||to instanceof (globalThis.User??class{}))return to;
 if(to)return playerFor(to);
 return ctx.decider;
}
const pendingRpc=new Map();
export function rpc(user,payload){
 const id=foundry.utils.randomID(),timeout=Number(setting('promptTimeout',90))*1000;
 return new Promise(resolve=>{
  const done=v=>{clearTimeout(timer);clearInterval(watch);pendingRpc.delete(id);resolve(v);};
  const timer=setTimeout(()=>done({timeout:true}),timeout);
  // A player who disconnects mid-prompt must not stall the queue for the whole timeout.
  const watch=setInterval(()=>{if(!game.users.get(user.id)?.active)done({timeout:true});},2000);watch.unref?.();
  pendingRpc.set(id,done);
  game.socket.emit(`module.${ID}`,{type:'rpc',id,userId:game.user.id,to:user.id,payload});
  ui.notifications.info(`Empath: waiting for ${user.name}…`);
 });
}
// Called by main.mjs's socket listener.
export function rpcReply(msg){const f=pendingRpc.get(msg.id);if(f)f(msg.result??null);}
export async function rpcServe(msg){
 const p=msg.payload??{};let result=null;
 try{
  if(p.op==='prompt')result=await localPrompt(p.title,p.content,p.buttons);
  else if(p.op==='confirm')result=await localConfirm(p.title,p.text);
  else if(p.op==='save'){const a=await fromUuid(p.actorUuid);if(a?.isOwner){const rolls=await a.rollSavingThrow({ability:p.ability??'wis',target:p.dc,rolls:[{options:{advantage:p.mode===1,disadvantage:p.mode===-1}}]},{configure:true});result=rolls?.length?{total:rolls[0].total}:{total:null};}}
  else if(p.op==='use'){
   // The GM creates the casting copy; wait briefly for it to reach this client, then use it here.
   let item=null;for(let i=0;i<40&&!item;i++){item=await fromUuid(p.itemUuid);if(!item)await new Promise(r=>setTimeout(r,100));}
   const activity=item?.isOwner?item.system.activities.get(p.activityId):null;
   if(activity){castAuth.add(p.castId);try{result={ok:Boolean(await activity.use(p.usage,{configure:false}))};}finally{castAuth.delete(p.castId);}}
  }
  else if(p.op==='skill'){const a=await fromUuid(p.actorUuid);if(a?.isOwner){const rolls=await a.rollSkill({skill:p.skill},{configure:true});result=rolls?.length?{total:rolls[0].total}:{total:null};}}
 }catch(e){console.error('Empath rpc',e);}
 game.socket.emit(`module.${ID}`,{type:'rpc-reply',id:msg.id,userId:game.user.id,to:msg.userId,result});
}
async function localPrompt(title,content,buttons){
 return foundry.applications.api.DialogV2.wait({window:{title},content:`<div class="empath-dialog standard-form">${content}</div>`,buttons:buttons.map(b=>({...b,callback:(_event,button,dialog)=>({action:b.action,...Object.fromEntries(new FormData(button.form??dialog.form))} )})),rejectClose:false});
}
async function localConfirm(title,text){return Boolean(await foundry.applications.api.DialogV2.confirm({window:{title},content:`<p>${esc(text)}</p>`,rejectClose:false}));}
export async function prompt(title,content,buttons=[{action:'ok',label:'Confirm',default:true}],{to}={}) {
 const user=resolveUser(to);
 if(user&&user.id!==game.user.id&&user.active){const r=await rpc(user,{op:'prompt',title,content,buttons:buttons.map(({action,label,default:d})=>({action,label,default:d}))});if(!r?.timeout)return r;title=`${title} (no answer from ${user.name})`;}
 return localPrompt(title,content,buttons);
}
export function form(content){return `<div class="empath-fields">${content}</div>`;}
export function input(name,label,value='',type='number',extra=''){return `<label>${esc(label)}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;}
export function check(name,label,checked=false){return `<label><input name="${name}" type="checkbox" ${checked?'checked':''}> ${esc(label)}</label>`;}
export function select(name,label,options,value=''){return `<label>${esc(label)}<select name="${name}">${options.map(o=>`<option value="${esc(o.id)}" ${String(o.id)===String(value)?'selected':''}>${esc(o.name)}</option>`).join('')}</select></label>`;}
// Toast for the GM and for the actor's player (refusals and errors should reach whoever is playing the Empath).
export function tell(actor,text,level='warn'){
 ui.notifications[level]?.(text);
 for(const u of new Set([playerFor(actor),ctx.decider].filter(u=>u&&u.id!==game.user.id)))game.socket.emit(`module.${ID}`,{type:'notice',userId:game.user.id,to:u.id,text:String(text).slice(0,300),level});
}
export async function confirm(title,text,{to}={}){
 const user=resolveUser(to);
 if(user&&user.id!==game.user.id&&user.active){const r=await rpc(user,{op:'confirm',title,text});if(!r?.timeout)return Boolean(r);title=`${title} (no answer from ${user.name})`;}
 return localConfirm(title,text);
}
// GM approval for a player's action that affects a creature no player owns ("Both" routing).
export async function approve(text,actors=[]){
 if(!ctx.decider||setting('promptRouting','owner')!=='both')return true;
 if(actors.length&&actors.every(a=>hasPlayerOwner(a)))return true;
 return localConfirm('Approve Empath action',`${ctx.decider.name}: ${text}`);
}
export async function chat(actor,title,text,{gm=false,owners=false,buttons=[],flags={}}={}){
 // owners: whisper to GMs and the users who own this actor (used for reaction offers).
 const whisper=owners?game.users.filter(u=>u.isGM||actor.testUserPermission?.(u,'OWNER')).map(u=>u.id):gm?game.users.filter(u=>u.isGM).map(u=>u.id):[];
 return ChatMessage.create({speaker:ChatMessage.getSpeaker({actor}),content:`<div class="empath-card"><h3>${esc(title)}</h3><p>${esc(text)}</p>${buttons.map(b=>`<button type="button" data-empath-action="${b.action}" data-caster="${esc(actor.uuid)}" ${b.data?`data-param="${esc(b.data)}"`:''}>${esc(b.label)}</button>`).join('')}</div>`,whisper,flags:{[ID]:{caster:actor.uuid,...flags}}});
}
export function allActors(){const m=new Map(game.actors.map(a=>[a.uuid,a]));for(const scene of game.scenes)for(const token of scene.tokens??[])if(token.actor)m.set(token.actor.uuid,token.actor);return [...m.values()];}
export function actorToken(actor){return canvas?.tokens?.controlled?.find(t=>t.actor?.uuid===actor.uuid)?.document??actor.getActiveTokens?.(true,true)?.[0]??canvas?.scene?.tokens?.find(t=>t.actor?.uuid===actor.uuid);}
export function distance(a,b){
 if(!a||!b||a.parent?.id!==b.parent?.id)return Infinity;
 const grid=a.parent.grid,size=grid.size??100,units=grid.distance??5;
 const ax=a.x,ay=a.y,aw=a.width*size,ah=a.height*size,bx=b.x,by=b.y,bw=b.width*size,bh=b.height*size;
 const dx=Math.max(ax-bx-bw,bx-ax-aw,0),dy=Math.max(ay-by-bh,by-ay-ah,0),dz=Math.abs((a.elevation??0)-(b.elevation??0));
 // Grid-independent nearest-edge distance. Total cover is always adjudicated by the GM.
 return Math.max(Math.hypot(dx,dy)/size*units,dz);
}
// Total cover: walls block sight between token centres. Only checkable on the scene this client has loaded;
// elsewhere (or on API changes) it reports false and the GM's judgement applies.
export function totalCover(a,b){
 try{
  if(!a||!b||!canvas?.ready||canvas.scene?.id!==a.parent?.id||a.parent?.id!==b.parent?.id)return false;
  const size=a.parent.grid?.size??100,c=t=>({x:t.x+t.width*size/2,y:t.y+t.height*size/2});
  const backend=CONFIG.Canvas?.polygonBackends?.sight;if(!backend?.testCollision)return false;
  return Boolean(backend.testCollision(c(a),c(b),{type:'sight',mode:'any'}));
 }catch{return false;}
}
export async function linkedActor(link){return (await fromUuid(link.tokenUuid))?.actor??await fromUuid(link.actorUuid);}
export async function linkedToken(link){return fromUuid(link.tokenUuid);}
export function armorBlocked(actor,s=state(actor)){
 if(s.armorOverride)return false;
 return actor.system.attributes?.ac?.calc==='natural'||actor.items.some(i=>i.type==='equipment'&&i.system.equipped&&['light','medium','heavy'].includes(i.system.type?.value));
}
export function eligibility(actor,target,s=state(actor)){
 const problems=[];if(s.disabled)problems.push('Aura disabled by GM');if(armorBlocked(actor,s))problems.push('Caster has armor or natural armor');
 return problems.concat(targetEligibility(actor,target));
}
// Target-only checks. Caster-side problems (armor, GM disable) suspend the aura but must not break existing links.
export function targetEligibility(actor,target){
 const problems=[];if(!target)return ['Missing creature'];
 if(target.system.details?.type?.value==='construct')problems.push('Construct');
 if(Number(target.system.abilities?.int?.value??0)<=1)problems.push('Intelligence 1 or lower');
 if(['dr','di'].some(k=>Array.from(target.system.traits?.[k]?.value??[]).includes('psychic')))problems.push('Psychic resistance or immunity');
 const p=profile(actor);if(p.icon==='terror'&&p.level<9&&Array.from(target.system.traits?.ci?.value??[]).includes('frightened'))problems.push('Frightened immunity before Terror level 9');
 return problems;
}
export async function chooseLink(actor,{side,targets=[],label='Choose link',to,prefer}={}){
 const links=state(actor).links.filter(l=>side==='ally'?!l.hostile:side==='enemy'?l.hostile:true);
 if(prefer){const l=links.find(x=>x.id===prefer);if(l)return l;if(state(actor).links.some(x=>x.id===prefer))throw new Error(`That needs ${side==='ally'?'an allied':'a hostile'} link.`);}
 if(links.length===1)return links[0]; // nothing to choose
 if(!links.length)throw new Error(`No ${side==='ally'?'allied ':side==='enemy'?'hostile ':''}link available. Form a link first.`);
 let selected=links.find(l=>targets.includes(l.tokenUuid));if(selected)return selected;
 const options=[];for(const l of links){const t=await linkedToken(l);options.push({id:l.id,name:`${t?.name??'Missing token'} — ${l.depth} depth (${l.hostile?'hostile':'allied'})`});}
 const r=await prompt(label,form(select('link','Link',options)),undefined,{to});return r?links.find(l=>l.id===r.link):null;
}
export async function effect(target,caster,link,key,{name=key,statuses=[],data={},duration=0,expiry=null}={}){
 // In combat, a turn-boundary expiry is authoritative: world time jumps at each new round, which would end
 // round-counted effects (Inspirational Mantle) before the Empath's turn.
 const timed=duration&&!(expiry&&game.combat?.started);
 const record={caster:caster.uuid,linkId:link?.id??null,key,...data,expiry,endsAt:timed?game.time.worldTime+duration:null};
 const [e]=await target.createEmbeddedDocuments('ActiveEffect',[{name:`Empath: ${name}`,img:ICONS_BY_KEY[key]??'icons/magic/control/hypnosis-mesmerism-eye.webp',origin:caster.uuid,transfer:false,disabled:false,changes:[],statuses,duration:timed?{value:duration,units:'seconds'}:{},flags:{[ID]:record}}]);return e;
}
export function markers(actor,key){if(!actor?.effects)return [];return [...actor.effects].filter(e=>!e.disabled&&e.getFlag(ID,'key')&&(key?e.getFlag(ID,'key')===key:true));}
export async function deleteMarkers(actor,predicate){if(!actor?.effects)return;const ids=actor.effects.filter(e=>e.flags?.[ID]&&predicate(e.flags[ID])).map(e=>e.id);if(ids.length)await actor.deleteEmbeddedDocuments('ActiveEffect',ids);}
export async function spend(actor,linkId,cost){const s=state(actor),l=s.links.find(l=>l.id===linkId);if(!l||l.depth<cost)throw new Error(`Requires ${cost} link depth.`);l.depth-=cost;await saveState(actor,s);return l;}
export async function numberPrompt(title,label,value,min,max,opts={}){if(max<min)throw new Error(`Not enough link depth (need at least ${min}).`);const r=await prompt(title,form(input('number',label,value,'number',`min="${min}" max="${max}" step="1"`)),undefined,opts);if(!r)return null;const n=Number(r.number);if(!Number.isInteger(n)||n<min||n>max)throw new Error(`Choose a whole number from ${min} to ${max}.`);return n;}
export async function saveRoll(caster,target,{voluntary=false,depth=false}={}){
 const p=profile(caster);let buttons=[{action:'roll',label:`Roll Wisdom (DC ${p.dc})`,default:true}];if(voluntary)buttons.push({action:'fail',label:'Voluntarily fail'});
 if(voluntary){const r=await prompt('Empath saving throw',`<p>${esc(target.name)} — Wisdom DC ${p.dc}.</p>`,buttons,{to:target});if(!r)return null;if(r.action==='fail')return false;}
 let mode=0;const fearImmune=Array.from(target.system.traits?.ci?.value??[]).includes('frightened');if(p.icon==='terror'){if(p.level>=9&&fearImmune)mode=1;else if(depth)mode=p.level<9&&target.getFlag(ID,'fearAdvantage')?1:-1;}
 return rollFor(target,'save',{ability:'wis',dc:p.dc,mode});
}
// Roll a save (true/false vs dc) or skill (total) for an actor: its player rolls on their own client with the dnd5e
// dialog; NPCs (or offline players) are fast-forwarded on the GM client when "auto-roll" is on.
export async function rollFor(actor,op,{ability='wis',dc,mode=0,skill}={}){
 const user=setting('promptRouting','owner')==='gm'?null:playerFor(actor);
 if(user&&user.id!==game.user.id){const r=await rpc(user,{op,actorUuid:actor.uuid,ability,dc,mode,skill});if(!r?.timeout){if(r?.total==null)return null;return op==='save'?r.total>=dc:r.total;}}
 // Rolled here: an NPC, an offline player's creature, or GM-only routing. Fast-forward unless auto-roll is off.
 const configure=!setting('autoRollNpc',true);
 const rolls=op==='save'?await actor.rollSavingThrow({ability,target:dc,rolls:[{options:{advantage:mode===1,disadvantage:mode===-1}}]},{configure}):await actor.rollSkill({skill},{configure});
 if(!rolls?.length)return null;return op==='save'?rolls[0].total>=dc:rolls[0].total;
}
// Undo records live on the GM client only (ids are unguessable; players cannot set arbitrary HP through them).
const undoLog=new Map();
const hpOf=a=>({value:Number(a.system?.attributes?.hp?.value??0),temp:Number(a.system?.attributes?.hp?.temp??0)});
// Apply damage through dnd5e, then post a card showing the HP change with an Undo button for the Empath's player and GM.
export async function applyWithUndo(caster,target,damages,title,options={}){
 const before=hpOf(target);await target.applyDamage(damages,options);const after=hpOf(target);
 const lost=(before.value-after.value)+(before.temp-after.temp),id=foundry.utils.randomID();
 undoLog.set(id,{target:target.uuid,value:before.value-after.value,temp:before.temp-after.temp});if(undoLog.size>200)undoLog.delete(undoLog.keys().next().value);
 await chat(caster,title,`${target.name} takes ${lost} damage (HP ${before.value} → ${after.value}${before.temp?`, temp ${before.temp} → ${after.temp}`:''}).`,{buttons:lost>0?[{action:'undo-damage',label:'Undo',data:id}]:[]});
 return lost;
}
export async function undoDamage(caster,id){
 const rec=undoLog.get(id);if(!rec)throw new Error('This damage can no longer be undone (already undone, or the GM reloaded).');
 const target=await fromUuid(rec.target);if(!target)throw new Error('Undo: the creature no longer exists.');undoLog.delete(id);const now=hpOf(target);
 await target.update({'system.attributes.hp.value':now.value+rec.value,'system.attributes.hp.temp':(now.temp+rec.temp)||null});
 await chat(caster,'Damage undone',`${target.name} regains ${rec.value+rec.temp} HP (now ${now.value+rec.value}).`);
}
export async function damage(caster,target,formula,title,{unavoidable=false,apply=true}={}){
 const RollClass=CONFIG.Dice.DamageRoll??Roll;const roll=await new RollClass(formula,caster.getRollData(),{type:'psychic'}).evaluate();await roll.toMessage({speaker:ChatMessage.getSpeaker({actor:caster}),flavor:title});
 const value=Math.max(0,roll.total);
 if(apply&&(!setting('confirmDamage',false)||await confirm(title,`Apply ${value} psychic damage to ${target.name}?${unavoidable?' This damage bypasses all reductions.':''}`,{to:'gm'})))await applyWithUndo(caster,target,[{value,type:'psychic'}],title,unavoidable?{ignore:true}:{});
 return roll.total;
}
export async function expireCast(caster,castId,{quiet=false}={}){
 const s=state(caster);const wasInstant=s.links.some(l=>(l.held??[]).some(h=>h.castId===castId&&h.instant));for(const l of s.links)l.held=(l.held??[]).filter(h=>h.castId!==castId);await saveState(caster,s);
 for(const a of allActors())await deleteMarkers(a,f=>f.caster===caster.uuid&&f.castId===castId);
 const copies=caster.items.filter(i=>i.getFlag(ID,'castId')===castId),copyUuids=new Set(copies.map(i=>i.uuid));
 // dnd5e 6 on Foundry 14 places spell areas as Regions (flags.dnd5e.item = casting item); older builds used MeasuredTemplates.
 const ours=d=>d.getFlag?.(ID,'castId')===castId||copyUuids.has(d.flags?.dnd5e?.item);
 for(const scene of game.scenes){
  for(const [collection,type] of [['regions','Region'],['templates','MeasuredTemplate']]){
   const docs=scene[collection];if(!docs?.filter)continue;const ids=docs.filter(ours).map(d=>d.id);
   if(ids.length)try{await scene.deleteEmbeddedDocuments(type,ids);}catch(e){console.warn(`Empath: could not remove ${type}`,e);}
  }
 }
 if(copies.length)await caster.deleteEmbeddedDocuments('Item',copies.map(i=>i.id));
 if(!quiet&&!wasInstant)await chat(caster,'Link-held spell ended','Its tracked effects and areas were removed. Remove any summons or untracked changes manually.',{owners:true});
}
export async function breakLink(caster,linkId,{forced=false}={}){
 if(!forced&&!game.user.isGM)throw new Error('Only the GM can manually break links.');
 const s=state(caster),l=s.links.find(l=>l.id===linkId);if(!l)return;for(const h of l.held??[])await expireCast(caster,h.castId);
 const fresh=state(caster);fresh.links=fresh.links.filter(x=>x.id!==linkId);fresh.auras=fresh.auras.filter(a=>a.linkId!==linkId);await saveState(caster,fresh);
 for(const a of allActors())await deleteMarkers(a,f=>f.caster===caster.uuid&&f.linkId===linkId);
 await chat(caster,'Link broken','Depth and effects tied to this link end.');
}
