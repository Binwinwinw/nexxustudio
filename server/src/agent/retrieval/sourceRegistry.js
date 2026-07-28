import codeSearchSource from './codeSearchSource.js';
import logSearchSource from './logSearchSource.js';
import dbSource from './dbSource.js';
import webSearchSource from './webSearchSource.js';
// Add others like docsSource and memorySource later

const adapters = {
  code: codeSearchSource,
  logs: logSearchSource,
  db: dbSource,
  web: webSearchSource
};

export function getSourceAdapters(allowedSources) {
  return allowedSources
    .filter(source => adapters[source])
    .map(source => adapters[source]);
}
