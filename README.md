# Empath — Links & Icons 1.6.1

For Foundry VTT **14** (verified 14.369) and D&D5e **6.x** (verified 6.0.6, minimum 6.0.5). Includes the Empath class, all three Icons, 48 class/subclass features, level 1–20 advancement, and the Open Empath Manager macro. No additional modules are required. Midi-QOL, DAE, Times Up, and socketlib are not used.

## Install

1. Extract the ZIP. Copy the **empath-class** folder into your Foundry **User Data → Data → modules** directory. The manifest must be at `Data/modules/empath-class/module.json`, with no extra nesting.
2. Restart Foundry, open your world, and enable **Empath — Links & Icons** under Manage Modules.
3. Open **Empath — Class & Icons** and drag **Empath** onto the character sheet. Use the native advancement flow for hit points, primary-class proficiencies, ASIs, and the Icon selected at level 3. The three Icons grant their features at levels 3, 9, 13, and 17.
4. Open **Empath — Controls**, import **Open Empath Manager**, and drag the macro onto your hotbar. Select the Empath’s token and run the macro. A sheet-header link button is also provided where the native sheet hook supports it. The macro is the reliable fallback.
5. For Icon of Sorcery, choose **Manage Spells — Spells 2024**. The module looks for an Item compendium with exactly that title. If it has another title, put its collection ID in **Configure Settings → Empath → Spell compendium collection ID**. Find the ID in the pack’s configuration or with `game.packs.find(p => p.title === "Spells 2024")?.collection` in the Foundry console.
6. Run the included **SMOKE-TEST.md** in a test world before using the class in a session. Offline tests and actual LevelDB compendium compilation passed; this build has **not been tested on a live Foundry server**.

On Windows the default location is often `%LOCALAPPDATA%/FoundryVTT/Data/modules`; on macOS it is often `~/Library/Application Support/FoundryVTT/Data/modules`. Use Foundry’s configured User Data path if you moved it. For managed hosting, upload the same folder through the host’s module/file-management tools. This ZIP does not have a hosted manifest-install URL.

## Importing with Plutonium (alternative to step 3)

`plutonium/empath-homebrew.json` is a 5etools-format homebrew file. It validates against the official homebrew schema and contains the Empath class, all three Icons and all 48 features. In Plutonium's Class importer, load this file through the source picker's file-upload or custom-file option, then import Empath onto the character as you would any class. Pick the Icon at level 3.

- **Keep this module enabled.** The JSON provides the class and features; this module provides all the automation. The Plutonium side data sets each item's `empath-<key>` identifier and module flags. Cloud Mind and Meeting of Minds get 1/short-rest uses and Aura Max gets 1/long-rest.
- **Use one route per character.** Either drag Empath from the module compendium or import it with Plutonium, not both, or every feature will appear twice.
- If Plutonium drops some side data, the module still recognises imported items by identifier or distinctive feature name. The manager lists any features it cannot find on the actor.
- **Sorcery spells** still come from an Item compendium (Spells 2024 by default; see step 5). The homebrew file does not add a class spell list.
- Plutonium's own compatibility with Foundry 14 / D&D5e 6 is outside this module's control.
- Regenerate the file after editing features: `node tools/build-plutonium.mjs`.

## Install with a manifest URL (GitHub)

One-time setup:
1. Create a new repository on github.com (for example `empath-class`). It can be private only if your Foundry host can reach it; public is simplest.
2. Upload this folder's contents to the repository root, so that `module.json` is at the top level.
3. Make sure `.github/workflows/release.yml` is in the repository. Hidden folders are often skipped by drag-and-drop; if so, use **Add file → Create new file**, name it `.github/workflows/release.yml`, and paste the file's contents.

For each version:
1. On the repository page, click **Releases → Draft a new release**.
2. Create a tag matching the version, e.g. `v1.5.1`, and click **Publish release**.
3. The workflow (in the **Actions** tab) attaches `module.json` and `module.zip` to the release within a minute or two.

In Foundry: **Add-on Modules → Install Module**, paste `https://github.com/<your-name>/<repo>/releases/latest/download/module.json` into **Manifest URL**, and click Install. Later releases appear as updates in Foundry.


