import { looksLooping } from './qualityGuards.js';
import responseThinkingCleaner from './responseThinkingCleaner.js';
import { recoverVisibleFromFullResponse } from './genericGreetingGuards.js';

const THINK_TAG_OPEN = '<' + 'redacted_thinking' + '>';
const THINK_TAG_CLOSE = '</' + 'redacted_thinking' + '>';
const THINK_TAG_CLOSE_LEGACY = '</' + 'think' + '>';
const ACTION_TAG_OPEN = '<action>';
const ACTION_TAG_CLOSE = '</action>';
const READY_TAG = '[READY]';

function findThinkClose(buffer) {
  const candidates = [
    { index: buffer.indexOf(THINK_TAG_CLOSE), length: THINK_TAG_CLOSE.length },
    {
      index: buffer.indexOf(THINK_TAG_CLOSE_LEGACY),
      length: THINK_TAG_CLOSE_LEGACY.length,
    },
  ].filter((c) => c.index !== -1);

  if (candidates.length === 0) {
    return { index: -1, length: 0 };
  }

  candidates.sort((a, b) => a.index - b.index);
  return candidates[0];
}

class OllamaStreamProcessor {
  constructor({ onLoopDetected, onReady, onChunk, onThought } = {}) {
    this.onLoopDetected = onLoopDetected;
    this.onReady = onReady;
    this.onChunk = onChunk;
    this.onThought = onThought;
    this.reset();
  }

  reset() {
    this.currentResponse = '';
    this.fullResponse = '';
    this.state = 'TEXT';
    this.buffer = '';
    this.penseurLoopDetected = false;
    this.penseurRaw = '';
    this.currentThought = '';
    this.currentAction = '';
  }

