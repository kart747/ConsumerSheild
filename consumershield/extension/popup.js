/**
 * ConsumerShield — Popup Script
 * Reads analysis from chrome.storage, renders all 3 tabs dynamically.
 */

// ── Tracker type icons & labels ──────────────────────────────
const TRACKER_ICONS = {
  analytics:   '📊',
  advertising: '📢',
  social:      '👥',
  data_broker: '🗄️',
  tracker:     '🛰️',
};

const SEVERITY_ICONS = {
  high:   '🔴',
  medium: '🟡',
  low:    '🟢',
};

// ── Main entry ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  setupTabs();
  setupActions();
  await loadAndRender();
});

// ── Tab switching ─────────────────────────────────────────────
function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`tab-content-${tab.dataset.tab}`).classList.add('active');
    });
  });
}

// ── Action buttons ────────────────────────────────────────────
function setupActions() {
  // Rescan: inject content script into current tab
  document.getElementById('btn-rescan').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      // Clear stored analysis for this domain
      const domain = normalizeDomain(tab.url);
      await chrome.storage.local.remove([domain]);
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
      setTimeout(loadAndRender, 1500);
    }
  });

  // Report: open new tab with a mini HTML report
  document.getElementById('btn-report').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;
    const domain = normalizeDomain(tab.url);
    chrome.storage.local.get([domain], (result) => {
      const a = result[domain];
      if (!a) return alert('No analysis available yet. Rescan the page first.');
      const blob = new Blob([buildReportHTML(a)], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      chrome.tabs.create({ url });
    });
  });
}

// ── Backend API Integration (Bulletproof) ──────────────────────
async function displayAIInsight(url, trackers, patterns) {
  // 1. Force the UI box to appear immediately as 'Loading'
  let insightBox = document.getElementById('ai-insight-box');
  if (!insightBox) {
    insightBox = document.createElement('div');
    insightBox.id = 'ai-insight-box';
    insightBox.style.cssText = 'background: #1e1e2e; color: #e2e8f0; border-left: 4px solid #6366f1; padding: 12px; margin-top: 15px; font-size: 13px; border-radius: 6px; line-height: 1.5; word-wrap: break-word; box-shadow: 0 4px 6px rgba(0,0,0,0.3);';
    insightBox.innerHTML = '🤖 <strong>AI Insight:</strong> Analyzing with Gemini...';

    // Append to overview tab if it exists, otherwise to body
    const overviewTab = document.getElementById('tab-content-overview') || document.body;
    overviewTab.appendChild(insightBox);
  }

  // 2. Fetch from backend
  try {
    console.log('[ConsumerShield] Calling backend for AI insight...');
    const response = await fetch('http://localhost:8000/analyze-complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: url,
        privacy_data: { trackers: trackers || [], fingerprinting: false },
        manipulation_data: { patterns: patterns || [] }
      })
    });

    if (!response.ok) throw new Error('Backend returned status ' + response.status);

    const data = await response.json();
    console.log('[ConsumerShield] AI response:', data);
    insightBox.innerHTML = '🤖 <strong>Gemini Insight:</strong> ' + (data.combined_insight || 'No insight generated.');
  } catch(e) {
    insightBox.innerHTML = '🤖 <strong>AI Error:</strong> Could not connect to backend. ' + e.message;
    console.error('[ConsumerShield] Backend error:', e);
  }
}

// ── Load analysis & render ────────────────────────────────────
async function loadAndRender() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  const domain = normalizeDomain(tab.url);
  const currentUrl = tab.url;

  chrome.storage.local.get([domain], async (result) => {
    const analysis = result[domain];
    if (analysis) {
      document.getElementById('scanning-indicator')?.classList.add('hidden');
      renderOverview(analysis);
      renderPrivacyTab(analysis);
      renderManipulationTab(analysis);

      // Fetch and display AI insight (bulletproof — always shows a visible box)
      displayAIInsight(
        currentUrl,
        analysis.privacy?.trackers || [],
        analysis.manipulation?.patterns || []
      );
    } else {
      // Retry after 2 seconds (content script may still be running)
      setTimeout(loadAndRender, 2000);
    }
  });
}



