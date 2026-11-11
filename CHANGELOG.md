# Changelog

## 1.6.1 — enable fix
- Fixed: the module still could not be enabled on dnd5e 6.0.6. Foundry compares versions part by part, so the system maximum "6" was read as lower than 6.0.6. The dnd5e maximum is now removed (minimum 6.0.5, verified 6.0.6); the in-game warning still flags a different major version.

## 1.6.0 — player-facing by default
Defaults changed (both are settings, so either can be switched back):
- **Who answers Empath prompts** now defaults to "Player decides (no GM step)". The GM approval for effects on NPCs is opt-in.
- **Module damage applies immediately.** The chat card shows the HP change and has an **Undo** button for the Empath's player and the GM.

Player-facing
- **Sorcery spells are used on the player's own screen**: they place their own templates and get the spell's chat card. Previously this ran on the GM's client.
- **Spell payment is automatic** (casting link first, then the others; hostile depth counts double), with a fold-out to choose it by hand. The "required participant" checkbox and the Focused Bond / Aura Max confirmations are gone.
- **Form Link with nothing targeted** offers a list of the creatures in the aura that can be linked. Ally or hostile comes from token disposition.
- **Manager redesign:** each link has its own buttons for the actions that apply to it, so there is no "choose link" dialog. Also shown: depth pips, distance and out-of-aura warning, uses left, the current target, and a separate Reactions section.
- With a single matching link, the link chooser is skipped everywhere.
- **Sustaining an aura** offers "Always sustain".
- Refusals and errors are shown to the Empath's player, not only the GM. GM-only whispers that the player needs (depth refusals, Trauma Dump, held spell ended) now go to the player too.
- Chat-card buttons are hidden from people who can't use them and disable after a click.

