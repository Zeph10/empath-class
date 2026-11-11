// Feature text from the Empath (5e Class) page by Axis, co-authored by Ghostwheel, D&D Homebrew Wiki
// (https://dnd-wiki.org/wiki/Empath_(5e_Class)), CC BY-SA 3.0. Wording is kept as written; wiki markup was
// removed and combined sections were split so each Foundry feature item carries its own part of the text.
// Block types: "string" paragraph | {list:[...]} | {name,text} run-in header | {table:{cols,rows}} | {note} module note.
const SORCERY_TABLE={cols:['Icon of Sorcery Level','Cantrips Known','Spells Known','Maximum Spell Level'],rows:[[3,2,2,1],[4,2,2,1],[5,2,3,2],[6,2,3,2],[7,2,4,2],[8,3,4,2],[9,3,5,3],[10,3,5,3],[11,3,6,3],[12,3,6,3],[13,3,7,4],[14,3,7,4],[15,3,8,4],[16,3,8,4],[17,3,9,5],[18,3,9,5],[19,3,10,5],[20,4,10,5]].map(([l,...r])=>[`${l}${l===3?'rd':'th'}`,...r.map(String)])};
const RAW=[
 ['aura','Aura',1,'base',[
  'At 1st level you have an aura that enables you to understand the thoughts and feelings of those who enter it. Unlike a paladin aura which offers benefits to your allies, this aura allows you to use your empath features, and functions more like your effective range. You know the location and emotional state of creatures are within range of your aura. Creatures are considered to be within your aura as long as they:',
  {list:['Are not constructs','Are not behind full cover','Do not have resistance or immunity to psychic damage','Have an Intelligence score higher than 1']},
  'Your aura is an emanation starting at 30 ft. The range of this emanation increases when you reach certain empath levels, as shown in the Empath table. Empaths cannot benefit from this class feature if they have natural armor or are wearing armor, as it prevents their aura from expanding.']],
 ['link','Link',1,'base',[
  'Beginning at 1st level, you are able to deepen your empathic connection to creatures within your aura. While a creature is in your aura you can form a link with it as a bonus action. Your link cannot be ended voluntarily; instead, the link breaks if the target leaves the range of your aura at any time. While you are linked to a creature you cannot concentrate on a spell. A linked creature can feel what the empath feels and vise versa.',
  'Either you or the linked creature can spend an action to attempt to dig deeper by making a Wisdom (Insight) ability check contested against the other creature\'s Charisma (Deception) ability check. On a success, you can read the creature\'s surface-level thoughts and gain insight into the creature\'s reasoning (if any) and something that looms large in its mind (such as something it worries over, loves, or hates). A creature who succeeds on their Charisma (Deception) check is immune to further attempts to probe deeper using this ability until they finish a long rest.',
  'Some of your class features require your target to make a saving throw to resist the feature\'s effects. The saving throw DC is calculated as follows:',
  {name:'Empath save DC =',text:'8 + your proficiency bonus + your Wisdom modifier'}]],
 ['follow','The Right Place at the Right Time',1,'base',[
  'You may spend a reaction if a linked creature moves. As part of that reaction, you may move five feet each time the linked creature moves five feet, but no more total distance than your speed. You regain this reaction at the end of the creature\'s turn.']],
 ['mood','Mood Manipulation',1,'base',[
  'Starting at 1st level, you can manipulate the emotions of those you are linked to in profound ways. You gain the use of the following mood manipulations: Apathy and Fervor.']],
 ['apathy','Apathy',1,'base',[
  'You may attempt to thwart a linked foe\'s attempts at aggression. By spending an action, you may force a linked creature to make a Wisdom saving throw. On a failed save, their next instance of damage dealt is reduced by 1d4 + your Charisma modifier and they are unable to critically hit while under this effect. Upon reaching 5th, 11th, and 17th levels, increase the amount of damage reduced by an additional 1d4. This effect can stack with other instances of Apathy.']],
 ['fervor','Fervor',1,'base',[
  'You may attempt to inspire your linked ally to perform at their best. By spending an action, you can cause their next weapon attack before the start of your next turn to be made at advantage. In addition, their first successful weapon attack before the start of your next turn deals additional damage equal to your Charisma modifier. Upon reaching 5th, 11th, and 17th levels, also expand the ally\'s critical hit range by 1. (This stacks with effects that expand your critical hit rate)']],
 ['depth','Link Depth',2,'base',[
  'Upon reaching 2nd level, you gain the ability to store empathic energy within the bonds you share with friend or foe. Whenever a linked target ends its turn, you may force it to make a Wisdom saving throw. On a failed save, the link depth for their link is increased by one as long as they are a worthy foe. A creature may choose to fail their saving throw if they wish. This power can be used to empower your empath abilities and describes the intensity of your emotional connection.',
  'All link depth is lost when the link is broken. The maximum depth you can accrue on a target is equal to your Charisma modifier (minimum one). Whenever link depth is expended, a display occurs which signals a supernatural event. Examples of displays can be auditory (such as bass-pitched hum), material (such as the target or an area briefly being slicked with translucent gel which shortly disappears), mental (such as a subtle chime ringing in the minds of those nearby), olfactory (such as an odd but familiar odor bringing to mind a brief mental flash of a long-buried memory), or visual (such as the empath\'s eyes glowing like points of silver fire). Regardless, it is clear that the empath is the source of this supernatural event.',
  'You gain the following mood manipulations: Pain Resonance and Inspirational Mantle.']],
 ['pain','Pain Resonance',2,'base',[
  'As an action, expend link depth to deal 2d6 psychic damage to the linked foe per link depth. The size of the die of damage from this feature increases at levels 5 to a d8, at 11 to a d10, and at 17 to a d12. Starting at fifth level, the dice are doubled if pain resonance is used at touch range.']],
 ['mantle','Inspirational Mantle',2,'base',[
  'As an action, expend one link depth to increase your ally\'s attack bonus by one for one turn. You may expend addition link depth to extend the duration of this ability for an additional round per link depth. If your link is broken, the effect of Inspirational Mantle ends. Increase the bonus by one at 9th and 17th levels (up to a maximum of +3). At fifth level, also expand the critical hit range by the attack bonus granted by this feature.']],
 ['icon','Iconic Nature',3,'base',[
  'As you reach 3rd level, you determine the nature of your Icon. Choose one of the following icons: Icon of Sorcery, Icon of Terror, or Icon of the Crowds, all detailed at the end of the class description. Your icon grants you features at 3rd level, and again at 9th, 13th, and 17th level.']],
 ['influence','Insidious Influence',5,'base',[
  'At 5th level, you gain the ability to form an additional link, increasing the number you can have active at once to two. However, one of the two links must be made to a hostile creature.']],
 ['imprint','Imprint Affect',6,'base',[
  'At 6th level you can spend an action to infuse something you or one of your links feels into an object you are touching. Any creature that touches the object may feel this emotion. The emotion is limited in intensity and typically has no lasting effects.']],
 ['linger','Lingering Link',7,'base',[
  'At 7th level, your links are durable enough to survive briefly being severed from your aura. If a creature would leave your aura, you may treat the creature as if it were still in your aura or allow the link to break. If you treat the creature as if it were in your aura, then you must end your turn with the creature in your aura, or the link breaks.']],
 ['extra','Extra Link',10,'base',[
  'Starting at 10th level, you can use a bonus action to form an additional link, increasing the number you can have active at once to three. At least one of the three links you form is limited to a hostile creature.']],
 ['improved','Improved Empathy',11,'base',[
  'At 11th level, whenever your link would gain link depth, it gains an additional link depth, and your maximum capacity of link depth per link is doubled.']],
 ['heart','Heart to Heart',14,'base',[
  'Starting at 14th level, you may speak telepathically with any creature within your aura allowing you to understand each other as long as they know at least one language.']],
 ['cloud','Cloud Mind',15,'base',[
  'Beginning at 15th level, you can cause others to become unaware of your existence. Once per short rest, you may force all creatures within range of your aura to make a Wisdom saving throw, or else you become Hidden to them. If you activate any class features, cast a spell, activate a magic item or make an attack, this effect automatically ends, and if you interact with the environment in a noticeable way, they may attempt the saving throw once more. This effect lasts for ten minutes, or until you end your turn with them outside your aura.']],
 ['trauma','Trauma Dump',18,'base',[
  'Starting at 18th level, you can open yourself to the psychic emanations of others and take on some of their wounds to allow them to recuperate from the scars events have left on them. You can replicate the effects of greater restoration on a target if you are in contact with them for ten minutes and you are both staying still.']],
 ['world','Share Your World',20,'base',[
  'At 20th level, you may have a number of links equal to your proficiency bonus.']],
 // Icon of Sorcery
 ['sorcery','Spellcasting',3,'sorcery',[
  'An Icon of Sorcery may form in response to profound displays of magical power. Those with this icon are able to convert emotions into magical power.',
  'When you reach 3rd level, you gain spellcasting.',
  {name:'Casting Empath Spells',text:'Empaths do not cast spells using spell slots and instead expend link depth. When you cast a spell, first select which of your active links will cast the spell and the linked creature associated with that link. The spell must include either yourself or that creature, and the link must have at least one link depth if it casting a leveled spell. The spell originates either from your space or that creature\'s space. Expend link depth equal to twice the spell level from any active links, hostile links count double.'},
  'When you cast a spell gained from this subclass with a duration of more than one round, the spell ends if the link designated for the casting breaks. You can only cast empath spells in this way even if you know spells from another class or feature.',
  {name:'Cantrips.',text:'You learn two cantrips of your choice from the icon of sorcery spell list (found at the end of this subclass). You learn an additional cantrip of your choice at 10th level. 0 linked depth is needed to cast a cantrip.'},
  {name:'Leveled Spells',text:'You know two 1st-level icon of sorcery spells of your choice from the icon of sorcery spell list (shown at the end of this subclass).'},
  'The Spells Known column of the Icon of Sorcery Spellcasting table shows when you learn more leveled spells. A spell you choose must be of a level no higher than what\'s shown in the table\'s Maximum Spell Level column for your level. For example, at level ten you can learn a spell of 1st, 2nd, or 3rd level, and 3 is the highest level you can upcast your spells.',
  'Whenever you gain a level in this class, you can replace one of the icon of sorcery spells you know with another spell of your choice from the icon of sorcery spell list. The new spell must be of a level no higher than what\'s shown in the table\'s Maximum Spell Level column for your level.',
  {name:'Spellcasting Ability.',text:'Wisdom is your spellcasting ability for your icon of sorcery spells.'},
  {name:'Spell save DC',text:'= 8 + your proficiency bonus + your Wisdom modifier'},
  {name:'Spell attack modifier',text:'= your proficiency bonus + your Wisdom modifier'},
  {name:'Spells and Concentration.',text:'Empaths do not concentrate on spells in the traditional way. Instead, they designate a link to hold their concentration when they cast a spell, each of which can concentrate on a single spell. If the link breaks, they are considered to have lost concentration, and the spell ends. They cannot lose concentration by taking damage.'},
  {table:SORCERY_TABLE},
  {note:'The cantrip text (additional cantrip at 10th level) and the table (3 at 8th, 4 at 20th) disagree; the module follows the table.'}]],
 ['focus','Focused Bond',3,'sorcery',[
  'Starting at 3rd level, you learn to cast magic through your connections with others. You may replace the range of a spell with "a linked target(s)". If you do so and it has a range of self, the target must be willing.']],
 ['fuel','Body Fuel',9,'sorcery',[
  'Upon reaching 9th level, you gain the ability to convert pain into empathic energy. You can reduce the amount of link depth required to cast a spell by half (minimum 0), but take 1d6 psychic damage for each depth reduced. The damage taken from this feature cannot be reduced in any way.']],
 ['meeting','Meeting of Minds',13,'sorcery',[
  'Starting at 13th level, as a reaction when an ally you are linked with successfully lands a weapon attack, you may transfer the link and all link depth attached to that link to the target of the weapon attack. You can use this ability once and regain its use at the end of a short or long rest. If you do so, you are unable to use mood manipulations until the end of your next turn.']],
 ['max','Aura Max',17,'sorcery',[
  'Having reached 17th level, your aura can become a conduit. Replace the target of a spell with "any number of target creatures within your aura." If you do so and it has a range of self, each target must be willing.',
  'You can use this ability once and regain the ability to use it at the end of a long rest.']],
 // Icon of Terror
 ['fearmonger','Fearmonger',3,'terror',[
  'The Icon of Terror is born from a large group of people witnessing something horrific. Those who bear this power can manipulate the deepest fears of those unlucky enough to enter their aura.',
  'Starting at 3rd level, the way you interact with others through your links changes. Creatures that are immune to the frightened condition cannot be linked to. Creatures that gain advantage on saving throws against frightened have advantage on the saving throw to resist increasing their link\'s depth. However, creatures that have neither have disadvantage on saving throws to resist increasing their link\'s depth.',
  'In addition, the following mood manipulations: Fear of Disappointment and Terrorize.']],
 ['disappointment','Fear of Disappointment',3,'terror',[
  'The weight of expectation causes your allies to perform. You can spend an action and expend 1 link depth from the link of a linked creature to grant them advantage on all attacks until the start of your next turn. You can spend additional link depth when activating this feature; if you do, the linked creature also deals additional psychic damage on attacks equal to twice the number of additional link depth expended. If they attack a linked creature the additional damage is quadrupled instead.']],
 ['terrorize','Terrorize',3,'terror',[
  'Fear sparks within the heart of your enemies, causing them to lose their nerve. You can spend an action and expend one link depth from the link of a linked creature to cause that creature to become frightened of you. You are immune to all damage originating from the creature while they are frightened in this way. They can end the condition at the start of their turn by ending their turn, or by passing a wisdom saving throw at the end of their turn after taking their turn normally.']],
 ['widespread','Widespread Fear',9,'terror',[
  'By 9th level, your fearsome aura seeps deeply into the psyche of those who stand against you. A creature with immunity to fear instead has advantage on saves against your empath abilities. A creature who has advantage against being frightened does not benefit from that feature.',
  'In addition, you gain the following mood manipulations: Fear of Missing Out and Intrusive Thoughts.']],
 ['fomo','Fear of Missing Out',9,'terror',[
  'You must allow your allies to join in making the world know fear. You can spend your action to expend two link depth from the link of a linked ally to empower their next successful attack roll. On a successful attack, all creatures within 15 feet of the target must pass a wisdom save or become frightened. This effect ends if your link breaks.']],
 ['intrusive','Intrusive Thoughts',9,'terror',[
  'Summon forth forbidden thoughts for your enemies to act upon. You can spend your action to expend three link depth from the link of a linked foe to force them spend their next bonus action to make a weapon attack at advantage against a target of your choice at any point during their turn. If this attack hits, the attacked creature becomes frightened of your linked target until they leave your aura. This attack does not suffer from disadvantage due to being frightened.']],
 ['challenge','Challenge Heart',13,'terror',[
  'Starting at 13th level, frightened creatures cannot willing leave your aura. Additionally, you gain the following mood manipulations: Fear of Failure and Jump Scare.']],
 ['failure','Fear of Failure',13,'terror',[
  'Summon forth the strength born of the desperation to succeed. When a linked ally makes a successful attack against an enemy, you can spend your reaction and expend six link depth from their link to force them to reroll that attack without advantage or disadvantage. On a successful hit, the original attack is instead a critical hit and deals an additional 40 psychic damage.']],
 ['jump','Jump Scare',13,'terror',[
  'A sudden jet of emotion causes your allies to suddenly act. If it is a linked foe\'s turn and they are frightened, you can spend a reaction and expend three link depth to allow an ally to immediately act as if it was their turn. During this extra turn, the selected ally has advantage on attack and damage rolls against the creature whose turn they interrupted and cannot willingly leave your aura. The linked creature resumes their turn after this extra turn concludes, and the selected ally skips their next turn.']],
 ['crisis','Crisis of Life',17,'terror',[
  'Upon reaching 17th level, you gain the following mood manipulations: Fear of Death and Fear\'s End.']],
 ['death','Fear of Death',17,'terror',[
  'Your fears manifest physically, forcing your foes to relive their pain. You can spend eight link depth from the link of an allied creature as an action to cause all damage they do until the start of your next turn to be doubled. Additionally, you may move any amount of link depth from hostile links to this link and take another action.']],
 ['end','Fear’s End',17,'terror',[
  'A terror so deep that it grows into hopelessness. You can spend an action to expend six link depth from the link of a linked foe to force them to make a Wisdom saving throw. On a failed save, they must spend their action making a weapon attack against themselves at advantage using their most powerful attack. This attack does not suffer from disadvantage due to being frightened. On a successful hit, the attack does critical damage and the target takes 100 psychic damage. On a successful saving throw, the target takes 50 psychic damage.']],
 // Icon of the Crowds
 ['empowered','Empowered Aura',3,'crowds',[
  'The Icon of the Crowds is born of breathtaking public spectacles. Inspire your allies and sap your enemies with auras of empathic power.',
  'At 3rd level, you can use your aura to empower allies or weaken enemies within it by exploiting the link to your target. You can activate one empowered aura per active link. All auras require an action to activate, and they end if the link which paid for their cost breaks.',
  {name:'Sustain:',text:'Some auras require you to sustain them, or they end. You pay the sustain cost at the beginning of your turn. If you sustain an aura, you cannot use an action other than an empath class ability.'},
  {name:'Check:',text:'Some auras can only be activated if you have a certain condition met.'},
  {name:'Energize:',text:'Energize effects give additional benefits if you expend additional link depth. You may do so at any time as a free action. If you choose to do so, they gain an additional effect as described in each empowered aura.'},
  'You begin with the following empowered auras: Valor and Trepidation.']],
 ['valor','Valor',3,'crowds',[
  'Expend two link depth on an ally. Whenever an ally makes an ability check, the target can roll a d4 and add the number rolled to the ability check. This lasts for one minute, or until your link breaks.',
  {name:'Sustain:',text:'one link depth.'},
  {name:'Energize:',text:'Expend one link depth. Until Valor ends, also add the d4 to attack rolls and saves.'}]],
 ['trepidation','Trepidation',3,'crowds',[
  'Expend one link depth on an enemy. All enemies suffer the following effect: When a hostile creature in the aura makes an attack roll or a saving throw, the target must roll a d4 and subtract the number rolled to the attack roll or saving throw. This lasts for one minute, or until your link breaks.',
  {name:'Energize:',text:'Expend one link depth. Until Trepidation ends, roll the d4 at advantage.'}]],
 ['manifest','Manifest Aura',9,'crowds',[
  'Beginning at 9th level, you gain access to two new auras: Turbulence and Violence.']],
 ['turbulence','Turbulence',9,'crowds',[
  'Expend two link depth on an allied link. All allies within your aura gain the following ability:',
  'When an enemy that is farther than 15 feet away from you makes a ranged weapon attack against you, you may expend your reaction to force that enemy to make a Wisdom saving throw. On a failed save, that attack and all future ranged weapon attacks made by that creature against you automatically miss until the start of its next turn. This lasts for one minute, or until your link breaks.',
  {name:'Sustain:',text:'two link depth.'},
  {name:'Energize:',text:'Expend one link depth. Until turbulence ends, even creatures within 15 feet of you are affected by this aura.'}]],
 ['violence','Violence',9,'crowds',[
  'Expend two link depth on an enemy link. Each hostile creature who starts or willingly moves into the range of your aura makes a Wisdom saving throw. They take 3d8 psychic damage on a failed save. This lasts for one minute, or until your link breaks.',
  {name:'Energize:',text:'Spend two link depth to increase the damage dealt to hostile creatures by 1d8. This can be used any number of times until Violence ends.'}]],
 ['materialize','Materialize Aura',13,'crowds',[
  'At 13th level, you gain access to two new auras: Excitement and Fatigue.']],
 ['excitement','Excitement',13,'crowds',[
  {name:'Check',text:'six link depth on an ally. You gain an additional action on each of your turns. That action can be used only to take the Dash, Disengage, Hide, or Utilize action. This lasts for one minute, or until your link breaks.'},
  {name:'Sustain:',text:'Two link depth.'},
  {name:'Energize:',text:'Expend two link depth. Allies can choose an additional action they did not already choose until excitement ends.'}]],
 ['fatigue','Fatigue',13,'crowds',[
  {name:'Check',text:'four link depth on an enemy. Enemies consider your aura to be difficult terrain. This lasts for one minute, or until your link breaks.'},
  {name:'Energize:',text:'You may spend two additional link depth when initiating this aura to cause the difficult terrain to only allow enemies to 1 foot for every 3 feet they would move until Fatigue ends.'}]],
 ['incarnate','Incarnate Aura',17,'crowds',[
  'At 17th level, you gain access to two new auras: Vigilance and Trouble.']],
 ['vigilance','Vigilance',17,'crowds',[
  {name:'Check',text:'eight link depth on allies. Allies within vigilance have advantage on saving throws against spells and other magical effects. This lasts for one minute, or until your link breaks.'},
  {name:'Sustain:',text:'three link depth.'},
  {name:'Energize:',text:'Expend two link depth. Until Vigilance ends, spells have no effect on a successful save.'}]],
 ['trouble','Trouble',17,'crowds',[
  {name:'Check',text:'eight link depth on enemies. Hostile creatures that enter the aura cannot leave its area. This lasts for one minute, or until your link breaks.'},
  {name:'Sustain:',text:'two link depth.'},
  {name:'Energize:',text:'Expend two link depth. Until Trouble ends, hostile creatures also cannot enter your aura.'}]],
];
export const ASI_TEXT='Upon reaching 4th level and again at 8th, 12th, 16th, and 19th level, you can increase one ability score of your choice by 2, or two ability scores of your choice by 1. You can\'t increase your ability score above 20 using this feature.';
// Plain-text rendering for tooltips, dialogs and chat cards.
export function plainText(blocks){return blocks.map(b=>typeof b==='string'?b:b.list?b.list.map(i=>`• ${i}`).join(' '):b.table?'':b.note?`(Module note: ${b.note})`:`${b.name} ${b.text}`).filter(Boolean).join(' ');}
const escHtml=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
// HTML rendering for Foundry item descriptions.
export function toHtml(blocks){return blocks.map(b=>typeof b==='string'?`<p>${escHtml(b)}</p>`:b.list?`<ul>${b.list.map(i=>`<li>${escHtml(i)}</li>`).join('')}</ul>`:b.table?`<table><thead><tr>${b.table.cols.map(c=>`<th>${escHtml(c)}</th>`).join('')}</tr></thead><tbody>${b.table.rows.map(r=>`<tr>${r.map(c=>`<td>${escHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`:b.note?`<p><em>Module note: ${escHtml(b.note)}</em></p>`:`<p><strong>${escHtml(b.name)}</strong> ${escHtml(b.text)}</p>`).join('');}
// 5etools entries rendering for the Plutonium homebrew file.
export function toEntries(blocks){return blocks.map(b=>typeof b==='string'?b:b.list?{type:'list',items:b.list}:b.table?{type:'table',caption:'Icon of Sorcery Spellcasting',colLabels:b.table.cols,rows:b.table.rows}:b.note?`{@i Module note: ${b.note}}`:{type:'entries',name:b.name.replace(/[.:=]$/,'').trim(),entries:[b.text.replace(/^=\s*/,'')]});}
export const FEATURES=RAW.map(([key,name,level,icon,blocks])=>({key,name,level,icon,blocks,text:plainText(blocks)}));
export const SPELL_LIST=[
 ['Blade Ward','Chill Touch','Fire Bolt','Friends','Guidance','Message','Ray of Frost','Shocking Grasp','Starry Wisp','Thorn Whip'],
 ['Animal Friendship','Armor of Agathys','Bane','Bless','Charm Person','Chromatic Orb','Command','Compelled Duel','Comprehend Languages','Disguise Self','Dissonant Whispers','Divine Favor','Ensnaring Strike','Expeditious Retreat','Faerie Fire','False Life','Guiding Bolt','Heroism','Hideous Laughter','Inflict Wounds','Jump','Longstrider','Mage Armor','Magic Missile','Protection from Evil and Good','Ray of Sickness','Sanctuary','Shield','Shield of Faith','Sleep','Speak with Animals','Wardaway'],
 ['Alter Self','Barkskin','Beast Sense','Blindness/Deafness','Blur','Calm Emotions','Crown of Madness','Darkvision',"Elminster’s Elusion",'Enlarge/Reduce','Enthrall','Lesser Restoration','Levitate','Mirror Image','Pass Without Trace','Protection from Poison','Ray of Enfeeblement',"Nystul’s Magic Aura",'Scorching Ray','See Invisibility','Shatter','Spider Climb','Suggestion','Warding Bond'],
 ['Astral Flood','Beacon of Hope','Bestow Curse','Blink',"Crusader’s Mantle",'Dispel Magic','Fear','Feign Death','Fireball','Gaseous Form','Haste',"Laeral’s Silver Lance",'Life Transference','Lightning Bolt','Meld into Stone','Nondetection','Protection from Energy','Remove Curse','Slow','Tongues','Vampiric Touch','Water Breathing','Water Walk','Wind Wall'],
 ['Aura of Life','Aura of Purity','Banishment','Blight','Compulsion','Confusion','Death Ward','Elemental Bane','Fire Shield','Fount of Moonlight','Freedom of Movement','Guardian of Nature','Greater Invisibility','Phantasmal Killer','Polymorph','Stoneskin'],
 ['Antilife Shell','Awaken','Circle of Power','Cone of Cold','Contagion','Destructive Wave','Dispel Evil and Good','Dominate Person','Dream','Geas','Greater Restoration','Hold Monster',"Jallarzi’s Storm of Radiance",'Modify Memory','Negative Energy Flood','Seeming','Swift Quiver','Telepathic Bond',"Yolande’s Regal Presence"]
];
export const PASSIVE=new Set(['aura','mood','depth','icon','influence','linger','extra','improved','world','sorcery','focus','fuel','max','fearmonger','widespread','challenge','crisis','empowered','manifest','materialize','incarnate']);

// Resolve an item to an Empath feature key: module flag, then `empath-<key>` identifier (module packs and the
// Plutonium homebrew both set it), then a distinctive feature name. Generic names (Aura, Link, Spellcasting)
// are only matched by flag/identifier so other classes' features are never captured.
const BY_NAME=new Map(FEATURES.filter(f=>!['aura','link','sorcery'].includes(f.key)).map(f=>[f.name.toLowerCase().replace(/[’']/g,"'"),f.key]));
const KEYS=new Set(FEATURES.map(f=>f.key));
export function featureKey(item){
 if(!item||item.type!=='feat')return null;
 const flag=item.flags?.['empath-class']?.key;if(flag&&KEYS.has(flag))return flag;
 const id=String(item.system?.identifier??'');if(id.startsWith('empath-')&&KEYS.has(id.slice(7)))return id.slice(7);
 return BY_NAME.get(String(item.name??'').toLowerCase().replace(/[’']/g,"'"))??null;
}