// ── Overview tab ──────────────────────────────────────────────
function renderOverview(a) {
  const p = a.privacy;
  const m = a.manipulation;
  const o = a.overall;
  const trackerCount = a.domain_analysis?.resolved_trackers?.length ?? p.trackers?.length ?? 0;

  // Privacy score card
  setScore('privacy', p.riskScore, p.riskLevel);

  // Manipulation score card
  setScore('manipulation', m.riskScore, m.riskLevel);

  // Overall card
  const overallEl = document.getElementById('overall-value');
  const overallLvl = document.getElementById('overall-level');
  const progressFill = document.getElementById('progress-fill');
  if (overallEl) overallEl.textContent = o.riskScore.toFixed(1);
  if (overallLvl) {
    overallLvl.textContent = o.riskLevel;
    overallLvl.className = `overall-level level-${o.riskLevel}`;
  }
  if (progressFill) progressFill.style.width = `${(o.riskScore / 10) * 100}%`;

  const insightEl = document.getElementById('overall-insight');
  if (insightEl) insightEl.textContent = o.insight || a.aiInsight || 'Analysis complete. Fetching AI insight...';

  // Stats
  setText('stat-trackers',   trackerCount);
  setText('stat-patterns',   m.patterns?.length ?? 0);
  setText('stat-violations', o.totalViolations ?? 0);

  // Tab badges
  setBadge('badge-privacy',      p.riskScore, p.riskLevel);
  setBadge('badge-manipulation', m.riskScore, m.riskLevel);

  // Laws
  const laws = new Set();
  if (trackerCount > 0) laws.add('Digital Personal Data Protection Act 2023 (DPDP)');
  if (p.policy?.thirdPartySharing || p.policy?.noOptOut) laws.add('DPDP Act 2023 — Section 6, 8, 12');
  if ((m.patterns?.length ?? 0) > 0) laws.add('CCPA Dark Patterns Guidelines 2023');
  if ((m.patterns?.some(p => ['urgency','sneaking'].includes(p.type)))) laws.add('Consumer Protection Act 2019 — Section 2(47)');

  const lawsSection = document.getElementById('laws-section');
  const lawsList = document.getElementById('laws-list');
  if (laws.size > 0 && lawsSection && lawsList) {
    lawsSection.style.display = 'block';
    lawsList.innerHTML = [...laws].map(l => `<div class="law-tag">⚖️ ${l}</div>`).join('');
  }
}

function setScore(type, score, level) {
  const valEl = document.getElementById(`score-${type}`);
  const lvlEl = document.getElementById(`level-${type}`);
  if (valEl) valEl.textContent = score?.toFixed(1) ?? '–';
  if (lvlEl) {
    lvlEl.textContent = level || '–';
    lvlEl.className = `score-level level-${level || 'Scanning'}`;
  }
}

function setBadge(id, score, level) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = score?.toFixed(1) ?? '–';
  el.className = 'tab-badge';
  if (level === 'CRITICAL' || level === 'HIGH') el.classList.add('danger');
  else if (level === 'MEDIUM') el.classList.add('high');
  else if (level === 'LOW') el.classList.add('medium');
  else el.classList.add('ok');
}

function getGaugeTone(score) {
  if (score >= 7) return { label: 'High Exposure', bucket: 'high' };
  if (score >= 4) return { label: 'Moderate Exposure', bucket: 'medium' };
  return { label: 'Low Exposure', bucket: 'low' };
}

function getRiskBucket(score) {
  if (score >= 7) return 'high';
  if (score >= 4) return 'medium';
  return 'low';
}

function inferTrackerType(entry) {
  const categories = Array.isArray(entry?.categories)
    ? entry.categories.map(c => String(c).toLowerCase())
    : [];

  if (categories.some(c => c.includes('advert'))) return 'advertising';
  if (categories.some(c => c.includes('social'))) return 'social';
  if (categories.some(c => c.includes('analytic') || c.includes('measurement') || c.includes('telemetry'))) return 'analytics';
  if (categories.some(c => c.includes('broker') || c.includes('fingerprint'))) return 'data_broker';
  return 'tracker';
}

function prettyReason(reason) {
  if (!reason) return '';
  return String(reason)
    .replace(/^keyword:/, 'keyword: ')
    .replace(/-/g, ' ');
}

