import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {FEATURES,PASSIVE,featureKey} from '../scripts/features.mjs';
import {levelOf,iconOf} from '../scripts/core.mjs';
const brew=JSON.parse(fs.readFileSync(new URL('../plutonium/empath-homebrew.json',import.meta.url)));
test('Homebrew contains every feature with module identifier and flag',()=>{
 const side=[...brew.foundryClassFeature,...brew.foundrySubclassFeature];
 assert.equal(side.length,FEATURES.length);
 for(const f of FEATURES){const s=side.find(x=>x.name===f.name&&x.level===f.level);assert.ok(s,f.name);assert.equal(s.identifier,`empath-${f.key}`);assert.equal(s.flags['empath-class'].key,f.key);assert.equal(s.activities.length,PASSIVE.has(f.key)?0:1);}
 for(const k of ['cloud','meeting','max'])assert.ok(side.find(x=>x.identifier===`empath-${k}`).system.uses.max==='1');
});
test('Homebrew feature references all resolve',()=>{
 const cf=new Set(brew.classFeature.map(f=>`${f.name}|${f.className}|${f.classSource}|${f.level}`));
 const sf=new Set(brew.subclassFeature.map(f=>`${f.name}|${f.className}|${f.classSource}|${f.subclassShortName}|${f.subclassSource}|${f.level}`));
 for(const r of brew.class[0].classFeatures)assert.ok(cf.has(typeof r==='string'?r:r.classFeature),String(r));
 for(const s of brew.subclass)for(const u of s.subclassFeatures)assert.ok(sf.has(u),u);
 for(const f of brew.subclassFeature)for(const e of f.entries)if(e?.type==='refSubclassFeature')assert.ok(sf.has(e.subclassFeature),e.subclassFeature);
 assert.deepEqual(brew.foundrySubclass.map(s=>s.identifier).sort(),['icon-of-sorcery','icon-of-terror','icon-of-the-crowds']);
});
test('Imported items are recognised by flag, identifier, or distinctive name — never generic names',()=>{
 assert.equal(featureKey({type:'feat',flags:{'empath-class':{key:'fervor'}},system:{}}),'fervor');
 assert.equal(featureKey({type:'feat',flags:{},system:{identifier:'empath-cloud'},name:'Whatever'}),'cloud');
 assert.equal(featureKey({type:'feat',flags:{},system:{identifier:'cloud-mind'},name:'Cloud Mind'}),'cloud');
 assert.equal(featureKey({type:'feat',flags:{},system:{identifier:'fears-end'},name:"Fear's End"}),'end');
 assert.equal(featureKey({type:'feat',flags:{},system:{identifier:'spellcasting'},name:'Spellcasting'}),null);
 assert.equal(featureKey({type:'spell',flags:{},system:{},name:'Cloud Mind'}),null);
});
test('Class and Icon are recognised by name when identifiers differ',()=>{
 const items=[{type:'class',name:'Empath',system:{identifier:'empath-axis',levels:9}},{type:'subclass',name:'Icon of the Crowds',system:{identifier:'crowds'}}];
 const actor={items:Object.assign(items,{})};assert.equal(levelOf(actor),9);assert.equal(iconOf(actor),'crowds');
});
