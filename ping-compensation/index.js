const CLASS_NAMES = ["Warrior", "Lancer", "Slayer", "Berserker", "Sorcerer", "Archer", "Priest", "Mystic", "Reaper", "Gunner"]

// movingCharge never gets sActionEnd, instead connects to new sActionStage on release
// catchBack, shorTel, positionswap, inversecapture need to wait for movement
// notimeline, drain, and defence are held indefinitely
const DISABLED_SKILL_TYPES = ["catchBack", "shortTel", "positionswap", "inversecapture", "movingCharge", "notimeline", "drain", "defence"]

// ---- 115.02 port -------------------------------------------------------------------------------------------------
// One source for both clients: the protocol is read from the connection (dispatch.protocolVersion 387463 = 115.02,
// anything else = the original 31.04 behaviour, '*' versions).
//
// What differs on 115 (the server is still 31.04, so the skill ids, template ids and abnormality ids in skills.json
// and abnormals.json stay valid):
//  * definition versions: every hook uses a version the 115 toolbox data has (a list is tried in order);
//  * int64 fields (abnormality duration) are BigInt: read through Number(), written back as BigInt;
//  * S_ACTION_STAGE: the 115 client plays a stage at projectileSpeed (the bridge copies speed there), so a changed
//    speed is written to both;
//  * the raw C_START_* buffers carry the 8 byte sequence + checksum header of the sequenced client opcodes. The toolbox
//    renumbers every padded opcode it sends to the server (native prepareToServer), so re-sending the buffer is a
//    normal packet with the next sequence number.
const PROTOCOL_115 = 387463

//                                 31.04          115.02
const VERSIONS = {
    S_EACH_SKILL_RESULT:         [["*"],         [15]],
    S_ABNORMALITY_BEGIN:         [["*"],         [5]],
    S_ABNORMALITY_REFRESH:       [["*"],         [2, 1]],
    S_ABNORMALITY_END:           [["*"],         [1]],
    S_ACTION_STAGE:              [["*"],         [9]],
    S_ACTION_END:                [["*"],         [5]],
    S_START_COOLTIME_SKILL:      [["*"],         [4]],
    C_PLAYER_LOCATION:           [["*"],         [5]],
    C_NOTIFY_LOCATION_IN_ACTION: [["*"],         [4]],
    S_INSTANT_MOVE:              [["*"],         [3]],
    S_INSTANT_DASH:              [["*"],         [3]],
    C_START_SKILL:               [["*"],         [7]],
    C_PRESS_SKILL:               [["*"],         [5]],
    C_START_COMBO_INSTANT_SKILL: [["*"],         [6]],
    C_START_INSTANCE_SKILL:      [["*"],         [8]],
    C_START_INSTANCE_SKILL_EX:   [["*"],         [5]],
    C_START_TARGETED_SKILL:      [["*"],         [7]],
}

// Prediction mods. OSTO PR is a full client side emulator: it blocks the server's S_ACTION_STAGE / S_ACTION_END and
// injects its own, and re-sends the start packets itself. Ping Compensation on top of it would shorten the same stages
// and send a second fake S_ACTION_END, so next to these it stays out of the packet path completely ("yield").
// Other prediction mods only switch on the original skillPrediction behaviour.
// (OSTO PR's module.json also lists ping-compensation under conflicts, so the toolbox normally refuses to load both;
// this is the second line of defence for a PR build without that entry or one loaded later.)
const YIELD_TO_MODS = ["osto-pr", "sp-test"]
const PREDICTION_MODS = ["skill-prediction", "pr-classic", "ping-remover", "ngsp", "psp", "kuma-prediction"]

const START_PACKETS = ["C_START_SKILL", "C_PRESS_SKILL", "C_START_COMBO_INSTANT_SKILL", "C_START_INSTANCE_SKILL", "C_START_INSTANCE_SKILL_EX", "C_START_TARGETED_SKILL"]

const num = v => (typeof v === "bigint" ? Number(v) : v)