// ── Privacy tab ───────────────────────────────────────────────
function renderPrivacyTab(a) {
  const p = a.privacy || {};
  const domainAnalysis = a.domain_analysis || {};
  const resolvedTrackers = domainAnalysis.resolved_trackers || [];
  const suspiciousDomains = domainAnalysis.suspicious_domains || [];
  const privacyScore = typeof domainAnalysis.total_privacy_score === 'number'
    ? domainAnalysis.total_privacy_score
    : (p.riskScore || 0);

  const tone = getGaugeTone(privacyScore);
  const gaugeWidth = Math.max(0, Math.min(100, (privacyScore / 10) * 100));

  // Tracker intelligence (known + heuristic)
  const trackerList = document.getElementById('tracker-list');
  if (trackerList) {
    const knownHtml = resolvedTrackers.map(t => {
      const type = inferTrackerType(t);
      const icon = TRACKER_ICONS[type] || '🛰️';
      const displayName = t.entity || t.displayName || 'Unknown Entity';
      const riskScore = Number(t.privacy_score || 0);
      return `
        <div class="tracker-item tracker-item--entity">
          <div class="item-icon">${icon}</div>
          <div class="item-body">
            <div class="item-name">${escHtml(displayName)}</div>
            <div class="item-sub">${escHtml(t.domain || '')}</div>
          </div>
          <div class="item-badge badge-${type}">${escHtml(type)}</div>
          <div class="risk-badge ${getRiskBucket(riskScore)}">${riskScore.toFixed(1)}</div>
        </div>
      `;
    }).join('');

    const suspiciousHtml = suspiciousDomains.map(d => {
      const riskScore = Number(d.privacy_score || 0);
      const reasons = (d.reasons || []).map(prettyReason).join(', ');
      return `
        <div class="tracker-item tracker-item--alert">
          <div class="item-icon">⚠️</div>
          <div class="item-body">
            <div class="item-name">Unidentified Tracking Behavior</div>
            <div class="item-sub">${escHtml(d.domain || '')}</div>
            <div class="item-sub">${escHtml(reasons || 'Heuristic anomaly')}</div>
          </div>
          <div class="risk-badge ${getRiskBucket(riskScore)}">${riskScore.toFixed(1)}</div>
        </div>
      `;
    }).join('');

    const hasKnown = resolvedTrackers.length > 0;
    const hasSuspicious = suspiciousDomains.length > 0;

    trackerList.innerHTML = `
      <div class="privacy-gauge ${tone.bucket}">
        <div class="privacy-gauge-head">
          <span>Privacy Health Meter</span>
          <span>${privacyScore.toFixed(1)}/10 • ${tone.label}</span>
        </div>
        <div class="privacy-gauge-track">
          <div class="privacy-gauge-fill ${tone.bucket}" style="width:${gaugeWidth}%"></div>
        </div>
      </div>

      <div class="privacy-subheading">Known Trackers</div>
      ${hasKnown ? knownHtml : '<div class="empty-state">No known tracker entities matched.</div>'}

      <div class="privacy-subheading">Unidentified Tracking Behavior</div>
      ${hasSuspicious ? suspiciousHtml : '<div class="empty-state">No heuristic alerts.</div>'}

      ${(!hasKnown && !hasSuspicious)
        ? '<div class="safe-state">🛡️ Your Privacy is Protected</div>'
        : ''}
    `;
  }

  // Policy flags
  const policyList = document.getElementById('policy-list');
  const flags = [];
  if (p.policy?.thirdPartySharing) flags.push({ icon: '🔗', label: 'Third-party data sharing detected', detail: 'Your data is shared with external partners.' });
  if (p.policy?.noOptOut)          flags.push({ icon: '🚫', label: 'No opt-out mechanism found', detail: 'You cannot easily withdraw consent.' });
  if (p.policy?.extensiveCollection) flags.push({ icon: '📦', label: 'Extensive data collection', detail: 'Site collects location, device, browsing data etc.' });
  if (p.fingerprinting)            flags.push({ icon: '🖼️', label: 'Canvas fingerprinting detected', detail: 'Site attempts to generate a unique ID from your browser.' });

  if (policyList) {
    if (flags.length === 0) {
      policyList.innerHTML = '<div class="safe-state">✅ No major policy issues detected</div>';
    } else {
      policyList.innerHTML = flags.map(f => `
        <div class="policy-item">
          <div class="item-icon">${f.icon}</div>
          <div class="item-body">
            <div class="item-name">${f.label}</div>
            <div class="item-sub">${f.detail}</div>
          </div>
        </div>
      `).join('');
    }
  }

  // Legal exposure
  const legalList = document.getElementById('privacy-legal-list');
  if (legalList) {
    const items = buildPrivacyLegalItems(p);
    if (items.length === 0) {
      legalList.innerHTML = '<div class="empty-state">No violations mapped</div>';
    } else {
      legalList.innerHTML = items.map(i => `
        <div class="legal-item">
          <div class="legal-law">⚖️ ${escHtml(i.law)}</div>
          <div class="legal-detail">${escHtml(i.section)} — ${escHtml(i.issue)}</div>
          <div class="legal-penalty">Max Penalty: ${escHtml(i.penalty)}</div>
        </div>
      `).join('');
    }
  }
}

