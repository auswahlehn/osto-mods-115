'use strict';
const config = require('./config.js');

// Auto Loot for the 64-bit (115.02) client.
// Same hooks and same commands as before, with these changes:
//  - one tracked timer: the old code started a new untracked scan loop for every drop that was out of range, so N drops
//    made N loops and a burst of N requests (the bridge drops frames above 60 per 100 ms and 240 per second);
//  - up to BATCH requests per tick for different drops, nearest first (peak about 13 per 100 ms);
//  - a drop that the server does not answer is asked for at most MAX_TRIES times, then only once per SLOW_MS;
//  - owner ids are read whatever their shape (number, BigInt, {playerId} or {id});
//  - no error without a location, and the loop continues after the player dismounts.
const BATCH = 4;       // loot requests per tick (tick = config.interval): about 13 per 100 ms, the bridge limit is 60
const MAX_TRIES = 12;
const SLOW_MS = 3000;

module.exports = function AutoLootOld(mod) {
    const cmd = mod.command || mod.require.command;

    let enable = config.enable,
        enableAuto = config.enableAuto,
        interval = config.interval,
        throttleMax = config.throttleMax,
        scanInterval = config.scanInterval,
        radius = config.radius;

    let location = null,
        items = new Map(),
        lootTimeout = null;

    const say = (text) => {
        try { (mod.command || cmd).message(text); } catch (_) { /* no chat */ }
    };

    function ownerId(owner) {
        if (owner !== null && typeof owner === 'object')
            return owner.playerId !== undefined ? owner.playerId : owner.id;
        return owner;
    }

    function isMine(owners) {
        const me = mod.game.me;
        if (!me || me.playerId === null || me.playerId === undefined || !owners)
            return false;
        for (const owner of owners) {
            const id = ownerId(owner);
            if (id !== undefined && id !== null && Number(id) === Number(me.playerId))
                return true;
        }
        return false;
    }

    function stop() {
        if (lootTimeout) clearTimeout(lootTimeout);
        lootTimeout = null;
    }

    function schedule(ms) {
        stop();
        lootTimeout = setTimeout(tryLoot, ms);
    }

    cmd.add('loot', {
        $default() {
            enable = !enable;
            say(`${enable ? 'en' : 'dis'}abled`);
        },
        auto() {
            enableAuto = !enableAuto;
            say(`auto-loot ${enableAuto ? 'en' : 'dis'}abled`);
        }
    });

    mod.game.me.on('change_zone', () => { items.clear(); stop(); });

    mod.hook('S_RETURN_TO_LOBBY', 1, () => { items.clear(); stop(); });
    mod.hook('S_SPAWN_ME', 3, (e) => { location = e.loc; });
    mod.hook('C_PLAYER_LOCATION', 5, (e) => { location = e.loc; });
    mod.hook('S_SYSTEM_MESSAGE', 1, (e) => { if (e.message === '@41') return false });
    mod.hook('C_TRY_LOOT_DROPITEM', 4, () => { if (enable && !lootTimeout) schedule(interval); });
    mod.hook('S_DESPAWN_DROPITEM', 4, (e) => { items.delete(e.gameId); });

    mod.hook('S_SPAWN_DROPITEM', 9, (e) => {
        if (config.blacklist.includes(e.item) || (e.item >= 8000 && e.item <= 8024) || !isMine(e.owners))
            return;
        items.set(e.gameId, { gameId: e.gameId, loc: e.loc, item: e.item, priority: 0, next: 0 });
        if (enableAuto && !lootTimeout) tryLoot();
    });

    function tryLoot() {
        stop();
        if (!items.size) return;
        const me = mod.game.me;
        if (!me || me.mounted || !location) {
            if (enableAuto) schedule(scanInterval);
            return;
        }
        const now = Date.now();
        const near = [];
        for (const item of items.values()) {
            if (item.next > now) continue;
            const distance = location.dist3D(item.loc);
            if (distance <= radius) near.push({ item, distance });
        }
        if (near.length) {
            near.sort((a, b) => (a.item.priority - b.item.priority) || (a.distance - b.distance));
            for (const { item } of near.slice(0, BATCH)) {
                mod.send('C_TRY_LOOT_DROPITEM', 4, { gameId: item.gameId });
                if (++item.priority >= MAX_TRIES) {
                    item.priority = 0;
                    item.next = now + SLOW_MS;
                }
            }
            schedule(interval);
            return;
        }
        if (enableAuto) schedule(scanInterval);
    }

    if (this && typeof this === 'object')
        this.destructor = () => { stop(); items.clear(); };
}