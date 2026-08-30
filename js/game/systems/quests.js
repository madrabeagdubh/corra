// quests.js
//
// GameState only stores quest STATUS ('inactive' | 'active' | 'complete'),
// keyed by id -- it has no titles or descriptions, because state and text
// are different lifetimes (state is per-save, text is per-build). This is
// the text half: one entry per quest id used anywhere in a .dlg draft's
// @quest / @done directives.
//
// Add an entry here whenever a new @quest id is introduced. Nothing enforces
// that pairing automatically -- an id with no entry here will show in the
// toast and the log with its raw id as a fallback title, which is a visible
// enough failure to notice in testing.

import { showQuestToast } from '../ui/questToast.js'
import { SoundBoard }     from './soundBoard.js'

export const QUEST_REGISTRY = {
  q_baile: {
    titleGa: 'Cuairt ar ráth an Taoisigh',
    titleEn: 'Visit the Chieftain\'s Ráth',
    descGa:  'Dúirt Muireann liom dul go ráth Fhionnbarra agus a ghabha a lorg.',
    descEn:  'Muireann told me to go to Fionnbarra\'s ráth and seek out his smith.',
  },
}

export function getQuestText(questId) {
  return QUEST_REGISTRY[questId] || {
    titleGa: questId, titleEn: questId, descGa: '', descEn: '',
  }
}

// -- Toast + sound for a quest transition ------------------------------
// Shared by encounterPanel.js (dialogue-driven @quest/@done) and any scene
// that flips quest state directly (e.g. b0.js completing q_baile onEnter,
// which happens on arrival rather than through a dialogue option).
export function announceQuest(questId, status, scene) {
  const text = getQuestText(questId)
  showQuestToast({
    status,
    titleGa: text.titleGa,
    titleEn: text.titleEn,
    hint: status === 'active',
  })
  SoundBoard.play('BADGE_APPEAR', scene)
}
