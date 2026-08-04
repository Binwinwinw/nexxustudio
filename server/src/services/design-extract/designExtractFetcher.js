/**
 * Fetch HTML contrôlé pour Design Extract.
 */
import axios from 'axios';
import { AGENT_USER_AGENT } from '../../agent/policies/web/index.js';
import {
  DESIGN_EXTRACT_TIMEOUT_MS,
  DESIGN_EXTRACT_MAX_HTML_BYTES,
} from './designExtractPolicy.js';

/**
 * @param {string} url
 */
export async function fetchDesignExtractHtml(url) {
  const response = await axios.get(url, {
    headers: {
      'User-Agent': AGENT_USER_AGENT,
      Accept: 'text/html,application/xhtml+xml',
    },
    timeout: DESIGN_EXTRACT_TIMEOUT_MS,
    maxContentLength: DESIGN_EXTRACT_MAX_HTML_BYTES,
    responseType: 'text',
    validateStatus: (status) => status >= 200 && status < 400,
  });

  const html = String(response.data || '');
  if (html.length < 120) {
    throw new Error('HTML insuffisant pour extraction ADN.');
  }

  return {
    html,
    fetched_at: new Date().toISOString(),
    content_type: response.headers['content-type'] || 'text/html',
  };
}

export default fetchDesignExtractHtml;
