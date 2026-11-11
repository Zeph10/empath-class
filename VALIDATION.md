# Release validation — 1.0.0

Target: Foundry VTT 14.367; D&D5e 6.0.5. Validation performed 2026-09-30.

## Completed

- Inspected the official D&D5e source identifying itself as 6.0.5, including class/subclass/feature data models, advancement examples, activity-use and consumption configuration, native roll-hook signatures, native save/skill methods, damage calculation/application hooks, template-origin metadata, and rest completion hooks.
- Checked Foundry v14 DialogV2 documentation and used ApplicationV2 / HandlebarsApplicationMixin for the manager.
- Built native LevelDB compendiums with `@foundryvtt/foundryvtt-cli` 3.0.4, then extracted each pack and verified document counts: **48 features, 4 class/subclass Items, 1 Macro**.
- Verified all ItemGrant references resolve to included feature IDs, every feature is granted through class or subclass advancement, stable IDs are valid, and ASI levels / d6 hit die / no-slot spellcasting are represented correctly.
- JavaScript syntax checks for every shipped `.mjs` file.
- **15 passing Node tests**, covering every level’s aura/depth/link breakpoints, Sorcery progression, reserved hostile slots, mixed-link payments and Body Fuel, spell aliases, grant completeness, link-specific cleanup, token-edge/elevation distance, numeric eligibility, critical-suppression precedence, source-aware damage doubling/immunity, casting cancellation, successful casting, custom concentration, and native-use routing/non-slot resource preservation.
- Archive inspection: correct `empath-class/module.json` nesting, every manifest script/style/pack path present, and LevelDB CURRENT files present for each compendium.

## Not completed here

No licensed live Foundry server/world was available. Actual Foundry document instantiation, UI rendering, native advancement dialogs, multiplayer transport, and interactions with other modules are **not certified by the Node mocks or compendium roundtrip**. The included SMOKE-TEST.md is the live acceptance checklist. “Targeted for 14.367 / 6.0.5” is the compatibility intention, not a claim that live tests passed.

The build is a usable module package with real native packs and complete source. Some mechanics deliberately require guided GM resolution; see AUTOMATION.md for the exact boundary.
