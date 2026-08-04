import axios from 'axios';
import * as cheerio from 'cheerio';
import RobotsParser from 'robots-txt-parser';
import ollama from '../llm/ollama.js';
import { checkUrlPolicy, checkContentPolicy } from '../agent/policies/web/index.js';
import { sanitizeToolOutput } from './tool-output-sanitizer.js';
import { validateEgressUrl } from '../security/ssrfProtection.js';
import { classifyNetworkEgress } from '../hooks/networkEgressPolicy.js';

/**
 * webSummarizer - Lecture et résumé légal de pages web.
 */
export async function summarizeWebPage(url) {
  try {
    const egress = classifyNetworkEgress(
      { type: "http_request", toolName: "webSummarize", url },
      { isActive: () => false },
    );
    if (egress.decision === "deny") {
      throw new Error(`Egress refusé : ${egress.reason}`);
    }
    const ssrf = await validateEgressUrl(url);
    if (ssrf.blocked) {
      throw new Error(`Egress refusé (${ssrf.reason}) : ${url}`);
    }

    // 1. Check robots.txt (Légalité)
    const robots = RobotsParser();
    const urlObj = new URL(url);
    const robotsUrl = `${urlObj.origin}/robots.txt`;
    
    try {
      await robots.fetch(robotsUrl);
      if (typeof robots.isAllowed === 'function') {
        const isAllowed = robots.isAllowed(url, 'CitadelleBot/1.0');
        if (!isAllowed) {
          throw new Error('Accès refusé par le fichier robots.txt du site.');
        }
      }
    } catch (e) {
      console.warn(`[WebSummarizer] Impossible de vérifier robots.txt (${e.message}), poursuite prudente.`);
    }

    // 2. Fetch avec headers réalistes
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'NexxusCitadel/1.0 (research-agent; non-commercial; local-use)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8'
      },
      timeout: 10000  // 10s — conforme ADR-011 (timeout strict)
    });

    // Vérification de politique URL (ADR-011)
    const urlCheck = checkUrlPolicy(url);
    if (urlCheck.blocked) {
      throw new Error(`URL bloquée par politique souveraine : ${urlCheck.reason}`);
    }

    // 3. Parsing et Nettoyage
    const $ = cheerio.load(data);
    $('script, style, nav, footer, header, iframe, noscript').remove();
    
    const title = $('title').text().trim() || url;
    const text = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 10000);

    // Vérification du contenu (ADR-011 — blocage paywall/login)
    const contentCheck = checkContentPolicy(text);
    if (contentCheck.blocked) {
      throw new Error(`Contenu bloqué par politique souveraine : ${contentCheck.reason}`);
    }

    if (text.length < 50) {
      throw new Error('Contenu textuel insuffisant sur la page.');
    }

    // 4. Résumé via Ollama (qwen3.5:9b)
    const prompt = `RÉSUMÉ SOUVERAIN NEXXUS
Source : ${url}
Titre : ${title}

Contenu à analyser :
${text}

MISSION : Produire un résumé structuré et technique en français (environ 150-200 mots).`;

    // Utilisation de l'API locale ollama.js (messages, model, options)
    const summary = await ollama.chat(
      [{ role: 'user', content: prompt }],
      'qwen3.5:9b',
      { temperature: 0.2, num_predict: 1000 }
    );

    const cleanedSummary = sanitizeToolOutput(String(summary || ''), 'web-summary');

    return {
      success: true,
      url,
      title,
      summary: cleanedSummary.text,
      stats: {
        charCount: text.length,
        model: 'qwen3.5:9b',
        sanitization: cleanedSummary.flags,
      },
    };

  } catch (error) {
    console.error(`[WebSummarizer] Error scanning ${url}:`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
}
