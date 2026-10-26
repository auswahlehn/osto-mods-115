# osto-mods-115

OSTO's tested mirrors of toolbox mods for the 115 client toolbox (Old School TERA, 115 client on the 31.04 server through the bridge).

Each folder is one mod, laid out the way the toolbox updater expects: `module.json` (its `servers` entry points at this repository), `manifest.json` (sha256 of every file) and the mod files. The updater installs a mod from `https://raw.githubusercontent.com/auswahlehn/osto-mods-115/master/<folder>/`.
These are mirrors: the code is the original authors' work. Original READMEs and licenses are kept. Where an upstream repository has no license file, all rights stay with the original author; if an author wants a mod removed, open an issue and it will be taken down.

All mods were tested offline on the 115 toolbox (load next to the core mods, replay of captured 115 sessions, synthetic packets, headless start, install through the toolbox updater). They have not been run live on every setup; some features depend on systems the 31.04 server lacks (see each folder).

## Mods (22)

| Folder (module name) | Original author(s) | Upstream | OSTO changes |
|---|---|---|---|
| [Achievements-Master](Achievements-Master/) | Owyn | [Owyn/Achievements](https://github.com/Owyn/Achievements) | patched |
| [auto-bank](auto-bank/) | Snug / Prav / Seraph | [Snugglez/Auto-Bank](https://github.com/Snugglez/Auto-Bank) | no |
| [auto-camera](auto-camera/) | seraphinush . teralove | [seraphinush-gaming/auto-camera](https://github.com/seraphinush-gaming/auto-camera) | no |
| [auto-vanguard](auto-vanguard/) | seraphinush . baldera-mods | [seraphinush-gaming/auto-vanguard](https://github.com/seraphinush-gaming/auto-vanguard) | no |
| [bugfix](bugfix/) | Caali / Pinkie Pie | [tera-toolbox-mods/bugfix](https://github.com/tera-toolbox-mods/bugfix) | no |
| [camera-control](camera-control/) | Caali | [tera-toolbox-mods/camera-control](https://github.com/tera-toolbox-mods/camera-control) | no |
| [fps-utils](fps-utils/) | Risenio | [Risenio/fps-utils](https://github.com/Risenio/fps-utils) | patched |
| [instant-everything](instant-everything/) | Caali / Pinkie Pie / m0py / Snug / beng | [tera-toolbox-mods/instant-everything](https://github.com/tera-toolbox-mods/instant-everything) | no |
| [JustSpamF](JustSpamF/) | Snug | [Snugglez/JustSpamF](https://github.com/Snugglez/JustSpamF) | no |
| [Mount-Prediction](Mount-Prediction/) | Snug | [Snugglez/mount-prediction](https://github.com/Snugglez/mount-prediction) | no |
| [no-more-delayed-buffs](no-more-delayed-buffs/) | SaltyMonkey | [SaltyMonkey/no-more-delayed-buffs](https://github.com/SaltyMonkey/no-more-delayed-buffs) | no |
| [No-More-Motes](No-More-Motes/) | Snug | [Snugglez/No-More-Motes](https://github.com/Snugglez/No-More-Motes) | no |
| [Rainbow](Rainbow/) | Pentagon | [codeagon/rainbow](https://github.com/codeagon/rainbow) | no |
| [Salt-Remover](Salt-Remover/) | SaltyMonkey | [SaltyMonkey/Salt-remover](https://github.com/SaltyMonkey/Salt-remover) | no |
| [skill-resets](skill-resets/) | Caali / SaltyMonkey / eemj | [tera-toolbox-mods/skill-resets](https://github.com/tera-toolbox-mods/skill-resets) | patched |
| [tera-settings-saver](tera-settings-saver/) | Kasea | [tera-toolbox-mods/Tera-Settings-Saver](https://github.com/tera-toolbox-mods/Tera-Settings-Saver) | no |
| [unmount-fix](unmount-fix/) | Mister-Kay | [Mister-Kay/unmount-fix](https://github.com/Mister-Kay/unmount-fix) | no |
| [fps-manager](fps-manager/) | SaltyMonkey | [tera-classic-mods/fps-manager](https://github.com/tera-classic-mods/fps-manager) | ported |
| [OSTOAerogasm](OSTOAerogasm/) | NMods & Laxus | [lightryuzaki/ostoweather](https://github.com/lightryuzaki/ostoweather) | ported |
| [party-deaths-notifier-classic](party-deaths-notifier-classic/) | SaltyMonkey | [tera-classic-mods/party-deaths-notifier-classic](https://github.com/tera-classic-mods/party-deaths-notifier-classic) | ported |
| [quick-load](quick-load/) | HakuryuuDom / Pinkie Pie | [HakuryuuDom/quick-load](https://github.com/HakuryuuDom/quick-load) | ported |
| [generic-box-opener-item-user](generic-box-opener-item-user/) | Owyn | [tera-private-mods/generic-box-opener-item-user](https://github.com/tera-private-mods/generic-box-opener-item-user) | ported |

"patched" = OSTO fixed something so the mod works on the 115 toolbox; "ported" = OSTO port of a v31 toolbox mod to the 115 toolbox.

## Held back (3)

These three only replace client UI packages (GPK files) and have no effect until GPK support exists in the 115 toolbox. The folders are mirrored for completeness but are not part of the launcher catalog yet, and the `.gpk` binaries are not included.

| Folder | Original author(s) | Upstream |
|---|---|---|
| [clean-character-bar](clean-character-bar/) | SaltyMonkey | [SaltyMonkey/tera-online-clean-character-bar](https://github.com/SaltyMonkey/tera-online-clean-character-bar) |
| [clean-onscreen-messages](clean-onscreen-messages/) | SaltyMonkey | [SaltyMonkey/tera-online-clean-onscreen-messages](https://github.com/SaltyMonkey/tera-online-clean-onscreen-messages) |
| [extended-boss-bar](extended-boss-bar/) | SaltyMonkey | [SaltyMonkey/tera-online-extended-boss-bar](https://github.com/SaltyMonkey/tera-online-extended-boss-bar) |

## Credits

All mods are the work of their original authors, listed above and in each `module.json`: the TERA Toolbox community (Caali / Pinkie Pie, tera-toolbox-mods), SaltyMonkey, Snugglez, seraphinush-gaming, Owyn, Risenio and the fps-utils contributors (Saegusae, codeagon, SerenTera, Kyoukaya, SaltyMonkey, Leyki), Mister-Kay, codeagon, HakuryuuDom, NMods and Laxus (Aerogasm). Thank you.

## Notes

- fps-utils (command `fps`) and fps-manager (commands `fm` and `fpsm`) can be installed together; the mirrored fps-manager uses `fpsm` instead of `fps`.
- `.gitattributes` turns line-ending conversion off on purpose: the hashes in the manifests are of the exact bytes in this repository.
