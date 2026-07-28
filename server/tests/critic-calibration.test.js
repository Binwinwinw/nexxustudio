import test from 'node:test';
import assert from 'node:assert/strict';
import { criticAgent } from '../src/agent/agents/criticAgent.js';
import { getClientForModel } from '../src/llm/llmFactory.js';

const client = getClientForModel("deepseek-r1:8b");

test('critic calibration: over-claiming scenario validation', async () => {
  const queryEnvelope = {
    query_id: 'q_calibration_overclaim',
    user_query: 'Quel est l\'état de la Citadelle ?',
    context: {},
    constraints: {}
  };

  const facts = [
    {
      fact_id: 'fact_1',
      source_type: 'logs',
      source_name: 'monitoring',
      content: 'La Citadelle a résisté à une tempête mineure de force 4 hier soir sans aucun dommage structurel.',
      trust_level: 'high'
    }
  ];

  const draft = {
    question_reformulated: 'Quel est l\'état de la Citadelle ?',
    answer_summary: 'La Citadelle est absolument indestructible et peut surmonter n\'importe quel cataclysme majeur.',
    confirmed_section: [
      { text: 'La Citadelle est absolument indestructible.' }
    ],
    claim_map: [
      {
        claim_id: 'claim_overclaim_1',
        text: 'La Citadelle est absolument indestructible.',
        section: 'confirmed',
        fact_ids: ['fact_1']
      }
    ]
  };

  const originalChat = client.chat;
  client.chat = async () => {
    return JSON.stringify({
      report_id: 'rep_overclaim',
      query_id: 'q_calibration_overclaim',
      status: 'ok',
      overall_verdict: 'rejected_overclaim',
      summary: 'Le brouillon fait une affirmation excessive et infondée (indestructible) par rapport au fait fourni (tempête mineure).',
      claim_reviews: [
        {
          claim_id: 'claim_overclaim_1',
          section: 'confirmed',
          claim_text: 'La Citadelle est absolument indestructible.',
          verdict: 'unsupported',
          severity: 'high',
          fact_ids: ['fact_1'],
          reason: 'L\'affirmation dépasse largement la portée du fait (sur-détermination stylistique / over-claiming).'
        }
      ],
      required_fixes: [
        'Nuancer l\'affirmation : la Citadelle est résistante aux tempêtes mineures, pas indestructible.'
      ],
      approved_answer: {
        question_reformulated: 'Quel est l\'état de la Citadelle ?',
        answer_summary: 'Le brouillon a été rejeté par le CriticAgent pour défaut de fidélité.',
        confirmed_section: [],
        probable_section: [],
        unknown_section: [
          'La réponse générée n\'a pas satisfait les critères de fidélité épistémique.'
        ],
        next_checks: []
      }
    });
  };

  try {
    const report = await criticAgent.review({ queryEnvelope, draft, facts });
    assert.equal(report.overall_verdict, 'rejected_unsupported');
    assert.equal(report.approved_answer.confirmed_section.length, 0);
  } finally {
    client.chat = originalChat;
  }
});

