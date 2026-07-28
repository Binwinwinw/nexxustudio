export function extractResultContent(result) {
  if (typeof result === 'string') {
    return result;
  }

  if (typeof result?.content === 'string') {
    return result.content;
  }

  return '';
}

export function resolveStreamResult(streamedContent = '', finalResult = '') {
  const streamHasThinking = /<think>/i.test(String(streamedContent || ''));

  // Prefer server-cleaned final result when stream leaked internal thinking.
  if (finalResult && streamHasThinking) {
    return finalResult;
  }

  // SÉCURITÉ ANTI-DUPLICATION (V3.1.0)
  // Si le contenu streamé est massivement plus long que le résultat final (heuristique 1.5x)
  // et qu'il contient déjà le résultat final, c'est un signe de boucle onContent doublée.
  if (finalResult && streamedContent.length > finalResult.length * 1.5) {
    if (streamedContent.includes(finalResult)) {
      console.warn('[Resolver] Duplication massive détectée, retour au résultat final propre.');
      return finalResult;
    }
  }

  return finalResult && finalResult.length >= streamedContent.length
    ? finalResult
    : streamedContent;
}
