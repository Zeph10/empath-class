# Automation and rules interpretations

## New in 1.5.0: decisions the module makes (interpretations)

1. **"Most powerful attack" / forced weapon attacks:** the attack activity with the highest average damage (dice midpoint plus modifiers). For Intrusive Thoughts and Fear of Failure any weapon attack qualifies, and the same choice is used.
2. **Hit determination:** a natural 20 hits, a natural 1 misses, otherwise total ≥ AC. Exceptional defences (Shield, Uncanny Dodge and the like) are not inferred.
3. **Willing creatures:** an allied creature with no active player always fails depth saves on purpose. A hostile creature never does.
4. **Fear of Missing Out:** "all creatures within 15 feet" excludes creatures with the Empath token's disposition (its own side).
5. **Violence "willingly moves into":** entering during its own turn is willing. Movement on another creature's turn is treated as forced.
6. **Terrorize:** NPC behaviour comes from the "Terrorize: NPC choice" setting. Players are asked.
7. **Total cover:** walls that block sight between token centres, on the scene the GM is viewing. Elsewhere, cover is not checked.
8. **Jump Scare damage advantage:** stated on the card (roll twice, keep the higher). The extra turn itself is played at the table; the skipped turn is automatic.

## New in 1.4.0: who decides, and enforced rules

See CHANGELOG 1.4.0 and the module settings. Still adjudicated by the GM:
- walls and difficult terrain on a Follow move;
- whether movement was forced;
- Excitement's extra action;
- Jump Scare's interrupted-turn order;
- narrative features (Imprint Affect, Heart to Heart);
- Trauma Dump's curse / ability-score / max-HP options.

## New in 1.3.0: event-driven automation

| Feature | What happens now |
|---|---|
| Apathy | The marked creature's next damage instance is reduced automatically when applied through dnd5e's damage card (the preview numbers show it too). Stacked Apathy adds up. If one instance hits several targets, each is reduced. Apathy then ends, and so does its crit suppression. |
| Fear of Missing Out | When the linked ally's attack hits (detected from its roll against the targeted creature), the GM gets a list of creatures within 15 ft of the target, all pre-ticked, and their saves are rolled. A failure frightens the creature. If the hit can't be determined (no single target), the GM is asked. |
| Terrorize | At the frightened creature's turn start, the GM is asked whether it ends its turn. Yes removes the fear and advances combat; No means it saves at turn end, as before. |
| Intrusive Thoughts | At the creature's turn start, the GM picks the target. Its weapon attack is rolled with advantage, and a hit frightens the victim. Choosing "Later" keeps it pending. |
| Fear of Failure, Meeting of Minds | When a linked ally hits, an eligible Empath gets a whispered chat card with a one-click "Use …" button. It is only offered when there's enough depth or uses and mood manipulations aren't blocked. |
| Jump Scare | When a frightened hostile linked creature starts its turn, an eligible Empath gets a one-click card. |
| Turbulence | When a hostile creature makes a ranged weapon attack against a protected ally (from beyond 15 ft unless energized), a one-click card rolls the attacker's save. On a failure, that attacker's later ranged weapon attacks against that ally are flagged as automatic misses until its next turn starts. |

Detection uses the attacker's selected targets, so **target the creature before attacking**. "Manual Resolve" in the manager remains as the fallback.


This module contains every mechanical class feature and every Icon feature on the linked Empath page. It implements a combination of automatic state management, supported native roll modifiers, and GM-guided resolution. “Included” does not mean all clauses are unattended automation.

## Automated state and native rolls

