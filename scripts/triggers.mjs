// Event-driven automation: attack-hit detection, Apathy damage reduction, and turn-start resolutions that previously
// needed "Resolve Hit / Damage". Everything that writes runs on the designated GM (authority) client.
import {ID,profile,levelOf} from './core.mjs';
import {state,allActors,markers,deleteMarkers,actorToken,distance,chat,confirm,prompt,form,select,check,esc,saveRoll,effect,internalRolls,playerFor,setting} from './runtime.mjs';
import {weaponResolution} from './actions.mjs';

const featureUses=(actor,key)=>{const i=actor.items.find(i=>i.type==='feat'&&(i.flags?.[ID]?.key===key||i.system?.identifier===`empath-${key}`));if(!i)return 0;return Math.max(0,Number(i.system.uses?.max||1)-Number(i.system.uses?.spent??0));};
const moodBlocked=caster=>Boolean(state(caster).moodBlocked?.created);
const hostileTo=(a,b)=>Number(a?.disposition)!==Number(b?.disposition);

/* ---------------- Apathy ---------------- */
// Unspent Apathy markers, plus those already being spent by this same damage message (one instance may hit several targets).
export function apathyMarkers(actor,messageId=null){return markers(actor,'apathy').filter(e=>{const s=e.getFlag(ID,'spentOn');return !s||(messageId&&s===messageId);});}
export function applyApathy(damages,reduction){
 let left=Math.max(0,Number(reduction)||0);
 for(const d of damages){if(left<=0)break;if(Number(d.value)<=0||['healing','temphp','maximum'].includes(d.type))continue;const cut=Math.min(Number(d.value),left);d.value=Number(d.value)-cut;left-=cut;}
 return Number(reduction)-left;
}

/* ---------------- Attack hits ---------------- */
// Cheap client-side filter so ordinary attacks do not generate socket traffic.
export function attackIsRelevant(attacker,attackerToken,targetActors){
 if(markers(attacker).some(e=>['fomo','turbulence-miss'].includes(e.getFlag(ID,'key'))))return true;
 if(targetActors.some(a=>markers(a,'turbulence').length))return true;
 return Boolean(attackerToken)&&allActors().some(a=>levelOf(a)&&state(a).links.some(l=>l.tokenUuid===attackerToken));
}
async function offer(caster,title,text,action,param){
 await chat(caster,title,text,{owners:true,buttons:[{action,label:`Use ${title}`,data:param}]});
}
export async function onAttack(p){
 if(internalRolls.count)return;
 const attacker=await fromUuid(p.attacker);if(!attacker)return;
 const atkTok=p.attackerToken?await fromUuid(p.attackerToken):actorToken(attacker);
 const victims=[];for(const u of p.targets??[]){const t=await fromUuid(u);if(t?.actor)victims.push(t);}
 const victim=victims[0]??null;

 // Fear of Missing Out: the linked ally's next successful attack frightens creatures within 15 ft of the target.
 const fomo=markers(attacker,'fomo');
 if(fomo.length&&p.hit!==false){
  let hit=p.hit;if(hit===null)hit=await confirm('Fear of Missing Out',`Did ${attacker.name}’s attack${victim?` against ${victim.name}`:''} hit?`,{to:'gm'});
  if(hit){
   if(!victim)await chat(attacker,'Fear of Missing Out','The attack had no target selected, so the burst could not be placed. Target the creature and attack again, or use Manual Resolve in the Empath Manager.',{owners:true});
   else{for(const e of fomo){const caster=await fromUuid(e.getFlag(ID,'caster'));if(caster)await fomoBurst(caster,victim,e);}await attacker.deleteEmbeddedDocuments('ActiveEffect',fomo.map(e=>e.id));}
  }
 }

 // Turbulence: an affected attacker's ranged weapon attacks against the protected creature miss automatically.
 if(p.ranged&&p.weapon)for(const v of victims)for(const e of markers(attacker,'turbulence-miss').filter(e=>e.getFlag(ID,'protects')===v.actor.uuid))
  await chat(attacker,'Turbulence',`${attacker.name}’s ranged weapon attack against ${v.name} automatically misses. Do not apply its damage.`);

 for(const caster of allActors().filter(a=>levelOf(a))){
  const prof=profile(caster),s=state(caster),link=s.links.find(l=>l.tokenUuid===atkTok?.uuid);
  // Reactions after a linked ally's successful (weapon) attack.
  if(link&&!link.hostile&&p.hit!==false&&victim&&victim.uuid!==link.tokenUuid){
   const maybe=p.hit===null?' (if it hit)':'';
   if(prof.icon==='terror'&&prof.level>=13&&link.depth>=6&&!moodBlocked(caster))
    await offer(caster,'Fear of Failure',`${attacker.name} hit ${victim.name}${maybe}. Reaction: spend 6 depth to reroll the attack; another hit becomes a critical hit with +40 psychic.`,'failure',`${atkTok.uuid}|${victim.uuid}`);
   if(prof.icon==='sorcery'&&prof.level>=13&&p.weapon&&featureUses(caster,'meeting')>0&&!s.links.some(l=>l.tokenUuid===victim.uuid))
    await offer(caster,'Meeting of Minds',`${attacker.name} landed a weapon attack on ${victim.name}${maybe}. Reaction: move this link and its ${link.depth} depth to ${victim.name}.`,'meeting',`${atkTok.uuid}|${victim.uuid}`);
  }
  // Turbulence: allies in the aura may react to a ranged weapon attack from more than 15 ft away.
  if(p.ranged&&p.weapon&&p.hit!==false&&atkTok)for(const v of victims){
   const turb=markers(v.actor,'turbulence').find(e=>e.getFlag(ID,'caster')===caster.uuid);if(!turb||!hostileTo(atkTok,v))continue;
   if(!turb.getFlag(ID,'energized')&&distance(atkTok,v)<=15)continue;
   await offer(caster,'Turbulence',`${attacker.name} made a ranged weapon attack against ${v.name}. ${v.name} may use its reaction: ${attacker.name} makes a Wisdom save or the attack misses.`,'react-turbulence',`${atkTok.uuid}|${v.uuid}`);
  }
 }
}
export async function fomoBurst(caster,victim,marker){
 // Interpretation (no GM selection): the Empath's own side — same token disposition as the Empath — is not frightened.
 const side=actorToken(caster)?.disposition;
 const nearby=(victim.parent?.tokens??[]).filter(t=>t.actor&&t.id!==victim.id&&distance(victim,t)<=15&&(side===undefined||Number(t.disposition)!==Number(side)));
 if(!nearby.length)return chat(caster,'Fear of Missing Out',`No creatures within 15 feet of ${victim.name}.`);
 // Every creature within 15 feet of the target saves; no GM selection needed.
 await chat(caster,'Fear of Missing Out',`Creatures within 15 feet of ${victim.name} make a Wisdom save or become frightened: ${nearby.map(t=>t.name).join(', ')}.`);
 const link={id:marker.getFlag(ID,'linkId')};
 for(const t of nearby){if(await saveRoll(caster,t.actor)===false)await effect(t.actor,caster,link,'fomo-fear',{name:'Fear of Missing Out',statuses:['frightened']});}
}

