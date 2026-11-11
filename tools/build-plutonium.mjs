// Generates plutonium/empath-homebrew.json: a 5etools-format homebrew file (class, Icons, features)
// that Plutonium can import. Foundry side-data carries the identifiers/flags the module automation uses.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {FEATURES,PASSIVE,toEntries,ASI_TEXT} from '../scripts/features.mjs';
import {ID,SOURCE,ICONS} from '../scripts/core.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const SRC='EmpathAxis',CLASS='Empath';
const SHORT={sorcery:'Sorcery',terror:'Terror',crowds:'Crowds'};
const ident=k=>`icon-of-${k==='crowds'?'the-crowds':k}`;
const activation=k=>k==='link'?'bonus':['follow','meeting','failure','jump'].includes(k)?'reaction':(k==='heart'||PASSIVE.has(k))?'special':'action';
const uses=k=>['cloud','meeting'].includes(k)?{uses:{max:'1',per:'sr'}}:k==='max'?{uses:{max:'1',per:'lr'}}:null;
const img='icons/magic/control/hypnosis-mesmerism-eye.webp';
function foundry(f,extra){
 const out={...extra,identifier:`empath-${f.key}`,img,flags:{[ID]:{key:f.key,icon:f.icon,level:f.level}}};
 const u=uses(f.key);if(u)out.system=u;
 // Passive features get no activity (nothing to click); active ones get one utility activity the module intercepts.
 out.activities=PASSIVE.has(f.key)?[]:[{type:'utility',name:f.name,activation:{type:activation(f.key)},flags:{[ID]:{action:f.key}}}];
 return out;
}
const entries=f=>toEntries(f.blocks);
const base=FEATURES.filter(f=>f.icon==='base');
const classFeature=[],subclassFeature=[],foundryClassFeature=[],foundrySubclassFeature=[];
for(const f of base){const ref={name:f.name,source:SRC,className:CLASS,classSource:SRC,level:f.level};classFeature.push({...ref,entries:entries(f)});foundryClassFeature.push(foundry(f,ref));}
// Generic structure features (ASI and Icon gain levels)
const extraClass=[];
for(const l of [4,8,12,16,19])extraClass.push({name:'Ability Score Improvement',source:SRC,className:CLASS,classSource:SRC,level:l,entries:[ASI_TEXT]});
for(const l of [9,13,17])extraClass.push({name:'Icon Feature',source:SRC,className:CLASS,classSource:SRC,level:l,entries:['You gain a feature from your Icon.']});
classFeature.push(...extraClass);
const iconChoice=classFeature.find(f=>f.name==='Iconic Nature');
const classFeatureRefs=[];
for(let l=1;l<=20;l++){
 for(const f of classFeature.filter(f=>f.level===l)){
  const uid=`${f.name}|${CLASS}|${SRC}|${l}`;
  classFeatureRefs.push(f===iconChoice||f.name==='Icon Feature'?{classFeature:uid,gainSubclassFeature:true}:uid);
 }
}
const subclass=[],foundrySubclass=[];
for(const [key,name]of Object.entries(ICONS)){
 const short=SHORT[key],feats=FEATURES.filter(f=>f.icon===key),refs=[];
 for(const l of [3,9,13,17]){
  const atLevel=feats.filter(f=>f.level===l);if(!atLevel.length)continue;
  const [head,...rest]=atLevel;
  refs.push(`${head.name}|${CLASS}|${SRC}|${short}|${SRC}|${l}`);
  for(const f of atLevel){
   const ref={name:f.name,source:SRC,className:CLASS,classSource:SRC,subclassShortName:short,subclassSource:SRC,level:l};
   const e=entries(f);if(f===head)for(const r of rest)e.push({type:'refSubclassFeature',subclassFeature:`${r.name}|${CLASS}|${SRC}|${short}|${SRC}|${l}`});
   subclassFeature.push({...ref,entries:e});foundrySubclassFeature.push(foundry(f,ref));
  }
 }
 subclass.push({name,shortName:short,source:SRC,className:CLASS,classSource:SRC,subclassFeatures:refs});
 foundrySubclass.push({name,shortName:short,source:SRC,className:CLASS,classSource:SRC,identifier:ident(key),img,flags:{[ID]:{key}}});
}
const auraRow=l=>`${30+5*Math.floor((l-1)/3)} ft.`,linkRow=l=>l>=20?'PB':l>=10?3:l>=5?2:1;
const doc={
 _meta:{sources:[{json:SRC,abbreviation:'EMP',full:'Empath (Axis & Ghostwheel)',url:SOURCE,authors:['Axis','Ghostwheel'],convertedBy:['Empath — Links & Icons Foundry module'],version:'1.6.1',color:'5c348f'}],edition:'one',dateAdded:1790000000,dateLastModified:1790000000},
 class:[{name:CLASS,source:SRC,edition:'one',hd:{number:1,faces:6},proficiency:['wis','cha'],primaryAbility:[{wis:true,cha:true}],
  startingProficiencies:{skills:[{choose:{from:['animal handling','deception','insight','intimidation','perception','performance','persuasion'],count:2}}],tools:['{@item Disguise Kit|XPHB}'],toolProficiencies:[{'disguise kit':true}]},
  startingEquipment:{additionalFromBackground:true,default:['(a) a quarterstaff, (b) an improvised sling and 20 rocks, or (c) a kitchen knife','(a) a diplomat’s pack, (b) an entertainer’s pack, or (c) an explorer’s pack','A {@item Disguise Kit|XPHB}']},
  classTableGroups:[{colLabels:['Aura','Max Links'],rows:Array.from({length:20},(_,i)=>[auraRow(i+1),linkRow(i+1)])}],
  classFeatures:classFeatureRefs,subclassTitle:'Icon'}],
 foundryClass:[{name:CLASS,source:SRC,identifier:'empath',img,flags:{[ID]:{key:'class'}},
  advancement:[{type:'ScaleValue',title:'Aura Range',configuration:{identifier:'aura',type:'distance',distance:{units:'ft'},scale:Object.fromEntries([1,4,7,10,13,16,19].map((l,i)=>[l,{value:30+5*i}]))}}]}],
 subclass,foundrySubclass,classFeature,subclassFeature,foundryClassFeature,foundrySubclassFeature
};
await fs.writeFile(path.join(root,'plutonium/empath-homebrew.json'),JSON.stringify(doc,null,'\t'));
console.log(`classFeature ${classFeature.length}, subclassFeature ${subclassFeature.length}, foundry ${foundryClassFeature.length+foundrySubclassFeature.length}`);
