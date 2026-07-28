import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

/**
 * Syntax Proxy (Fiabilité v3.5)
 * Valide les blocs de code avant publication.
 */
class SyntaxProxy {
  /**
   * Vérifie la syntaxe des blocs de code dans une réponse
   * @param {string} text 
   */
  async check(text = '') {
    const codeBlocks = this.extractCodeBlocks(text);
    const results = [];

    for (const block of codeBlocks) {
      if (['javascript', 'js', 'typescript', 'ts', 'jsx', 'tsx'].includes(block.lang)) {
        const lintResult = await this.lintCode(block.code, block.lang);
        results.push({ ...block, ...lintResult });
      } else {
        // Pour les autres langages, on fait un check de parenthèses basique
        results.push({ ...block, valid: this.checkBrackets(block.code), reason: 'basic_bracket_check' });
      }
    }

    const invalid = results.filter(r => !r.valid);
    return {
      allValid: invalid.length === 0,
      details: results,
      summary: invalid.map(i => `[${i.lang}] ${i.reason}`).join(', ')
    };
  }

  extractCodeBlocks(text) {
    const regex = /```(.*?)\n([\s\S]*?)```/g;
    const blocks = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      blocks.push({
        lang: match[1].trim() || 'text',
        code: match[2]
      });
    }
    return blocks;
  }

  checkBrackets(code) {
    const stack = [];
    const pairs = { '{': '}', '[': ']', '(': ')' };
    for (const char of code) {
      if (pairs[char]) {
        stack.push(char);
      } else if (Object.values(pairs).includes(char)) {
        if (pairs[stack.pop()] !== char) return false;
      }
    }
    return stack.length === 0;
  }

  async lintCode(code, lang) {
    // Fast check first
    if (!this.checkBrackets(code)) return { valid: false, reason: 'unclosed_brackets' };
    if (code.includes('import {') && !code.includes('from')) return { valid: false, reason: 'broken_import' };

    // Async ESLint check (Simple one-liner)
    const tmpFile = path.join(os.tmpdir(), `nexxus_lint_${Date.now()}.${lang.includes('ts') ? 'ts' : 'js'}`);
    try {
      await fs.writeFile(tmpFile, code);
      // On utilise --no-eslintrc pour éviter les conflits et on check juste la syntaxe
      execSync(`npx eslint ${tmpFile} --no-eslintrc --parser-options=ecmaVersion:latest,sourceType:module`, { stdio: 'ignore' });
      return { valid: true };
    } catch (e) {
      return { valid: false, reason: 'eslint_syntax_error' };
    } finally {
      await fs.remove(tmpFile);
    }
  }
}

export default new SyntaxProxy();
