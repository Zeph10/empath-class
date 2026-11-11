import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {FEATURES,PASSIVE,SPELL_LIST,toHtml} from '../scripts/features.mjs';
import {ID,SOURCE,ICONS} from '../scripts/core.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const id=s=>crypto.createHash('sha256').update(s).digest('hex').slice(0,16);
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const img='icons/magic/control/hypnosis-mesmerism-eye.webp';
const source={custom:'Axis & Ghostwheel — Empath, D&D Homebrew Wiki',book:'Empath (homebrew)',license:'CC-BY-SA-3.0',rules:'2024'};
const uuid=k=>`Compendium.${ID}.features.Item.${id(k)}`;
const desc=blocks=>({value:`${toHtml(blocks)}<p><a href="${SOURCE}">Source: Empath by Axis, co-authored by Ghostwheel</a> (CC BY-SA 3.0). See the module's AUTOMATION.md for what is automated and how rules are interpreted.</p>`,chat:''});
const grant=(keys,level,label='Empath Features')=>({_id:id(`${label}${level}${keys.join()}`),type:'ItemGrant',level,title:label,configuration:{items:keys.map(k=>({uuid:uuid(k),optional:false})),optional:false},value:{}});
function activity(f){const key=id(`${f.key}-activity`);return {[key]:{_id:key,type:'utility',name:PASSIVE.has(f.key)?'Open Empath Manager':f.name,activation:{type:['link'].includes(f.key)?'bonus':['follow','meeting','failure','jump'].includes(f.key)?'reaction':['heart'].includes(f.key)?'special':'action',value:1,override:false},consumption:{spellSlot:false,targets:[],scaling:{allowed:false}},target:{prompt:false,override:false,affects:{type:'creature',count:'1',choice:false},template:{type:'',size:'',units:'ft'}},range:{units:'ft',value:'@scale.empath.aura',override:false},duration:{units:'inst',concentration:false,override:false},uses:{max:'',spent:0,recovery:[]},effects:[],flags:{[ID]:{action:PASSIVE.has(f.key)?'manager':f.key}}}};}
const packs={features:[],classes:[],macros:[]};
for(const f of FEATURES)packs.features.push({_id:id(f.key),name:f.name,type:'feat',img,system:{description:desc(f.blocks),source,identifier:`empath-${f.key}`,type:{value:'class',subtype:''},prerequisites:{level:f.level,items:['class:empath'],repeatable:false},requirements:`Empath ${f.level}${f.icon==='base'?'':`; ${ICONS[f.icon]}`}`,properties:[],activities:activity(f),uses:{max:['cloud','meeting'].includes(f.key)?'1':f.key==='max'?'1':'',spent:0,recovery:['cloud','meeting'].includes(f.key)?[{period:'sr',type:'recoverAll'}]:f.key==='max'?[{period:'lr',type:'recoverAll'}]:[]}},effects:[],flags:{[ID]:{key:f.key,icon:f.icon,level:f.level}},ownership:{default:2}});
const classAdv=[{_id:id('hp'),type:'HitPoints',configuration:{},value:{},title:'Hit Points'},
{_id:id('saves'),type:'Trait',level:1,classRestriction:'primary',configuration:{mode:'default',grants:['saves:wis','saves:cha'],choices:[],allowReplacements:false},value:{chosen:[]}},
{_id:id('tools'),type:'Trait',level:1,classRestriction:'primary',configuration:{mode:'default',grants:['tool:disg'],choices:[],allowReplacements:false},value:{chosen:[]}},
{_id:id('skills'),type:'Trait',level:1,classRestriction:'primary',configuration:{mode:'default',grants:[],choices:[{count:2,pool:['skills:ani','skills:dec','skills:ins','skills:itm','skills:prc','skills:prf','skills:per']}],allowReplacements:false},value:{chosen:[]}},
{_id:id('subclass'),type:'Subclass',level:3,title:'Iconic Nature',configuration:{},value:{}},
{_id:id('aura-scale'),type:'ScaleValue',title:'Aura Range',configuration:{identifier:'aura',type:'distance',distance:{units:'ft'},scale:Object.fromEntries([1,4,7,10,13,16,19].map((l,i)=>[l,{value:30+5*i}]))},value:{}}];
for(const level of [...new Set(FEATURES.filter(f=>f.icon==='base').map(f=>f.level))])classAdv.push(grant(FEATURES.filter(f=>f.icon==='base'&&f.level===level).map(f=>f.key),level));
for(const level of [4,8,12,16,19])classAdv.push({_id:id(`asi${level}`),type:'AbilityScoreImprovement',level,title:'Ability Score Increase',configuration:{points:2,fixed:{str:0,dex:0,con:0,int:0,wis:0,cha:0},cap:2,locked:[]},value:{}});
const progression='<table><tr><th>Level</th><th>Aura</th><th>Features</th></tr>'+Array.from({length:20},(_,i)=>{const l=i+1;return `<tr><td>${l}</td><td>${30+5*Math.floor(i/3)} ft.</td><td>${FEATURES.filter(f=>f.icon==='base'&&f.level===l).map(f=>`@UUID[${uuid(f.key)}]{${f.name}}`).join(', ')}${[4,8,12,16,19].includes(l)?'Ability Score Increase':''}${[9,13,17].includes(l)?'Icon feature':''}</td></tr>`;}).join('')+'</table>';
packs.classes.push({_id:id('empath'),name:'Empath',type:'class',img,system:{description:{value:`<p>An unarmored empath builds emotional links and spends their depth to influence creatures.</p><p>d6 Hit Die. Primary class: Wisdom and Charisma saves, Disguise Kit, and two skills from Animal Handling, Deception, Insight, Intimidation, Perception, Performance, Persuasion. No armor or weapon proficiencies.</p><p>Equipment: choose quarterstaff, improvised sling with 20 rocks, or kitchen knife; choose diplomat’s, entertainer’s, or explorer’s pack; gain a disguise kit. Equipment is selected manually.</p><p>Use native class advancement for hit points, ASIs, and Icon choice. Level-one HP uses the standard maximum Hit Die (6 + Constitution), correcting the source’s ambiguous d6 notation. Multiclass prerequisites and additional proficiencies are left to the GM.</p>${progression}<p><a href="${SOURCE}">Source and complete flavor text</a></p>`,chat:''},source,identifier:'empath',levels:1,hd:{denomination:'d6',spent:0,additional:''},primaryAbility:{value:['wis','cha'],all:false},properties:[],spellcasting:{progression:'none',ability:'wis'},advancement:classAdv,startingEquipment:[]},effects:[],flags:{[ID]:{key:'class'}},ownership:{default:2}});
for(const [key,name]of Object.entries(ICONS)){
 const advancement=[3,9,13,17].map(l=>grant(FEATURES.filter(f=>f.icon===key&&f.level===l).map(f=>f.key),l,name));
 if(key==='sorcery')for(const [identifier,title,scale]of [['cantrips-known','Cantrips Known',{3:2,8:3,20:4}],['spells-known','Spells Known',Object.fromEntries([3,5,7,9,11,13,15,17,19].map((l,i)=>[l,i+2]))],['max-spell-level','Maximum Spell Level',{3:1,5:2,9:3,13:4,17:5}]])advancement.push({_id:id(identifier),type:'ScaleValue',title,configuration:{identifier,type:'number',scale:Object.fromEntries(Object.entries(scale).map(([l,n])=>[l,{value:n}]))},value:{}});
 packs.classes.push({_id:id(key),name,type:'subclass',img,system:{description:{value:`<p>${name}. Features at Empath levels 3, 9, 13, and 17.</p>${FEATURES.filter(f=>f.icon===key).map(f=>`<p>@UUID[${uuid(f.key)}]{${f.name}} (level ${f.level})</p>`).join('')}${key==='sorcery'?'<p>Open Empath Manager → Manage Spells to choose known spells from Spells 2024. Spell slots are not granted. Use the manager’s Cast controls for payment and link concentration.</p>':''}`,chat:''},source,identifier:`icon-of-${key==='crowds'?'the-crowds':key}`,classIdentifier:'empath',spellcasting:{progression:'none',ability:'wis'},advancement},effects:[],flags:{[ID]:{key}},ownership:{default:2}});
}
packs.macros.push({_id:id('manager-macro'),name:'Open Empath Manager',type:'script',img,scope:'global',command:'game.empath.open();',ownership:{default:2}});
await fs.writeFile(path.join(root,'data/spell-list.json'),JSON.stringify(SPELL_LIST,null,2));
// Writes pack-sources/. Compile them with `python3 tools/compile_packs.py` (no npm needed), or set FOUNDRY_CLI_MODULE
// to use the official @foundryvtt/foundryvtt-cli instead.
const cli=process.env.FOUNDRY_CLI_MODULE?await import(process.env.FOUNDRY_CLI_MODULE):null;
for(const [name,items]of Object.entries(packs)){if(!cli){const src=path.join(root,'pack-sources',name);await fs.rm(src,{recursive:true,force:true});await fs.mkdir(src,{recursive:true});for(const d of items){d._key=`!${name==='macros'?'macros':'items'}!${d._id}`;await fs.writeFile(path.join(src,`${d._id}.json`),JSON.stringify(d,null,2));}console.log(`${name}: ${items.length} sources written`);continue;}const {compilePack,extractPack}=cli;
 const src=path.join(root,'pack-sources',name),dest=path.join(root,'packs',name),check=path.join(root,'pack-check',name);await fs.rm(src,{recursive:true,force:true});await fs.rm(dest,{recursive:true,force:true});await fs.rm(check,{recursive:true,force:true});await fs.mkdir(src,{recursive:true});
 for(const d of items){d._key=`!${name==='macros'?'macros':'items'}!${d._id}`;await fs.writeFile(path.join(src,`${d._id}.json`),JSON.stringify(d,null,2));}
 await compilePack(src,dest);await fs.mkdir(check,{recursive:true});await extractPack(dest,check);
 if((await fs.readdir(check)).length!==items.length)throw new Error(`${name}: database roundtrip failed`);
 console.log(`${name}: ${items.length} documents compiled and roundtripped`);
}
await fs.rm(path.join(root,'pack-check'),{recursive:true,force:true});