  processToken(token) {
    if (this.penseurLoopDetected) {
      return;
    }

    this.fullResponse += token;
    this.penseurRaw += token;
    this.buffer += token;

    if (this.penseurRaw.length > 300) {
      const tail = this.penseurRaw.slice(-1200);
      if (looksLooping(tail)) {
        this.penseurLoopDetected = true;
        if (this.onLoopDetected) {
          this.onLoopDetected();
        }
        return;
      }
    }

    // console.log(`[StreamProcessor] processToken. State: ${this.state}, Token: "${token}", Buffer: "${this.buffer}"`);

    while (this.buffer.length > 0) {
      if (this.state === 'TEXT') {
        const thoughtIndex = this.buffer.indexOf(THINK_TAG_OPEN);
        const actionIndex = this.buffer.indexOf(ACTION_TAG_OPEN);
        const readyIndex = this.buffer.toUpperCase().indexOf(READY_TAG);
        
        // Support de secours pour les pensées en texte clair
        const plainThinkingMarkers = [
          'Thinking Process:', 'Thinking Process\n', '**Thinking Process:**',
          'Reasoning:', 'Reasoning\n', '**Reasoning:**',
          'Thinking:', 'Thinking\n', '**Thinking:**',
          'Thoughts:', 'Thoughts\n', '**Thoughts:**',
          'Raisonnement:', 'Raisonnement\n', '**Raisonnement:**'
        ];
        
        let plainThinkingIndex = -1;
        let plainThinkingLen = 0;
        for (const marker of plainThinkingMarkers) {
          const idx = this.buffer.indexOf(marker);
          if (idx !== -1 && (plainThinkingIndex === -1 || idx < plainThinkingIndex)) {
            plainThinkingIndex = idx;
            plainThinkingLen = marker.length;
          }
        }
        
        let nextTagIndex = -1;
        const candidates = [
          { idx: thoughtIndex, len: THINK_TAG_OPEN.length, state: 'THINK' },
          { idx: actionIndex, len: ACTION_TAG_OPEN.length, state: 'ACTION' },
          { idx: readyIndex, len: READY_TAG.length, state: 'READY' },
          { idx: plainThinkingIndex, len: plainThinkingLen, state: 'PLAIN_THINK' }
        ].filter(c => c.idx !== -1);

        if (candidates.length > 0) {
          candidates.sort((a, b) => a.idx - b.idx);
          nextTagIndex = candidates[0].idx;
        }

        if (nextTagIndex === -1) {
          const tags = [THINK_TAG_OPEN, ACTION_TAG_OPEN, READY_TAG];
          let keepLen = 0;
          for (const tag of tags) {
            for (let i = 1; i < tag.length; i++) {
              const prefix = tag.slice(0, i);
              if (this.buffer.toUpperCase().endsWith(prefix.toUpperCase())) {
                keepLen = Math.max(keepLen, i);
              }
            }
          }
          
          const chunk = this.buffer.slice(0, this.buffer.length - keepLen);
          if (chunk) {
            this.currentResponse += chunk;
            if (this.onChunk) this.onChunk(chunk);
          }
          this.buffer = this.buffer.slice(this.buffer.length - keepLen);
          break; // Sortie de boucle car on attend la suite du préfixe
        } else {
          const chunk = this.buffer.slice(0, nextTagIndex);
          if (chunk) {
            this.currentResponse += chunk;
            if (this.onChunk) this.onChunk(chunk);
          }
          
          const matched = candidates[0];
          this.buffer = this.buffer.slice(nextTagIndex + matched.len);
          
          if (matched.state === 'THINK') {
            this.state = 'THINK';
            this.currentThought = '';
          } else if (matched.state === 'PLAIN_THINK') {
            this.state = 'PLAIN_THINK';
            this.currentThought = '';
          } else if (matched.state === 'ACTION') {
            this.state = 'ACTION';
            this.currentAction = '';
          } else if (matched.state === 'READY') {
            this.buffer = '';
            if (this.onReady) {
              this.onReady();
            }
          }
        }
      } else if (this.state === 'PLAIN_THINK') {
        // La pensée en texte clair s'arrête dès qu'un marqueur de transition (salutation, signature ou titre) est rencontré
        const transitionMarkers = [
          'Je suis NEXXUS', 'NEXXUS :', 'En tant que NEXXUS',
          'Le Jugement de la Citadelle', 'Le comparatif', 'Voici le comparatif',
          '### ', '## ', '# '
        ];
        
        let transitionIndex = -1;
        for (const marker of transitionMarkers) {
          const idx = this.buffer.indexOf(marker);
          if (idx !== -1 && (transitionIndex === -1 || idx < transitionIndex)) {
            transitionIndex = idx;
          }
        }
        
        if (transitionIndex === -1) {
          this.currentThought += this.buffer;
          this.buffer = '';
          break;
        } else {
          const thoughtPart = this.buffer.slice(0, transitionIndex);
          this.currentThought += thoughtPart;
          if (this.onThought) this.onThought(this.currentThought);
          this.state = 'TEXT';
          // On réinjecte le marqueur dans le buffer pour qu'il soit traité comme texte normal visible
          this.buffer = this.buffer.slice(transitionIndex);
        }
      } else if (this.state === 'THINK') {
        const { index: endThoughtIndex, length: closeLen } = findThinkClose(
          this.buffer,
        );
        if (endThoughtIndex === -1) {
          const endTags = [THINK_TAG_CLOSE, THINK_TAG_CLOSE_LEGACY];
          let keepLen = 0;
          for (const endTag of endTags) {
            for (let i = 1; i < endTag.length; i++) {
              const prefix = endTag.slice(0, i);
              if (this.buffer.endsWith(prefix)) {
                keepLen = Math.max(keepLen, i);
              }
            }
          }

          const chunk = this.buffer.slice(0, this.buffer.length - keepLen);
          this.currentThought += chunk;
          this.buffer = this.buffer.slice(this.buffer.length - keepLen);
          break;
        } else {
          const thoughtPart = this.buffer.slice(0, endThoughtIndex);
          this.currentThought += thoughtPart;
          if (this.onThought) this.onThought(this.currentThought);
          this.state = 'TEXT';
          this.buffer = this.buffer.slice(endThoughtIndex + closeLen);
        }
      } else if (this.state === 'ACTION') {
        const endActionIndex = this.buffer.indexOf(ACTION_TAG_CLOSE);
        if (endActionIndex === -1) {
          const endTag = ACTION_TAG_CLOSE;
          let keepLen = 0;
          for (let i = 1; i < endTag.length; i++) {
            const prefix = endTag.slice(0, i);
            if (this.buffer.endsWith(prefix)) {
              keepLen = i;
            }
          }
          
          const chunk = this.buffer.slice(0, this.buffer.length - keepLen);
          this.currentAction += chunk;
          this.buffer = this.buffer.slice(this.buffer.length - keepLen);
          break;
        } else {
          this.currentAction += this.buffer.slice(0, endActionIndex);
          this.state = 'TEXT';
          this.buffer = this.buffer.slice(endActionIndex + ACTION_TAG_CLOSE.length);
        }
      }
    }
  }

