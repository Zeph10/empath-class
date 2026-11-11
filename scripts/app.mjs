import {ID,profile,ICONS,AURAS} from './core.mjs';
import {FEATURES,PASSIVE,featureKey} from './features.mjs';
import {state,linkedToken,actorToken,allActors,markers,armorBlocked,distance} from './runtime.mjs';
import {armorReason} from './actions.mjs';
// Display-only costs: side of link needed and minimum depth, for labels and greying out unaffordable actions.
const COSTS={link:{label:'bonus action'},apathy:{side:'enemy',min:0,label:'save'},fervor:{side:'ally',min:0,label:'free'},pain:{side:'enemy',min:1,label:'1+ hostile'},mantle:{side:'ally',min:1,label:'1+ allied'},disappointment:{side:'ally',min:1,label:'1+ allied'},terrorize:{side:'enemy',min:1,label:'1 hostile'},fomo:{side:'ally',min:2,label:'2 allied'},intrusive:{side:'enemy',min:3,label:'3 hostile'},failure:{side:'ally',min:6,label:'6 allied'},jump:{side:'enemy',min:3,label:'3 hostile'},death:{side:'ally',min:8,label:'8 allied'},end:{side:'enemy',min:6,label:'6 hostile'},valor:{side:'ally',min:2,label:'2 allied'},trepidation:{side:'enemy',min:1,label:'1 hostile'},turbulence:{side:'ally',min:2,label:'2 allied'},violence:{side:'enemy',min:2,label:'2 hostile'},excitement:{side:'ally',min:6,label:'needs 6 allied'},fatigue:{side:'enemy',min:4,label:'needs 4 hostile'},vigilance:{side:'ally',min:8,label:'needs 8 allied'},trouble:{side:'enemy',min:8,label:'needs 8 hostile'},meeting:{side:'ally',min:0,label:'reaction, 1/rest'},cloud:{label:'1/short rest'},trauma:{label:'10 min'}};
const {ApplicationV2,HandlebarsApplicationMixin}=foundry.applications.api;
export class EmpathManager extends HandlebarsApplicationMixin(ApplicationV2){
 static DEFAULT_OPTIONS={id:'empath-manager',tag:'div',classes:['empath-manager','standard-form'],window:{title:'Empath — Links & Icons',icon:'fa-solid fa-link',resizable:true},position:{width:620,height:780},actions:{use:EmpathManager.use,spells:EmpathManager.spells,controls:EmpathManager.controls}};
 static PARTS={content:{template:`modules/${ID}/templates/manager.hbs`,scrollable:['']}};
 constructor(actor,options={}){super(options);this.actor=actor??canvas.tokens?.controlled?.[0]?.actor??game.user.character??game.actors.find(a=>a.isOwner&&profile(a).level);}
 async _prepareContext(options){
 const actors=[...game.actors,...(canvas.scene?.tokens?.map(t=>t.actor)??[])].filter(a=>a&&a.isOwner&&profile(a).level);const unique=[...new Map(actors.map(a=>[a.uuid,a])).values()];
 if(!this.actor||!this.actor.isOwner||!profile(this.actor).level)this.actor=unique[0];const actor=this.actor,p=profile(actor),s=actor?state(actor):{links:[],auras:[]};
 // Reactions are offered as chat cards when their trigger happens; everything else with a link side gets a button on that link.
 const REACTIONS=new Set(['failure','meeting','jump','follow']);
 const usable=FEATURES.filter(f=>!PASSIVE.has(f.key)&&f.level<=p.level&&(f.icon==='base'||f.icon===p.icon));
 const src=actor?actorToken(actor):null,blocked=Boolean(s.moodBlocked?.created);
 const usesLeft=key=>{const i=actor?.items.find(i=>featureKey(i)===key);return i?Math.max(0,Number(i.system.uses?.max||1)-Number(i.system.uses?.spent??0)):null;};
 const links=[];for(const l of s.links){const token=await linkedToken(l);const side=l.hostile?'enemy':'ally',busy=s.auras.some(a=>a.linkId===l.id);
  const dist=src&&token?distance(src,token):Infinity;
  const actions=usable.filter(f=>COSTS[f.key]?.side===side&&!REACTIONS.has(f.key)).map(f=>{const c=COSTS[f.key],aura=Boolean(AURAS[f.key]);
   const why=l.depth<(c.min??0)?`Needs ${c.min} depth on this link (has ${l.depth}).`:aura&&busy?'This link already powers an aura. End that aura first.':!aura&&blocked?'Mood manipulations are unavailable until your next turn ends (Meeting of Minds).':'';
   return {key:f.key,name:f.name,cost:c.label.replace(/ (allied|hostile)$/,''),aura,dim:Boolean(why),tip:why||f.text};});
  links.push({...l,name:token?.name??'Missing token',capacity:p.capacity,held:l.held??[],full:l.depth>=p.capacity,pips:Array.from({length:p.capacity},(_,i)=>i<l.depth),
   distance:Number.isFinite(dist)?`${Math.round(dist)} ft`:'not on this scene',far:dist>p.range,moods:actions.filter(x=>!x.aura),auraActions:actions.filter(x=>x.aura),
   depthHint:p.level<2?'Link Depth starts at Empath level 2.':l.depth>=p.capacity?`At capacity: ${p.capacity} = Charisma modifier (min 1)${p.level>=11?' ×2':', doubles at level 11'}. Spend depth first.`:'Depth builds automatically when this creature ends its turn in combat. Click to do it now.'});}
 const general=usable.filter(f=>!COSTS[f.key]?.side&&!REACTIONS.has(f.key)&&f.key!=='link').map(f=>{const u=usesLeft(f.key);return {key:f.key,name:f.name,cost:u===null?COSTS[f.key]?.label:`${u} use${u===1?'':'s'} left`,dim:u===0,tip:f.text};});
 const reactions=usable.filter(f=>REACTIONS.has(f.key)).map(f=>{const u=f.key==='meeting'?usesLeft('meeting'):null;return {key:f.key,name:f.name,cost:u===null?COSTS[f.key]?.label?.replace(/^reaction, /,''):`${u} use${u===1?'':'s'} left`,tip:f.text};});
 const targets=[...(game.user.targets??[])].map(t=>t.document?.name??t.name).filter(Boolean);
 const best=side=>Math.max(-1,...s.links.filter(l=>side==='ally'?!l.hostile:l.hostile).map(l=>l.depth));
 const active=[];if(actor)for(const a of allActors())for(const e of markers(a).filter(e=>e.getFlag(ID,'caster')===actor.uuid&&!['probe-immune'].includes(e.getFlag(ID,'key')))){const f=e.flags[ID];const detail=f.key==='apathy'?`reduce next damage by ${f.reduction}`:f.key==='fervor'?[f.advPending?'advantage pending':'',f.damagePending?`+${f.bonus} damage pending`:''].filter(Boolean).join(', '):f.key==='mantle'?`+${f.bonus} attack`:f.energized?`energized ${f.energized}`:'';active.push({target:a.name,name:e.name.replace(/^Empath: /,''),img:e.img,detail});}
 const owned=new Set(actor?.items.map(i=>featureKey(i)).filter(Boolean)??[]);const missing=actor?FEATURES.filter(f=>f.level<=p.level&&(f.icon==='base'||f.icon===p.icon)&&!owned.has(f.key)).map(f=>f.name):[];
 return {...await super._prepareContext(options),general,reactions,blocked,targets:targets.join(', '),multi:unique.length>1,canLink:s.links.length<p.links,auraMaxLeft:usesLeft('max'),active,missing:missing.join(', '),armorBlock:actor&&!s.disabled&&armorBlocked(actor)?armorReason(actor):'',noIcon:actor&&p.level>=3&&!p.icon,hasActor:Boolean(actor),actors:unique.map(a=>({id:a.uuid,name:a.name,selected:a.uuid===actor?.uuid})),name:actor?.name,p,icon:ICONS[p.icon]??'No Icon selected',links,auras:s.auras.map(a=>{const l=links.find(x=>x.id===a.linkId),spec=AURAS[a.key]??{};return {...a,name:FEATURES.find(f=>f.key===a.key)?.name,link:l?.name??'?',sustain:spec.sustain??0,canEnergize:a.key==='violence'||(!a.energized&&a.key!=='fatigue'),energizeCost:spec.energize};}),isGM:game.user.isGM,disabled:s.disabled,armorOverride:s.armorOverride,features:FEATURES.filter(f=>!PASSIVE.has(f.key)&&f.level<=p.level&&(f.icon==='base'||f.icon===p.icon)).map(f=>{const c=COSTS[f.key]??{};return {...f,cost:c.label,unaffordable:Boolean(c.side)&&best(c.side)<(c.min??0)};}),sorcery:p.icon==='sorcery',tokenPresent:Boolean(actor&&actorToken(actor)),spells:actor?.items.filter(i=>i.getFlag(ID,'knownSpell')).map(i=>({id:i.id,name:i.name,level:i.system.level}))??[]};
 }
 async _onRender(context,options){await super._onRender(context,options);this.element.querySelector('[name="actor"]')?.addEventListener('change',async e=>{this.actor=await fromUuid(e.target.value);this.render();});}
 static async use(_event,button){if(!this.actor)return;await game.empath.use(this.actor,button.dataset.key,button.dataset.param??'');}
 static async spells(){if(this.actor)await game.empath.use(this.actor,'spells');}
 static async controls(){if(this.actor)await game.empath.use(this.actor,'controls');}
}