class PingCompensation {
    constructor(mod) {
        this.skills = require("./skills.json")
        this.abnormals = require("./abnormals.json")
        this.config = require("./config.json")

        this.mod = mod
        this.hooks = []

        this.is115 = this.detect115()

        this.debugging = false
        this.enabled = true
        this.active = false

        // if skill-prediction is detected, skip own ping statistics and skill
        // cooldown duration corrections. Also block retries for disabled skills.
        // 115 port: also set when a prediction mod is loaded next to us (see checkCoexistence).
        // The config key keeps the upstream spelling; the correct spelling is accepted too.
        this.skillPredictionSetting = !!(this.config?.Settings?.SkillPrediciton ?? this.config?.Settings?.SkillPrediction ?? false)
        this.skillPrediction = this.skillPredictionSetting
        this.yielding = false
        this.yieldTo = null
        this.predictor = null

        this.pingHistorySetting = this.config?.Settings?.PingHistory ?? 30
        this.pingIntervalSetting = this.config?.Settings?.PingInterval ?? 4000
        this.pingOffsetSetting = this.config?.Settings?.PingOffset ?? 0
        this.pingHistory = []
        this.pingMin = 1
        this.pingMax = 1000
        this.pingTime = 0
        this.pingWaiting = false
        this.pingTimer = null

        this.rubberBandDistSetting = this.config?.Settings?.RubberBandDistance ?? 300
        this.actionName = null
        this.actionEnd = null
        this.actionEndSpeed = 1.0
        this.actionEndTime = null
        this.actionEndTimer = null
        this.sendingActionEnd = false

        this.activeAbnormals = {}
        this.sendingAbnormalityEnd = false

        this.retryCountSetting = this.config?.Settings?.RetryCount ?? 2
        this.retryTimeoutSetting = this.config?.Settings?.RetryTimeout ?? 100
        this.retryDelaySetting = this.config?.Settings?.RetryDelay ?? 30
        this.noRetryDelaySetting = this.config?.Settings?.NoRetryDelay ?? 60
        this.retryNext = false
        this.retryBuffer = null
        this.retryCount = 0
        this.retryTimer = null
        this.retryTimeout = null

        this.initialize = this.initialize.bind(this)
        this.destructor = this.destructor.bind(this)

        // handle ping
        this.StartPingTimer = this.StartPingTimer.bind(this)
        this.StopPingTimer = this.StopPingTimer.bind(this)
        this.PingRequestHandler = this.PingRequestHandler.bind(this)
        this.PingFakeRequestHandler = this.PingFakeRequestHandler.bind(this)
        this.PingResponseHandler = this.PingResponseHandler.bind(this)

        // handle incoming client or server packets
        this.StartSkillHandler = this.StartSkillHandler.bind(this)
        this.StartSkillHandler2 = this.StartSkillHandler2.bind(this)
        this.ActionStageHandler = this.ActionStageHandler.bind(this)
        this.ActionEndHandler = this.ActionEndHandler.bind(this)
        this.ReactionHandler = this.ReactionHandler.bind(this)
        this.StartCooltimeSkillHandler = this.StartCooltimeSkillHandler.bind(this)

        this.AbnormalityBeginHandler = this.AbnormalityBeginHandler.bind(this)
        this.AbnormalityEndHandler = this.AbnormalityEndHandler.bind(this)
        this.SendAbnormalityEnd = this.SendAbnormalityEnd.bind(this)

        // helper methods
        this.UpdateLocation = this.UpdateLocation.bind(this)
        this.SendRetry = this.SendRetry.bind(this)
        this.SendActionEnd = this.SendActionEnd.bind(this)
        this.SendInstantMove = this.SendInstantMove.bind(this)
        this.CancelRetry = this.CancelRetry.bind(this)
        this.CancelActionEnd = this.CancelActionEnd.bind(this)

        this.ToggleMod = this.ToggleMod.bind(this)
        this.ToggleDebug = this.ToggleDebug.bind(this)
        this.SendPingMessage = this.SendPingMessage.bind(this)
        this.SendHelpMessage = this.SendHelpMessage.bind(this)

        this.mod.command.add("pc", {
            $default: this.SendHelpMessage,
            $none: this.ToggleMod,
            debug: this.ToggleDebug,
            ping: this.SendPingMessage,
        })

        this.mod.game.initialize("me")
        this.checkCoexistence(true)
        this.applyState()
        // a prediction mod can be loaded after us: look again on every zone entry
        this.mod.hook("S_SPAWN_ME", "event", { order: 2 }, () => {
            if (this.checkCoexistence(true)) this.applyState()
        })
    }

