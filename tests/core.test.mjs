import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {ID,profile,spellProgress,planPayment,canAddLink,normalize,AURAS} from '../scripts/core.mjs';
import {FEATURES,SPELL_LIST} from '../scripts/features.mjs';
const actor=(level,cha=3,icon='sorcery',prof=4)=>({items:[{type:'class',system:{identifier:'empath',levels:level}},{type:'subclass',system:{identifier:`icon-of-${icon==='crowds'?'the-crowds':icon}`}}],system:{abilities:{cha:{mod:cha},wis:{mod:4}},attributes:{prof}}});
test('Every aura and resource breakpoint across levels 1–20',()=>{
 const expected=[30,30,30,35,35,35,40,40,40,45,45,45,50,50,50,55,55,55,60,60];
 for(let l=1;l<=20;l++){const p=profile(actor(l));assert.equal(p.range,expected[l-1]);assert.equal(p.capacity,l>=11?6:3);assert.equal(p.gain,l>=11?2:1);assert.equal(p.links,l>=20?4:l>=10?3:l>=5?2:1);assert.equal(p.dc,16);}
 assert.equal(profile(actor(11,-2)).capacity,2);assert.equal(profile(actor(2,-2)).capacity,1);
});
test('Sorcery table has the exact cantrip, known-spell and max-level progression',()=>{
 for(let l=1;l<=20;l++){const p=spellProgress(l);assert.equal(p.known,l<3?0:Math.floor((l+1)/2));assert.equal(p.cantrips,l<3?0:l<8?2:l<20?3:4);assert.equal(p.max,l<3?0:l<5?1:l<9?2:l<13?3:l<17?4:5);}
});
test('Reserve a hostile slot after level five; level one may be allied',()=>{
 assert.ok(canAddLink([],false,profile(actor(1))));assert.equal(canAddLink([{hostile:false}],false,profile(actor(5))),false);assert.ok(canAddLink([{hostile:false}],true,profile(actor(5))));assert.ok(canAddLink([{hostile:false},{hostile:true}],false,profile(actor(10))));assert.equal(canAddLink([{hostile:false},{hostile:false}],false,profile(actor(10))),false);
});
test('Payment mixes hostile and allied depth; Body Fuel uses energy rather than raw depth',()=>{
 const links=[{id:'a',depth:5,hostile:false},{id:'h',depth:3,hostile:true}];
 assert.deepEqual(planPayment(links,{a:2,h:2},3),{spend:{a:2,h:2},cost:6,paid:6,selfDice:0});
 assert.equal(planPayment(links,{a:1,h:1},3,{bodyFuel:true}).selfDice,3);
 assert.equal(planPayment(links,{a:0,h:2},3,{bodyFuel:true}).paid,4); // one unavoidable rounding overpay
 assert.throws(()=>planPayment(links,{a:0,h:4},3),/Invalid/);
 assert.throws(()=>planPayment(links,{a:0,h:1},3),/Need/);
 assert.throws(()=>planPayment(links,{a:5,h:2},3),/overpays/);
 assert.throws(()=>planPayment(links,{a:1.5,h:2},3),/Invalid/);
});
test('2024 spell aliases normalize punctuation and legacy named spells',()=>{
 assert.equal(normalize('Tasha’s Hideous Laughter'),normalize('Hideous Laughter'));assert.equal(normalize('Nystul’s Magic Aura'),normalize('Magic Aura'));assert.equal(normalize("Rary's Telepathic Bond"),normalize('Telepathic Bond'));
});
test('Native compendium references, IDs and all feature unlocks are complete',()=>{
 const root=path.resolve(import.meta.dirname,'..');let count=0;const docs=[];
 for(const name of ['features','classes','macros'])for(const filename of fs.readdirSync(path.join(root,'pack-sources',name))){const d=JSON.parse(fs.readFileSync(path.join(root,'pack-sources',name,filename)));assert.match(d._id,/^[a-zA-Z0-9]{16}$/);assert.equal(d._key,`!${name==='macros'?'macros':'items'}!${d._id}`);docs.push(d);count++;}
 assert.equal(count,53);const features=docs.filter(d=>d.type==='feat');assert.equal(features.length,FEATURES.length);const featureIds=new Set(features.map(d=>d._id));
 const granted=new Set();for(const d of docs.filter(d=>['class','subclass'].includes(d.type)))for(const adv of d.system.advancement){assert.match(adv._id,/^[a-zA-Z0-9]{16}$/);if(adv.type==='ItemGrant')for(const entry of adv.configuration.items){const id=entry.uuid.split('.').at(-1);assert.ok(featureIds.has(id));granted.add(id);}}
 assert.equal(granted.size,FEATURES.length);const cls=docs.find(d=>d.type==='class');assert.equal(cls.system.hd.denomination,'d6');assert.equal(cls.system.spellcasting.progression,'none');assert.deepEqual(cls.system.advancement.filter(a=>a.type==='AbilityScoreImprovement').map(a=>a.level),[4,8,12,16,19]);
});
test('Crowds has all eight auras and spell list has no duplicate normalized names',()=>{
 assert.equal(Object.keys(AURAS).length,8);const names=SPELL_LIST.flat().map(normalize);assert.equal(new Set(names).size,names.length);assert.equal(FEATURES.length,48);
});
