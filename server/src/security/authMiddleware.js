import authService from './authService.js';

export const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const xApiToken = req.headers['x-api-token'];

  // 1. Support du Token Interne (Prioritaire pour les scripts/Forge)
  if (xApiToken && xApiToken === process.env.INTERNAL_API_TOKEN) {
    req.user = { id: 'internal_agent', role: 'architect' };
    return next();
  }

  // 2. Support du JWT standard
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: "Authentification requise. Format: Bearer <token> ou X-API-Token" });
  }

  const token = authHeader.split(' ')[1];
  const decoded = authService.verifyToken(token);

  if (!decoded) {
    return res.status(401).json({ error: "Token invalide ou expiré." });
  }

  // Injecter les données de l'utilisateur/agent dans la requête
  req.user = decoded;
  next();
};
