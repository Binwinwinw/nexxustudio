import express from 'express';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

const router = express.Router();
const AUDIT_FILE = path.join(process.cwd(), 'logs', 'audit_events.jsonl');

// Helper pour lire le JSONL en stream et extraire les EPISTEMIC_FAIL_CLOSED
async function fetchEpistemicEvents() {
    const events = [];
    if (!fs.existsSync(AUDIT_FILE)) return events;

    const fileStream = fs.createReadStream(AUDIT_FILE);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    for await (const line of rl) {
        if (!line.trim()) continue;
        try {
            const event = JSON.parse(line);
            if (event.action === 'EPISTEMIC_FAIL_CLOSED') {
                events.push(event);
            }
        } catch (e) {
            // Ignorer les lignes corrompues
        }
    }
    return events;
}

router.get('/summary', async (req, res) => {
    try {
        const events = await fetchEpistemicEvents();
        res.json({ total: events.length });
    } catch (e) {
        res.status(500).json({ error: 'Failed to read audit logs.' });
    }
});

router.get('/fail_closed_timeseries', async (req, res) => {
    try {
        const days = parseInt(req.query.days || 30, 10);
        const events = await fetchEpistemicEvents();
        
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);

        const series = {};
        events.forEach(e => {
            const dateObj = new Date(e.timestamp);
            if (dateObj >= cutoff) {
                const dateStr = dateObj.toISOString().split('T')[0];
                series[dateStr] = (series[dateStr] || 0) + 1;
            }
        });

        const result = Object.keys(series).sort().map(date => ({
            date,
            count: series[date]
        }));

        res.json(result);
    } catch (e) {
        res.status(500).json({ error: 'Failed to generate timeseries.' });
    }
});

router.get('/fail_closed_by_domain', async (req, res) => {
    try {
        const events = await fetchEpistemicEvents();
        const domains = {};
        
        events.forEach(e => {
            const domain = e.payload?.domain || e.payload?.agent || 'Unknown';
            domains[domain] = (domains[domain] || 0) + 1;
        });

        const result = Object.keys(domains).map(name => ({
            name,
            value: domains[name]
        })).sort((a, b) => b.value - a.value);

        res.json(result);
    } catch (e) {
        res.status(500).json({ error: 'Failed to extract domains.' });
    }
});

router.get('/fail_closed_by_version', async (req, res) => {
    try {
        const events = await fetchEpistemicEvents();
        const versions = {};
        
        events.forEach(e => {
            const version = e.payload?.version || e.version || 'Unknown';
            versions[version] = (versions[version] || 0) + 1;
        });

        const result = Object.keys(versions).map(version => ({
            version,
            count: versions[version]
        })).sort((a, b) => b.count - a.count);

        res.json(result);
    } catch (e) {
        res.status(500).json({ error: 'Failed to extract versions.' });
    }
});

router.get('/recent_high_blocks', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit || 20, 10);
        const events = await fetchEpistemicEvents();
        
        const highEvents = events.filter(e => {
            const sev = (e.payload?.severity || e.severity || '').toUpperCase();
            return sev === 'HIGH' || sev === 'CRITICAL';
        });

        // Fallback: si aucun event n'a explicitement de sévérité HIGH, on renvoie les plus récents globaux
        const targetEvents = highEvents.length > 0 ? highEvents : events;
        
        // Reverse array to get most recent first
        targetEvents.reverse();
        
        const recent = targetEvents.slice(0, limit).map(e => ({
            timestamp: e.timestamp,
            query: e.payload?.query || e.payload?.topic || 'N/A',
            agent: e.payload?.domain || e.payload?.agent || 'N/A',
            reason: e.payload?.reason || 'N/A',
            severity: e.payload?.severity || e.severity || 'UNKNOWN',
            version: e.payload?.version || e.version || 'Unknown'
        }));

        res.json(recent);
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch recent high blocks.' });
    }
});

router.get('/top_locked_topics_7d', async (req, res) => {
    try {
        const events = await fetchEpistemicEvents();
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 7);
        
        const topics = {};
        events.forEach(e => {
            const dateObj = new Date(e.timestamp);
            if (dateObj >= cutoff) {
                const topic = e.payload?.topic || e.payload?.query || 'Unknown';
                topics[topic] = (topics[topic] || 0) + 1;
            }
        });

        const result = Object.keys(topics).map(topic => ({
            topic,
            count: topics[topic]
        })).sort((a, b) => b.count - a.count).slice(0, 10);

        res.json(result);
    } catch (e) {
        res.status(500).json({ error: 'Failed to extract topics.' });
    }
});

router.get('/alerts', async (req, res) => {
    try {
        const events = await fetchEpistemicEvents();
        const alerts = [];
        
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
        
        let last24hCount = 0;
        let prev24hCount = 0;
        
        const domainCountsLast24h = {};
        const domainCountsPrev24h = {};

        events.forEach(e => {
            const d = new Date(e.timestamp);
            const domain = e.payload?.domain || e.payload?.agent || 'Unknown';
            
            if (d >= oneDayAgo) {
                last24hCount++;
                domainCountsLast24h[domain] = (domainCountsLast24h[domain] || 0) + 1;
            } else if (d >= twoDaysAgo && d < oneDayAgo) {
                prev24hCount++;
                domainCountsPrev24h[domain] = (domainCountsPrev24h[domain] || 0) + 1;
            }
        });

        const MIN_THRESHOLD = 5; // Seuil minimum pour éviter le bruit

        // Règle 1: Doublement sur 24h
        if (last24hCount >= MIN_THRESHOLD && last24hCount >= prev24hCount * 2) {
            alerts.push({
                type: 'VOLUME_SPIKE',
                severity: 'WARNING',
                message: `Le volume de EPISTEMIC_FAIL_CLOSED a doublé sur 24h (${last24hCount} vs ${prev24hCount}).`,
                metrics: { last24h: last24hCount, prev24h: prev24hCount }
            });
        }

        // Règle 2: Spike par domaine
        Object.keys(domainCountsLast24h).forEach(domain => {
            const countNow = domainCountsLast24h[domain];
            const countPrev = domainCountsPrev24h[domain] || 0;
            
            if (countNow >= MIN_THRESHOLD && countNow >= (countPrev * 3 || MIN_THRESHOLD)) {
                alerts.push({
                    type: 'DOMAIN_SPIKE',
                    severity: 'WARNING',
                    message: `Pic de blocages détecté pour le domaine '${domain}' (${countNow} vs ${countPrev}).`,
                    metrics: { domain, last24h: countNow, prev24h: countPrev }
                });
            }
        });

        res.json({ alerts, metadata: { last24hTotal: last24hCount, prev24hTotal: prev24hCount } });
    } catch (e) {
        res.status(500).json({ error: 'Failed to compute alerts.' });
    }
});

export default router;
