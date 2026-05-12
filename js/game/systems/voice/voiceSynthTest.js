// voiceSynthTest.js — drop this into Fairy_Margin's create() or import it at the top
// of bogLocationScene.js temporarily for testing.
//
// It monkey-patches talkToNPC so that whenever Bean an Chnuic speaks,
// her voice plays alongside the textPanel.
//
// HOW TO USE:
//   1. Copy voiceSynth.js to your src/ tree (e.g. src/game/audio/voiceSynth.js)
//   2. Import this file in your BogLocationScene (or Fairy_Margin subclass) create():
//        import { installVoiceTest } from './voiceSynthTest.js'
//        // ... inside async create(), after initializeLocation():
//        installVoiceTest(this)
//   3. Load http://localhost:5173/?scene=Fairy_Margin and tap Bean an Chnuic.

import { createVoice, VOICES, irishSyllables, withVoice } from './voiceSynth.js'

export function installVoiceTest(scene) {
  console.log('[VoiceTest] Installing voice test on scene:', scene.scene.key)

  // One voice instance per NPC id — created lazily on first interaction
  const voiceMap = {}

  // Voice assignments — keyed to NPC id from the map JSON
  const voiceAssignments = {
    'sí_bean': VOICES.beanAnChnuic,
  }

  // Keep a reference to the original method
  const _originalTalkToNPC = scene.talkToNPC.bind(scene)

  scene.talkToNPC = function(npc) {
    const npcId    = npc.getData('id')
    const voiceDef = voiceAssignments[npcId]

    if (!voiceDef) {
      // No voice assigned — fall through to normal dialogue
      return _originalTalkToNPC(npc)
    }

    // Lazy-create the voice
    if (!voiceMap[npcId]) {
      voiceMap[npcId] = createVoice(voiceDef)
      console.log(`[VoiceTest] Created voice for ${npcId}`)
    }

    const voice     = voiceMap[npcId]
    const dialogues = npc.getData('dialogues')
    const index     = npc.getData('dialogueIndex') || 0
    const dialogue  = dialogues[index]

    if (scene.joystick) scene.joystick.reset()
    if (scene.player)   scene.player.isMoving = false

    const text = dialogue.ga || dialogue.irish || ''

    // Detect style from punctuation
    let style = 'statement'
    if (text.trimEnd().endsWith('?')) style = 'question'
    if (text.trimEnd().endsWith('!')) style = 'exclamation'

    console.log(`[VoiceTest] Speaking (${style}): "${text}"`)
    console.log(`[VoiceTest] Syllables:`, irishSyllables(text))

    // Play voice
    voice.speak(text, {
      mode:  'speech',
      style,
      onSyl: (syl, idx) => {
        // Optional: console log to verify timing against text
        // console.log(`  syl[${idx}]: ${syl}`)
      },
      onDone: () => {
        console.log('[VoiceTest] Utterance complete')
      }
    })

    // Show text panel normally
    scene.textPanel.show({
      ...dialogue,
      irish:   dialogue.ga  || dialogue.irish   || '',
      english: dialogue.en  || dialogue.english || '',
      type: 'dialogue',
      speaker: npc.getData('name'),
      onDismiss: () => {
        voice.stop()   // cut voice if player dismisses before it finishes
        const nextIndex = (index + 1) % dialogues.length
        npc.setData('dialogueIndex', nextIndex)
        if (npc.getData('stateKey') && window.GameState)
          window.GameState.setNPCProgress(npc.getData('stateKey'), nextIndex)
      }
    })
  }

  // Clean up voices when scene shuts down
  const _originalShutdown = scene.shutdown?.bind(scene)
  scene.shutdown = function() {
    for (const v of Object.values(voiceMap)) {
      try { v.destroy() } catch(e) {}
    }
    console.log('[VoiceTest] Voices destroyed')
    if (_originalShutdown) _originalShutdown()
  }

  console.log('[VoiceTest] Ready — tap Bean an Chnuic to test')
}

// ─────────────────────────────────────────────────────────────────────────────
// STANDALONE DEMO — call this from the browser console to test audio directly
// without needing an NPC interaction:
//   import { demoVoice } from './voiceSynthTest.js'
//   demoVoice()
// ─────────────────────────────────────────────────────────────────────────────

export async function demoVoice(voiceName = 'beanAnChnuic') {
  const { createVoice, VOICES, irishSyllables } = await import('./voiceSynth.js')
  const voice = createVoice(VOICES[voiceName])

  const lines = [
    { text: "Ná bain leis an gcnoc.",      style: 'statement'    },
    { text: "Tá ár gcuid féin ann.",        style: 'statement'    },
    { text: "Ach más mian leat, éist.",     style: 'question'     },
  ]

  let i = 0
  function next() {
    if (i >= lines.length) { voice.destroy(); return }
    const { text, style } = lines[i++]
    console.log(`[Demo] "${text}"  (${style})`)
    console.log(`[Demo] syllables:`, irishSyllables(text))
    voice.speak(text, { mode: 'speech', style, onDone: () => setTimeout(next, 600) })
  }
  next()

  return voice   // return so caller can stop() it
}