- **Form Link:** target one token, choose allied/hostile, and confirm total-cover eligibility. A new link starts at zero depth.
- **Build Depth:** request a save or voluntary failure. At level 2+, the module prompts at a linked creature’s turn end when enabled. Outside combat, use Build Depth manually, or let the GM set pre-combat depth through that link’s GM Controls.
- **Actions:** use the buttons in the manager or the corresponding feature activity on the character sheet. Choose an eligible link and any depth expenditure. Costs are checked before spending. Action/reaction economy and triggering events still require table confirmation.
- **GM Controls:** change depth, hostile status, numeric-eligibility overrides, worthy-foe eligibility, or conditional fear-save advantage. The GM may break a link to correct a state. Players cannot voluntarily break links through the manager; they may move outside the aura under the class rules.
- **Empowered auras:** activation, energize costs, sustain, and duration are tracked. Recipients come from token dispositions; friendly tokens share benefits, hostile tokens receive penalties, and neutral/unusual alliances need GM adjudication. One aura per paying link. Sustain prompts occur at the Empath’s turn start.
- **Resolve Hit / Damage:** resolve Apathy’s next damage instance, Fear of Missing Out’s next-hit burst, Intrusive Thoughts’ forced attack, or Terrorize’s forfeited-turn option.
- **Sorcery:** manage known spells, then use a spell’s Cast button or its original activity. Choose the holding link, spell level, payment allocations, and optional Body Fuel / Focused Bond / Aura Max. Hostile depth pays two energy per point. Body Fuel removes energy cost equal to the spell level and deals that many d6 of unavoidable psychic damage.
- **Held spells:** each casting gets an embedded spell copy so two links may hold different instances independently. Concentration is tracked on the link, and it never produces ordinary damage-triggered concentration saves. Breaking the link ends its held spells and tracked effects. Instant cast copies stay available for follow-up attack/damage/effect buttons; end them through the manager after resolution to clear the copies.
- **Rests:** Cloud Mind and Meeting of Minds recharge on short rests; Aura Max on long rests. Native class hit dice and HP rest behavior remain native. Thought-probe immunity is removed on the defending creature’s long rest.

## Multiplayer

At least one GM must be connected. Exactly one active GM, selected consistently by user ID, runs state changes and automated prompts. A player’s action request appears to that GM for confirmation and then guided resolution. Saves and damage-application confirmations appear **on the GM’s screen**, rather than opening separate asynchronous roll windows on every player’s screen. Player-owned rolls still receive the supported Empath modifiers locally.

When a player requests an action, their targeted tokens are temporarily selected for the GM’s native spell/attack workflow, then the GM’s selection is restored. Do not advance combat through several turns while earlier prompts remain unresolved. Undoing/revisiting an already processed turn does not repeat automatic resource gains; use GM Controls if correcting combat history.

## Files and development

- `packs/`: compiled native LevelDB compendiums (not JSON-only import placeholders).
- `pack-sources/`: readable source Item/Macro JSON.
- `scripts/`: complete module source, including the mechanical feature summaries and spell list.
- `AUTOMATION.md`: exact automated / guided behavior and interpretations.
- `SMOKE-TEST.md`: live-world acceptance checks.
- `VALIDATION.md`: actual checks run for this release.
- `tests/`: Node tests. Run `node --test tests/*.test.mjs` from this folder.
- `tools/build.mjs`: rebuild sources and packs. Install `@foundryvtt/foundryvtt-cli@3.0.4` in a separate build-tools folder or set `FOUNDRY_CLI_MODULE` to its absolute `index.mjs` path. Run `node tools/build.mjs`, then `python3 tools/compile_packs.py` to compile the LevelDB packs without npm.

## Attribution

Empath by **Axis**, co-authored by **Ghostwheel**: https://dnd-wiki.org/wiki/Empath_(5e_Class), retrieved 2026-09-30, page revision referenced by the source: **392056**.

Worthy Foe by **Ghostwheel**: https://dnd-wiki.org/wiki/Worthy_Foe_(5e_Descriptor), revision **388896**.

The wiki licenses its text under **CC BY-SA 3.0** unless specified otherwise: https://dnd-wiki.org/wiki/D%26D_Homebrew_Wiki%3ACopyrights. Feature summaries and other adapted class text in this package are licensed under CC BY-SA 3.0: https://creativecommons.org/licenses/by-sa/3.0/. Wording has been condensed and rewritten; interpretations and software implementation have been added. The original pages contain the complete flavor text and author commentary.

Module software is MIT licensed; see LICENSE. Foundry and D&D5e are required separately. Foundry-provided icon paths reference the user’s installed assets. The module distributes no official spell text: selected spells are copied locally from the user’s own Spells 2024 compendium.
