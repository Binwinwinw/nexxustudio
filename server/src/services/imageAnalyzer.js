import sharp from 'sharp';
import { createWorker } from 'tesseract.js';
import ollama from '../llm/ollama.js';
import knowledgeHub from './knowledgeHub.js';
import { MODEL_CONFIG } from '../config/models.js';

const PRIMARY_MODEL =
  process.env.NEXXUS_VISION_MODEL ||
  MODEL_CONFIG.TIER_3_EXPERTS.vision.model ||
  'gemma4:12b';
const OCR_MODEL =
  process.env.NEXXUS_VISION_OCR_MODEL ||
  MODEL_CONFIG.TIER_3_EXPERTS.ocr.model ||
  'deepseek-ocr:latest';
/** Fallback VL/OCR si primaire plante (OOM, archi, etc.). */
const FALLBACK_MODEL =
  process.env.NEXXUS_VISION_FALLBACK_MODEL || OCR_MODEL;
const OCR_LANG = 'fra+eng';
const OCR_ENABLED = process.env.NEXXUS_VISION_OCR === '1';

function isVisionEngineIncompatible(error) {
  const msg = String(error?.message || error || '').toLowerCase();
  return (
    msg.includes('unknown model architecture') ||
    msg.includes("'mllama'") ||
    msg.includes('mllama') ||
    msg.includes('llama3.2-vision is not yet supported') ||
    msg.includes('no longer compatible with your version of ollama')
  );
}

/** Gemma4 vision met souvent la description dans thinking ; content vide. */
function unwrapVisionReply(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const m = s.match(/<think>([\s\S]*?)<\/think>\s*([\s\S]*)$/i);
  if (m) {
    const think = m[1].trim();
    const body = m[2].trim();
    return body || think;
  }
  return s;
}

function buildVisionPrompt(ocrText) {
  return [
    'Tu es Nexxus, analyseur visuel local de La Citadelle.',
    "Décris précisément ce que tu vois sur l'image.",
    'Si du texte est visible, lis-le et signale les éventuelles zones ambiguës.',
    "Si c'est une capture d'écran, repère interfaces, boutons, logs, erreurs, code, menus, métriques et liens.",
    'Réponds en français avec une structure claire : résumé, éléments visibles, texte détecté, hypothèses, points d\'attention.',
    ocrText
      ? `OCR détecté par Tesseract : ${ocrText}`
      : 'OCR détecté : aucun texte lisible.',
  ].join('\n');
}

function buildFallbackPrompt() {
  return [
    'Analyse cette image (capture UI / document / photo).',
    '1) Extrais tout le texte visible (OCR fidèle).',
    '2) Décris brièvement la mise en page, les zones UI et le contexte.',
    'Réponds en français, concret, sans inventer ce qui n\'est pas visible.',
  ].join('\n');
}

/**
 * ocrImage - Extraction de texte via DeepSeek-OCR (avec Tesseract.js en fallback)
 */
async function ocrImage(buffer) {
  try {
    const ocrAnalysis = await ollama.chat(
      [
        {
          role: 'user',
          content:
            'Extrait tout le texte de cette image avec une grande précision. Ne renvoie que le texte brut extrait, sans commentaire supplémentaire.',
          images: [buffer.toString('base64')],
        },
      ],
      OCR_MODEL,
    );

    if (ocrAnalysis && ocrAnalysis.trim().length > 0) {
      return ocrAnalysis.trim();
    }
  } catch (error) {
    console.warn(
      `[Vision][OCR] Erreur DeepSeek-OCR, tentative de fallback Tesseract: ${error.message}`,
    );
  }

  // Tesseract Fallback
  let worker = null;
  try {
    worker = await createWorker(OCR_LANG);
    const { data } = await worker.recognize(buffer);
    return (data.text || '').trim();
  } catch (error) {
    console.warn(`[Vision][OCR] OCR Tesseract indisponible: ${error.message}`);
    return '';
  } finally {
    if (worker) {
      await worker.terminate().catch(() => {});
    }
  }
}

