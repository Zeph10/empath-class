// Rule enforcement chosen in settings: aura movement limits, "The Right Place at the Right Time" follow moves,
// Fatigue movement cost, and Cloud Mind per-player token hiding.
import {ID,profile,levelOf} from './core.mjs';
import {state,allActors,markers,actorToken,distance,chat,confirm,setting} from './runtime.mjs';

const hostileTo=(a,b)=>Number(a?.disposition)!==Number(b?.disposition)&&Number(b?.disposition)!==0;
const at=(doc,c={})=>({id:doc.id,parent:doc.parent,disposition:doc.disposition,x:c.x??doc.x,y:c.y??doc.y,width:c.width??doc.width,height:c.height??doc.height,elevation:c.elevation??doc.elevation});

/* ---------- Movement limits (Trouble, Challenge Heart) ---------- */
export function movementViolation(doc,change){
 if(!['x','y','elevation'].some(k=>k in change)||!doc.actor)return null;
 const from=at(doc),to=at(doc,change);
 for(const caster of allActors().filter(a=>levelOf(a))){
  const src=actorToken(caster);if(!src||src.id===doc.id||src.parent?.id!==doc.parent?.id)continue;
  const p=profile(caster),inNow=distance(src,from)<=p.range,inNext=distance(src,to)<=p.range;
  const trouble=state(caster).auras.find(a=>a.key==='trouble');
  if(trouble&&inNow&&!inNext&&markers(doc.actor,'trouble').some(e=>e.getFlag(ID,'caster')===caster.uuid))
   return `Trouble: ${doc.name} entered ${caster.name}’s aura and cannot leave it.`;
  if(trouble?.energized&&!inNow&&inNext&&hostileTo(src,doc))
   return `Trouble (energized): hostile creatures cannot enter ${caster.name}’s aura.`;
  if(inNow&&!inNext&&markers(doc.actor,'jump-ally').some(e=>e.getFlag(ID,'caster')===caster.uuid))
   return `Jump Scare: ${doc.name} cannot willingly leave ${caster.name}’s aura during its extra turn.`;
  if(p.icon==='terror'&&p.level>=13&&doc.actor.statuses?.has('frightened')&&inNow&&!inNext)
   return `Challenge Heart: frightened ${doc.name} cannot willingly leave ${caster.name}’s aura.`;
 }
 return null;
}
// preUpdateToken runs on the moving client and must answer synchronously, so the move is refused and re-issued
// with an override flag if the mover confirms it was forced movement or a GM ruling.
const guarding=new Set();
export function guardMovement(doc,change,options,userId){
 if(!setting('enforceMovement',true)||options?.empathOverride||userId!==game.user.id)return;
 const why=movementViolation(doc,change);if(!why)return;
 // Players are simply stopped; only the GM may override (forced movement is the GM's to apply).
 if(!game.user.isGM){ui.notifications.warn(`${why} The GM can move the token if this is forced movement.`);return false;}
 if(guarding.has(doc.id))return false;guarding.add(doc.id);
 const retry=Object.fromEntries(['x','y','elevation'].filter(k=>k in change).map(k=>[k,change[k]]));
 confirm('Movement blocked',`${why} Move anyway (forced movement or GM ruling)?`,{to:'gm'}).then(ok=>{if(ok)doc.update(retry,{empathOverride:true});}).finally(()=>guarding.delete(doc.id));
 return false;
}

/* ---------- Position tracking (authority) ---------- */
const lastPos=new Map();
export function seedPositions(scene=canvas?.scene){for(const t of scene?.tokens??[])lastPos.set(t.uuid,{x:t.x,y:t.y,elevation:t.elevation});}
// Call synchronously from updateToken: returns where the token was before this update.
export function previousPosition(doc,options){
 const prior=lastPos.get(doc.uuid)??options?.movement?.[doc.id]?.origin??null;
 lastPos.set(doc.uuid,{x:doc.x,y:doc.y,elevation:doc.elevation});return prior;
}
const feet=(doc,dx,dy)=>{const g=doc.parent.grid;return Math.hypot(dx,dy)/(g.size??100)*(g.distance??5);};

