import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('❌ [CRITICAL] JWT_SECRET is missing from environment variables.');
  console.error('La Citadelle refuse de démarrer sans un secret JWT valide.');
  process.exit(1);
}
const TOKEN_EXPIRY = '24h';

class AuthService {
  /**
   * Génère un token JWT pour un utilisateur ou un agent
   */
  generateToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
  }

  /**
   * Vérifie la validité d'un token JWT
   */
  verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return null;
    }
  }

  /**
   * Hache un mot de passe avant stockage
   */
  async hashPassword(password) {
    const salt = await bcrypt.genSalt(12);
    return bcrypt.hash(password, salt);
  }

  /**
   * Compare un mot de passe en clair avec son hachage
   */
  async comparePassword(password, hash) {
    return bcrypt.compare(password, hash);
  }
}

export default new AuthService();
