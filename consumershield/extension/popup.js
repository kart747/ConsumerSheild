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

// ── Backend API Integration ────────────────────────────────────
async function getAIInsight(url, trackers, patterns) {
  try {
    const response = await fetch('http://localhost:8000/analyze-complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: url,
        privacy_data: {
          trackers: trackers || [],
          fingerprinting: false
        },
        manipulation_data: {
          patterns: patterns || []
        }
      })
    });
    const data = await response.json();
    return data.combined_insight || null;
  } catch(e) {
    console.log('Backend unreachable:', e);
    return null;
  }
}

// ── Load analysis & render ────────────────────────────────────
async function loadAndRender() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  const domain = normalizeDomain(tab.url);

  chrome.storage.local.get([domain], async (result) => {
    const analysis = result[domain];
    if (analysis) {
      document.getElementById('scanning-indicator')?.classList.add('hidden');
      renderOverview(analysis);
      renderPrivacyTab(analysis);
      renderManipulationTab(analysis);
      
      // Fetch AI insight from backend
      const aiInsight = await getAIInsight(
        tab.url,
        analysis.privacy?.trackers || [],
        analysis.manipulation?.patterns || []
      );
      if (aiInsight) {
        displayAIInsight(aiInsight);
      }
    } else {
      // Retry after 2 seconds (content script may still be running)
      setTimeout(loadAndRender, 2000);
    }
  });
}

// ── Display AI Insight ────────────────────────────────────────
function displayAIInsight(insight) {
  const container = document.getElementById('overall-insight');
  if (!container) return;
  
  const aiDiv = document.createElement('div');
  aiDiv.id = 'ai-insight';
  aiDiv.style.cssText = 'background: #f0f4ff; border-left: 3px solid #4f46e5; padding: 10px; margin-top: 10px; font-size: 12px; border-radius: 4px; line-height: 1.5;';
  aiDiv.innerHTML = `🤖 AI Insight: ${escHtml(insight)}`;
  container.parentNode.insertBefore(aiDiv, container.nextSibling);
}

// ── Overview tab ──────────────────────────────────────────────
function renderOverview(a) {
  const p = a.privacy;
  const m = a.manipulation;
  const o = a.overall;

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
  setText('stat-trackers',   p.trackers?.length ?? 0);
  setText('stat-patterns',   m.patterns?.length ?? 0);
  setText('stat-violations', o.totalViolations ?? 0);

  // Tab badges
  setBadge('badge-privacy',      p.riskScore, p.riskLevel);
  setBadge('badge-manipulation', m.riskScore, m.riskLevel);

  // Laws
  const laws = new Set();
  if ((p.trackers?.length ?? 0) > 0) laws.add('Digital Personal Data Protection Act 2023 (DPDP)');
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

// ── Privacy tab ───────────────────────────────────────────────
function renderPrivacyTab(a) {
  const p = a.privacy;

  // Trackers — Always display detected trackers regardless of privacy score
  const trackerList = document.getElementById('tracker-list');
  if (trackerList) {
    const trackers = p.trackers ?? [];
    if (trackers.length === 0) {
      trackerList.innerHTML = '<div class="safe-state">✅ No known trackers detected</div>';
    } else {
      // Always show tracker names and details, even if privacy score is low
      trackerList.innerHTML = trackers.map(t => `
        <div class="tracker-item">
          <div class="item-icon">${TRACKER_ICONS[t.type] || '🔍'}</div>
          <div class="item-body">
            <div class="item-name">${escHtml(t.name)}</div>
            <div class="item-sub">${escHtml(t.domain)}</div>
            ${t.source ? `<div class="item-source">Detected via: ${escHtml(t.source)}</div>` : ''}
          </div>
          <div class="item-badge badge-${t.type}">${escHtml(t.type)}</div>
        </div>
      `).join('');
    }
  }

  // Policy flags
  const policyList = document.getElementById('policy-list');
  const flags = [];
  if (p.policy?.thirdPartySharing) flags.push({ icon: '🔗', label: 'Third-party data sharing detected', detail: 'Your data is shared with external partners.' });
  if (p.policy?.noOptOut)          flags.push({ icon: '🚫', label: 'No opt-out mechanism found', detail: 'You cannot easily withdraw consent.' });
  if (p.policy?.extensiveCollection) flags.push({ icon: '📦', label: 'Extensive data collection',   detail: 'Site collects location, device, browsing data etc.' });
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
