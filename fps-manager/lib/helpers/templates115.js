"use strict";

const CLASSES = ["warrior", "lancer", "slayer", "berserker", "sorcerer", "archer", "priest", "elementalist", "soulless", "engineer", "fighter", "assassin", "glaiver"];

const classOfTemplate = (templateId) => {
	if (!Number.isInteger(templateId) || templateId < 10101 || templateId > 19999) return undefined;
	return CLASSES[(templateId % 100) - 1];
};

exports.CLASSES = CLASSES;
exports.classOfTemplate = classOfTemplate;
