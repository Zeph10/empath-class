import {ID,normalize,profile,spellProgress,planPayment,autoPayment} from './core.mjs';
import {SPELL_LIST,featureKey} from './features.mjs';
import {castAuth,approve,rpc,playerFor,setting,ctx,state,saveState,linkedActor,linkedToken,chooseLink,uid,clone,prompt,form,input,select,check,confirm,chat,esc,damage,expireCast,actorToken,distance,eligibility,armorBlocked} from './runtime.mjs';
const aliases={hideouslaughter:['tashashideouslaughter'],telepathicbond:['rarystelepathicbond'],magicAura:['nystulsmagicaura']};
export function findSpellPack(){const setting=game.settings.get(ID,'spellPack');if(setting&&game.packs.get(setting))return game.packs.get(setting);return [...game.packs].find(p=>p.documentName==='Item'&&normalize(p.title??p.metadata.label)==='spells2024');}
export async function resolveSpellEntries(){
 const pack=findSpellPack();if(!pack)throw new Error('Spells 2024 compendium not found. Choose its collection ID in Settings → Empath → Spell compendium.');
 const index=await pack.getIndex({fields:['type','system.level','system.source.rules']});const list=[];
 for(let level=0;level<SPELL_LIST.length;level++)for(const name of SPELL_LIST[level]){
 const norm=normalize(name);const candidates=[...index].filter(e=>e.type==='spell'&&Number(e.system?.level)===level&&(normalize(e.name)===norm||(aliases[norm]??[]).includes(normalize(e.name))));
 candidates.sort((a,b)=>Number(b.system?.source?.rules==='2024')-Number(a.system?.source?.rules==='2024'));
 list.push({name,level,id:candidates[0]?._id??null,duplicates:candidates.length>1});
 }
 return {pack,list};
}
export async function manageSpells(actor){
 const p=profile(actor);if(p.icon!=='sorcery'||p.level<3)throw new Error('Icon of Sorcery level 3+ required.');const progress=spellProgress(p.level),{pack,list}=await resolveSpellEntries();
 const known=actor.items.filter(i=>i.getFlag(ID,'knownSpell'));const knownIds=new Set(known.map(i=>i.getFlag(ID,'spellSource')));
 const available=list.filter(e=>e.level<=progress.max),missing=available.filter(e=>!e.id);
 const content=`<p>Choose up to ${progress.cantrips} cantrips and ${progress.known} leveled spells. Maximum spell level ${progress.max}. You may swap one known spell each time you gain an Empath level.</p><div class="empath-spell-list">${available.map(e=>e.id?check(`spell_${e.id}`,`${e.name} — ${e.level===0?'cantrip':`level ${e.level}`}${e.duplicates?' (duplicate names; 2024 preferred)':''}`,knownIds.has(`Compendium.${pack.collection}.Item.${e.id}`)):`<p class="empath-missing">Missing: ${esc(e.name)} (level ${e.level})</p>`).join('')}</div>`;
 let checked=null,selected;
 for(;;){
  const html=checked?content.replace(/<input name="spell_([^"]+)" type="checkbox" (checked)?/g,(m,id)=>`<input name="spell_${id}" type="checkbox" ${checked.has(id)?'checked':''}`):content;
  const r=await prompt('Empath known spells',form(html));if(!r)return;
  selected=available.filter(e=>e.id&&r[`spell_${e.id}`]);const c=selected.filter(e=>e.level===0).length,k=selected.filter(e=>e.level>0).length;
  if(c<=progress.cantrips&&k<=progress.known)break;
  ui.notifications.warn(`Empath: ${c}/${progress.cantrips} cantrips and ${k}/${progress.known} leveled spells selected. Adjust the selection.`);
  checked=new Set(selected.map(e=>e.id));
 }
 const selectedSources=new Set(selected.map(e=>`Compendium.${pack.collection}.Item.${e.id}`));const removed=known.filter(i=>!selectedSources.has(i.getFlag(ID,'spellSource')));
 if(removed.length&& !await confirm('Replace known spells',`Remove ${removed.map(i=>i.name).join(', ')} from ${actor.name}? Other classes’ spells are untouched.`))return;
 const create=[];for(const e of selected){const source=`Compendium.${pack.collection}.Item.${e.id}`;if(knownIds.has(source))continue;const original=await pack.getDocument(e.id),d=original.toObject();delete d._id;delete d._key;d.system.ability='wis';d.system.method='innate';d.system.prepared=1;d.system.sourceItem='class:empath';d.flags??={};d.flags[ID]={knownSpell:true,spellSource:source};d.flags.dnd5e??={};delete d.flags.dnd5e.advancementOrigin;delete d.flags.dnd5e.advancementRoot;create.push(d);}
 if(create.length)await actor.createEmbeddedDocuments('Item',create);if(removed.length)await actor.deleteEmbeddedDocuments('Item',removed.map(i=>i.id));
 await chat(actor,'Empath spell selection',`Known spells updated from ${pack.title}. ${missing.length} eligible spell names were not found. No spells were copied into the module or changed in the source compendium.`);
}
export async function castSpell(actor,itemId='',targets=[]){
 const p=profile(actor),progress=spellProgress(p.level);if(state(actor).disabled)throw new Error('The GM has disabled this Empath\'s aura (Aura Controls).');if(armorBlocked(actor))throw new Error('Armor or natural armor blocks the aura; the GM can allow it in Aura Controls.');if(p.icon!=='sorcery')throw new Error('Icon of Sorcery required.');let item=actor.items.get(itemId);
 if(!item){const spells=actor.items.filter(i=>i.getFlag(ID,'knownSpell'));if(!spells.length)throw new Error('Use Manage Spells first.');const r=await prompt('Cast Empath spell',form(select('spell','Spell',spells.map(i=>({id:i.id,name:i.name})))));if(!r)return;item=actor.items.get(r.spell);}
 if(!item?.getFlag(ID,'knownSpell'))throw new Error('Select an Empath known spell.');const base=Number(item.system.level);if(base>progress.max)throw new Error('Spell level exceeds class limit.');
 const link=await chooseLink(actor,{label:'Choose casting / concentration link'});if(!link)return;if(base>0&&link.depth<1)throw new Error('Casting link must contain at least one depth before payment.');const s=state(actor),target=await linkedActor(link);
 const options=[];for(let l=base;l<=progress.max;l++)if(base||l===0)options.push({id:l,name:l?`Level ${l} — ${2*l} energy`:'Cantrip — no depth'});
 const choices=[...item.system.activities].filter(a=>!a.visibility?.level?.min||a.visibility.level.min<=p.level);if(!choices.length)throw new Error('Spell has no native activities.');
 const multi=choices.length>1;
 const r=await prompt(`Cast ${item.name}`,form(`<p>Cast through your link with <strong>${esc(target?.name)}</strong>. The spell must include you or ${esc(target?.name)}. Cost: 2 energy per spell level (allied depth 1, hostile depth 2).</p>${options.length>1?select('level','Cast at',options,base):''}${multi?select('activity','Use',choices.map(a=>({id:a.id,name:a.name||a.type}))):''}${select('origin','Spell originates from',[{id:'caster',name:actor.name},{id:'link',name:target?.name??'Linked creature'}])}${check('focused','Focused Bond: range becomes “linked target(s)”')}${p.level>=9?check('fuel','Body Fuel: half cost, take 1d6 psychic per depth saved'):''}${p.level>=17?check('max','Aura Max (1/long rest): any targets in your aura'):''}${base>0?`${check('auto','Pay automatically (this link first, then the others)',true)}<details><summary>Choose the payment yourself</summary>${s.links.map(l=>input(l.id,`${l.hostile?'Hostile':'Allied'} link — ${l.depth} available`,0,'number',`min="0" max="${l.depth}" step="1"`)).join('')}</details>`:''}`),[{action:'ok',label:'Cast',default:true}]);if(!r)return;
 r.level??=base;r.activity??=choices[0].id;
 const castLevel=Number(r.level);if(!Number.isInteger(castLevel)||castLevel<base||castLevel>progress.max||!base&&castLevel!==0)throw new Error('Invalid cast level.');
 const fuel=Boolean(r.fuel)&&p.level>=9;
 const manual=Object.fromEntries(s.links.map(l=>[l.id,Number(r[l.id]??0)]));
 const allocation=base>0&&(r.auto||!Object.values(manual).some(n=>n>0))?autoPayment(s.links,link.id,castLevel,{bodyFuel:fuel}):manual;
 const payment=planPayment(s.links,allocation,castLevel,{bodyFuel:fuel});
 if(r.max){const max=actor.items.find(i=>featureKey(i)==='max');if(!max||Number(max.system.uses.spent)>=1)throw new Error('Aura Max has no uses remaining.');for(const u of targets){const t=await fromUuid(u);if(!t?.actor||distance(actorToken(actor),t)>p.range||eligibility(actor,t.actor).length)throw new Error(`Aura Max: ${t?.name??'a target'} is outside your aura or cannot be affected.`);}}
 const originalActivity=item.system.activities.get(r.activity);if(!originalActivity)throw new Error('Native activity missing.');
 const involved=[target];for(const u of targets){const t=await fromUuid(u);if(t?.actor)involved.push(t.actor);}
 if(!await approve(`cast ${item.name} at level ${castLevel} (${payment.cost} energy)${involved.length>1?` targeting ${involved.slice(1).map(a=>a.name).join(', ')}`:''}`,involved))return;
 const concentration=Boolean(originalActivity.duration.concentration||item.system.properties.has('concentration'));
 if(concentration){const held=(link.held??[]).filter(h=>h.concentration);if(held.length&&!await confirm('Replace link concentration','This link already holds a concentration spell. Casting this spell ends the old one.'))return;}
 const castId=uid(),d=item.toObject();delete d._id;delete d._key;d.name=`${item.name} [Empath cast]`;d.flags[ID]={castId,castInstance:true,caster:actor.uuid,linkId:link.id,spellSource:item.getFlag(ID,'spellSource')};d.system.properties=d.system.properties.filter(v=>v!=='concentration');d.system.uses={max:'',spent:0,recovery:[]};
 for(const a of Object.values(d.system.activities)){a.duration.concentration=false;a.consumption.spellSlot=false;a.consumption.scaling.allowed=true;a.flags??={};a.flags[ID]={castInstance:true,castId};if(r.focused){a.range={...a.range,units:'spec',value:'',special:'Linked targets',override:true};}if(r.max){a.target.affects={...a.target.affects,type:'creature',count:'',choice:true};a.target.prompt=false;}}
 const [copy]=await actor.createEmbeddedDocuments('Item',[d]);let result;
 castAuth.add(castId);
 const usage={scaling:castLevel-base,consume:{spellSlot:false},concentration:{begin:false,end:null}};
 try{
  // The Empath's player uses the spell on their own screen (their template placement and chat card); the GM is the fallback.
  const user=setting('promptRouting','owner')==='gm'?null:(ctx.decider??playerFor(actor));let remote=null;
  if(user&&user.id!==game.user.id&&user.active)remote=await rpc(user,{op:'use',itemUuid:copy.uuid,activityId:r.activity,castId,usage});
  if(remote&&!remote.timeout)result=remote.ok;
  else{const activity=copy.system.activities.get(r.activity);result=await activity.use(usage,{configure:false});}
 }catch(err){await actor.deleteEmbeddedDocuments('Item',[copy.id]);throw err;}finally{castAuth.delete(castId);}
 if(!result){await actor.deleteEmbeddedDocuments('Item',[copy.id]);return;}
 // Link depth is committed only after the native activity succeeds, avoiding cancelled-use charges.
 const fresh=state(actor);for(const l of fresh.links){if(l.depth<payment.spend[l.id])throw new Error('Link depth changed during casting; resolve cost manually.');l.depth-=payment.spend[l.id]??0;}
 const active=fresh.links.find(l=>l.id===link.id);if(!active)throw new Error('Casting link was lost during spell use.');
 if(concentration)for(const old of active.held??[])if(old.concentration)await expireCast(actor,old.castId);
 // expireCast updates flags, so re-read while preserving our computed payment.
 const post=state(actor);for(const l of post.links){const paid=fresh.links.find(x=>x.id===l.id);if(paid)l.depth=paid.depth;}
 const current=post.links.find(l=>l.id===link.id);const duration=item.system.duration,seconds=duration.units==='minute'?Number(duration.value)*60:duration.units==='hour'?Number(duration.value)*3600:duration.units==='day'?Number(duration.value)*86400:duration.units==='round'?Number(duration.value)*6:0;
 const lasts=concentration||seconds>6||['perm','spec'].includes(duration.units);current.held??=[];current.held.push({castId,itemId:copy.id,name:item.name,concentration,endsAt:seconds?game.time.worldTime+seconds:null,instant:!lasts});await saveState(actor,post);
 if(r.max){const max=actor.items.find(i=>featureKey(i)==='max');await max.update({'system.uses.spent':Number(max.system.uses.spent??0)+1});}
 await chat(actor,'Empath spell cast',`${item.name}, level ${castLevel}. Paid ${payment.cost} energy. Origin: ${r.origin==='link'?target.name:actor.name}. ${lasts?'The casting link holds this spell.':'Instant casting copy retained for damage/effect buttons; it is removed automatically at the start of your next turn in combat, or end it from the manager.'} Use the spell’s chat card for its attack, save and damage buttons.`);
 if(payment.selfDice)await damage(actor,actor,`${payment.selfDice}d6`,'Body Fuel — unavoidable damage',{unavoidable:true});
}
