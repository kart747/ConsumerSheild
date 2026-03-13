/**
 * ConsumerShield — Background Service Worker (MV3)
 * Handles: message routing, dual risk calculation, storage, badge updates, backend relay
 */

// ═══════════════════════════════════════════════════════════════════════════
// Dual Risk Calculator (inline — cannot import from service worker easily)
// ═══════════════════════════════════════════════════════════════════════════

function calculatePrivacyRisk(privacyData) {
  let score = 0;
  const trackerCount = (privacyData.trackers || []).length;
  if (trackerCount >= 10) score += 4;
  else if (trackerCount >= 6) score += 3;
  else if (trackerCount >= 3) score += 2;
  else if (trackerCount >= 1) score += 1;

  if (privacyData.policy?.thirdPartySharing) score += 1.5;
  if (privacyData.policy?.noOptOut) score += 1.5;
  if (privacyData.policy?.extensiveCollection) score += 1;
  if (privacyData.fingerprinting) score += 2;

  return Math.min(10, parseFloat(score.toFixed(1)));
}

function calculateManipulationRisk(manipulationData) {
  const weights = { low: 0.8, medium: 2.0, high: 4.0 };
  let score = 0;
  (manipulationData.patterns || []).forEach(p => {
    score += (weights[p.severity] || 0.8) * (p.confidence || 1.0);
  });
  return Math.min(10, parseFloat(score.toFixed(1)));
}

function getRiskLevel(score) {
  if (score >= 8.5) return 'CRITICAL';
  if (score >= 6.5) return 'HIGH';
  if (score >= 4.0) return 'MEDIUM';
  if (score >= 2.0) return 'LOW';
  return 'SAFE';
}

function generateInsight(analysis) {
  const p = analysis.overall.privacyRisk;
  const m = analysis.overall.manipulationRisk;
  const trackers = analysis.privacy.trackers.length;
  const patterns = analysis.manipulation.patterns.length;

  if (p >= 7 && m >= 7) {
    return `🚨 Exploits you on BOTH fronts — ${trackers} trackers + ${patterns} dark patterns. Violates DPDP Act 2023 & CCPA 2023.`;
  }
  if (p >= 6.5) {
    return `⚠️ ${trackers} trackers detected. Data sharing without clear consent. Potential DPDP Act 2023 violation.`;
  }
  if (m >= 6.5) {
    return `⚠️ ${patterns} dark pattern(s) detected. Psychological manipulation found. CCPA Guidelines 2023 violation.`;
  }
  if (trackers === 0 && patterns === 0) {
    return '✅ No major privacy violations or dark patterns detected.';
  }
  return `ℹ️ ${trackers} tracker(s) and ${patterns} concern(s) found. Check the Privacy and Manipulation tabs.`;
}

function getBadgeColor(level) {
  const colors = {
    CRITICAL: '#ef4444',
    HIGH: '#f97316',
    MEDIUM: '#eab308',
    LOW: '#22c55e',
    SAFE: '#6ee7b7',
  };
  return colors[level] || '#6ee7b7';
}

// ═══════════════════════════════════════════════════════════════════════════
// Normalize domain
// ═══════════════════════════════════════════════════════════════════════════

function normalizeDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Backend relay (optional — gracefully skips if not available)
// ═══════════════════════════════════════════════════════════════════════════

const BACKEND_URL = 'http://localhost:8000';

async function sendToBackend(analysis) {
  try {
    const response = await fetch(`${BACKEND_URL}/analyze-complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: analysis.url,
        privacy_data: analysis.privacy,
        manipulation_data: analysis.manipulation,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) {
      const backendResult = await response.json();
      // Merge AI insight and regulatory violations from backend
      const domain = normalizeDomain(analysis.url);
      chrome.storage.local.get([domain], (result) => {
        const stored = result[domain] || {};
        stored.aiInsight = backendResult.combined_insight;
        stored.regulatoryViolations = backendResult.regulatory_violations;
        stored.backendAnalyzed = true;
        chrome.storage.local.set({ [domain]: stored });
      });
    }
  } catch {
    // Backend not running — silently skip
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Message handler
// ═══════════════════════════════════════════════════════════════════════════

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyzeComplete') {
    const data = request.data;
    const domain = normalizeDomain(data.url);

    const privacyRisk = calculatePrivacyRisk(data.privacy);
    const manipulationRisk = calculateManipulationRisk(data.manipulation);
    const overallRisk = parseFloat(((privacyRisk + manipulationRisk) / 2).toFixed(1));
    const overallLevel = getRiskLevel(overallRisk);

    const analysis = {
      domain,
      url: data.url,
      timestamp: data.timestamp,
      privacy: {
        ...data.privacy,
        riskScore: privacyRisk,
        riskLevel: getRiskLevel(privacyRisk),
      },
      manipulation: {
        ...data.manipulation,
        riskScore: manipulationRisk,
        riskLevel: getRiskLevel(manipulationRisk),
      },
      overall: {
        riskScore: overallRisk,
        riskLevel: overallLevel,
        privacyRisk,
        manipulationRisk,
        totalViolations: data.privacy.trackers.length + data.manipulation.patterns.length,
        insight: '',
      },
    };

    analysis.overall.insight = generateInsight(analysis);

    // Persist to storage
    chrome.storage.local.set({ [domain]: analysis });

    // Update badge on the tab
    const tabId = sender.tab?.id;
    if (tabId) {
      const badgeText = overallRisk > 0 ? overallRisk.toFixed(1) : '';
      chrome.action.setBadgeText({ text: badgeText, tabId });
      chrome.action.setBadgeBackgroundColor({ color: getBadgeColor(overallLevel), tabId });
    }

    // Optionally enrich with backend AI
    sendToBackend(analysis).catch(() => {});

    sendResponse({ success: true, domain });
  }

  if (request.action === 'getAnalysis') {
    const domain = request.domain;
    chrome.storage.local.get([domain], (result) => {
      sendResponse({ analysis: result[domain] || null });
    });
    return true; // async
  }

  return true;
});

// Clear badge when tab navigates
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    chrome.action.setBadgeText({ text: '', tabId }).catch(() => {});
  }
});
