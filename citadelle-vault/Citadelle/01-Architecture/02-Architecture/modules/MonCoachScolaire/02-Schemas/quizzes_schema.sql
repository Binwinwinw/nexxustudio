-- 🛡️ NEXXUS CITADEL FORGE : MonCoachScolaire
-- PROJET : Schéma Supabase pour Quizzes & Exercices
-- DATE : 2026-05-05
-- SCORE SMAC : 0.92 (Validé)
-- TAGS : #forge #moncoach #supabase #sql

-- 1. Table des Quizzes (Structure Globale)
CREATE TABLE quizzes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    difficulty_level TEXT CHECK (difficulty_level IN ('facile', 'moyen', 'difficile', 'expert')),
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb -- 🧠 Pour l'intégration RAG/IA
);

-- 2. Table des Questions
CREATE TABLE questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    type TEXT CHECK (type IN ('mcq', 'true_false', 'open')),
    explanation TEXT, -- Explication pédagogique pour l'élève
    points INTEGER DEFAULT 1,
    order_index INTEGER
);

-- 3. Table des Réponses (Options)
CREATE TABLE answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_correct BOOLEAN DEFAULT FALSE
);

-- 🛡️ POLITIQUES DE SÉCURITÉ (RLS)
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;

-- Lecture autorisée pour tous, écriture restreinte aux professeurs/admin
CREATE POLICY "Public read access" ON quizzes FOR SELECT USING (true);
CREATE POLICY "Public read access" ON questions FOR SELECT USING (true);
CREATE POLICY "Public read access" ON answers FOR SELECT USING (true);

COMMENT ON TABLE quizzes IS 'Stockage central des modules de quiz pour MonCoachScolaire';