| Area | Behavior |
|---|---|
| Class advancement | Native d6 hit dice/HP, Wisdom and Charisma saves, Disguise Kit, two selected skills, ASIs at 4/8/12/16/19, subclass at 3, features at their levels. No armor/weapon proficiencies or spell slots. |
| Links | Per-link depth, capacity/gain/maximum links based on Empath level and Charisma; one reserved hostile slot after level 5; range and encoded eligibility checks; Lingering Link prompt and turn-end cleanup. |
| Depth | GM save/voluntary-failure prompt at linked turn end; minimum-worthy-foe CR check, optional GM override; manual out-of-combat charging. |
| Fervor | Next weapon-attack advantage, expanded critical range, first rolled weapon-damage bonus, expiry at source’s next turn start. Natural/NPC weapon attack activities are recognized. |
| Inspirational Mantle | Flat attack modifier and critical expansion, paid duration, link-break cleanup. |
| Apathy | Wisdom save, rolled reduction, stacked markers, critical suppression. The GM applies the combined reduction once to the next damage instance through Resolve Hit / Damage. |
| Fear of Disappointment | Attack advantage and added psychic damage on native attack damage rolls. A target in a caster’s link list gives the larger bonus. Conditional target recognition uses the rolling user’s selected targets; select exactly the victim or resolve manually. |
| Terrorize | Frightened marker; turn-start choice / turn-end save; forfeited-turn cleanup. Native Apply Damage sourced from a recognizable item message prevents damage from this creature to the Empath. External/manual HP edits and source-less damage require GM application of the immunity. |
| Fear of Death | Depth payment and bounded hostile-depth transfer. Native Apply Damage doubles positive damage with an identifiable source item before recipient resistances are calculated. Healing/temp HP are not doubled. Source-less/manual damage must be doubled manually. Do not double the native roll too. |
| Crowds auras | Activation/check/cost, one per link, energize, one-minute expiry, turn-start sustain, recipients based on token dispositions, link-break cleanup. |
| Valor / Trepidation | Native skill/check modifiers and, where applicable, attack/save modifiers. Energized Trepidation uses the greater of two d4 penalty rolls. |
| Vigilance | Native saves originating from a recognizable spell or magic-item save card gain advantage. Other magical effects require manual advantage. Energized successful-save negation is GM resolved. |
| Violence | Turn-start save and damage prompt. Movement prompts ask whether this was a voluntary entry from outside; declining prevents the trigger. This avoids treating every movement inside the aura as a new entry. |
| Sorcery | Allowed spell-name matching from Spells 2024, known-spell limits, table progression, link payment from multiple pools, hostile multiplier, Body Fuel cost and unavoidable psychic roll, Aura Max use tracking. Native spell activities, damage, saves and material/resource metadata are retained. |
| Link-held spells | Custom concentration per link, separate per-cast spell items, no ordinary concentration effect/checks, held-spell expiry and cleanup. Effects/templates whose origin resolves to the cast item are tracked and removed when that cast ends. |
| Limited uses | Cloud Mind/Meeting of Minds short-rest uses; Aura Max long-rest use. |
| Cloud Mind | Observer markers, Wisdom saves, timer, ability/spell/attack activation cleanup, and source-turn-end range check. No global token invisibility. |
| Trauma Dump | Stationary-contact confirmation; clear chosen charmed/petrified effects or decrement exhaustion. Curse, reduced ability scores, and reduced maximum HP use GM resolution. |

Supported roll modifiers can be disabled in settings. This also disables source-aware Terrorize/Fear of Death damage modifications, so the table can avoid duplicate automation with other modules. No Midi-QOL APIs are called. Compatibility with arbitrary other modules’ roll/damage rewriting has not been certified.

## Guided or manually adjudicated

- **Thought probing:** native contested Insight/Deception rolls and defender-long-rest immunity tracking; the GM supplies only the relevant thoughts. No NPC biography/stat disclosure is automated.
- **The Right Place at the Right Time:** reaction/movement rules are in the activity card. The GM/player moves the token, measures the distance, handles grapples/obstacles, and tracks its unusual reaction reset.
- **Imprint Affect and Heart to Heart:** descriptive/private GM prompts, without inventing emotional states or conversations.
- **Cloud Mind:** observer-specific hiding, noticeable interaction, mundane environmental actions, attacks made directly through roll buttons, and magic-item uses performed outside activity activation need GM review. The module cannot reliably make a token visible to some observers and hidden to others with core Foundry visibility.
- **Fear of Missing Out:** resolve the linked creature’s next hit through the manager, select every creature in the 15-foot burst, and request saves. The GM selects the burst recipients; no automatic hit inference or burst-center guessing.
- **Intrusive Thoughts:** pending turn reminder; Resolve Hit / Damage guides a chosen native weapon attack with advantage, suppressing frightened disadvantage. A confirmed hit applies the frightened marker to its victim; range exit removes it. The bonus action and commanded target are confirmed by the GM.
- **Fear of Failure:** confirm the original linked ally hit, choose the same weapon activity, reroll normally, and confirm a second hit. Native critical damage and the additional 40 psychic damage can be resolved through prompts. Undo any already-applied original damage before replacing it. If the hit creature was not targeted, a manual instruction card is provided.
- **Jump Scare:** validates a frightened hostile link and pays depth. Interrupted/extra/skipped turns, advantage on damage rolls, targeting restrictions and return to the interrupted turn are GM managed; combat order is not rewritten.
- **Fear’s End:** native Wisdom save; success rolls/applies 50 psychic. On failure the GM chooses the strongest native weapon attack; the module rolls it against self with advantage, confirms a hit, and offers critical weapon damage plus 100 psychic. Do not add the 100 after a miss or apply damage again from the chat card.
- **Meeting of Minds:** confirm the linked ally’s weapon hit and target the victim. Transfer link and depth, spend use, and lock mood manipulations until the end of the Empath’s next turn. Effects attached to the old participant and held spells end as a documented interpretation.
- **Turbulence:** reaction eligibility, 15-foot distance, attacker save, selective automatic misses and expiration are described in the activity. Resolve them manually; the module does not intercept every ranged attack on every client.
- **Excitement:** additional actions and the ambiguous energized-allies clause are described/reminded. The GM tracks their scope and action choices.
- **Fatigue/Challenge Heart/Trouble:** ruler costs, forced-versus-voluntary movement and boundary prohibitions need GM enforcement. Reminders appear on movement; tokens are not trapped by a generic collision wall.
- **Vigilance energized:** a successful spell save negates effects; the GM adjusts native damage and riders. The module cannot generally undo every effect produced by other modules.
- **Spells:** originating from a linked participant, replacing Self range, changing recipient counts, willingness, spell components/casting time, summons, and spell-specific riders need GM confirmation. Native templates are positioned by the GM at the selected origin. Material inventory/consumption on cloned spell items must be checked against actual inventory; copies do not create free components.
- **Action economy:** activities identify action/bonus action/reaction costs, but guided interception bypasses the native activity consumption stage. The GM tracks whether the appropriate action is available. Additional actions, special reaction resets and multi-turn interruptions are not silently inferred.
- **Range/cover:** nearest-token-edge Euclidean distance plus elevation is used. Foundry grids with non-Euclidean diagonals, facing/walls, total cover, natural armor implemented as a custom formula, scene units other than feet, and unusual alliances need GM overrides. Links remain bound to their original token UUIDs; moving to a different scene requires relinking or a GM correction.
- **Durations:** round-bound effects use source turn boundaries; long durations and aura durations use Foundry world time. Advance world time outside combat, or clear effects manually. No real-time wall-clock timers.
- **Rest/recovery:** depth is not automatically erased on rest (not specified by the class). Probe-defense immunity lasts until the defender’s long rest. Conditional fear-save advantage remains until the GM changes it; it is not a rest resource.

