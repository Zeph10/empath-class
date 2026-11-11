import {ID,profile,canAddLink,AURAS,clamp} from './core.mjs';
import {FEATURES,PASSIVE,featureKey} from './features.mjs';
import {doFollow} from './enforce.mjs';
import {tell,applyWithUndo,undoDamage,targetEligibility,totalCover,internalRolls,approve,hasPlayerOwner,playerFor,rollFor,setting,ctx,state,saveState,actorToken,distance,eligibility,linkedActor,linkedToken,chooseLink,spend,effect,markers,deleteMarkers,chat,confirm,prompt,form,input,select,check,numberPrompt,saveRoll,damage,uid,esc,breakLink,expireCast,allActors,armorBlocked} from './runtime.mjs';
import {manageSpells,castSpell} from './spells.mjs';
// Explains why depth was not gained. Manual requests always explain; automatic turn-end checks stay quiet when the
// link is simply full or the class level is too low, but still report anything the table would want to fix.
async function depthBlocked(caster,link,reason,{manual=false,quiet=false}={}){
 if(quiet&&!manual)return;const text=`${caster.name}: no link depth gained${link?.name?` on ${link.name}`:''}. ${reason}`;
 tell(caster,`Empath — ${text}`);if(manual)await chat(caster,'Link depth',text,{owners:true});
}
export function armorReason(actor){
 const armor=actor.items.find(i=>i.type==='equipment'&&i.system.equipped&&['light','medium','heavy'].includes(i.system.type?.value));
 if(armor)return `${armor.name} is equipped (armor blocks the aura). Unequip it, or allow it in the GM's Aura Controls.`;
 return 'Its armor class is calculated as natural armor (common on NPC-type actors), which blocks the aura. Change the AC calculation, or allow it in the GM\'s Aura Controls.';
}
export async function gainDepth(caster,link,{manual=false}={}){
 const target=await linkedActor(link);const p=profile(caster);
 if(!target)return depthBlocked(caster,link,'The linked creature could not be found (token deleted or on another scene).',{manual});
 link={...link,name:target.name};
 if(p.level<2)return depthBlocked(caster,link,'Link Depth is gained at Empath level 2.',{manual,quiet:true});
 if(link.depth>=p.capacity)return depthBlocked(caster,link,`This link is already at capacity (${link.depth}/${p.capacity}). Capacity equals your Charisma modifier (minimum 1)${p.level>=11?', doubled by Improved Empathy':'; it doubles at level 11'}.`,{manual,quiet:true});
 if(state(caster).disabled)return depthBlocked(caster,link,'The GM has disabled this Empath\'s aura (Aura Controls).',{manual});
 if(armorBlocked(caster))return depthBlocked(caster,link,armorReason(caster),{manual});
 let worthy=!link.hostile;const cr=Number(target.system.details?.cr??NaN);if(link.hostile)worthy=Number.isFinite(cr)&&cr>p.worthyThreshold;
 const qualifies=link.worthy??worthy;
 if(!qualifies)return depthBlocked(caster,link,link.hostile?`Not a worthy foe: CR ${Number.isFinite(cr)?cr:'unknown'} must be above ${p.worthyThreshold} at your level. The GM can override this in the link's GM Controls (“Worthy foe override”).`:'The GM has marked this ally as not qualifying (GM Controls).',{manual,quiet:true});
 // No GM input: willing allies fail on purpose (their player may choose instead); hostile creatures roll automatically
 // and never fail on purpose. Player-owned hostile creatures roll on their own client.
 let failed=false;const own=!link.hostile&&setting('promptRouting','owner')!=='gm'?playerFor(target):null;
 if(!link.hostile&&(link.autoFail||!own))failed=true;
 else if(own){
  const r=await prompt('Link depth: your choice',form(`<p>${esc(caster.name)} reaches for a deeper bond with ${esc(target.name)} (${link.depth}/${p.capacity} depth). Fail the Wisdom save (DC ${p.dc}) on purpose to deepen the link, or roll it?</p>`),[{action:'fail',label:'Fail on purpose',default:true},{action:'always',label:'Always fail on purpose (stop asking)'},{action:'roll',label:'Roll the save'},{action:'skip',label:'Not now'}],{to:target});
  if(!r||r.action==='skip')return;
  if(r.action==='always'){const fresh=state(caster),fl=fresh.links.find(x=>x.id===link.id);if(fl){fl.autoFail=true;await saveState(caster,fresh);}}
  if(r.action==='roll'){const result=await saveRoll(caster,target,{depth:true});if(result===null)return;failed=!result;}else failed=true;
 }
 else{const result=await saveRoll(caster,target,{depth:true});if(result===null)return;failed=!result;}
 if(!failed)return chat(caster,'Link depth',`${target.name} succeeded on its Wisdom save (DC ${p.dc}); no depth gained.`);
 const s=state(caster),l=s.links.find(x=>x.id===link.id);if(!l)return;l.depth=Math.min(p.capacity,l.depth+p.gain);await saveState(caster,s);await chat(caster,'Link depth',`Gained ${p.gain} depth; this link now has ${l.depth}/${p.capacity}.`);
 // Building hostile depth ends Sanctuary on the Empath.
 if(l.hostile){const sanct=caster.effects.filter(e=>/sanctuary/i.test(e.name??''));if(sanct.length){await caster.deleteEmbeddedDocuments('ActiveEffect',sanct.map(e=>e.id));await chat(caster,'Sanctuary ends',`${caster.name} built hostile link depth, so Sanctuary ends.`);}}
}
async function createLink(caster,targets){
 const source=actorToken(caster);if(!source)throw new Error('Place the Empath\'s token on the scene first.');
 const s=state(caster),p=profile(caster),gm=!ctx.decider;
 const problems=t=>{const r=targetEligibility(caster,t.actor);if(distance(source,t)>p.range)r.push(`outside your ${p.range} ft aura`);if(totalCover(source,t))r.push('behind total cover');return r;};
 let target=await fromUuid(targets[0]??'');if(target&&(target.documentName!=='Token'||!target.actor))target=null;
 if(target&&s.links.some(l=>l.tokenUuid===target.uuid))throw new Error(`Already linked to ${target.name}.`);
 let hostile,override=false;
 if(!target){
  // Nothing targeted: offer the creatures that can actually be linked right now.
  const options=source.parent.tokens.filter(t=>t.actor&&t.id!==source.id&&!s.links.some(l=>l.tokenUuid===t.uuid)&&!problems(t).length).map(t=>({id:t.uuid,name:`${t.name} — ${Number(t.disposition)===Number(source.disposition)?'ally':'hostile'}, ${Math.round(distance(source,t))} ft`}));
  if(!options.length)throw new Error(`No linkable creature within your ${p.range} ft aura. (Constructs, Intelligence 1, psychic resistance/immunity and total cover prevent links.)`);
  const r=await prompt('Form empath link',form(`<p>Bonus action. A link cannot be ended voluntarily; it breaks if the creature leaves your aura.</p>${select('token','Link with',options)}`),[{action:'ok',label:'Form link',default:true}]);if(!r)return;
  target=await fromUuid(r.token);if(!target?.actor)return;hostile=Number(target.disposition)!==Number(source.disposition);
 }else{
  const reasons=problems(target);hostile=Number(target.disposition)!==Number(source.disposition);
  if(reasons.length&&!gm)throw new Error(`Cannot link with ${target.name}: ${reasons.join('; ')}.`);
  if(gm){
   const r=await prompt('Form empath link',form(`<p>${esc(target.name)}. ${reasons.length?`Problems: ${esc(reasons.join('; '))}.`:'Eligible.'}</p>${check('hostile','Hostile creature',hostile)}${reasons.length?check('override','GM override: link anyway',false):''}`),[{action:'ok',label:'Form link',default:true}]);if(!r)return;
   if(reasons.length&&!r.override)throw new Error(`Cannot link: ${reasons.join('; ')}.`);hostile=Boolean(r.hostile);override=Boolean(r.override);
  }else if(!await confirm('Form empath link',`Link with ${target.name} (${hostile?'hostile':'ally'})? A link cannot be ended voluntarily.`))return;
 }
 if(!canAddLink(s.links,hostile,p))throw new Error(s.links.length>=p.links?`You already have ${p.links} link${p.links===1?'':'s'}, your maximum at this level.`:'Your remaining link is reserved for a hostile creature.');
 if(!await approve(`form a${hostile?' hostile':'n allied'} link with ${target.name}`,[target.actor]))return;
 const fresh=state(caster);fresh.links.push({id:uid(),tokenUuid:target.uuid,actorUuid:target.actor.uuid,sourceToken:source.uuid,hostile,depth:0,held:[],override,worthy:null});await saveState(caster,fresh);
 await chat(caster,'Link formed',`${caster.name} forms ${hostile?'a hostile':'an allied'} link with ${target.name} (bonus action). Depth starts at 0.`);
 if(caster.concentration?.effects?.size)await chat(caster,'Concentration conflict','You cannot concentrate on a spell while linked. End your existing concentration.',{owners:true});
}
async function useCharge(caster,key){const i=caster.items.find(i=>featureKey(i)===key);if(!i)throw new Error('Feature missing from actor.');if(Number(i.system.uses.spent??0)>=Number(i.system.uses.max||1))throw new Error('No uses remaining; take the appropriate rest.');await i.update({'system.uses.spent':Number(i.system.uses.spent??0)+1});}
// Average damage of an attack activity (dice minimised and maximised), used to pick the "most powerful" attack.
function averageDamage(activity){
 try{const cfg=activity.getDamageConfig?.({})??{};let sum=0;
  for(const r of cfg.rolls??[]){const f=(r.parts??[]).join(' + ');if(!f)continue;const lo=new Roll(f,r.data??{}).evaluateSync({minimize:true}).total,hi=new Roll(f,r.data??{}).evaluateSync({maximize:true}).total;sum+=(lo+hi)/2;}
  return sum;}catch{return 0;}
}
function weaponAttacks(actor){
 const out=[];for(const item of actor.items)for(const activity of item.system.activities??[])if(activity.type==='attack'&&(item.type==='weapon'||activity.attack?.type?.classification!=='spell'))out.push({item,activity,avg:averageDamage(activity)});
 return out.sort((a,b)=>b.avg-a.avg);
}
// The forced attack uses the attacker's strongest weapon attack automatically (Fear's End says "most powerful";
// for the others any weapon attack qualifies). The GM only chooses if averages cannot be computed and tie.
async function chooseWeaponAttack(actor,title){
 const list=weaponAttacks(actor);if(!list.length)throw new Error(`${actor.name} has no weapon attack. Add one or resolve this attack manually.`);
 if(list.length===1||list[0].avg>list[1].avg||setting('autoRollNpc',true))return list[0].activity;
 const r=await prompt(title,form(select('attack','Weapon attack',list.map(o=>({id:`${o.item.id}:${o.activity.id}`,name:`${o.item.name} — ${o.activity.name||'Attack'}`})))),undefined,{to:'gm'});if(!r)return null;const [item,activity]=r.attack.split(':');return actor.items.get(item)?.system.activities.get(activity);
}
export async function weaponResolution(caster,attacker,victim,{mode=1,critical=false,extra=0,title='Empath forced attack'}={}){
 const activity=await chooseWeaponAttack(attacker,title);if(!activity)return false;
 const fast=setting('autoRollNpc',true)&&!hasPlayerOwner(attacker);
 internalRolls.count++;let rolls;try{rolls=await activity.rollAttack({empathMode:mode},{configure:!fast});}finally{internalRolls.count--;}if(!rolls?.length)return false;
 // Hit is decided by the roll: natural 20 hits, natural 1 misses, otherwise total vs AC.
 const ac=Number(victim.system.attributes?.ac?.value??10),total=rolls[0].total;
 const hit=rolls[0].isCritical||(!rolls[0].isFumble&&total>=ac);
 await chat(caster,title,`${attacker.name} attacks ${victim.name} with ${activity.item?.name??'a weapon'}: ${total} vs AC ${ac} — ${hit?'hit':'miss'}.`);
 if(!hit)return false;
 const damages=await activity.rollDamage({isCritical:critical||rolls[0].isCritical},{configure:!fast});
 if(damages?.length&&(!setting('confirmDamage',false)||await confirm(title,`Apply the weapon damage (${damages.reduce((n,r)=>n+Math.max(0,r.total),0)}) to ${victim.name}? Do not also click Apply Damage on its chat card.`,{to:'gm'})))await applyWithUndo(caster,victim,damages.map(r=>({value:Math.max(0,r.total),type:r.options.type??'none'})),`${title} — weapon damage (already applied; do not click Apply Damage on the roll)`);
 if(extra)await damage(caster,victim,String(extra),`${title} — additional psychic damage`);return true;
}
async function simple(caster,key,targets){const f=FEATURES.find(f=>f.key===key);await chat(caster,f?.name??key,f?.text??'Resolve this effect at the table.',{gm:['imprint','heart'].includes(key)});}
async function cloud(caster,targets){
 const source=actorToken(caster);if(!source)throw new Error('Place the Empath\'s token on the scene first.');const p=profile(caster);
 const inAura=t=>t?.actor&&t.id!==source.id&&distance(source,t)<=p.range&&!targetEligibility(caster,t.actor).length&&!totalCover(source,t);
 const picked=(await Promise.all(targets.map(t=>fromUuid(t)))).filter(inAura);
 const r=await prompt('Cloud Mind',form(`<p>Once per short rest. Creatures in your aura make a Wisdom save (DC ${p.dc}) or you become hidden to them for 10 minutes.</p>${picked.length?`<p>Affecting your ${picked.length} targeted creature${picked.length===1?'':'s'}.</p>`:check('allies','Also affect your allies',false)}`),[{action:'ok',label:'Use Cloud Mind',default:true}]);if(!r)return;
 const tokens=picked.length?picked:source.parent.tokens.filter(t=>inAura(t)&&(r.allies||Number(t.disposition)!==Number(source.disposition)));
 if(!tokens.length)throw new Error('No affected creatures in your aura.');
 if(!await approve(`Cloud Mind (${tokens.length} creature${tokens.length===1?'':'s'})`,tokens.map(t=>t.actor)))return;await useCharge(caster,'cloud');
 const failed=[];for(const token of tokens){if(await saveRoll(caster,token.actor)===false){await effect(token.actor,caster,null,'cloud',{name:'Unaware of Empath',data:{sourceToken:source.uuid},duration:600});failed.push(token.name);}}
 await chat(caster,'Cloud Mind',`${failed.length?`Unaware of ${caster.name}: ${failed.join(', ')}.`:'Every creature succeeded on its save.'} It ends if you attack, cast a spell, use a magic item or an Empath feature, and lasts up to 10 minutes.`);
}
async function contest(caster,targets,prefer){
 const link=await chooseLink(caster,{targets,prefer});if(!link)return;const target=await linkedActor(link);const r=await prompt('Probe thoughts',form(select('direction','Who probes?',[{id:'caster',name:'Empath probes target'},{id:'target',name:'Target probes Empath'}])));if(!r)return;
 const attacker=r.direction==='caster'?caster:target,defender=r.direction==='caster'?target:caster;
 if(markers(attacker,'probe-immune').some(e=>e.getFlag(ID,'defender')===defender.uuid))throw new Error('This defender is immune to further probes until its long rest.');
 if(!await approve(`probe thoughts between ${caster.name} and ${target.name}`,[target]))return;
 const a=await rollFor(attacker,'skill',{skill:'ins'});if(a===null)return;const b=await rollFor(defender,'skill',{skill:'dec'});if(b===null)return;
 if(a>b)await chat(caster,'Surface thoughts revealed',`${attacker.name} reads ${defender.name}’s surface thoughts: its reasoning and something that looms large in its mind. The GM describes them.`);
 else{await effect(attacker,caster,link,'probe-immune',{name:'Thought probe blocked',data:{defender:defender.uuid}});await chat(caster,'Thought probe blocked','The defending creature resists further probes until its long rest.');}
}
export async function syncAuras(caster){
 const s=state(caster),source=actorToken(caster);if(!source)return;const p=profile(caster);
 for(const aura of s.auras){const spec=AURAS[aura.key];if(!spec)continue;const expected=new Set();
 for(const token of source.parent.tokens){if(!token.actor||distance(source,token)>p.range||eligibility(caster,token.actor).length||(token.id!==source.id&&totalCover(source,token)))continue;
 const sameSide=token.id===source.id||Number(token.disposition)===Number(source.disposition)&&Number(token.disposition)!==0;const hostile=Number(token.disposition)!==0&&!sameSide;
 if(spec.side==='ally'&&!sameSide||spec.side==='enemy'&&!hostile)continue;expected.add(token.actor.uuid);
 const exists=markers(token.actor,aura.key).find(e=>e.getFlag(ID,'auraId')===aura.id&&e.getFlag(ID,'caster')===caster.uuid);
 if(!exists)await effect(token.actor,caster,{id:aura.linkId},aura.key,{name:spec.name,data:{auraId:aura.id,energized:aura.energized??0,sourceToken:source.uuid},duration:Math.max(1,aura.endsAt-game.time.worldTime)});
 else if(exists.getFlag(ID,'energized')!==aura.energized)await exists.setFlag(ID,'energized',aura.energized??0);
 }
 for(const actor of allActors())await deleteMarkers(actor,f=>f.caster===caster.uuid&&f.auraId===aura.id&&!expected.has(actor.uuid));
 }
}
async function auraAction(caster,key,targets,prefer){
 const spec=AURAS[key],l=await chooseLink(caster,{side:spec.side,targets,prefer});if(!l)return;const s=state(caster);if(s.auras.some(a=>a.linkId===l.id))throw new Error('This link already powers an empowered aura. End that aura first.');
 if(l.depth<(spec.check??spec.cost))throw new Error(`Requires ${spec.check??spec.cost} depth.`);
 const r=await prompt(spec.name,form(`<p>${esc(FEATURES.find(f=>f.key===key).text)}</p>${check('energize',`Energize now (+${spec.energize} depth)`)}`));if(!r)return;
 const cost=spec.cost+(r.energize?spec.energize:0);if(l.depth<cost)throw new Error('Insufficient depth for activation and energize.');
 if(spec.side==='enemy'&&!await approve(`activate ${spec.name}${r.energize?' (energized)':''}, affecting enemies in the aura`))return;await spend(caster,l.id,cost);
 const fresh=state(caster);fresh.auras.push({id:uid(),key,linkId:l.id,energized:r.energize?1:0,endsAt:game.time.worldTime+60});await saveState(caster,fresh);await syncAuras(caster);await chat(caster,spec.name,`${spec.name} is active for one minute${r.energize?' (energized)':''}. It affects ${spec.side==='ally'?'you and your allies':'hostile creatures'} in the aura${spec.sustain?`; you are asked at the start of each of your turns whether to pay ${spec.sustain} depth to sustain it`:''}.`);
}
async function edit(caster,targets,param){
 const l=state(caster).links.find(l=>l.id===param)??await chooseLink(caster,{targets});if(!l)return;const p=profile(caster),target=await linkedActor(l);
 const r=await prompt('GM link controls',form(input('depth','Link depth',l.depth,'number',`min="0" max="${p.capacity}"`) +check('hostile','Hostile',l.hostile)+check('override','Override automatic eligibility restrictions',l.override)+check('worthy','Worthy foe override',l.worthy??!l.hostile)+check('autoFail','Willing ally: auto voluntary-fail depth saves (no per-turn dialogs)',l.autoFail)+check('fearAdvantage','Target has conditional advantage against frightened (Terror, pre-level 9)',target?.getFlag(ID,'fearAdvantage'))),[{action:'ok',label:'Save',default:true},{action:'break',label:'Break link (GM)'}]);if(!r)return;if(r.action==='break')return breakLink(caster,l.id,{forced:true});
 const s=state(caster),item=s.links.find(x=>x.id===l.id);if(!canAddLink(s.links.filter(x=>x.id!==l.id),Boolean(r.hostile),p))throw new Error('That disposition exceeds allied-link capacity.');item.depth=clamp(Math.floor(Number(r.depth)),0,p.capacity);item.hostile=Boolean(r.hostile);item.override=Boolean(r.override);item.worthy=Boolean(r.worthy);item.autoFail=Boolean(r.autoFail)&&!item.hostile;if(target)await target.setFlag(ID,'fearAdvantage',Boolean(r.fearAdvantage));await saveState(caster,s);
}
export async function runAction(caster,key,targets=[],param=''){
 const p=profile(caster);if(!p.level)throw new Error('Add the Empath class to this actor first.');
 // Reaction cards pass the involved tokens as "ally|victim" (or "foe") so the right link and target are used;
 // the hit that produced the card was already detected, so it is not re-confirmed.
 const fromCard=Boolean(param)&&['failure','meeting','jump'].includes(key);
 if(param&&['failure','meeting','jump'].includes(key))targets=String(param).split('|').filter(Boolean);
 if(key==='react-turbulence')return reactTurbulence(caster,param);
 if(key==='undo-damage')return undoDamage(caster,param);
 // Manager per-link buttons pass "L:<linkId>" so no link chooser is needed.
 const prefer=String(param).startsWith('L:')?String(param).slice(2):undefined;
 if(key==='spells')return manageSpells(caster);if(key==='cast')return castSpell(caster,param,targets);
 if(key==='controls'){const s=state(caster),r=await prompt('GM aura controls',form(check('disabled','Disable aura',s.disabled)+check('armor','Allow aura despite armor / natural armor',s.armorOverride)));if(r){s.disabled=Boolean(r.disabled);s.armorOverride=Boolean(r.armor);await saveState(caster,s);}return;}
 if(key==='edit')return edit(caster,targets,param);
 if(key==='depth-gain'){const l=state(caster).links.find(x=>x.id===param)??await chooseLink(caster,{targets});return l&&gainDepth(caster,l,{manual:true});}
 if(key==='energize'){const s=state(caster),a=s.auras.find(a=>a.id===param);if(!a)return;const spec=AURAS[a.key];if(a.key==='fatigue')throw new Error('Fatigue must be energized on activation.');if(a.energized&&a.key!=='violence')throw new Error('Already energized.');await spend(caster,a.linkId,spec.energize);const fresh=state(caster);fresh.auras.find(x=>x.id===a.id).energized=(a.energized??0)+1;await saveState(caster,fresh);return syncAuras(caster);}
 if(key==='end-aura'){const s=state(caster),a=s.auras.find(x=>x.id===param);if(!a)return;s.auras=s.auras.filter(x=>x.id!==param);await saveState(caster,s);for(const t of allActors())await deleteMarkers(t,f=>f.caster===caster.uuid&&f.auraId===param);return;}
 if(key==='end-cast')return expireCast(caster,param);
 if(key==='contest')return contest(caster,targets,prefer);
 if(key==='resolve')return resolveOutcome(caster,param,targets);
 const f=FEATURES.find(f=>f.key===key);if(!f||p.level<f.level||f.icon!=='base'&&f.icon!==p.icon)throw new Error('Feature is not available at this level / Icon.');
 if(PASSIVE.has(key))return game.empath.open(caster);
 if(state(caster).disabled)throw new Error('The GM has disabled this Empath\'s aura (Aura Controls).');if(armorBlocked(caster))throw new Error(armorReason(caster));
 if(['apathy','fervor','pain','mantle','disappointment','terrorize','fomo','intrusive','failure','jump','death','end'].includes(key)&&state(caster).moodBlocked?.created)throw new Error('Meeting of Minds prevents mood manipulations until your next turn ends.');
 for(const target of allActors())await deleteMarkers(target,f=>f.caster===caster.uuid&&f.key==='cloud');
 if(key==='link')return createLink(caster,targets);if(key==='cloud')return cloud(caster,targets);if(key==='follow'&&param)return doFollow(caster,param);
 if(key==='imprint'||key==='heart'||key==='follow')return simple(caster,key,targets);
 if(key==='trauma'){
  const r=await prompt('Trauma Dump',form(`<p>Confirm 10 minutes of stationary contact. Resolve one Greater Restoration effect.</p>${select('restore','Effect',[{id:'charmed',name:'End charmed'},{id:'petrified',name:'End petrified'},{id:'exhaustion',name:'Reduce exhaustion by one'},{id:'curse',name:'End one curse'},{id:'ability',name:'End one ability-score reduction'},{id:'hp',name:'End one maximum-HP reduction'}])}`));if(!r)return;const target=(await fromUuid(targets[0]??''))?.actor;if(!target)throw new Error('Target the creature being restored.');if(!await approve(`Trauma Dump on ${target.name}`,[target]))return;
  if(['charmed','petrified'].includes(r.restore)){const effects=target.effects.filter(e=>e.statuses.has(r.restore));if(effects.length)await target.deleteEmbeddedDocuments('ActiveEffect',effects.map(e=>e.id));}
  else if(r.restore==='exhaustion')await target.update({'system.attributes.exhaustion':Math.max(0,Number(target.system.attributes.exhaustion??0)-1)});
  else await chat(caster,'Trauma Dump',`Remove one ${r.restore==='hp'?'maximum-HP reduction':r.restore==='ability'?'ability-score reduction':'curse'} from ${target.name} (this one is not automated).`,{owners:true});return;
 }
 if(AURAS[key])return auraAction(caster,key,targets,prefer);
 const side=['pain','apathy','terrorize','intrusive','end'].includes(key)?'enemy':['fervor','mantle','disappointment','fomo','failure','death','meeting'].includes(key)?'ally':null;
 const link=await chooseLink(caster,{side,targets,prefer});if(!link)return;const target=await linkedActor(link);if(!target)throw new Error('Linked actor missing.');
 if(!await approve(`${f.name} on ${target.name}`,[target]))return;
 if(key==='apathy'){
  if(await saveRoll(caster,target)!==false)return;const reduction=await damage(caster,target,`${p.apathyDice}d4 + ${p.cha}`,'Apathy — damage reduction roll',{apply:false});
  await effect(target,caster,link,'apathy',{name:'Apathy',data:{reduction:Math.max(0,reduction)}});return chat(caster,'Apathy',`${target.name}’s next damage instance is reduced by ${Math.max(0,reduction)} automatically when applied, and it cannot critically hit until then.`);
 }
 if(key==='pain'){
  const n=await numberPrompt('Pain Resonance','Depth to spend',link.depth,1,link.depth);if(n===null)return;
  // Touch range (5 ft) is measured from the Empath's current token; it doubles the dice from level 5.
  const source=actorToken(caster)??await fromUuid(link.sourceToken),token=await linkedToken(link);const touching=p.level>=5&&distance(source,token)<=5;
  await spend(caster,link.id,n);return damage(caster,target,`${n*2*(touching?2:1)}d${p.painDie}`,`Pain Resonance${touching?' (touch: dice doubled)':''}`);
 }
 if(key==='fervor'){await effect(target,caster,link,'fervor',{name:'Fervor',data:{bonus:p.cha,crit:p.fervorCrit,advPending:true,damagePending:true},expiry:{caster:caster.uuid,phase:'start',remaining:1}});return;}
 if(key==='mantle'){const n=await numberPrompt('Inspirational Mantle','Depth / duration in rounds',1,1,link.depth);if(n===null)return;await spend(caster,link.id,n);await effect(target,caster,link,'mantle',{name:'Inspirational Mantle',data:{bonus:p.mantleBonus,crit:p.level>=5?p.mantleBonus:0},duration:6*n,expiry:{caster:caster.uuid,phase:'start',remaining:n}});return;}
 if(key==='disappointment'){const n=await numberPrompt('Fear of Disappointment','Depth (1 base + extra)',1,1,link.depth);if(n===null)return;await spend(caster,link.id,n);await effect(target,caster,link,'disappointment',{name:'Fear of Disappointment',data:{extra:n-1},expiry:{caster:caster.uuid,phase:'start',remaining:1}});return;}
 if(key==='terrorize'){await spend(caster,link.id,1);await effect(target,caster,link,'terrorize',{name:'Terrorize',statuses:['frightened'],data:{targetToken:link.tokenUuid}});await chat(caster,'Terrorize',`${target.name} is frightened of ${caster.name}, and its damage to ${caster.name} is ignored automatically. It can end the fear by giving up its turn, or by saving at the end of its turn.`);return;}
 if(key==='fomo'){await spend(caster,link.id,2);await effect(target,caster,link,'fomo',{name:'Fear of Missing Out — awaiting hit'});await chat(caster,'Fear of Missing Out',`${target.name}’s next successful attack frightens creatures within 15 feet of its target (Wisdom save). Target the creature when attacking so the burst is found automatically.`);return;}
 if(key==='intrusive'){await spend(caster,link.id,3);await effect(target,caster,link,'intrusive',{name:'Intrusive Thoughts'});return chat(caster,'Intrusive Thoughts',`At the start of ${target.name}’s next turn you choose who it attacks; its weapon attack (with advantage) is rolled automatically.`);}
 if(key==='failure'){
  const victim=(await fromUuid(targets.find(u=>u!==link.tokenUuid)??''))?.actor;
  if(!fromCard&&!await confirm('Fear of Failure','Confirm the linked ally’s weapon hit. Spend six depth and reroll that same attack normally; on another hit, replace its damage with critical damage plus 40 psychic. Undo any original applied damage first.'))return;
  if(fromCard)await chat(caster,'Fear of Failure','Rerolling the attack. If the original damage was already applied, undo it: a hit now deals critical damage plus 40 psychic instead.');
  await spend(caster,link.id,6);
  if(victim)await weaponResolution(caster,target,victim,{mode:0,critical:true,extra:40,title:'Fear of Failure'});
  else await chat(caster,'Fear of Failure','Reroll the original attack normally. A hit replaces original damage with critical weapon damage plus 40 psychic. Target the hit creature before using this ability for guided native resolution.');return;
 }
 if(key==='jump'){
  if(!link.hostile||!target.statuses.has('frightened'))throw new Error('Select a frightened hostile link.');
  const src=actorToken(caster),foeTok=await linkedToken(link);
  const allies=(src?.parent?.tokens??[]).filter(t=>t.actor&&t.id!==foeTok?.id&&Number(t.disposition)===Number(src.disposition)).map(t=>({id:t.uuid,name:t.name}));
  if(!allies.length)throw new Error('No allied token on the scene to act.');
  const r=await prompt('Jump Scare',form(`<p>Spend 3 depth: an ally immediately takes a turn against ${esc(target.name)} (advantage on attack and damage rolls against it; it cannot willingly leave your aura), then skips its next regular turn.</p>${select('ally','Ally who acts',allies)}`));if(!r)return;
  const ally=await fromUuid(r.ally);if(!ally?.actor)return;await spend(caster,link.id,3);
  await effect(ally.actor,caster,link,'jump-ally',{name:`Jump Scare — acting against ${target.name}`,data:{foe:target.uuid},expiry:{caster:target.uuid,phase:'end',remaining:1}});
  await effect(ally.actor,caster,link,'jump-skip',{name:'Jump Scare — skips next turn'});
  return chat(caster,'Jump Scare',`${ally.name} acts now, interrupting ${target.name}’s turn. Its attacks against ${target.name} have advantage (roll damage twice and use the higher result). When its own next turn comes, it is skipped automatically. Resume ${target.name}’s turn afterwards.`);
 }
 if(key==='death'){
  await spend(caster,link.id,8);await effect(target,caster,link,'death',{name:'Fear of Death — double damage',expiry:{caster:caster.uuid,phase:'start',remaining:1}});
  const s=state(caster);const hostile=s.links.filter(x=>x.hostile&&x.depth);if(hostile.length){const r=await prompt('Transfer hostile depth',form(hostile.map(l=>input(l.id,`Transfer from hostile link (${l.depth} available)`,0,'number',`min="0" max="${l.depth}"`)).join('')));if(r){const fresh=state(caster),dest=fresh.links.find(l=>l.id===link.id);let total=0;for(const l of hostile){const n=Number(r[l.id]??0);if(!Number.isInteger(n)||n<0||n>l.depth)throw new Error('Invalid depth transfer.');total+=n;}if(dest.depth+total>p.capacity)throw new Error('Transfer exceeds allied capacity.');for(const l of hostile)fresh.links.find(x=>x.id===l.id).depth-=Number(r[l.id]??0);dest.depth+=total;await saveState(caster,fresh);}}
  await chat(caster,'Fear of Death','Double this ally’s final damage through the start of your next turn. You may take another action this turn.');return;
 }
 if(key==='end'){
  if(link.depth<6)throw new Error('Need six depth.');const result=await saveRoll(caster,target);if(result===null)return;await spend(caster,link.id,6);if(result)return damage(caster,target,'50','Fear’s End — successful save');
  await weaponResolution(caster,target,target,{mode:1,critical:true,extra:100,title:'Fear’s End'});return;
 }
 if(key==='meeting'){
  const token=await fromUuid(targets.find(u=>u!==link.tokenUuid)??'');if(!token?.actor)throw new Error('Target the creature hit by your linked ally.');const reasons=eligibility(caster,token.actor);if(distance(actorToken(caster),token)>p.range)reasons.push('Outside aura');const r=await prompt('Meeting of Minds',form(`<p>Confirm the ally landed a weapon hit. ${esc(reasons.join('; '))}</p>${check('hostile','New target is hostile',Number(token.disposition)!==Number(actorToken(caster)?.disposition))}${ctx.decider?'':check('override','GM override eligibility')}`));if(!r)return;if(ctx.decider)r.override=undefined;if(reasons.length&&!r.override)throw new Error(`Cannot move the link to ${token.name}: ${reasons.join('; ')}.`);
  const s=state(caster);if(s.links.some(l=>l.tokenUuid===token.uuid))throw new Error('Already linked to target.');if(!canAddLink(s.links.filter(l=>l.id!==link.id),Boolean(r.hostile),p))throw new Error('Transfer violates link capacity.');await useCharge(caster,'meeting');
  // Spells and other benefits attached to the old participant end; the depth transfers intact.
  for(const h of link.held??[])await expireCast(caster,h.castId);for(const a of allActors())await deleteMarkers(a,f=>f.caster===caster.uuid&&f.linkId===link.id);
  const fresh=state(caster),l=fresh.links.find(x=>x.id===link.id);l.tokenUuid=token.uuid;l.actorUuid=token.actor.uuid;l.hostile=Boolean(r.hostile);l.override=Boolean(r.override);l.held=[];fresh.auras=fresh.auras.filter(a=>a.linkId!==link.id);fresh.moodBlocked=game.combat?.started?{remaining:1,created:`${game.combat.id}:${game.combat.round}:${game.combat.turn}`}:null;await saveState(caster,fresh);if(!fresh.moodBlocked)await chat(caster,'Meeting of Minds','Out of combat: mood manipulations are unavailable until the end of your next turn. Track this manually.');return;
 }
}
export async function resolveOutcome(caster,param='',targets=[]){
 const s=state(caster),opts=[];for(const l of s.links){const a=await linkedActor(l);if(a)opts.push({id:l.id,name:a.name});}if(!opts.length)throw new Error('No links.');
 const r=await prompt('Resolve hit / damage',form(select('link','Linked creature',opts,param)+select('event','Event',[{id:'hit',name:'A weapon hit occurred'},{id:'damage',name:'A damage instance occurred'},{id:'forfeit',name:'Forfeit Terrorize creature’s turn'},{id:'intrusive',name:'Resolve Intrusive Thoughts bonus-action attack'},{id:'clear',name:'Clear pending Intrusive Thoughts after resolution'}])));if(!r)return;
 const l=s.links.find(x=>x.id===r.link),actor=await linkedActor(l);if(!actor)return;
 if(r.event==='forfeit')return deleteMarkers(actor,f=>f.caster===caster.uuid&&f.key==='terrorize');
 if(r.event==='intrusive'){
  const pending=markers(actor,'intrusive').filter(e=>e.getFlag(ID,'caster')===caster.uuid);if(!pending.length)throw new Error('No Intrusive Thoughts pending.');
  const token=await fromUuid(targets.find(u=>u!==l.tokenUuid)??'');if(!token?.actor)throw new Error('Target the intended attack victim.');
  if(await weaponResolution(caster,actor,token.actor,{mode:1,title:'Intrusive Thoughts'}))await effect(token.actor,caster,l,'intrusive-fear',{name:'Intrusive Thoughts — frightened',statuses:['frightened'],data:{targetToken:token.uuid,sourceToken:actorToken(caster)?.uuid}});
  await actor.deleteEmbeddedDocuments('ActiveEffect',pending.map(e=>e.id));return;
 }
 if(r.event==='clear')return deleteMarkers(actor,f=>f.caster===caster.uuid&&f.key==='intrusive');
 if(r.event==='damage'){
  const apathy=markers(actor,'apathy');if(apathy.length){const reduction=apathy.reduce((n,e)=>n+Number(e.getFlag(ID,'reduction')??0),0);await chat(caster,'Apply Apathy reduction',`Reduce the triggering damage instance by ${reduction}, minimum zero. If damage was already applied, the GM restores the prevented HP/temp HP to its recipients. Do not reduce unrelated damage.`);await actor.deleteEmbeddedDocuments('ActiveEffect',apathy.map(e=>e.id));}return;
 }
 if(r.event==='hit'){
  for(const e of markers(actor,'fervor'))if(e.getFlag(ID,'damagePending')){await chat(caster,'Fervor bonus',`Add ${e.getFlag(ID,'bonus')} to this weapon hit if it was not already added by the native damage-roll hook.`);await e.setFlag(ID,'damagePending',false);}
  const fomo=markers(actor,'fomo').filter(e=>e.getFlag(ID,'caster')===caster.uuid);
  if(fomo.length){if(!targets.length)throw new Error('Target creatures within 15 feet of the hit creature before resolving.');for(const u of targets){const token=await fromUuid(u);if(!token?.actor)continue;if(await saveRoll(caster,token.actor)===false)await effect(token.actor,caster,l,'fomo-fear',{name:'Fear of Missing Out',statuses:['frightened']});}await actor.deleteEmbeddedDocuments('ActiveEffect',fomo.map(e=>e.id));}
 }
}

// Turbulence reaction (offered automatically when a ranged weapon attack targets a protected ally).
async function reactTurbulence(caster,param){
 const [a,v]=String(param).split('|');const atk=await fromUuid(a??''),ally=await fromUuid(v??'');
 if(!atk?.actor||!ally?.actor)throw new Error('Turbulence: attacker or ally token is missing.');
 const turb=markers(ally.actor,'turbulence').find(e=>e.getFlag(ID,'caster')===caster.uuid);if(!turb)throw new Error(`${ally.name} is no longer inside Turbulence.`);
 const saved=await saveRoll(caster,atk.actor);if(saved===null)return;
 if(saved)return chat(caster,'Turbulence',`${atk.name} succeeds on its save; the attack resolves normally.`);
 await effect(atk.actor,caster,{id:turb.getFlag(ID,'linkId')},'turbulence-miss',{name:`Turbulence — ranged attacks vs ${ally.name} miss`,data:{protects:ally.actor.uuid},expiry:{caster:atk.actor.uuid,phase:'start',remaining:1}});
 return chat(caster,'Turbulence',`${atk.name} fails: that attack and its further ranged weapon attacks against ${ally.name} automatically miss until the start of its next turn. Undo any damage already applied from this attack.`);
}
