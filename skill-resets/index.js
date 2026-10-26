exports.NetworkMod = function(mod) {
    const warnTimeout = 15;
    let lastReset = { time: null, icon: null };
    let iconsData = new Map();

    function getSkillBase(skill) {
        return Math.floor(skill / 10000);
    }

    mod.game.on("enter_game", () => {
        iconsData.clear();
        // OSTO115 patch: the 115 launcher shim has no DataCenter reader, so queryData rejects. The upstream code had no catch (an
        // unhandled rejection on every login). Without icons the notice is shown as text only (see the message below).
        mod.queryData("/SkillIconData/Icon@class=?/", [mod.game.me.class], true, false, ["skillId", "iconName"]).then(res => {
            res.forEach(icon => {
                iconsData.set(icon.attributes.skillId, icon.attributes.iconName);
                iconsData.set(getSkillBase(icon.attributes.skillId), icon.attributes.iconName);
            });
        }).catch(() => { /* no DataCenter: no icons */ });
    });

    // OSTO115 patch: order 150. OSTO PR hooks S_CREST_MESSAGE (order 100, skips packets that an earlier hook silenced) to clear its own
    // cooldown tracking when a glyph resets a skill. This hook swallows the type 6 message (show_system_reset_message is off by default),
    // so at the default order 0 it would run first and PR would never see the reset.
    mod.hook("S_CREST_MESSAGE", 2, { order: 150 }, ({ type, skill }) => {
        if (type === 6) {
            let icon = iconsData.get(skill) || iconsData.get(getSkillBase(skill));
            if (lastReset.icon !== icon || (lastReset.icon === icon && (Date.now() - lastReset.time > warnTimeout))) {
                lastReset.icon = icon;
                lastReset.time = Date.now();
                mod.send("S_CUSTOM_STYLE_SYSTEM_MESSAGE", 1, {
                    // OSTO115 patch: no <img> when the icon is unknown (no DataCenter); upstream printed img://__undefined
                    message: `${icon ? `<img src="img://__${icon}" width="48" height="48" vspace="-20"/>` : ''}<font size="24" color="${mod.settings.reset_font_color}">${icon ? '&nbsp;' : ''}Reset</font>`,
                    style: mod.settings.resetStyle
                });
            }
            if (mod.settings.sound)
                mod.send("S_PLAY_SOUND", 1, { SoundID: mod.settings.soundId });

            if (!mod.settings.show_system_reset_message)
                return false;
        }
    });
};
