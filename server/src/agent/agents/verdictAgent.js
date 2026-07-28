// server/src/agent/agents/verdictAgent.js

export const verdictAgent = {
  async finalize({ draft, criticReport }) {
    const approved = criticReport.approved_answer || {};
    
    // Construct final response text from the summary and the sections
    let response_text = approved.answer_summary || "Aucune réponse disponible.";
    
    if (approved.confirmed_section && approved.confirmed_section.length) {
      response_text += "\n\n### ✅ Ce que nous savons (Confirmé)\n- " + approved.confirmed_section.join("\n- ");
    }
    if (approved.probable_section && approved.probable_section.length) {
      response_text += "\n\n### 🧐 Ce qui est probable (Hypothèses)\n- " + approved.probable_section.join("\n- ");
    }
    if (approved.unknown_section && approved.unknown_section.length) {
      response_text += "\n\n### ❓ Ce que nous ignorons (Inconnu)\n- " + approved.unknown_section.join("\n- ");
    }
    if (approved.next_checks && approved.next_checks.length) {
      response_text += "\n\n### 🛠️ Prochaines étapes suggérées\n- " + approved.next_checks.join("\n- ");
    }

    return {
      answer_id: `ans_${Date.now()}`,
      status: (criticReport.overall_verdict && criticReport.overall_verdict.startsWith("rejected")) ? "failed_safe" : "validated",
      verdict_matrix: {
        confirmed: approved.confirmed_section || [],
        probable: approved.probable_section || [],
        unknown: approved.unknown_section || []
      },
      response_text,
      audit_refs: {
        draft_id: draft.draft_id,
        review_id: criticReport.report_id
      }
    };
  }
};