    detect115() {
        try {
            const pv = this.mod.dispatch && this.mod.dispatch.protocolVersion
            if (pv) return Number(pv) === PROTOCOL_115
        } catch (e) { /* fall through */ }
        try { return this.mod.majorPatchVersion >= 100 } catch (e) { return false }
    }

    // hook with the definition version list of this protocol (the first version the toolbox accepts wins)
    hookP(name, opts, cb) {
        let error
        for (const v of VERSIONS[name][this.is115 ? 1 : 0]) {
            try {
                return this.mod.hook(name, v, opts, cb)
            } catch (e) { error = e }
        }
        throw error
    }

    sendP(name, data) {
        return this.mod.send(name, VERSIONS[name][this.is115 ? 1 : 0][0], data)
    }

    // Which prediction mods are loaded in this toolbox. Returns true when the state changed.
    checkCoexistence(announce) {
        const loaded = name => {
            try { return !!this.mod.manager.isLoaded(name) } catch (e) { return false }
        }
        const yieldTo = YIELD_TO_MODS.find(loaded) || null
        const predictor = PREDICTION_MODS.find(loaded) || null
        const skillPrediction = this.skillPredictionSetting || !!predictor
        const changed = yieldTo !== this.yieldTo || skillPrediction !== this.skillPrediction
        this.yieldTo = yieldTo
        this.yielding = !!yieldTo
        this.predictor = predictor
        this.skillPrediction = skillPrediction
        if (changed && announce !== false) {
            if (yieldTo) this.mod.log(`${yieldTo} is loaded: Ping Compensation stays passive (it changes and sends no packets).`)
            else if (predictor) this.mod.log(`${predictor} is loaded: skill prediction mode.`)
        }
        return changed
    }

    // the packet hooks are installed exactly when the mod is enabled and not yielding
    applyState() {
        const want = this.enabled && !this.yielding
        if (want && !this.active) {
            this.active = true
            this.initialize()
            if (this.mod.game.isIngame) this.StartPingTimer()
        }
        else if (!want && this.active) {
            this.active = false
            this.destructor()
        }
    }

    ToggleMod() {
        this.enabled = !this.enabled
        this.checkCoexistence(false)
        this.applyState()
        const message = "Ping Compensation " + (this.enabled ? "enabled." : "disabled.")
            + (this.enabled && this.yielding ? ` (passive while ${this.yieldTo} is loaded)` : "")
        this.mod.command.message(message)
    }

    ToggleDebug() {
        this.debugging = !this.debugging
        const message = "Ping Compensation debugging " + (this.debugging ? "enabled." : "disabled.")
        this.mod.command.message(message)
    }

    destructor() {
        this.StopPingTimer()
        this.CancelRetry()
        this.CancelActionEnd()

        for (let hook of this.hooks) {
            this.mod.unhook(hook)
        }
        this.hooks = []
    }