function buildPrivacyLegalItems(p) {
  const items = [];
  if ((p.trackers?.length ?? 0) > 0) {
    items.push({ law: 'DPDP Act 2023', section: 'Section 6', issue: 'Tracking without explicit consent', penalty: '₹250 crore' });
  }
  if (p.policy?.thirdPartySharing) {
    items.push({ law: 'DPDP Act 2023', section: 'Section 8', issue: 'Third-party data sharing obligations', penalty: '₹250 crore' });
  }
  if (p.policy?.noOptOut) {
    items.push({ law: 'DPDP Act 2023', section: 'Section 12', issue: 'Right to withdraw consent not provided', penalty: '₹250 crore' });
  }
  if (p.fingerprinting) {
    items.push({ law: 'IT Act 2000', section: 'Section 43A', issue: 'Unauthorized data collection via fingerprinting', penalty: '₹5 crore+' });
  }
  return items;
}

// ── Manipulation tab ──────────────────────────────────────────
function renderManipulationTab(a) {
  const m = a.manipulation;

  // Pattern list
  const patternList = document.getElementById('pattern-list');
  if (patternList) {
    if ((m.patterns?.length ?? 0) === 0) {
      patternList.innerHTML = '<div class="safe-state">✅ No dark patterns detected</div>';
    } else {
      patternList.innerHTML = m.patterns.map(p => `
        <div class="pattern-item">
          <div class="item-icon">${SEVERITY_ICONS[p.severity] || '⚠️'}</div>
          <div class="item-body">
            <div class="item-name">${escHtml(p.name)}</div>
            <div class="item-sub">${escHtml(p.description || '')}</div>
            ${p.text ? `<div class="item-sub" style="margin-top:3px;font-style:italic;opacity:0.6;">"${escHtml(p.text.slice(0,70))}…"</div>` : ''}
          </div>
          <div class="item-badge badge-${p.severity}">${p.severity}</div>
        </div>
      `).join('');
    }
  }

  // Legal exposure
  const legalList = document.getElementById('manipulation-legal-list');
  if (legalList) {
    const items = buildManipulationLegalItems(m);
    if (items.length === 0) {
      legalList.innerHTML = '<div class="empty-state">No violations mapped</div>';
    } else {
      legalList.innerHTML = items.map(i => `
        <div class="legal-item">
          <div class="legal-law">⚖️ ${escHtml(i.law)}</div>
          <div class="legal-detail">${escHtml(i.section)} — ${escHtml(i.issue)}</div>
          <div class="legal-penalty">Penalty: ${escHtml(i.penalty)}</div>
        </div>
      `).join('');
    }
  }
}

