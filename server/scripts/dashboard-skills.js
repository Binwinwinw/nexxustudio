#!/usr/bin/env node
import { printSkillsDashboard } from '../src/ops/dashboard-skills.js';

const dashboard = printSkillsDashboard();
process.exit(dashboard.summary.errors > 0 ? 1 : 0);
