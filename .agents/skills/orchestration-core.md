# Skill: Nexxus Orchestration Core

## Purpose
Manage the autonomous project lifecycle from goal to delivery using specialized experts and dynamic handovers.

## Operational Protocol
1. **Strategic Identification**: Analyze project goal and trigger expert routing (PM -> Architect -> Developer -> QA).
2. **Phase Management**:
    - **expert_pm**: Requirement extraction and constraint identification.
    - **expert_architect**: Design patterns, tech stack validation, and project structure definition.
    - **expert_developer**: Code implementation and physical file generation.
    - **expert_qa**: Audit, security check, and validation.
3. **Thought Enforcement**: All reasoning MUST happen within `<thought>` tags.
4. **Action Handover**: Use `<action>` tags for system interaction (e.g., project building).

## Constraints
- **Béton Armé**: No fluff. No jargon. Direct instructions.
- **Sovereignty**: Prioritize local tools (Ollama) and standalone infrastructure.
- **Traceability**: Every phase must log its results for the next expert.