  finalize() {
    if (this.buffer) {
      if (this.state === 'TEXT') {
        this.currentResponse += this.buffer;
      } else if (this.state === 'THINK' || this.state === 'PLAIN_THINK') {
        this.currentThought += this.buffer;
        if (this.onThought) this.onThought(this.currentThought);
      } else if (this.state === 'ACTION') {
        this.currentAction += this.buffer;
      }
      this.buffer = '';
    }

    // Nettoyage de résilience de sécurité supplémentaire : si le modèle a écrit des en-têtes
    // de pensée en texte clair au tout début sans utiliser de balises XML, on les retire proprement.
    if (this.currentResponse.trim()) {
      let cleanedResponse = this.currentResponse.trim();
      const leakedThinkingRegex = /^(?:\*\*|#|\s|\*|-)*(?:Thinking Process|Reasoning|Thinking|Raisonnement|Thoughts|Review|Execution|Start with|Point \d+|Step \d+|Final Review|Attempt \d+|Draft|Plan|Conclude|Present)\s*(?::|-)?(?:\*\*|#|\s)*[\s\S]*?(?=(?:Je suis NEXXUS|NEXXUS\s*:|En tant que NEXXUS|Le\s+\S+\s+de la Citadelle|#+\s+Le\s+\S+\s+de la Citadelle|#+\s+[^#\n]+Dragon Ball|#+\s+[^#\n]+RAPPORT|⚔️|##?\s+[^#\n]+))/i;
      const match = cleanedResponse.match(leakedThinkingRegex);
      if (match) {
        console.log(`[StreamProcessor] Leaked plain-text thinking block detected in finalize and stripped (length: ${match[0].length})`);
        this.currentThought += "\n[Leaked Plain-Text Thinking Stripped]\n" + match[0];
        this.currentResponse = cleanedResponse.slice(match[0].length).trim();
      }
    }

    // Deuxième couche de sécurité : rejeter les réponses visibles qui ne contiennent qu'un plan technique en anglais
    if (this.currentResponse.trim()) {
      const textToCheck = this.currentResponse.trim();
      const isEnglishPlan = /^(?:\*\*|#|\s|\*|-)*(?:Thinking Process|Reasoning|Thinking|Raisonnement|Thoughts|Review|Execution|Start with|Point \d+|Step \d+|Final Review|Attempt \d+|Draft|Plan|Conclude|Present)/i.test(textToCheck)
        && (textToCheck.includes("need to") || textToCheck.includes("should") || textToCheck.includes("must") || textToCheck.includes("first") || textToCheck.includes("then") || textToCheck.includes("we will"));
        
      if (isEnglishPlan) {
        console.log(`[StreamProcessor] Whole response detected as leaked plain-text English plan. Clearing response to trigger recovery.`);
        this.currentThought += "\n[Leaked English Plan Stripped]\n" + this.currentResponse;
        this.currentResponse = '';
      }
    }

    // Filet final : nettoyage des pensées résiduelles sur la réponse visible
    if (this.currentResponse.trim()) {
      this.currentResponse = responseThinkingCleaner
        .clean(this.currentResponse)
        .trim();
    }

    // Sauvegarde de résilience : si la réponse visible est vide mais qu'on a du contenu de pensée,
    // on extrait ce qui ressemble au message final (ex: après "Draft:", "Attempt X:", ou "Réponse:")
    // pour éviter les pages blanches et les échecs de régression.
    if (!this.currentResponse.trim() && this.currentThought.trim()) {
      let cleaned = this.currentThought
        .replace(/<think>|<\/think>/gi, '')
        .trim();

      const markers = [
        /Draft\s*(?:\*\s*)?:\s*/i,
        /Attempt\s*\d+\s*(?:\*\s*)?:\s*/i,
        /Réponse\s*(?:\*\s*)?:\s*/i,
        /Message\s*(?:\*\s*)?:\s*/i,
        /Final\s*Draft\s*(?:\*\s*)?:\s*/i,
        /Final\s*Response\s*(?:\*\s*)?:\s*/i,
        /Elegant\s*&\s*Direct\s*(?:\*\s*)?:\s*/i
      ];

      let foundMarker = false;
      for (const marker of markers) {
        const match = cleaned.match(marker);
        if (match) {
          const index = match.index + match[0].length;
          const candidate = cleaned.slice(index).trim();
          if (candidate.length > 10) {
            const isEnglishPlan = /^(?:\*\*|#|\s|\*|-)*(?:Thinking Process|Reasoning|Thinking|Raisonnement|Thoughts|Review|Execution|Start with|Point \d+|Step \d+|Final Review|Attempt \d+|Draft|Plan|Conclude|Present)/i.test(candidate)
              && (candidate.includes("need to") || candidate.includes("should") || candidate.includes("must") || candidate.includes("first") || candidate.includes("then") || candidate.includes("we will"));
              
            if (!isEnglishPlan) {
              this.currentResponse = candidate;
              foundMarker = true;
              break;
            }
          }
        }
      }

      if (!foundMarker) {
        // Fallback ultime sécurisé : si aucun marqueur ou si le contenu extrait est un plan technique / contient des blocs nettoyés de sécurité
        const hasStrippedBlock = cleaned.includes("[Leaked English Plan Stripped]") || cleaned.includes("[Leaked Plain-Text Thinking Stripped]");
        const isEnglishPlan = hasStrippedBlock ||
          (/Reasoning|Thinking|Raisonnement|Thoughts|Review|Execution|Start with|Point \d+|Step \d+|Final Review|Attempt \d+|Draft|Plan/i.test(cleaned)
          && (cleaned.includes("need to") || cleaned.includes("should") || cleaned.includes("must") || cleaned.includes("first") || cleaned.includes("then") || cleaned.includes("we will")));
          
        if (!isEnglishPlan) {
          this.currentResponse = cleaned;
        } else {
          const recovered = recoverVisibleFromFullResponse(this.fullResponse);
          this.currentResponse = recovered;
          if (!recovered) {
            console.log(
              "[StreamProcessor] English plan stripped with no recoverable visible payload.",
            );
          }
        }
      }

      // Déclencher le callback onChunk pour synchroniser les flux streamés et la réponse finale
      if (this.onChunk && this.currentResponse) {
        this.onChunk(this.currentResponse);
      }
    }

    if (!this.currentResponse.trim()) {
      const recovered = recoverVisibleFromFullResponse(this.fullResponse);
      if (recovered) {
        this.currentResponse = recovered;
        if (this.onChunk) this.onChunk(this.currentResponse);
      }
    }
  }

  getResult() {
    return {
      currentResponse: this.currentResponse,
      fullResponse: this.fullResponse,
      currentThought: this.currentThought,
      currentAction: this.currentAction
    };
  }
}

export default OllamaStreamProcessor;