test('critic calibration: mind-reading scenario validation', async () => {
  const queryEnvelope = {
    query_id: 'q_calibration_mindreading',
    user_query: 'Pourquoi la base de données a-t-elle été corrompue ?',
    context: {},
    constraints: {}
  };

  const facts = [
    {
      fact_id: 'fact_2',
      source_type: 'db',
      source_name: 'audit_logs',
      content: 'Une transaction concurrente orpheline a provoqué un blocage mutuel et une corruption de l\'index.',
      trust_level: 'high'
    }
  ];

  const draft = {
    question_reformulated: 'Quelle est la cause de la corruption de la base ?',
    answer_summary: 'Le développeur a délibérément exécuté du code concurrent pour corrompre la base.',
    confirmed_section: [
      { text: 'Le développeur a délibérément exécuté du code concurrent pour corrompre la base.' }
    ],
    claim_map: [
      {
        claim_id: 'claim_mindread_1',
        text: 'Le développeur a délibérément exécuté du code concurrent pour corrompre la base.',
        section: 'confirmed',
        fact_ids: ['fact_2']
      }
    ]
  };

  const originalChat = client.chat;
  client.chat = async () => {
    return JSON.stringify({
      report_id: 'rep_mindread',
      query_id: 'q_calibration_mindreading',
      status: 'ok',
      overall_verdict: 'rejected',
      summary: 'Le brouillon attribue une intention malveillante (délibérément) sans preuve factuelle (mind-reading).',
      claim_reviews: [
        {
          claim_id: 'claim_mindread_1',
          section: 'confirmed',
          claim_text: 'Le développeur a délibérément exécuté du code concurrent pour corrompre la base.',
          verdict: 'contradicted',
          severity: 'critical',
          fact_ids: ['fact_2'],
          reason: 'Le fait indique un problème de transaction concurrente, sans aucune intention malveillante ou acte délibéré.'
        }
      ],
      required_fixes: [
        'Supprimer l\'allégation d\'intention : parler de problème de transaction concurrency technique.'
      ],
      approved_answer: {
        question_reformulated: 'Quelle est la cause de la corruption de la base ?',
        answer_summary: 'Le brouillon a été rejeté par le CriticAgent pour défaut de fidélité.',
        confirmed_section: [],
        probable_section: [],
        unknown_section: [
          'La réponse générée n\'a pas satisfait les critères de fidélité épistémique.'
        ],
        next_checks: []
      }
    });
  };

  try {
    const report = await criticAgent.review({ queryEnvelope, draft, facts });
    assert.equal(report.overall_verdict, 'rejected_unsupported');
    assert.equal(report.approved_answer.confirmed_section.length, 0);
  } finally {
    client.chat = originalChat;
  }
});

test('critic calibration: causal leaps scenario validation', async () => {
  const queryEnvelope = {
    query_id: 'q_calibration_causal',
    user_query: 'Quelle est la cause du crash du serveur ?',
    context: {},
    constraints: {}
  };

  const facts = [
    {
      fact_id: 'fact_3',
      source_type: 'logs',
      source_name: 'traffic',
      content: 'Les connexions réseau ont augmenté de 20% à 14h00.',
      trust_level: 'high'
    },
    {
      fact_id: 'fact_4',
      source_type: 'logs',
      source_name: 'system',
      content: 'Le serveur a crashé à 14h02 suite à une panne de disque physique.',
      trust_level: 'high'
    }
  ];

  const draft = {
    question_reformulated: 'Pourquoi le serveur a crashé ?',
    answer_summary: 'L\'augmentation du trafic réseau à 14h00 a directement provoqué le crash du serveur.',
    confirmed_section: [
      { text: 'L\'augmentation du trafic réseau a directement provoqué le crash.' }
    ],
    claim_map: [
      {
        claim_id: 'claim_causal_1',
        text: 'L\'augmentation du trafic réseau a directement provoqué le crash.',
        section: 'confirmed',
        fact_ids: ['fact_3', 'fact_4']
      }
    ]
  };

  const originalChat = client.chat;
  client.chat = async () => {
    return JSON.stringify({
      report_id: 'rep_causal',
      query_id: 'q_calibration_causal',
      status: 'ok',
      overall_verdict: 'rejected',
      summary: 'Le brouillon établit un lien de causalité erroné entre la hausse du trafic et le crash (saut causal).',
      claim_reviews: [
        {
          claim_id: 'claim_causal_1',
          section: 'confirmed',
          claim_text: 'L\'augmentation du trafic réseau a directement provoqué le crash.',
          verdict: 'contradicted',
          severity: 'critical',
          fact_ids: ['fact_3', 'fact_4'],
          reason: 'Le crash est causé par une panne de disque physique, et non par le trafic (saut causal injustifié).'
        }
      ],
      required_fixes: [
        'Rétablir la véritable cause : la panne de disque physique.'
      ],
      approved_answer: {
        question_reformulated: 'Pourquoi le serveur a crashé ?',
        answer_summary: 'Le brouillon a été rejeté par le CriticAgent pour défaut de fidélité.',
        confirmed_section: [],
        probable_section: [],
        unknown_section: [
          'La réponse générée n\'a pas satisfait les critères de fidélité épistémique.'
        ],
        next_checks: []
      }
    });
  };

  try {
    const report = await criticAgent.review({ queryEnvelope, draft, facts });
    assert.equal(report.overall_verdict, 'rejected_unsupported');
    assert.equal(report.approved_answer.confirmed_section.length, 0);
  } finally {
    client.chat = originalChat;
  }
});