    initialize() {
        this.hooks.push(this.mod.hook('S_SPAWN_ME', 'event', this.StartPingTimer))
        this.hooks.push(this.mod.hook('S_LOAD_TOPO', 'event', this.StopPingTimer))
        this.hooks.push(this.mod.hook('S_RETURN_TO_LOBBY', 'event', this.StopPingTimer))

        // header-only packets (no definition fields), same opcode on both clients
        this.hooks.push(this.mod.hook("C_REQUEST_GAMESTAT_PING", "event", { order: 1 }, this.PingRequestHandler))
        this.hooks.push(this.mod.hook("C_REQUEST_GAMESTAT_PING", "event", { order: 1, filter: { fake: true } }, this.PingFakeRequestHandler))
        this.hooks.push(this.mod.hook("S_RESPONSE_GAMESTAT_PONG", "event", { order: 1, filter: { silenced: null } }, this.PingResponseHandler))

        this.hooks.push(this.hookP("S_EACH_SKILL_RESULT", {}, this.ReactionHandler))

        this.hooks.push(this.hookP("S_ABNORMALITY_BEGIN", { order: 1 }, this.AbnormalityBeginHandler))
        this.hooks.push(this.hookP("S_ABNORMALITY_REFRESH", { order: 1 }, this.AbnormalityBeginHandler))
        this.hooks.push(this.hookP("S_ABNORMALITY_END", { order: 1, filter: { fake: null } }, this.AbnormalityEndHandler))

        this.hooks.push(this.hookP("S_ACTION_STAGE", { order: 1 }, this.ActionStageHandler))
        this.hooks.push(this.hookP("S_ACTION_END", { order: 1, filter: { fake: null } }, this.ActionEndHandler))
        this.hooks.push(this.hookP("S_START_COOLTIME_SKILL", { order: 1 }, this.StartCooltimeSkillHandler))

        this.hooks.push(this.hookP("C_PLAYER_LOCATION", { order: 1, filter: { fake: null } }, this.UpdateLocation))
        this.hooks.push(this.hookP("C_NOTIFY_LOCATION_IN_ACTION", { order: 1, filter: { fake: null } }, this.UpdateLocation))
        this.hooks.push(this.hookP("S_INSTANT_MOVE", { order: 1, filter: { fake: null } }, this.UpdateLocation))
        this.hooks.push(this.hookP("S_INSTANT_DASH", { order: 1, filter: { fake: null } }, this.UpdateLocation))

        // the six skill start packets: raw (keeps the buffer for the retry) and parsed (skill id)
        for (const name of START_PACKETS) {
            this.hooks.push(this.mod.hook(name, 'raw', { order: 1 }, this.StartSkillHandler))
        }
        for (const name of START_PACKETS) {
            this.hooks.push(this.hookP(name, { order: 2 }, this.StartSkillHandler2))
        }
    }

    StartPingTimer() {
        if (!this.skillPrediction) {
            this.StopPingTimer()
            this.pingTimer = this.mod.setInterval(() => {
                this.mod.send("C_REQUEST_GAMESTAT_PING", 1, {})
            }, this.pingIntervalSetting);
        }
    }

    StopPingTimer() {
        if (this.pingTimer) {
            this.mod.clearInterval(this.pingTimer)
            this.pingTimer = null
        }
    }

    SendPingMessage() {
        if (this.pingHistory.length > 0) {
            const pingAvg = Math.round(this.pingHistory.reduce((a, b) => a + b) / this.pingHistory.length)
            this.mod.command.message(`Ping Avg: ${pingAvg} ms, Min: ${this.pingMin} ms, Max: ${this.pingMax} ms`)
        }
        else {
            this.mod.command.message("Please wait 5s for ping statistics.")
            if (!this.pingTimer) this.StartPingTimer()
        }
    }

    SendHelpMessage() {
        this.mod.command.message([
            '"pc": toggles ping-compensation',
            '"pc debug": toggles debug output',
            '"pc ping": shows ping statistics',
        ].join("\n"))
    }

    PingRequestHandler() {
        this.mod.setTimeout(() => {
            this.mod.send("S_RESPONSE_GAMESTAT_PONG", 1, {})
        }, this.pingMin)

        this.SendPingMessage()
        return false
    }

    PingFakeRequestHandler() {
        // hook other mod's pings instead of sending our own pings.
        if (this.pingWaiting && Date.now() - this.pingTime < this.pingIntervalSetting) {
            this.StopPingTimer()
        }

        if (!this.pingWaiting)
            this.pingTime = Date.now()

        this.pingWaiting = true
    }

