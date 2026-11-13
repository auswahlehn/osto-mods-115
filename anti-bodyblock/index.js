'use strict';

// Anti-Bodyblock for the 64-bit (115.02, protocol 387463) client.
// Original mod: Fruit, https://github.com/tera-private-mods/anti-bodyblock (no license file upstream).
// Port changes (the behavior is the same: every 5 s, one fake S_PARTY_INFO per online party member, sent to the client only):
//  - S_PARTY_INFO 1 -> 2 and S_PARTY_MEMBER_LIST 7 -> 9 (the 115 definitions). S_PARTY_INFO 1 {leader, unk1, unk2, unk3, unk4}
//    is the same 21 bytes as S_PARTY_INFO 2 {gameId, partyId, raid}: leader = gameId, unk1..unk3 = partyId, unk4 = raid (the
//    old code always sent unk4 = 1, so raid is true here);
//  - the party id also comes from S_PARTY_MEMBER_LIST (id), nothing is sent while no party id is known;
//  - the member list is cleared on S_LEAVE_PARTY and on leave_game, so nobody outside the party gets a fake packet;
//  - one tracked timer: the old code started another timer at every enter_game and on every toggle without stopping the
//    first, so each map change doubled the packets.
const INTERVAL_MS = 5000;

module.exports = function antiBodyBlock(mod) {
  const partyMembers = new Set();
  let partyId = null;
  let interval = null;
  let enabled = true;

  const removeBodyBlock = () => {
    if (partyId === null || partyId === undefined) return;
    for (const gameId of partyMembers) {
      try {
        mod.send('S_PARTY_INFO', 2, { gameId, partyId, raid: true });
      } catch (e) {
        mod.error('S_PARTY_INFO send failed: ' + (e && e.message));
        return;
      }
    }
  };

  const stop = () => {
    if (interval !== null) {
      mod.clearInterval(interval);
      interval = null;
    }
  };

  const start = () => {
    stop();
    if (enabled) interval = mod.setInterval(removeBodyBlock, INTERVAL_MS);
  };

  mod.game.on('enter_game', start);
  mod.game.on('leave_game', () => {
    stop();
    partyMembers.clear();
    partyId = null;
  });

  mod.command.add('bb', () => {
    enabled = !enabled;
    start();
    mod.command.message('Anti-bodyblock enabled: ' + enabled);
  });

  mod.hook('S_PARTY_INFO', 2, evt => { partyId = evt.partyId; });
  mod.hook('S_PARTY_MEMBER_LIST', 9, evt => {
    partyId = evt.id;
    partyMembers.clear();
    for (const member of evt.members) {
      if (!member.online) continue;
      partyMembers.add(member.gameId);
    }
  });
  mod.hook('S_LEAVE_PARTY', 1, () => {
    partyMembers.clear();
    partyId = null;
  });
};