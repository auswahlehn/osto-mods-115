"use strict";

/*
* 115 port helper. Without a DataCenter reader (the 115 launcher shim has none) mod.game.data.users stays empty and the
* original code could not map a player templateId to a class name. Player templates follow the convention 1XXYY
* (XX = 1 + race * 2 + gender, YY = 1 + class), the same decoding tera-game-state uses for me.class.
*/

// names as in the DataCenter UserData templates; the index is the client class number
const CLASSES = ["warrior", "lancer", "slayer", "berserker", "sorcerer", "archer", "priest", "elementalist", "soulless", "engineer", "fighter", "assassin", "glaiver"];

/**
 * @param {number} templateId player template
 * @returns {string|undefined} class name, undefined when it is no player template
 */
const classOfTemplate = (templateId) => {
	if (!Number.isInteger(templateId) || templateId < 10101 || templateId > 19999) return undefined;
	return CLASSES[(templateId % 100) - 1];
};

exports.CLASSES = CLASSES;
exports.classOfTemplate = classOfTemplate;
