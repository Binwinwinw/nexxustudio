import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  INSTALL_USAGE_KINDS,
  classifyInstallUsage,
  mapInstallKindToUsageIntent,
} from "../src/agent/micro/subject/subjectInstallUsage.js";
import { inferImplicitUsage, USAGE_INTENTS } from "../src/agent/micro/subject/subjectUsageIntent.js";
import { buildSubjectInterpretedState } from "../src/agent/micro/subject/subjectInterpretedState.js";

describe("subjectInstallUsage — taxonomie", () => {
  it("install_project_dependency — dépendances npm", () => {
    assert.equal(
      classifyInstallUsage("Installer uniquement les dépendances react-plotly.js"),
      INSTALL_USAGE_KINDS.PROJECT_DEPENDENCY,
    );
    assert.equal(
      inferImplicitUsage("npm install react-plotly.js plotly.js", {}),
      USAGE_INTENTS.INTERNAL_HANDOFF,
    );
  });

  it("bootstrap_project — npm create vite", () => {
    assert.equal(
      classifyInstallUsage("npm create vite@latest mon-app -- --template react"),
      INSTALL_USAGE_KINDS.BOOTSTRAP_PROJECT,
    );
    assert.equal(
      mapInstallKindToUsageIntent(INSTALL_USAGE_KINDS.BOOTSTRAP_PROJECT),
      USAGE_INTENTS.INTERNAL_HANDOFF,
    );
  });

  it("installe React, crée le projet, ajoute Plotly → dev, pas Steam", () => {
    const q = "installe React, crée le projet Vite, ajoute plotly.js";
    assert.equal(classifyInstallUsage(q), INSTALL_USAGE_KINDS.PROJECT_DEPENDENCY);
    assert.equal(inferImplicitUsage(q, {}), USAGE_INTENTS.INTERNAL_HANDOFF);
  });

  it("install_runtime_env — node via brew", () => {
    assert.equal(
      classifyInstallUsage("comment installer node avec brew sur mac"),
      INSTALL_USAGE_KINDS.RUNTIME_ENV,
    );
    assert.equal(
      inferImplicitUsage("comment installer node avec brew sur mac", {}),
      USAGE_INTENTS.CONFIGURE,
    );
  });

  it("install_app_user — steam explicite", () => {
    assert.equal(
      classifyInstallUsage("comment installer Need for Speed sur Steam"),
      INSTALL_USAGE_KINDS.APP_USER,
    );
    assert.equal(
      inferImplicitUsage("comment installer Need for Speed sur Steam", {}),
      USAGE_INTENTS.INSTALL,
    );
  });

  it("état SIL expose installKind", () => {
    const interpreted = buildSubjectInterpretedState({
      query: "ajoute react-plotly au projet vite",
    });
    assert.equal(interpreted.state.installKind, INSTALL_USAGE_KINDS.PROJECT_DEPENDENCY);
    assert.equal(interpreted.state.usage, USAGE_INTENTS.INTERNAL_HANDOFF);
  });
});
