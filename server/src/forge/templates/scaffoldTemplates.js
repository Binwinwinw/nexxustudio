/* server/src/forge/templates/scaffoldTemplates.js */

export const SCAFFOLD_TEMPLATES = {
  'react-vite': {
    description: "Modern React WebApp with Vite and TailwindCSS",
    files: {
      'package.json': (projectTitle) => JSON.stringify({
        name: projectTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        private: true,
        version: "0.1.0",
        type: "module",
        scripts: {
          "dev": "vite",
          "build": "vite build",
          "preview": "vite preview"
        },
        dependencies: {
          "react": "^18.3.1",
          "react-dom": "^18.3.1",
          "lucide-react": "^0.395.0"
        },
        devDependencies: {
          "@types/react": "^18.3.3",
          "@types/react-dom": "^18.3.0",
          "@vitejs/plugin-react": "^4.3.1",
          "autoprefixer": "^10.4.19",
          "postcss": "^8.4.38",
          "tailwindcss": "^3.4.4",
          "vite": "^5.3.1"
        }
      }, null, 2),
      'tailwind.config.mjs': () => `/** @type {import('tailwindcss').Config} */\nexport default {\n  content: [\n    "./index.html",\n    "./src/**/*.{js,ts,jsx,tsx}",\n  ],\n  theme: {\n    extend: {},\n  },\n  plugins: [],\n};`,
      'postcss.config.js': () => `export default {\n  plugins: {\n    tailwindcss: {},\n    autoprefixer: {},\n  },\n};`,
      'vite.config.js': () => `import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\n\nexport default defineConfig({\n  plugins: [react()],\n});`,
      'index.html': (projectTitle) => `<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <link rel="icon" type="image/svg+xml" href="/vite.svg" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>${projectTitle}</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.jsx"></script>\n  </body>\n</html>`,
      'src/main.jsx': () => `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App.jsx';\nimport './index.css';\n\nReactDOM.createRoot(document.getElementById('root')).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>,\n);`,
      'src/index.css': () => `@tailwind base;\n@tailwind components;\n@tailwind utilities;`,
      'src/App.jsx': () => `function App() {\n  return (\n    <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-4">\n      <h1 className="text-4xl font-bold mb-4">Nexxus Citadel Forge</h1>\n      <p className="text-neutral-400">Projet initialisé avec succès.</p>\n    </div>\n  );\n}\n\nexport default App;`
    }
  },
  'node-express': {
    description: "Standard Node.js API with Express",
    files: {
      'package.json': (projectTitle) => JSON.stringify({
        name: projectTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        version: "1.0.0",
        main: "src/index.js",
        type: "module",
        scripts: {
          "start": "node src/index.js",
          "dev": "nodemon src/index.js"
        },
        dependencies: {
          "express": "^4.19.2",
          "dotenv": "^16.4.5"
        },
        devDependencies: {
          "nodemon": "^3.1.2"
        }
      }, null, 2),
      'src/index.js': () => `import express from 'express';\nimport dotenv from 'dotenv';\ndotenv.config();\n\nconst app = express();\nconst PORT = process.env.PORT || 3000;\n\napp.use(express.json());\n\napp.get('/', (req, res) => {\n  res.json({ message: 'Nexxus Forge Node Backend Ready' });\n});\n\napp.listen(PORT, () => {\n  console.log(\`Server running on port \${PORT}\`);\n});`,
      '.env': () => `PORT=3000\nNODE_ENV=development`
    }
  },
  'static-html': {
    description: "Vanilla HTML/CSS/JS Prototype",
    files: {
      'index.html': (projectTitle) => `<!DOCTYPE html>\n<html>\n<head>\n  <title>${projectTitle}</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <h1>${projectTitle}</h1>\n  <script src="script.js"></script>\n</body>\n</html>`,
      'style.css': () => `body { font-family: sans-serif; background: #fafafa; padding: 2rem; }`,
      'script.js': () => `console.log('Nexxus Forge Static Ready');`
    }
  }
};