## Agreed/default interpretations

1. Follow progression **tables** when they conflict with prose. Sorcery cantrips: 2 at 3, 3 at 8, 4 at 20. Spells known: 2 at 3, +1 at every odd level from 5 through 19. Max spell levels: 1/2/3/4/5 at Empath 3/5/9/13/17.
2. Standard native first-level HP: **6 + Constitution modifier**. The source’s “d6” first-level notation is treated as ambiguous rather than introducing random first-level HP.
3. Multiclassing is mechanically supported. The page supplies no prerequisites or secondary-class proficiencies: the GM decides them, and the module grants no extra primary-class saves/skills/tools on a secondary class.
4. Allied depth can be built before combat, as described in the author notes. The literal “worthy foe” restriction conflicts with that intended allied use, so allied charging is allowed after GM confirmation. Hostile CR must be **strictly greater** than the linked Worthy Foe table’s threshold: 0 / 1/2 / 1 / 2 / 3 / 4 / 5 at levels 1–4 / 5–7 / 8–10 / 11–13 / 14–16 / 17–19 / 20. The GM may override.
5. The reserved-hostile-slot rule is retained at level 20. Share Your World increases maximum links to proficiency bonus without removing prior restrictions.
6. Improved Empathy doubles `max(1, Charisma modifier)` for capacity, including the minimum: a negative/zero Charisma modifier gives capacity 2 from level 11.
7. Inspirational Mantle durations expire at the Empath’s turn start after the chosen number of rounds. Stacking, overlapping applications, and differing turn-order interpretations need GM correction if your table rules differently.
8. Fear of Disappointment’s “quadrupled instead” is interpreted as quadrupling its +2-per-extra-depth damage to **+8 per extra depth** against another linked creature.
9. Body Fuel halves total spell energy before hostile-depth weighting. Removed energy equals spell level, so unavoidable damage is spell-level d6. An odd remaining cost may be overpaid by one using an indivisible hostile depth.
10. Each link can hold one concentration spell, plus eligible non-concentration ongoing spells. Replacing concentration ends the previous concentration spell only. Damage does not end custom link concentration. No extra incapacitation/death link-break rule is invented; the GM can break links when the table rules appropriate.
11. One empowered aura per active link. “Check” verifies capacity at activation without spending it. “Sustain” consumes at source turn start. “Energize” is once except Violence’s explicitly repeatable energize; Fatigue energizes only on activation. Difficult-terrain arithmetic is 2 feet per foot, or 3 when energized.
12. Mechanical descriptions are condensed adaptations; original flavor text is linked, not recreated. Starting equipment is recorded in the class description and chosen manually. Source spell names are matched to the user’s own compendium; missing spells are shown rather than fabricated or replaced silently.

## Storage and permission model

State is stored in actor flags under `empath-class.state`, with links and spell instances keyed by UUID/ID. Effects and cast-item copies have module flags for selective cleanup. Only the designated active GM performs guided actor/effect writes across the world. Player requests require ownership of the Empath and a GM confirmation; GM-only edit/override controls are excluded from ordinary player requests. Take a world backup before first installation.
