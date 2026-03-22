/**
 * GameState — Persistent world state for Fenians.baby
 *
 * Stores all mutable world state in localStorage, keyed by champion id.
 * Each champion has their own independent world state.
 *
 * State categories:
 *   collected    — one-time items picked up, never respawn
 *   defeated     — enemies defeated, with timestamp for respawn cooldowns
 *   npcProgress  — per-NPC dialogue index, so arcs persist across sessions
 *   quests       — quest flags: 'inactive' | 'active' | 'complete'
 *   visited      — maps visited (separate from introNarrative seen)
 *   inventory    — persisted separately by player.js, referenced here
 *
 * Usage:
 *   import { GameState } from '/data/gameState.js'
 *   GameState.init(championId)
 *   GameState.setCollected('bog_threshold.ancient_sword')
 *   GameState.isCollected('bog_threshold.ancient_sword')  // → true
 *   GameState.getNPCProgress('druid_temple.conall')       // → 2
 *   GameState.setNPCProgress('druid_temple.conall', 3)
 */

const STORAGE_PREFIX = 'fenians_state_'

function defaultState() {
  return {
    collected:   {},   // { 'mapKey.itemId': true }
    defeated:    {},   // { 'mapKey.enemyId': timestamp }
    npcProgress: {},   // { 'mapKey.npcId': dialogueIndex }
    quests:      {},   // { questId: 'inactive'|'active'|'complete' }
    visited:     {},   // { sceneKey: true }
    notes:       [],   // arbitrary story notes/flags [ 'met_conall', ... ]
  }
}

export const GameState = {
  _championId: null,
  _state: null,

  // ── Initialise for a champion ──────────────────────────────────────
  init(championId) {
    this._championId = championId
    const raw = localStorage.getItem(STORAGE_PREFIX + championId)
    try {
      this._state = raw ? JSON.parse(raw) : defaultState()
      // Ensure all keys exist (handles old saves missing new categories)
      const def = defaultState()
      for (const key of Object.keys(def)) {
        if (this._state[key] === undefined) this._state[key] = def[key]
      }
    } catch(e) {
      console.warn('[GameState] Corrupt save, resetting:', e)
      this._state = defaultState()
    }
    console.log(`[GameState] Loaded for champion: ${championId}`)
    return this
  },

  save() {
    if (!this._championId) return
    localStorage.setItem(STORAGE_PREFIX + this._championId, JSON.stringify(this._state))
  },

  reset() {
    if (!this._championId) return
    this._state = defaultState()
    this.save()
    console.log(`[GameState] Reset for champion: ${this._championId}`)
  },

  // ── Collectables ───────────────────────────────────────────────────
  // stateKey format: 'map_key.item_id' e.g. 'bog_threshold.ancient_sword'

  isCollected(stateKey) {
    return !!this._state?.collected[stateKey]
  },

  setCollected(stateKey) {
    if (!this._state) return
    this._state.collected[stateKey] = true
    this.save()
  },

  // ── Enemies ────────────────────────────────────────────────────────

  isDefeated(stateKey, respawnMs = 0) {
    if (!this._state) return false
    const ts = this._state.defeated[stateKey]
    if (!ts) return false
    if (respawnMs === 0) return true          // never respawns
    return (Date.now() - ts) < respawnMs      // still in cooldown
  },

  setDefeated(stateKey) {
    if (!this._state) return
    this._state.defeated[stateKey] = Date.now()
    this.save()
  },

  // ── NPC progress ───────────────────────────────────────────────────

  getNPCProgress(stateKey) {
    return this._state?.npcProgress[stateKey] ?? 0
  },

  setNPCProgress(stateKey, index) {
    if (!this._state) return
    this._state.npcProgress[stateKey] = index
    this.save()
  },

  advanceNPCProgress(stateKey, totalDialogues) {
    const current = this.getNPCProgress(stateKey)
    const next = (current + 1) % totalDialogues
    this.setNPCProgress(stateKey, next)
    return next
  },

  // ── Quests ─────────────────────────────────────────────────────────

  getQuest(questId) {
    return this._state?.quests[questId] ?? 'inactive'
  },

  setQuest(questId, status) {
    // status: 'inactive' | 'active' | 'complete'
    if (!this._state) return
    this._state.quests[questId] = status
    this.save()
    console.log(`[GameState] Quest ${questId}: ${status}`)
  },

  isQuestActive(questId)   { return this.getQuest(questId) === 'active' },
  isQuestComplete(questId) { return this.getQuest(questId) === 'complete' },

  // ── Map visits ─────────────────────────────────────────────────────

  hasVisited(sceneKey) {
    return !!this._state?.visited[sceneKey]
  },

  setVisited(sceneKey) {
    if (!this._state) return
    this._state.visited[sceneKey] = true
    this.save()
  },

  // ── Story notes ────────────────────────────────────────────────────
  // Free-form flags for story beats: 'met_conall', 'saw_bog_body', etc.

  hasNote(note) {
    return this._state?.notes.includes(note) ?? false
  },

  addNote(note) {
    if (!this._state || this.hasNote(note)) return
    this._state.notes.push(note)
    this.save()
  },
}