Fixes
- Players could tick "GM override" in Form Link and Meeting of Minds, and could click "Move anyway" on their own blocked move. Overrides are now GM-only.
- Cloud Mind made the Empath save against its own effect and used the GM's current scene. It now uses the Empath's scene, skips the Empath, and skips allies unless asked.
- A player who disconnects with a dialog open no longer stalls automation for the full timeout.
- A warning appears for Empath players when no GM is connected (the GM's client applies effects to other creatures).
- Tests: 49 passing.

## 1.5.1 — dnd5e 6.0.6 compatibility
- Fixed: the module was disabled on dnd5e 6.0.6. The manifest now accepts any dnd5e 6.x (verified on 6.0.6, minimum 6.0.5) and Foundry 14 (verified 14.369). The 6.0.5 → 6.0.6 changes (falling damage, exhaustion migration, internal refactors) do not touch anything this module hooks.
- The version warning now fires only on a different dnd5e major version.
- Fixed: "The Right Place at the Right Time" read walking speed from the pre-6.x location and always assumed 30 ft. It now reads `movement.speeds.walk`.
- Added a GitHub release workflow so the module can be installed and updated through a manifest URL (see README).

## 1.5.0 — fewer GM decisions
The module now makes these calls itself (interpretations are listed in AUTOMATION.md):
- **Forced attacks** (Fear's End, Intrusive Thoughts, Fear of Failure): the attacker's strongest weapon attack is chosen by average damage. Hit or miss is decided by the roll (natural 20 / natural 1 / total vs AC) and posted to chat.
- **Building depth:**
  - Willing allies fail on purpose automatically; allied NPCs always do.
  - A player-controlled ally is asked, with "Always fail on purpose (stop asking)".
  - Hostile creatures roll automatically and never fail on purpose.
  - Worthiness uses the CR rule. The GM can still override a link in GM Controls.
- **Sanctuary** is removed from the Empath automatically when hostile depth is built.
- **Fear of Missing Out:** every creature within 15 ft of the target saves, except the Empath's own side. No tick-list.
- **Violence:** entering on its own turn counts as willing; other entries are treated as involuntary. No dialog.
- **Terrorize:** a new setting, "Terrorize: NPC choice" (default: act normally and save at turn end). Player characters are still asked.
- **Pain Resonance:** touch range is measured (5 ft, level 5+), and the depth prompt defaults to all available depth.
- **Total cover:** walls blocking sight between tokens are detected. They prevent forming a link (override needs GM approval) and exclude creatures from aura effects.
- **Jump Scare:**
  - The Empath's player picks the ally.
  - That ally gets advantage on attacks against the foe and can't leave the aura during the extra turn.
  - Its next regular turn is skipped automatically.
- **Fear of Failure from a reaction card:** the already-detected hit is not re-confirmed.
- **Meeting of Minds:** hostility is pre-set from token disposition.
- **Fewer reminder messages:** with movement enforcement on, Challenge Heart, Trouble and Fatigue no longer post them.
- Tests: 42 passing.

## 1.4.0 — player-side prompts and rule enforcement
New world settings (Configure Settings → Empath); defaults match the table's preferences:
- **Who answers Empath prompts — "Player decides, GM approves NPC effects".**
  - The Empath's player gets their own choices on their own screen: links, spending, spell casting, energize, sustain, Lingering Link, and Intrusive Thoughts targets.
  - A player-controlled linked creature chooses for itself whether to fail its depth save on purpose.
  - The GM gets one approval prompt when a player's action affects a creature no player owns.
  - Unanswered player prompts fall back to the GM after a timeout (default 90 s).
  - The other options are "Player decides" (no approvals) and "GM only" (the previous behaviour).
- **Auto-roll module saves for NPCs (on):** NPC saves and the module's forced attacks are fast-forwarded. Players roll their own saves and Probe Thoughts checks with the dnd5e dialog on their own screen.
- **Confirm before applying module damage (on).**
- **Enforce aura movement limits (on):**
  - Moves that break Trouble (leaving, or entering when energized) or Challenge Heart (a frightened creature leaving) are blocked, with "Move anyway" for forced movement or a GM ruling.
  - Fatigue reports the real movement cost of moving inside the aura.
- **Offer "The Right Place at the Right Time" (on):** when a linked creature moves in combat, the Empath gets a one-click Follow. It moves the Empath the same way, capped at its walking speed, once per that creature's turn.
- **Cloud Mind hides the Empath from affected players (on):** a player whose character failed the save no longer sees the Empath's token. The GM always does.

Also:
- Energized Vigilance announces when a successful save against a spell means the spell has no effect.
- Tests: 39 passing.

## 1.3.1 — link depth feedback
- Link depth never silently fails to build. Every refusal now says why:
  - the link is at capacity (Charisma modifier, minimum 1; ×2 from level 11);
  - not a worthy foe (CR vs the threshold for your level), or the box was unticked;
  - the creature passed its save;
  - Empath level below 2;
  - the aura is disabled by the GM;
  - armor is equipped (the item is named) or the AC is calculated as natural armor.
- Manual requests also post the reason to the GM. Automatic turn-end checks stay quiet for "at capacity" and "below level 2".
- The manager marks full links with "(full)", explains capacity on the Build Depth button's tooltip, and shows a banner when armor blocks the aura.
- Tests: 32 passing, including depth rebuilding after being spent to 0 on allied and hostile links.

## 1.3.0 — event-driven automation
- Apathy reduction is applied automatically to the creature's next damage instance. It also shows in damage previews and is used up only when damage is actually applied.
- Fear of Missing Out bursts automatically on the ally's next hit.
- Terrorize asks about forfeiting the turn at the frightened creature's turn start, and advances combat if it does.
- Intrusive Thoughts' forced attack is prompted at the creature's turn start.
- One-click reaction cards for Fear of Failure, Meeting of Minds, Jump Scare and Turbulence (with automatic misses afterwards).
- The module's own rerolls never re-trigger reaction offers.
- "Resolve Hit / Damage" is renamed "Manual Resolve" and kept as a fallback.
- Tests: 30 passing.

## 1.2.0 — Foundry 14 fixes and source wording
- **Fixed:** "Empath: game.user.updateTokenTargets is not a function". Foundry 14 removed that API, and the error stopped every action requested by a player before it ran. Targeting now uses `canvas.tokens.setTargets` with fallbacks and can never block an action.
- **Fixed:** in dnd5e 6 on Foundry 14, spell areas are Regions, not MeasuredTemplates. Held-spell cleanup now finds and removes them (tagged at placement, or matched by the casting item), and no longer crashes if `scene.templates` is missing.
- Every feature description now uses the wording from the source page (dnd-wiki.org, Axis & Ghostwheel, CC BY-SA 3.0), including the Aura eligibility list, Sustain/Check/Energize labels and the Icon of Sorcery Spellcasting table. Wiki markup was removed and combined sections were split across the matching feature items. There is one module note, on Spellcasting: the source's cantrip prose and its table disagree, and the module follows the table.
- The Plutonium homebrew file uses the same wording, as 5etools lists, tables and inline headers.
- Packs are rebuilt with `tools/compile_packs.py` (pure Python, no npm). They were verified byte-identical through the module's reader, and separately opened and compacted with goleveldb in strict mode.
- Tests: 26 passing.

## 1.1.0 — Plutonium import
- Added `plutonium/empath-homebrew.json`: 5etools-format homebrew (class, 3 Icons, 48 features), schema-valid, with Foundry side data (identifiers, module flags, limited uses, activation types). Passive features import without activities.
- The module recognises imported items by flag, by `empath-<key>` identifier, or by distinctive feature name. Generic names (Aura, Link, Spellcasting) are never matched by name alone, so other classes' features are not captured. The class and Icons are also recognised by name.
- Using any recognised Empath feature from the sheet routes to the module, even if its activity has no module flag or was auto-generated.
- The manager warns about features missing from the actor and about a level 3+ Empath with no Icon.
- Tests: 24 passing.

## 1.0.1 — pre-playtest fixes

Bugs
- Turn-end processing (depth prompts, Lingering Link, Terrorize saves, Fervor/Mantle expiry) now reads `combat.previous`, so it works when a player clicks End Turn or a second GM advances combat. Previously it relied on `preUpdateCombat`, which fires only on the clicking client.
- Valor no longer adds its d4 twice to skill and tool checks. dnd5e 6.x fires `preRollAbilityCheck` for skill rolls as well as `preRollSkill`.
- "[Empath cast]" spell copies can no longer be recast from the character sheet for free. Only the module's Cast flow may activate them. Instant copies are cleared automatically at the Empath's next turn start in combat.
- Violence, Fatigue and Trouble respond only to real boundary crossings. Violence and Fatigue trigger on entry; Trouble now warns when an enemy leaves. They no longer fire on every step inside the aura.
- The GM "Disable aura" toggle and equipping armor now suspend Empath abilities without destroying existing links and depth.
- Inspirational Mantle (and other round-counted effects) in combat now end at the Empath's turn start, not at the round rollover.
- Challenge Heart only reminds about creatures this Empath frightened.
- Probe Thoughts no longer errors when a roll dialog is cancelled.
- Meeting of Minds out of combat no longer leaves mood manipulations blocked indefinitely. Leftover blocks clear when combat ends.
- Tokens without an actor no longer cause errors on movement.
- Pain / Mantle / Disappointment on a zero-depth link give a clear "not enough depth" message.
- Effect durations use the dnd5e 6 / Foundry 14 `{value, units}` shape.

UI
- The manager keeps its scroll position on refresh. It also shows an Active Effects list, and every action button now has a cost label; buttons are greyed out when no link has enough depth.
- The manager refreshes when effects are created or deleted.
- Distinct core icons per marker (Fervor, Apathy, Valor, Terrorize…) instead of one shared eye icon.
- Depth building is one dialog (Roll / Voluntarily fail / Skip) instead of three. GM Controls gain "Willing ally: auto voluntary-fail", which removes the per-turn dialog entirely for that link.
- Saves without a voluntary-fail option go straight to the native roll dialog, one dialog instead of two.
- Players get a notification when the GM declines, resolves, or errors on their request, or when a previous request is still pending.
- Spell selection over the limit re-opens with your checks preserved and shows the counts, instead of discarding everything.
- The sheet header button uses Foundry's header-control styling and sits before the close button.
- Fixed dialog CSS, the "an hostile" typo, and removed the unused "willing" checkbox. "Link-held spell ended" cards are GM-only and skipped for instant spells. The Fear of Death reminder posts once per application.

Tests: 19 passing (4 new covering the fixes above).