    PingResponseHandler() {
        if (this.pingWaiting) {
            this.pingWaiting = false
            this.pingHistory.push(Date.now() - this.pingTime)

            while (this.pingHistory.length > this.pingHistorySetting)
                this.pingHistory.shift()

            this.pingMin = Math.min(...this.pingHistory)
            this.pingMax = Math.max(...this.pingHistory)
        }
        return false
    }

    UpdateLocation(event) {
        if (!event.gameId || this.mod.game.me.is(event.gameId)) {
            if (this.actionEnd) {
                this.actionEnd.loc = event.loc
                this.actionEnd.w = event.w
            }
        }
    }

    SendActionEnd() {
        this.actionEndTimer = null
        if (this.actionEnd) {
            this.sendingActionEnd = true
            this.sendP("S_ACTION_END", this.actionEnd)
        }
    }

    CancelActionEnd() {
        this.actionEnd = null
        if (this.actionEndTimer) {
            this.mod.clearTimeout(this.actionEndTimer)
            this.actionEndTimer = null
        }
    }

    SendRetry() {
        if (this.retryBuffer && this.retryCount > 0 && Date.now() < this.retryTimeout) {
            this.mod.toServer(this.retryBuffer)
            this.retryCount -= 1

            if (this.retryCount > 0) {
                this.retryTimer = this.mod.setTimeout(this.SendRetry, this.retryDelaySetting)
            }
            else {
                this.retryBuffer = null
                this.retryTimer = null

                if (this.debugging && this.actionEnd) {
                    this.retryTimer = this.mod.setTimeout(() => {
                        this.mod.error("No Action Stage after retry!")
                    }, this.pingMax)
                }
            }

            if (this.debugging) {
                this.mod.log("Start Skill retry.")
            }
        }
    }

    CancelRetry() {
        this.retryNext = false
        this.retryCount = 0
        this.retryBuffer = null
        if (this.retryTimer) {
            this.mod.clearTimeout(this.retryTimer)
            this.retryTimer = null
        }
    }

    SendInstantMove(loc, w) {
        this.sendP("S_INSTANT_MOVE", {
            gameId: this.mod.game.me.gameId,
            loc,
            w
        })
    }

    StartSkillHandler(code, data) {
        // when sending packets to server, we only duplicate legit client packets
        // to avoid undocumented edge cases sending malformed packets.
        if (this.retryNext) {
            this.retryNext = false
            this.retryBuffer = data
            // ensure some delay exists, to prevent double sending
            if (this.retryCountSetting && this.retryDelaySetting) {
                this.retryTimer = this.mod.setTimeout(this.SendRetry, this.retryDelaySetting)
            }
        }
    }

    StartSkillHandler2(event) {
        // Cancel or modify start skill retry depending on user skill config
        const templateId = this.mod.game.me.templateId
        const classIdx = templateId % 100 - 1
        const className = CLASS_NAMES[classIdx]

        const skillId = event.skill.id
        const skillBase = Math.floor(skillId / 10000)
        const skillSub = skillId % 100
        const skillConfig = this.config?.[className]?.[skillBase]?.[skillSub]

        // cancel retries for unmanaged skills if skill prediciton is used
        if (this.skillPrediction && !skillConfig) {
            this.CancelRetry()
        }

        // if config is "no retry," cancel retry, and delay skill start.
        else if (typeof skillConfig == 'string' && skillConfig.trim().toLowerCase() == "no retry") {
            // cancel retry, but keep buffer
            if (this.retryTimer) {
                this.mod.clearTimeout(this.retryTimer)
                this.retryTimer = null
            }

            // setup no retry delay, or cleanup if too late
            this.retryCount = 1
            this.retryTimeout += this.noRetryDelaySetting
            const delay = this.retryTimeout - this.retryTimeoutSetting - Date.now()
            if (delay > 0) {
                this.retryTimer = this.mod.setTimeout(this.SendRetry, delay)

                if (this.debugging) {
                    const name = this.skills?.[templateId]?.[skillId]?.name || "Unknown"
                    this.mod.log(`Block Start Skill "${name}" (${skillId})`)
                }

                return false
            }
            else {
                this.CancelRetry()
            }
        }

        if (this.debugging) {
            const name = this.skills?.[templateId]?.[skillId]?.name || "Unknown"
            this.mod.log(`Start Skill "${name}" (${skillId})`)
        }
    }