/* ---------------- Turn start ---------------- */
export async function terrorizeTurn(actor){
 const fear=markers(actor,'terrorize');if(!fear.length)return false;
 // NPCs follow the "Terrorize: NPC choice" setting (default: act normally and save at turn end) so no GM input is needed.
 if(!playerFor(actor)){const mode=setting('npcTerrorize','act');
  if(mode==='act'){await chat(actor,'Terrorize',`${actor.name} acts normally while frightened and will make a Wisdom save at the end of its turn.`,{gm:true});return false;}
  if(mode==='forfeit')return forfeit(actor,fear);}
 if(!await confirm('Terrorize',`${actor.name} is frightened by Terrorize. Does it end its turn immediately to end the fear? (No: it acts normally and saves at the end of its turn.)`,{to:actor}))return false;
 return forfeit(actor,fear);
}
async function forfeit(actor,fear){
 await actor.deleteEmbeddedDocuments('ActiveEffect',fear.map(e=>e.id));
 await chat(actor,'Terrorize',`${actor.name} ends its turn to shake off the fear.`);
 const combat=game.combat;if(combat?.combatant?.actor===actor)await combat.nextTurn();
 return true;
}
export async function intrusiveTurn(actor,token){
 for(const e of markers(actor,'intrusive')){
  const caster=await fromUuid(e.getFlag(ID,'caster'));if(!caster)continue;
  const options=(token?.parent?.tokens??canvas.scene?.tokens??[]).filter(t=>t.actor&&t.id!==token?.id).map(t=>({id:t.uuid,name:t.name}));
  if(!options.length)continue;
  const r=await prompt('Intrusive Thoughts',form(`<p>${esc(actor.name)} must use its bonus action for a weapon attack with advantage against a target of ${esc(caster.name)}’s choice. Frightened does not impose disadvantage.</p>${select('victim','Target',options)}`),[{action:'go',label:'Resolve attack',default:true},{action:'later',label:'Later'}],{to:caster});
  if(!r||r.action==='later'){await chat(caster,'Intrusive Thoughts',`${actor.name} still owes its Intrusive Thoughts attack this turn. Resolve it from the Empath Manager (Manual Resolve).`,{owners:true});continue;}
  const victim=await fromUuid(r.victim);if(!victim?.actor)continue;
  const link=state(caster).links.find(l=>l.id===e.getFlag(ID,'linkId'))??{id:e.getFlag(ID,'linkId')};
  if(await weaponResolution(caster,actor,victim.actor,{mode:1,title:'Intrusive Thoughts'}))
   await effect(victim.actor,caster,link,'intrusive-fear',{name:`Intrusive Thoughts — frightened of ${actor.name}`,statuses:['frightened'],data:{targetToken:victim.uuid,sourceToken:actorToken(caster)?.uuid}});
  await actor.deleteEmbeddedDocuments('ActiveEffect',[e.id]);
 }
}
export async function jumpScareOffers(actor,token){
 if(!token||!actor.statuses?.has('frightened'))return;
 for(const caster of allActors().filter(a=>levelOf(a))){
  const p=profile(caster);if(p.icon!=='terror'||p.level<13||moodBlocked(caster))continue;
  const link=state(caster).links.find(l=>l.hostile&&l.tokenUuid===token.uuid&&l.depth>=3);
  if(link)await offer(caster,'Jump Scare',`${actor.name} is frightened and starting its turn. Reaction: spend 3 depth so an ally acts immediately.`,'jump',token.uuid);
 }
}