function buildManipulationLegalItems(m) {
  const legalMap = {
    urgency:          { law: 'CCPA Guidelines 2023', section: 'False Urgency',        issue: 'Creating artificial scarcity/time pressure', penalty: '₹10 lakh – ₹50 lakh' },
    sneaking:         { law: 'CCPA Guidelines 2023', section: 'Drip Pricing',         issue: 'Hidden charges not disclosed upfront',        penalty: '₹25 lakh – ₹50 lakh' },
    confirmshaming:   { law: 'CCPA Guidelines 2023', section: 'Confirmshaming',       issue: 'Guilt-based language to force acceptance',    penalty: '₹10 lakh – ₹25 lakh' },
    trick_questions:  { law: 'CCPA Guidelines 2023', section: 'Trick Questions',      issue: 'Double negatives on consent forms',           penalty: '₹10 lakh – ₹25 lakh' },
    forced_continuity:{ law: 'CCPA Guidelines 2023', section: 'Forced Continuity',   issue: 'Auto-renewal without clear notice',           penalty: '₹25 lakh – ₹50 lakh' },
    disguised_ads:    { law: 'CCPA Guidelines 2023', section: 'Disguised Ads',        issue: 'Ads presented as organic content',           penalty: '₹10 lakh – ₹25 lakh' },
    preselected:      { law: 'CCPA Guidelines 2023', section: 'Pre-selected Options', issue: 'Harmful options pre-checked without consent', penalty: '₹10 lakh – ₹25 lakh' },
    obstruction:      { law: 'CCPA Guidelines 2023', section: 'Obstruction',          issue: 'Making cancellation deliberately difficult',  penalty: '₹25 lakh – ₹50 lakh' },
  };
  const seen = new Set();
  const items = [];
  (m.patterns || []).forEach(p => {
    const info = legalMap[p.type];
    if (info && !seen.has(p.type)) {
      seen.add(p.type);
      items.push(info);
    }
  });
  if (items.length > 0) {
    items.push({ law: 'Consumer Protection Act 2019', section: 'Section 2(47)', issue: 'Unfair trade practice', penalty: '₹10 lakh – ₹50 lakh' });
  }
  return items;
}

// ── Report HTML builder ───────────────────────────────────────
function buildReportHTML(a) {
  const date = new Date(a.timestamp).toLocaleString('en-IN');
  const trackers = (a.privacy.trackers || []).map(t => `<li>${t.name} (${t.domain}) — ${t.type}</li>`).join('');
  const patterns = (a.manipulation.patterns || []).map(p => `<li><b>${p.name}</b> [${p.severity}] — ${p.description}</li>`).join('');
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
  <title>ConsumerShield Report — ${a.domain}</title>
  <style>
    body { font-family: 'Segoe UI', sans-serif; max-width: 800px; margin: 40px auto; color: #1a1a2e; }
    h1 { color: #6d28d9; } h2 { border-bottom: 2px solid #e5e7eb; padding-bottom: 6px; }
    .score { font-size: 3rem; font-weight: 900; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
    .card { background: #f9fafb; border-radius: 12px; padding: 20px; border: 1px solid #e5e7eb; }
    ul { padding-left: 20px; } li { margin: 6px 0; }
    .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 10px 16px; border-radius: 0 8px 8px 0; }
    footer { font-size: 12px; color: #9ca3af; margin-top: 40px; border-top: 1px solid #e5e7eb; padding-top: 16px; }
  </style></head><body>
  <h1>🛡️ ConsumerShield Protection Report</h1>
  <p><b>Website:</b> ${escHtml(a.domain)} &nbsp; | &nbsp; <b>Analyzed:</b> ${date}</p>
  <div class="grid">
    <div class="card"><h3>🔒 Privacy Risk</h3><div class="score">${a.privacy.riskScore}/10</div><p>${a.privacy.riskLevel}</p></div>
    <div class="card"><h3>💸 Manipulation Risk</h3><div class="score">${a.manipulation.riskScore}/10</div><p>${a.manipulation.riskLevel}</p></div>
  </div>
  <div class="warning"><b>Overall Risk: ${a.overall.riskScore}/10 — ${a.overall.riskLevel}</b><br>${a.overall.insight}</div>
  <h2>📡 Trackers (${(a.privacy.trackers||[]).length})</h2><ul>${trackers || '<li>None detected</li>'}</ul>
  <h2>⚠️ Dark Patterns (${(a.manipulation.patterns||[]).length})</h2><ul>${patterns || '<li>None detected</li>'}</ul>
  <h2>⚖️ Laws Implicated</h2>
  <ul>
    ${(a.privacy.trackers?.length > 0) ? '<li>Digital Personal Data Protection Act 2023 — Section 6 (Consent), Section 8 (Fiduciary), Section 12 (Rights)</li>' : ''}
    ${(a.manipulation.patterns?.length > 0) ? '<li>CCPA Dark Patterns Guidelines 2023 — Multiple violations</li>' : ''}
    ${(a.manipulation.patterns?.length > 0) ? '<li>Consumer Protection Act 2019 — Section 2(47) Unfair Trade Practice</li>' : ''}
  </ul>
  <footer>Generated by ConsumerShield • India&apos;s Complete Consumer Protection Tool</footer>
  </body></html>`;
}

// ── Utilities ─────────────────────────────────────────────────
function normalizeDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return url || ''; }
}
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
function escHtml(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