    StartCooltimeSkillHandler(event) {
        if (!this.skillPrediction) {
            const fixedCooldown = Math.max(0, event.cooldown - this.pingMin)

            if (this.debugging) {
                this.mod.log(`Cooldown reduced from ${event.cooldown} ms to ${fixedCooldown} ms.`)
            }

            event.cooldown = fixedCooldown

            return true
        }
    }

    SendAbnormalityEnd(id) {
        if (this.activeAbnormals[id]) {
            this.activeAbnormals[id].timer = null
            this.sendingAbnormalityEnd = true
            this.sendP("S_ABNORMALITY_END", {
                target: this.mod.game.me.gameId,
                id
            })
        }
    }

    AbnormalityBeginHandler(event) {
        if (!this.skillPrediction && this.mod.game.me.is(event.target)) {
            if (this.abnormals?.[event.id] && num(event.duration) > 0) {
                const { type, name } = this.abnormals[event.id]
                const duration = num(event.duration)   // int64 = BigInt on 115
                const fixedDuration = Math.max(Math.round(duration - this.pingMin + this.pingOffsetSetting), 0)

                this.activeAbnormals[event.id] = {
                    name,
                    type,
                    time: Date.now() + duration,
                    timer: this.mod.setTimeout(this.SendAbnormalityEnd, fixedDuration, event.id),
                }

                if (this.debugging) {
                    this.mod.log(`Abnormality Start [${type}] "${name}" (${event.id}).`)
                    this.mod.log(`Reduced duration from ${duration} ms to ${fixedDuration} ms.`)
                }

                event.duration = typeof event.duration === "bigint" ? BigInt(fixedDuration) : fixedDuration
                return true
            }
        }
    }

    AbnormalityEndHandler(event) {
        if (this.mod.game.me.is(event.target)) {
            if (this.sendingAbnormalityEnd && this.activeAbnormals[event.id]) {
                this.sendingAbnormalityEnd = false
                const { type, name } = this.activeAbnormals[event.id]

                if (this.debugging) {
                    this.mod.log(`Fake Abnormality Ended [${type}] "${name}" (${event.id}).`)
                }
            }
            else if (this.activeAbnormals[event.id]) {
                const { type, name, time, timer } = this.activeAbnormals[event.id]

                if (this.debugging) {
                    this.mod.log(`Real Abnormality Ended [${type}] "${name}" (${event.id}).`)
                }

                delete this.activeAbnormals[event.id]

                if (timer) {
                    this.mod.clearTimeout(timer)
                }
                else {
                    return false
                }
            }
        }
    }

