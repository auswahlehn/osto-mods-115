"use strict";

const proto = require("../data/protoData.json");

/*
* Unit for Fps Manager. Managing definitions versions for game protocol
* Author: SaltyMonkey
* Contributors: 
*/

/**
 * @typedef {import("../fpsManager.js").deps} deps
*/

// protocol version of the 115.02 client (the OSTO 115 toolbox); everything else keeps the original per patch lookup
const PROTOCOL_115 = 387463;

class unitProto {
	/**
	 *Creates an instance of unitProto.
	 * @param {deps} deps dependencies
	 * @memberof unitProto
	 */
	constructor(deps) {
		this.__mod = deps.mod;
		this.protocol115 = !!deps.mod.dispatch && deps.mod.dispatch.protocolVersion === PROTOCOL_115;
	}

	/**
	 * @description returns def version based on current game patch
	 * @param {*} defName definition string
	 * @returns {Array} definition data with version
	 * @memberof unitProto
	 */
	getData(defName) {
		// 115 column of protoData.json: the definition versions of the 115.02 protocol (toolbox115 defs)
		let version = proto[defName][this.protocol115 ? "115" : this.__mod.majorPatchVersion];
		return version ? [defName, version] : [defName, proto[defName].default];
	}

}

module.exports = unitProto;