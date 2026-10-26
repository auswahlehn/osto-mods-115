module.exports = function noMoreDelayedBuffs(mod) {
	if (mod.majorPatchVersion < 97) {
		mod.log("This mod fixing issues with x64 client only. Unavailable with your patch");
		return;
	}

	mod.game.initialize("me");
	
	mod.hook("S_ABNORMALITY_REFRESH", 2, { "order": 99999999, "filter": { "fake": null } }, (event) => {
		if (event.target !== mod.game.me.gameId || event.stacks < 2) return;

		mod.send("S_ABNORMALITY_END", 1, {
			"target": mod.game.me.gameId,
			"id": event.id
		});
		mod.send("S_ABNORMALITY_BEGIN", mod.majorPatchVersion <= 106 ? 4 : 5, {
			"target": mod.game.me.gameId,
			"source": mod.game.me.gameId,
			"id": event.id,
			"duration": event.duration,
			"stacks": event.stacks
		});
		return false;
	});
};