/* ---------- Fatigue: report the real movement cost ---------- */
export async function fatigueCost(doc,prior){
 if(!prior||!game.combat?.started||!setting('enforceMovement',true))return;
 for(const e of markers(doc.actor,'fatigue')){
  const caster=await fromUuid(e.getFlag(ID,'caster'));const src=caster&&actorToken(caster);if(!src)continue;
  const r=profile(caster).range;if(distance(src,at(doc,prior))>r||distance(src,doc)>r)continue; // only movement inside the aura
  const moved=feet(doc,doc.x-prior.x,doc.y-prior.y);if(moved<1)continue;const mult=e.getFlag(ID,'energized')?3:2;
  await chat(doc.actor,'Fatigue',`${doc.name} moved ${Math.round(moved)} ft inside the aura: that costs ${Math.round(moved*mult)} ft of movement (×${mult}).`,{owners:true});
 }
}

/* ---------- The Right Place at the Right Time ---------- */
const followUsed=new Set();
export function resetFollow(tokenUuid){for(const k of [...followUsed])if(k.endsWith(`|${tokenUuid}`))followUsed.delete(k);}
export async function offerFollow(doc,prior){
 if(!prior||!setting('offerFollow',true)||!game.combat?.started)return;
 const dx=doc.x-prior.x,dy=doc.y-prior.y;if(feet(doc,dx,dy)<5)return;
 for(const caster of allActors().filter(a=>levelOf(a))){
  const link=state(caster).links.find(l=>l.tokenUuid===doc.uuid);if(!link)continue;
  const key=`${caster.uuid}|${doc.uuid}`;if(followUsed.has(key))continue;
  const src=actorToken(caster);if(!src||src.parent?.id!==doc.parent?.id)continue;
  await chat(caster,'The Right Place at the Right Time',`${doc.name} moved ${Math.round(feet(doc,dx,dy))} ft. Reaction: move the same way (up to your speed).`,{owners:true,buttons:[{action:'follow',label:'Follow',data:`${doc.uuid}|${Math.round(dx)}|${Math.round(dy)}`}]});
 }
}
export async function doFollow(caster,param){
 const [uuid,dxs,dys]=String(param).split('|');const linked=await fromUuid(uuid??'');const src=actorToken(caster);
 if(!linked||!src)throw new Error('Follow: token not found on this scene.');
 const key=`${caster.uuid}|${linked.uuid}`;if(followUsed.has(key))throw new Error('This reaction was already used for this creature’s turn.');
 const g=src.parent.grid,size=g.size??100,units=g.distance??5,dx=Number(dxs)||0,dy=Number(dys)||0;
 const wanted=Math.hypot(dx,dy)/size*units,mv=caster.system.attributes?.movement??{},speed=Number(mv.speeds?.walk??mv.speed??mv.walk??30)||30; // dnd5e 6: movement.speeds.walk
 const allowed=Math.min(Math.floor(wanted/5)*5,speed);if(allowed<5)throw new Error('Not enough movement to follow.');
 const k=allowed/wanted,nx=src.x+Math.round(dx*k/size)*size,ny=src.y+Math.round(dy*k/size)*size;
 followUsed.add(key);
 await src.update({x:nx,y:ny},{empathFollow:true});
 await chat(caster,'The Right Place at the Right Time',`${caster.name} follows ${linked.name} ${allowed} ft (reaction). Walls and difficult terrain are not checked; adjust if needed.`);
}

/* ---------- Cloud Mind: hide the Empath from affected players ---------- */
export function cloudHidden(tokenDoc){
 if(game.user.isGM||!setting('cloudVisibility',true))return false;
 const caster=tokenDoc?.actor;if(!caster||caster.isOwner||!levelOf(caster))return false;
 const mine=game.user.character?[game.user.character]:(canvas?.tokens?.placeables??[]).filter(t=>t.actor?.isOwner).map(t=>t.actor);
 return mine.length>0&&mine.every(a=>markers(a,'cloud').some(e=>e.getFlag(ID,'caster')===caster.uuid));
}
export function refreshCloud(){for(const t of canvas?.tokens?.placeables??[])try{t.renderFlags?.set({refreshVisibility:true});}catch{}}
