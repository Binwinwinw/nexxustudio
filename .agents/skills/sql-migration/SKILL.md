---
name: sql-migration
description: Génère un script SQL MySQL sûr, rejouable et compatible phpMyAdmin pour MonCoachScolaire. Utiliser pour ajouter des colonnes, créer des index, modifier des structures de tables, ou écrire des triggers. Ne renumérote jamais les PK référencées. Inclut requêtes de validation post-exécution.
argument-hint: [description de la migration]
---

# Skill — SQL Migration Safe

## Objectif

Produire un script SQL MySQL sûr, idempotent et rejouable pour phpMyAdmin.

## Tables principales du projet

```sql
users           -- Utilisateurs (id, name, email, level, role, created_at)
exercises       -- Exercices (id, title, subject, level, type, content, difficulty)
user_exercises  -- Progression (id, user_id, exercise_id, score, completed_at)
courses         -- Cours (id, title, subject, level, content)
quiz_results    -- Résultats quiz (id, user_id, quiz_id, score, completed_at)
```

## Règles obligatoires

### 1. Idempotence — vérifier avant d'ajouter

```sql
-- Ajouter une colonne si elle n'existe pas
ALTER TABLE `exercises`
  ADD COLUMN IF NOT EXISTS `difficulty` TINYINT UNSIGNED NOT NULL DEFAULT 1;

-- Ajouter un index si il n'existe pas
ALTER TABLE `user_exercises`
  ADD INDEX IF NOT EXISTS `idx_user_exercise` (`user_id`, `exercise_id`);
```

### 2. Jamais de renumérotation PK référencée

```sql
-- ❌ INTERDIT : ALTER TABLE MODIFY id INT AUTO_INCREMENT
-- Si une colonne id est référencée par FK, ne jamais la modifier

-- ✅ CORRECT : Ajouter une nouvelle colonne plutôt que retravailler l'existant
ALTER TABLE `exercises` ADD COLUMN `external_ref` VARCHAR(64) NULL DEFAULT NULL;
```

### 3. DELIMITER pour triggers et procédures

```sql
DELIMITER //

CREATE TRIGGER `after_exercise_complete`
AFTER UPDATE ON `user_exercises`
FOR EACH ROW
BEGIN
  IF NEW.completed = 1 AND OLD.completed = 0 THEN
    UPDATE `users` SET `xp` = `xp` + 10 WHERE `id` = NEW.user_id;
  END IF;
END //

DELIMITER ;
```

### 4. Transactions pour migrations multi-étapes

```sql
START TRANSACTION;

ALTER TABLE `exercises` ADD COLUMN IF NOT EXISTS `tags` JSON NULL;
ALTER TABLE `exercises` ADD INDEX IF NOT EXISTS `idx_level_subject` (`level`, `subject`);

-- Vérifier avant commit
SELECT COUNT(*) FROM `exercises` WHERE `tags` IS NOT NULL;

COMMIT;
-- En cas d'erreur : ROLLBACK;
```

### 5. Fichier de migration nommé correctement

Convention : `db/migration_<description>_<AAAAMMJJ>.sql`

```
db/migration_add_indexes_20260227.sql
db/migration_add_lycee_bac_quiz_20260306.sql
```

## Template de migration complet

```sql
-- ============================================================
-- Migration : <description courte>
-- Date       : <AAAA-MM-JJ>
-- Contexte   : <pourquoi cette migration>
-- Rejouable  : OUI (IF NOT EXISTS / IF EXISTS)
-- ============================================================

-- 1. Vérification préalable (optionnel)
SELECT COUNT(*) AS `nb_exercises` FROM `exercises`;

-- 2. Modifications structurelles
ALTER TABLE `exercises`
  ADD COLUMN IF NOT EXISTS `source_file` VARCHAR(255) NULL DEFAULT NULL COMMENT 'Fichier JSON source',
  ADD INDEX IF NOT EXISTS `idx_type_level` (`type`, `level`);

-- 3. Données initiales si besoin
INSERT IGNORE INTO `exercises` (`id`, `title`, `subject`, `level`, `type`)
VALUES (999, 'Test', 'Maths', 'seconde', 'qcm');

-- 4. Validation post-migration
SELECT
  COUNT(*) AS `total`,
  SUM(CASE WHEN `source_file` IS NOT NULL THEN 1 ELSE 0 END) AS `avec_source`
FROM `exercises`;
```

## Commandes phpMyAdmin

1. Ouvrir phpMyAdmin → Sélectionner la base `moncoachscolaire`
2. Onglet **SQL** → Coller le script → **Exécuter**
3. Vérifier le résultat des requêtes de validation
4. En cas d'erreur : voir l'historique phpMyAdmin → copier le message exact

## Rollback

```sql
-- Annuler l'ajout d'une colonne
ALTER TABLE `exercises` DROP COLUMN IF EXISTS `source_file`;

-- Supprimer un index
ALTER TABLE `exercises` DROP INDEX IF EXISTS `idx_type_level`;
```

## Vérification de conformité

```sql
-- Vérifier les colonnes d'une table
SHOW COLUMNS FROM `exercises`;

-- Vérifier les index
SHOW INDEX FROM `exercises`;

-- Vérifier les FK
SELECT * FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'moncoachscolaire' AND TABLE_NAME = 'user_exercises';
```