async function chatVision(model, base64Image, prompt) {
  // Gemma4 vision brûle souvent le budget dans `thinking` — num_predict bas = coupe.
  return ollama.chat(
    [
      {
        role: 'user',
        content: prompt,
        images: [base64Image],
      },
    ],
    model,
    {
      model,
      temperature: 0.2,
      num_predict: Number(process.env.NEXXUS_VISION_NUM_PREDICT) || 1024,
    },
  );
}

/**
 * analyzeImage - Analyse multimodale complète (OCR + Vision)
 */
export async function analyzeImage(inputBuffer, options = {}) {
  const { filename = 'image', maxSize = 1536 } = options;

  try {
    console.log(`[Vision] 👁️ Analyse de ${filename} via ${PRIMARY_MODEL}...`);

    // 1. Préparation de l'image (Sharp)
    const preparedBuffer = await sharp(inputBuffer)
      .rotate()
      .resize({
        width: maxSize,
        height: maxSize,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .png()
      .toBuffer();

    // 2. OCR best-effort + Conversion Base64 en parallèle
    const [ocrText, base64Image] = await Promise.all([
      OCR_ENABLED ? ocrImage(preparedBuffer) : Promise.resolve(''),
      Promise.resolve(preparedBuffer.toString('base64')),
    ]);

    let analysis = '';
    let modelUsed = PRIMARY_MODEL;

    // 3. Appel multimodal primaire
    try {
      analysis = unwrapVisionReply(
        await chatVision(
          PRIMARY_MODEL,
          base64Image,
          buildVisionPrompt(ocrText),
        ),
      );
      if (!analysis) {
        throw new Error(`Vision reply empty from ${PRIMARY_MODEL}`);
      }
    } catch (primaryError) {
      const canFallback =
        FALLBACK_MODEL &&
        FALLBACK_MODEL !== PRIMARY_MODEL &&
        (isVisionEngineIncompatible(primaryError) ||
          /empty|oom|out of memory|status code 5\d\d/i.test(
            String(primaryError.message || ''),
          ));
      if (canFallback) {
        console.warn(
          `[Vision] Primaire ${PRIMARY_MODEL} échec (${primaryError.message}). Fallback → ${FALLBACK_MODEL}`,
        );
        modelUsed = FALLBACK_MODEL;
        analysis = unwrapVisionReply(
          await chatVision(
            FALLBACK_MODEL,
            base64Image,
            buildFallbackPrompt(),
          ),
        );
        if (!analysis) {
          throw new Error(`Vision fallback empty from ${FALLBACK_MODEL}`);
        }
      } else {
        throw primaryError;
      }
    }

    const result = {
      filename,
      model: modelUsed,
      ocrText,
      visionAnalysis: analysis,
      hasText: Boolean(ocrText),
      bufferSize: preparedBuffer.length,
      timestamp: new Date().toISOString(),
      fallbackUsed: modelUsed !== PRIMARY_MODEL,
    };

    // 4. Sauvegarde dans la Mémoire Vectorielle Souveraine (Knowledge Hub)
    try {
      await knowledgeHub.addDocuments([
        {
          id: `vision_${Date.now()}_${filename.replace(/[^a-z0-9]/gi, '_')}`,
          content: `[VISION][${filename}] Analysis: ${analysis}\nOCR detected: ${ocrText || 'none'}`,
          metadata: {
            type: 'vision',
            project: 'citadel',
            category: 'visual_intelligence',
            source: filename,
            source_display_name: `Capture: ${filename}`,
            title: `Visual Analysis - ${filename}`,
            ingest_origin: 'vision_pipeline',
            tags: ['vision', 'ocr', filename.split('.').pop() || 'image'],
            status: 'active',
            version: '1.0',
            model: modelUsed,
          },
        },
      ]);
    } catch (err) {
      console.warn(
        `[Vision] Failed to persist knowledge for ${filename}:`,
        err.message,
      );
    }

    return result;
  } catch (error) {
    console.error(`[Vision] Erreur lors de l'analyse de ${filename}:`, error.message);
    throw error;
  }
}

/**
 * analyzeImageFile - Helper pour analyser un fichier physique
 */
export async function analyzeImageFile(filePath) {
  const buffer = await sharp(filePath).toBuffer();
  return analyzeImage(buffer, { filename: filePath.split(/[\\/]/).pop() });
}
