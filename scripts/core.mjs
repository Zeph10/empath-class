export const ID = 'empath-class';
export const SOURCE = 'https://dnd-wiki.org/wiki/Empath_(5e_Class)';
export const ICONS = {sorcery:'Icon of Sorcery',terror:'Icon of Terror',crowds:'Icon of the Crowds'};
export const clamp = (v,min,max)=>Math.min(max,Math.max(min,Number(v)||0));
// Accept the module compendium items and Plutonium/homebrew imports (matched by identifier, then by name).
export function levelOf(actor) {return Number(actor?.items?.find(i=>i.type==='class' && (i.system.identifier==='empath'||i.name==='Empath'))?.system.levels ?? 0);}
export function iconOf(actor) {return Object.keys(ICONS).find(k=>actor?.items?.some(i=>i.type==='subclass' && (i.system.identifier===`icon-of-${k==='crowds'?'the-crowds':k}`||i.name===ICONS[k]||i.system.identifier===`icon-of-${k}`))) ?? '';}
export function profile(actor) {
 const level=levelOf(actor),cha=Number(actor?.system.abilities?.cha?.mod ?? 0),wis=Number(actor?.system.abilities?.wis?.mod ?? 0),prof=Number(actor?.system.attributes?.prof ?? 2);
 return {level,cha,wis,prof,icon:iconOf(actor),dc:8+prof+wis,range:30+5*Math.floor(Math.max(0,level-1)/3),capacity:Math.max(1,cha)*(level>=11?2:1),gain:level>=11?2:1,links:level>=20?prof:level>=10?3:level>=5?2:1,painDie:level>=17?12:level>=11?10:level>=5?8:6,apathyDice:1+(level>=5)+(level>=11)+(level>=17),fervorCrit:(level>=5)+(level>=11)+(level>=17),mantleBonus:1+(level>=9)+(level>=17),worthyThreshold:level>=20?5:level>=17?4:level>=14?3:level>=11?2:level>=8?1:level>=5?0.5:0};
}
export function spellProgress(level) {return {cantrips:level>=20?4:level>=8?3:level>=3?2:0,known:level>=3?Math.floor((level+1)/2):0,max:level>=17?5:level>=13?4:level>=9?3:level>=5?2:level>=3?1:0};}
export const normalize = s=>String(s??'').normalize('NFKD').replace(/[’']/g,'').replace(/^(tashas |nystuls |rarys )/i,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function planPayment(links,allocations,spellLevel,{bodyFuel=false}={}) {
 const raw=2*spellLevel,discount=bodyFuel?Math.floor(raw/2):0,cost=raw-discount;
 let paid=0;const spend={};
 for(const link of links){const n=Number(allocations[link.id]??0);if(!Number.isInteger(n)||n<0||n>link.depth)throw new Error('Invalid link-depth allocation.');spend[link.id]=n;paid+=n*(link.hostile?2:1);}
 if(paid<cost)throw new Error(`Need ${cost} energy; allocation provides ${paid}.`);
 // An indivisible hostile depth may exceed an odd remaining cost by one.
 if(paid>cost+1 || (paid>cost && !links.some(l=>l.hostile&&spend[l.id]>0)))throw new Error('Allocation overpays. Reduce the depth spent.');
 return {spend,cost,paid,selfDice:discount};
}
// Default payment for a spell: the casting link pays first, then the others; allied depth is worth 1, hostile 2.
// Hostile depth is only used in whole units, with at most one unit of overpayment when nothing else can cover the cost.
export function autoPayment(links,castingLinkId,spellLevel,{bodyFuel=false}={}) {
 const raw=2*spellLevel,cost=raw-(bodyFuel?Math.floor(raw/2):0);let rem=cost;const alloc=Object.fromEntries(links.map(l=>[l.id,0]));
 const order=[...links].sort((a,b)=>(b.id===castingLinkId)-(a.id===castingLinkId)||b.depth-a.depth);
 for(const l of order){if(rem<=0)break;const n=l.hostile?Math.min(l.depth,Math.floor(rem/2)):Math.min(l.depth,rem);alloc[l.id]=n;rem-=n*(l.hostile?2:1);}
 if(rem>0){const h=order.find(l=>l.hostile&&alloc[l.id]<l.depth);if(h){alloc[h.id]++;rem-=2;}}
 if(rem>0)throw new Error(`Not enough link depth: this costs ${cost} energy (allied depth counts 1, hostile depth 2).`);
 return alloc;
}
export function canAddLink(links,hostile,p) {return links.length<p.links && !(p.level>=5 && !hostile && links.filter(l=>!l.hostile).length>=p.links-1);}
export function terrorSaveMode(target,p) {if(p.icon!=='terror')return 0;const fearImmune=Array.from(target?.system.traits?.ci?.value??[]).includes('frightened');const fearAdv=Boolean(target?.getFlag?.(ID,'fearAdvantage'));if(p.level>=9)return fearImmune?1:-1;return fearAdv?1:-1;}
export const AURAS={
 valor:{name:'Valor',level:3,side:'ally',cost:2,sustain:1,energize:1},trepidation:{name:'Trepidation',level:3,side:'enemy',cost:1,sustain:0,energize:1},
 turbulence:{name:'Turbulence',level:9,side:'ally',cost:2,sustain:2,energize:1},violence:{name:'Violence',level:9,side:'enemy',cost:2,sustain:0,energize:2},
 excitement:{name:'Excitement',level:13,side:'ally',check:6,cost:0,sustain:2,energize:2},fatigue:{name:'Fatigue',level:13,side:'enemy',check:4,cost:0,sustain:0,energize:2},
 vigilance:{name:'Vigilance',level:17,side:'ally',check:8,cost:0,sustain:3,energize:2},trouble:{name:'Trouble',level:17,side:'enemy',check:8,cost:0,sustain:2,energize:2}
};