    ReactionHandler(event) {
        if (this.mod.game.me.is(event.target) && event.reaction && event.reaction.enable) {
            this.CancelRetry()
            const templateId = this.mod.game.me.templateId
            const skillId = event.reaction.skill.id
            if (this.skills?.[templateId]?.[skillId] && !this.skillPrediction) {
                let { name, dcType, length, distance } = this.skills[templateId][skillId]

                if (this.debugging) {
                    this.mod.log(`Action Stage "${name}" (${skillId}).`)
                    this.actionName = name
                }

                if (dcType == "reaction") {
                    // sometimes server gives custom length and distance
                    if (event.reaction.animSeq && event.reaction.animSeq.length > 0) {
                        length = event.reaction.animSeq.map(a => a.duration).reduce((a, b) => {
                            if (a == -1) a = 0
                            if (b == -1) b = 0
                            return a + b
                        })

                        const backwards = distance < 0
                        distance = event.reaction.animSeq.map(a => a.distance).reduce((a, b) => {
                            if (a == -1) a = 0
                            if (b == -1) b = 0
                            return a + b
                        })
                        if (backwards) {
                            distance *= -1
                        }
                    }

                    const fixedLength = Math.max(length - this.pingMin + this.pingOffsetSetting, 20)
                    const fixedSpeedMult = length / fixedLength

                    if (event.reaction.animSeq && event.reaction.animSeq.length > 0) {
                        for (let anim of event.reaction.animSeq) {
                            anim.duration /= fixedSpeedMult
                            anim.xyRate *= fixedSpeedMult
                            anim.zRate *= fixedSpeedMult
                        }
                    }

                    // Only set action end from first action stage
                    if (this.actionEndTimer) {
                        if (this.actionEnd && this.actionEnd.id == event.reaction.id) {
                            return true
                        }
                        else {
                            if (this.debugging) {
                                this.mod.error("New S_ACTION_STAGE without S_ACTION_END")
                                this.mod.error(event)
                            }
                            this.CancelActionEnd()
                        }
                    }

                    if (this.debugging) {
                        this.actionEndSpeed = 1.0
                        this.actionEndTime = Date.now() + Math.round(length)
                        this.mod.log(`Reduced length from ${Math.round(length)} ms to ${Math.round(fixedLength)} ms.`)
                    }

                    this.actionEnd = {
                        gameId: event.target,
                        loc: event.reaction.loc,
                        w: event.reaction.w,
                        templateId: templateId,
                        skill: event.reaction.skill,
                        type: 0,
                        id: event.reaction.id
                    }

                    if (distance) {
                        const dx = distance * Math.cos(event.reaction.w)
                        const dy = distance * Math.sin(event.reaction.w)
                        this.actionEnd.loc = event.reaction.loc.addN(dx, dy, 0)
                    }

                    this.actionEndTimer = this.mod.setTimeout(this.SendActionEnd, fixedLength)

                    return true
                }
            }
        }
    }

    ActionEndHandler(event) {
        if (this.mod.game.me.is(event.gameId)) {
            if (this.sendingActionEnd) {
                this.sendingActionEnd = false

                // retry next skill start in-case ping dropped
                this.retryNext = true
                this.retryCount = this.retryCountSetting
                this.retryTimeout = Date.now() + this.retryTimeoutSetting

                if (this.debugging) {
                    this.mod.log(`Fake Action Ended "${this.actionName}" (${event.skill.id}).`)
                }
            }
            else if (this.actionEnd && this.actionEnd.id == event.id) {
                if (this.debugging) {
                    this.mod.log(`Real Action Ended "${this.actionName}" (${event.skill.id}).`)
                    const lengthDiff = Math.round((Date.now() - this.actionEndTime) * this.actionEndSpeed)
                    if (lengthDiff > 50 || lengthDiff < -50) {
                        this.mod.error(`Expected length differed by ${lengthDiff} ms.`)
                    }
                }

                if (this.actionEndTimer) {
                    this.CancelActionEnd()
                }
                else {
                    // Teleport if fake action end was too far from real action end.
                    // Not sure if necessary, or may cause more complications if
                    // other start skill or location packets were sent in the interrim.
                    if (this.rubberBandDistSetting) {
                        const distSqr = event.loc.sqrDist2D(this.actionEnd.loc)
                        if (distSqr > this.rubberBandDistSetting * this.rubberBandDistSetting) {
                            if (this.debugging) {
                                this.mod.error(`Distance from real Action End > ${this.rubberBandDistSetting}`)
                            }
                            this.CancelRetry()
                            this.SendInstantMove(event.loc, event.w)
                        }
                    }

                    // Don't need additional retries if we know server action ended
                    this.actionEnd = null
                    this.retryNext = false
                    if (this.retryCount > 1) {
                        this.retryCount = 1
                    }

                    return false
                }
            }
        }
    }

