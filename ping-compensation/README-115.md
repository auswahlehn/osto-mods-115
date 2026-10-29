# Ping Compensation (Classic), 115.02 port

Same behaviour as upstream (v31 toolbox, `Ping-Compensation-Classic`); `skills.json`, `abnormals.json` and `config.json` are unchanged (the server is 31.04, so skill, template and abnormality ids are the same).

Changes in `index.js`:
- Protocol read from `dispatch.protocolVersion` (387463 = 115). Other protocols keep the upstream `'*'` hooks.
- 115 hook versions: S_EACH_SKILL_RESULT 15, S_ABNORMALITY_BEGIN 5, S_ABNORMALITY_REFRESH 2 (1 as fallback), S_ABNORMALITY_END 1, S_ACTION_STAGE 9, S_ACTION_END 5, S_START_COOLTIME_SKILL 4, C_PLAYER_LOCATION 5, C_NOTIFY_LOCATION_IN_ACTION 4, S_INSTANT_MOVE 3, S_INSTANT_DASH 3, C_START_SKILL 7, C_PRESS_SKILL 5, C_START_COMBO_INSTANT_SKILL 6, C_START_INSTANCE_SKILL 8, C_START_INSTANCE_SKILL_EX 5, C_START_TARGETED_SKILL 7.
- Abnormality duration is int64 (BigInt) on 115: read with Number(), written back as BigInt.
- S_ACTION_STAGE: `projectileSpeed` is set equal to the changed `speed` (the 115 client plays the stage at it).
- Retry: the raw `C_START_*` buffer has the 8 byte sequence/checksum header; the toolbox renumbers padded opcodes when it sends them, so the re-sent copy is a valid packet.
- `SendAbnormalityEnd` gets the id as a number (upstream passed `[id]`).

Next to OSTO PR (`osto-pr`, dev name `sp-test`): PR's module.json lists `ping-compensation` under `conflicts`, so the toolbox does not load PR when both are installed and enabled (it prints a conflict error for PR). If both are loaded anyway (a PR build without that entry, or PR loaded later), Ping Compensation checks `mod.manager.isLoaded()` at start and on every `S_SPAWN_ME` and stays passive: it removes its packet hooks, stops its ping timer and sends nothing. Other prediction mods (`skill-prediction`, `pr-classic`, `ping-remover`, `ngsp`, `psp`, `kuma-prediction`) switch on the upstream `SkillPrediciton` mode.