    ActionStageHandler(event) {
        if (this.mod.game.me.is(event.gameId)) {

            this.CancelRetry()

            const templateId = event.templateId
            const classIdx = templateId % 100 - 1
            const className = CLASS_NAMES[classIdx]

            const skillId = event.skill.id
            const skillBase = Math.floor(skillId / 10000)
            const skillSub = skillId % 100

            if (this.skills?.[templateId]?.[skillId]) {
                let { name, dcType, length, distance } = this.skills[templateId][skillId]

                if (this.debugging) {
                    this.mod.log(`Action Stage "${name}" (${skillId}).`)
                    this.actionName = name
                }

                if ((dcType == "reaction" && !this.skillPrediction)
                    || this.config?.[className]?.[skillBase]?.[skillSub]
                    && !DISABLED_SKILL_TYPES.includes(dcType)
                    && length > 0 && event.speed > 0
                ) {
                    length = length / event.speed

                    // sometimes server gives custom length and distance
                    if (event.animSeq && event.animSeq.length > 0) {
                        length = event.animSeq.map(a => a.duration).reduce((a, b) => {
                            if (a == -1) a = 0
                            if (b == -1) b = 0
                            return a + b
                        })

                        const backwards = distance < 0
                        distance = event.animSeq.map(a => a.distance).reduce((a, b) => {
                            if (a == -1) a = 0
                            if (b == -1) b = 0
                            return a + b
                        })
                        if (backwards) {
                            distance *= -1
                        }
                    }

                    // for stuns, length is determined by abnormality
                    // we need to get the longest abnormal, in-case we have overlapping stuns
                    if (name == "Stun") {
                        let now = Date.now()
                        let longestTime = now
                        for (let abnormalId in this.activeAbnormals) {
                            const abnormal = this.activeAbnormals[abnormalId]
                            if (abnormal.type == "Stun" && abnormal.time > longestTime) {
                                longestTime = abnormal.time
                            }
                        }
                        length = longestTime - now
                    }

                    const fixedLength = Math.max(length - this.pingMin + this.pingOffsetSetting, 20)
                    const fixedSpeedMult = length / fixedLength
                    event.speed *= fixedSpeedMult
                    // 115: the client plays the stage at projectileSpeed (the bridge copies speed there), keep both equal
                    if (this.is115) event.projectileSpeed = event.speed

                    if (event.animSeq && event.animSeq.length > 0) {
                        for (let anim of event.animSeq) {
                            anim.duration /= fixedSpeedMult
                            anim.xyRate *= fixedSpeedMult
                            anim.zRate *= fixedSpeedMult
                        }
                    }

                    // Only set action end from first action stage
                    if (this.actionEndTimer) {
                        if (this.actionEnd && this.actionEnd.id == event.id) {
                            return true
                        }
                        else {
                            if (this.debugging) {
                                this.mod.error("New S_ACTION_STAGE without S_ACTION_END")
                                this.mod.error(event)
                            }
                            this.CancelActionEnd()
                        }
                    }

                    if (this.debugging) {
                        this.actionEndSpeed = event.speed / fixedSpeedMult
                        this.actionEndTime = Date.now() + Math.round(length)
                        if (name != "Stun") {
                            this.mod.log(`Reduced length from ${Math.round(length)} ms to ${Math.round(fixedLength)} ms.`)
                        }
                    }

                    this.actionEnd = {
                        gameId: event.gameId,
                        loc: event.loc,
                        w: event.w,
                        templateId: event.templateId,
                        skill: event.skill,
                        type: 0,
                        id: event.id
                    }

                    if (distance) {
                        const dx = distance * Math.cos(event.w)
                        const dy = distance * Math.sin(event.w)
                        this.actionEnd.loc = event.loc.addN(dx, dy, 0)
                    }

                    this.actionEndTimer = this.mod.setTimeout(this.SendActionEnd, fixedLength)

                    return true
                }
            }
        }
    }
}

module.exports = PingCompensation;