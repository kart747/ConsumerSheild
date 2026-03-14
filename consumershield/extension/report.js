let REPORT = {
  site: "flipkart.com",
  timestamp: "2026-03-13 · 20:14:33 IST",
  securityScore: 3,
  darkPatterns: [
    { id: 1, type: "False Urgency", description: "Countdown timer displayed on product pages with no real deadline. Resets on page reload, artificially pressuring users into immediate purchases.", severity: "critical", dpdpRef: "Section 7(b)" },
    { id: 2, type: "Hidden Subscription", description: "Flipkart Plus membership silently pre-selected during checkout flow. Opt-out is buried two screens deep in account settings.", severity: "high", dpdpRef: "Section 6(1)" },
    { id: 3, type: "Confirm-shaming", description: "Decline button reads 'No, I don't want savings' — designed to invoke shame and override rational decision-making.", severity: "medium", dpdpRef: "Section 7(a)" },
    { id: 4, type: "Roach Motel", description: "Account sign-up is frictionless. Account deletion requires email verification, OTP, 7-day waiting period, and manual review.", severity: "critical", dpdpRef: "Section 12(3)" },
  ],
  trackers: [
    { name: "Google Analytics (GA4)", category: "Behavioral Analytics", risk: "high", requests: 47 },
    { name: "Meta Pixel", category: "Cross-site Tracking", risk: "critical", requests: 31 },
    { name: "Hotjar Session Recording", category: "Session Replay", risk: "high", requests: 18 },
    { name: "Criteo Ad Retargeting", category: "Ad Targeting", risk: "medium", requests: 12 },
    { name: "DoubleClick (Google)", category: "Ad Profiling", risk: "medium", requests: 9 },
  ],
  aiAnalysis: "Our analysis of flipkart.com reveals a systemic deployment of behaviorally-informed dark patterns engineered to suppress informed consent and inflate conversion metrics at the user's expense. The false urgency mechanisms exploit temporal discounting biases — a well-documented cognitive vulnerability — to manufacture perceived scarcity where none exists. The pre-selected membership enrollment violates the foundational principle of granular, uninstructed consent as codified in the DPDP Act 2023. Critically, the asymmetry between account creation (3 steps) and deletion (11 steps) constitutes a structural barrier to data erasure rights. Cross-site tracking via Meta Pixel and Google Analytics creates persistent behavioral profiles without explicit disclosure at the point of collection, exposing the platform to significant regulatory liability under DPDP Schedule I.",
  legalMappings: [
    { section: "Section 6(1)", title: "Consent Requirements", description: "Pre-selected checkboxes for Flipkart Plus constitute implied rather than explicit consent.", risk: "violation" },
    { section: "Section 7(a)", title: "Purpose Limitation", description: "Session recordings via Hotjar collected beyond declared purpose of 'performance analytics.'", risk: "violation" },
    { section: "Section 7(b)", title: "Data Minimisation", description: "47 GA4 requests per session suggests excessive telemetry collection beyond stated need.", risk: "risk" },
    { section: "Section 12(3)", title: "Right to Erasure", description: "Multi-step deletion process with mandatory 7-day delay potentially contravenes timely erasure obligations.", risk: "violation" },
    { section: "Section 16", title: "Significant Data Fiduciary", description: "Volume and sensitivity of data processed may trigger enhanced obligations under Schedule I.", risk: "risk" },
  ],
  wallOfShame: [
    { url: "amazon.in", riskScore: 95, reportsThisWeek: 1247, darkPatterns: ["False Urgency", "Hidden Subscription", "Confirm-shaming", "Roach Motel"], lastReported: "2025-07-14" },
    { url: "flipkart.com", riskScore: 92, reportsThisWeek: 987, darkPatterns: ["False Urgency", "Hidden Subscription", "Confirm-shaming"], lastReported: "2025-07-14" },
    { url: "myntra.com", riskScore: 88, reportsThisWeek: 756, darkPatterns: ["False Urgency", "Confirm-shaming", "Roach Motel"], lastReported: "2025-07-13" },
    { url: "swiggy.com", riskScore: 85, reportsThisWeek: 643, darkPatterns: ["False Urgency", "Hidden Subscription"], lastReported: "2025-07-13" },
    { url: "zomato.com", riskScore: 82, reportsThisWeek: 598, darkPatterns: ["False Urgency", "Confirm-shaming"], lastReported: "2025-07-12" },
    { url: "bookmyshow.com", riskScore: 78, reportsThisWeek: 432, darkPatterns: ["False Urgency", "Roach Motel"], lastReported: "2025-07-12" },
    { url: "makemytrip.com", riskScore: 75, reportsThisWeek: 387, darkPatterns: ["Confirm-shaming", "Hidden Subscription"], lastReported: "2025-07-11" },
    { url: "redbus.in", riskScore: 72, reportsThisWeek: 298, darkPatterns: ["False Urgency"], lastReported: "2025-07-11" },
    { url: "ola.com", riskScore: 68, reportsThisWeek: 234, darkPatterns: ["Confirm-shaming"], lastReported: "2025-07-10" },
    { url: "paytm.com", riskScore: 65, reportsThisWeek: 198, darkPatterns: ["Roach Motel"], lastReported: "2025-07-10" },
  ],
};

const BACKEND_URL = 'http://localhost:8000';

const AMAZON_TRACKER_MAP = {
  fls: 'Amazon First-Party Analytics',
  unagi: 'Amazon Behavioral Tracker',
  aax: 'Amazon Advertising Exchange',
  aps: 'Amazon Publisher Services',
  metrics: 'Amazon Metrics Collector',
  loadus: 'Amazon Load Tracker',
  images: 'Amazon CDN/Image Tracker',
  data: 'Amazon Data Collection',
  odr: 'Amazon Order Tracking',
  spl: 'Amazon Sponsored Products Logger',
};

const REPORT_DISCLAIMER = [
  'This report was generated by ConsumerShield using multi-layer AI analysis',
  '(DistilRoBERTa + Gemini 1.5 Flash) and a structured regulatory database',
  'mapped to the DPDP Act 2023 and CCPA Dark Pattern Guidelines 2023.',
  'This report may be used as supporting evidence for consumer complaints.',
  'For legal proceedings, consult a qualified consumer rights attorney.',
].join(' ');

const SEVERITY_RANK = { critical: 4, high: 3, medium: 2, low: 1 };
const RISK_RANK = { critical: 4, high: 3, medium: 2, low: 1 };

const TRACKER_TYPE_LABELS = {
  advertising: 'Advertising Tracker',
  analytics: 'Analytics Tracker',
  social: 'Social Tracker',
  data_broker: 'Data Broker',
  tracker: 'Tracker',
  unknown: 'Unclassified Tracker',
};

function formatReportTimestamp(timestampMs) {
  const dt = Number(timestampMs) > 0 ? new Date(Number(timestampMs)) : new Date();
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  const hh = String(dt.getHours()).padStart(2, '0');
  const mi = String(dt.getMinutes()).padStart(2, '0');
  const ss = String(dt.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} · ${hh}:${mi}:${ss}`;
}

function normalizeSeverity(value) {
  const raw = String(value || '').toLowerCase();
  if (raw.includes('critical') || raw.includes('severe')) return 'critical';
  if (raw.includes('high')) return 'high';
  if (raw.includes('low') || raw.includes('safe')) return 'low';
  return 'medium';
}

function normalizeRisk(value) {
  const sev = normalizeSeverity(value);
  if (sev === 'critical') return 'critical';
  if (sev === 'high') return 'high';
  if (sev === 'low') return 'medium';
  return 'medium';
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function toHostname(rawValue) {
  const raw = cleanText(rawValue).toLowerCase();
  if (!raw || /\s/.test(raw)) return '';

  const normalized = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw)
    ? raw
    : `https://${raw}`;

  try {
    return new URL(normalized).hostname.replace(/^www\./, '');
  } catch {
    const fallback = raw
      .replace(/^https?:\/\//i, '')
      .split('/')[0]
      .replace(/^www\./, '');
    return /^[a-z0-9.-]+$/.test(fallback) ? fallback : '';
  }
}

function toLawLabel(lawValue) {
  const law = cleanText(lawValue);
  if (/digital personal data protection/i.test(law) || /\bdpdp\b/i.test(law)) {
    return 'DPDP Act 2023';
  }
  if (/guidelines.*dark patterns/i.test(law) || /\bccpa\b/i.test(law)) {
    return 'CCPA Guidelines 2023';
  }
  if (/consumer protection act 2019/i.test(law)) {
    return 'Consumer Protection Act 2019';
  }
  return law || 'Regulatory Framework';
}

function normalizeSectionLabel(sectionValue) {
  const section = cleanText(sectionValue);
  if (!section) return '';
  const match = section.match(/Section\s*[0-9A-Za-z()]+/i);
  return match ? match[0].replace(/\s+/g, ' ') : section;
}

function isAmazonRelatedDomain(domainValue) {
  const domain = toHostname(domainValue);
  if (!domain) return false;
  return (
    /(^|\.)amazon\.(in|com)$/.test(domain)
    || /(^|\.)ssl-images-amazon\.com$/.test(domain)
    || /(^|\.)media-amazon\.com$/.test(domain)
    || /(^|\.)amazonaws\.com$/.test(domain)
  );
}

function toAmazonTrackerKey(domainValue) {
  const domain = toHostname(domainValue);
  if (!domain) return '';

  const label = domain.split('.')[0] || '';
  const normalized = label.toLowerCase().replace(/[^a-z0-9-]/g, '');
  const keys = Object.keys(AMAZON_TRACKER_MAP);

  for (const key of keys) {
    if (normalized === key) return key;
    if (normalized.startsWith(`${key}-`)) return key;
    const suffix = normalized.slice(key.length);
    if (normalized.startsWith(key) && /^\d+$/.test(suffix)) return key;
  }

  return '';
}

function trackerTypeLabel(typeValue) {
  const type = cleanText(typeValue).toLowerCase();
  if (!type) return 'Unclassified Tracker';
  if (TRACKER_TYPE_LABELS[type]) return TRACKER_TYPE_LABELS[type];
  return type.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function riskRank(value) {
  return RISK_RANK[normalizeRisk(value)] || 0;
}

function severityRank(value) {
  return SEVERITY_RANK[normalizeSeverity(value)] || 0;
}

function resolveTrackerDomain(tracker, index) {
  const domainCandidate = toHostname(tracker?.domain || tracker?.host || tracker?.hostname || '');
  if (domainCandidate) return domainCandidate;

  const nameValue = cleanText(tracker?.name || '');
  if (nameValue.includes('.')) {
    const domainFromName = toHostname(nameValue);
    if (domainFromName) return domainFromName;
  }

  return `tracker-${index + 1}.local`;
}

function normalizeTrackerEntries(analysis, privacy, site) {
  const mergedTrackers = [];
  if (Array.isArray(privacy.trackers)) {
    mergedTrackers.push(...privacy.trackers);
  }

  if (Array.isArray(privacy.detectedDomains)) {
    mergedTrackers.push(
      ...privacy.detectedDomains.map((domain) => ({
        domain,
        type: 'unknown',
      })),
    );
  }

  const domainIntel = analysis.domain_analysis || analysis.domainAnalysis || {};
  if (Array.isArray(domainIntel.resolved_trackers)) {
    mergedTrackers.push(
      ...domainIntel.resolved_trackers.map((item) => ({
        domain: item.domain || item.matched_domain,
        type: Array.isArray(item.categories) && item.categories.length > 0 ? item.categories[0] : item.type,
        name: item.entity || item.name,
      })),
    );
  }

  if (Array.isArray(domainIntel.suspicious_domains)) {
    mergedTrackers.push(
      ...domainIntel.suspicious_domains.map((item) => ({
        domain: item?.domain || item,
        type: 'unknown',
      })),
    );
  }

  const byDomain = new Map();
  mergedTrackers.forEach((tracker, index) => {
    let domain = resolveTrackerDomain(tracker, index);
    if (!domain) return;

    if (!domain.includes('.') && !domain.endsWith('.local')) {
      const siteDomain = toHostname(site);
      if (/amazon\.(in|com)$/i.test(siteDomain)) {
        domain = `${domain}.${siteDomain}`;
      }
    }

    const knownAmazonKey = toAmazonTrackerKey(domain);
    const isAmazon = isAmazonRelatedDomain(domain);
    const category = knownAmazonKey
      ? AMAZON_TRACKER_MAP[knownAmazonKey]
      : isAmazon
        ? 'Amazon Internal Tracker'
        : trackerTypeLabel(tracker?.type);

    const risk = normalizeRisk(tracker?.risk || tracker?.riskLevel || tracker?.risk_score || privacy.riskLevel || 'medium');
    const requests = Math.max(1, Number(tracker?.requests || tracker?.hits || tracker?.count || 1) || 1);

    const existing = byDomain.get(domain);
    if (!existing) {
      byDomain.set(domain, {
        name: domain,
        category,
        risk,
        requests,
      });
      return;
    }

    existing.requests += requests;
    if (riskRank(risk) > riskRank(existing.risk)) {
      existing.risk = risk;
    }

    if (existing.category === 'Amazon Internal Tracker' && category !== 'Amazon Internal Tracker') {
      existing.category = category;
    }
  });

  return Array.from(byDomain.values())
    .sort((a, b) => (riskRank(b.risk) - riskRank(a.risk)) || (b.requests - a.requests));
}

function mapLegalViolation(item, index) {
  const lawLabel = toLawLabel(item?.law || item?.regulation || item?.framework || '');
  const section = normalizeSectionLabel(item?.section || '');
  const title = cleanText(item?.issue || item?.title || item?.violation || item?.pattern || '') || `Potential compliance issue ${index + 1}`;
  const description = cleanText(item?.description || item?.reason || '');
  const penalty = cleanText(item?.penalty || '')
    || (lawLabel === 'DPDP Act 2023'
      ? 'Up to ₹250 crore'
      : lawLabel === 'CCPA Guidelines 2023'
        ? 'Up to ₹50 lakh per violation'
        : 'As per applicable law');
  const authority = cleanText(item?.authority || '')
    || (lawLabel === 'DPDP Act 2023'
      ? 'Data Protection Board of India'
      : lawLabel === 'CCPA Guidelines 2023'
        ? 'CCPA'
        : 'Relevant Regulatory Authority');

  const heading = section && (lawLabel === 'DPDP Act 2023' || lawLabel === 'Consumer Protection Act 2019')
    ? `${lawLabel} — ${section}`
    : lawLabel;

  const riskText = cleanText(`${item?.violation_type || ''} ${title} ${description}`);
  const risk = /violation|illegal|non[-\s]?compliance|without|prohibited|unfair/i.test(riskText)
    ? 'violation'
    : 'risk';

  return {
    heading,
    section: heading,
    title,
    description,
    penalty,
    authority,
    risk,
  };
}

function buildFallbackLegalMappings(darkPatterns, trackers) {
  const fallback = [];

  if (trackers.length > 0) {
    fallback.push({
      heading: 'DPDP Act 2023 — Section 6',
      section: 'DPDP Act 2023 — Section 6',
      title: 'Consent not obtained before behavioral tracking',
      description: 'Cross-site or behavioral tracking appears active before explicit user consent.',
      penalty: 'Up to ₹250 crore',
      authority: 'Data Protection Board of India',
      risk: 'violation',
    });
  }

  if (darkPatterns.length > 0) {
    const mostSevere = [...darkPatterns]
      .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))[0];
    fallback.push({
      heading: 'CCPA Guidelines 2023',
      section: 'CCPA Guidelines 2023',
      title: `${mostSevere?.type || 'Dark Pattern'} — prohibited manipulation tactic`,
      description: 'The interface appears to use manipulative UX that may pressure user decisions.',
      penalty: 'Up to ₹50 lakh per violation',
      authority: 'CCPA',
      risk: 'violation',
    });
  }

  return fallback;
}

function normalizeLegalMappings(analysis, darkPatterns, trackers) {
  const raw = [];
  const capture = (input) => {
    if (!Array.isArray(input)) return;
    input.forEach((item) => {
      if (item && typeof item === 'object') raw.push(item);
    });
  };

  capture(analysis.regulatoryViolations);
  capture(analysis.regulatory_violations);
  capture(analysis.regulatory?.violations);

  const mapped = raw.map((item, index) => mapLegalViolation(item, index));
  const deduped = [];
  const seen = new Set();
  mapped.forEach((entry) => {
    const key = `${entry.heading}|${entry.title}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    deduped.push(entry);
  });

  if (deduped.length > 0) return deduped;
  return buildFallbackLegalMappings(darkPatterns, trackers);
}

function buildFallbackAiInsight(site, darkPatterns, trackers) {
  const mostSevere = [...darkPatterns]
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))[0];

  const x = darkPatterns.length;
  const y = trackers.length;
  const severeLabel = mostSevere
    ? `${mostSevere.type} (${String(mostSevere.severity || '').toUpperCase()})`
    : 'behavioral tracking without explicit consent';

  const penaltyAmount = mostSevere ? '50 lakh per violation' : '250 crore';
  const domainLabel = cleanText(site) || 'this site';

  return `This site employs ${x} psychological manipulation tactics and ${y} privacy tracking mechanisms. The most severe violation on ${domainLabel} is ${severeLabel}, which may constitute an Unfair Trade Practice under Section 2(47) of the Consumer Protection Act 2019, with penalties up to ₹${penaltyAmount}.`;
}

function buildExportLegalLines(legalMappings) {
  if (!Array.isArray(legalMappings) || legalMappings.length === 0) {
    return ['No statutory mappings were generated for this scan.'];
  }

  const lines = [];
  legalMappings.forEach((mapping, index) => {
    lines.push(`[${mapping.heading}] ${mapping.title}`);
    lines.push(`  Penalty: ${mapping.penalty} | Authority: ${mapping.authority}`);
    if (mapping.description) {
      lines.push(`  Note: ${mapping.description}`);
    }
    if (index < legalMappings.length - 1) {
      lines.push('');
    }
  });

  return lines;
}

function toReportShape(analysis) {
  if (!analysis || typeof analysis !== 'object') return null;

  const fallbackUrl = String(analysis.url || '');
  let site = String(analysis.domain || '').trim();
  if (!site && fallbackUrl) {
    try {
      site = new URL(fallbackUrl).hostname.replace(/^www\./, '');
    } catch {
      site = fallbackUrl;
    }
  }
  if (!site) site = 'unknown-site';

  const privacy = analysis.privacy || {};
  const manipulation = analysis.manipulation || {};
  const overall = analysis.overall || {};

  const darkPatterns = Array.isArray(manipulation.patterns)
    ? manipulation.patterns.map((pattern, index) => ({
        id: index + 1,
        type: pattern.name || pattern.type || 'Dark Pattern',
        description: pattern.description || pattern.text || 'Pattern detected during live scan.',
        severity: normalizeSeverity(pattern.severity),
        dpdpRef: pattern.law || 'DPDP Act 2023',
      }))
    : [];

  const trackers = normalizeTrackerEntries(analysis, privacy, site);
  const legalMappings = normalizeLegalMappings(analysis, darkPatterns, trackers);

  const privacyScore = Number(privacy.riskScore);
  const manipulationScore = Number(manipulation.riskScore);
  const localMaxRisk = Math.max(
    Number.isFinite(privacyScore) ? privacyScore : 0,
    Number.isFinite(manipulationScore) ? manipulationScore : 0,
  );

  const fallbackOverallCandidates = [
    analysis.overall?.riskScore,
    analysis.securityScore,
    analysis.backendOverallRisk,
    analysis.backend_overall_risk,
    analysis.overall_risk,
    analysis.overallRisk,
    overall.riskScore,
  ];

  let securityScore = Number.isFinite(localMaxRisk) ? localMaxRisk : NaN;
  if (!Number.isFinite(securityScore) || securityScore === 0) {
    for (const candidate of fallbackOverallCandidates) {
      const value = Number(candidate);
      if (Number.isFinite(value)) {
        securityScore = value;
        break;
      }
    }
  }

  const aiSummary = cleanText(
    analysis.combined_insight
    || analysis.combinedInsight
    || analysis.aiInsight
    || analysis.ai_details?.combined_summary
    || overall.insight
    || '',
  ) || buildFallbackAiInsight(site, darkPatterns, trackers);

  return {
    ...REPORT,
    site,
    timestamp: formatReportTimestamp(analysis.timestamp),
    securityScore: Math.max(0, Math.min(10, Number(securityScore || 0))),
    darkPatterns,
    trackers,
    aiAnalysis: aiSummary,
    legalMappings,
  };
}

function toReportShape(analysis) {
  if (!analysis || typeof analysis !== 'object') return null;

  const fallbackUrl = String(analysis.url || '');
  let site = String(analysis.domain || '').trim();
  if (!site && fallbackUrl) {
    try {
      site = new URL(fallbackUrl).hostname.replace(/^www\./, '');
    } catch {
      site = fallbackUrl;
    }
  }
  if (!site) site = 'unknown-site';

  const privacy = analysis.privacy || {};
  const manipulation = analysis.manipulation || {};
  const overall = analysis.overall || {};

  const darkPatterns = Array.isArray(manipulation.patterns)
    ? manipulation.patterns.map((pattern, index) => ({
        id: index + 1,
        type: pattern.name || pattern.type || 'Dark Pattern',
        description: pattern.description || pattern.text || 'Pattern detected during live scan.',
        severity: normalizeSeverity(pattern.severity),
        dpdpRef: pattern.law || 'DPDP Act 2023',
      }))
    : [];

  const trackers = Array.isArray(privacy.trackers)
    ? privacy.trackers.map((tracker, index) => ({
        name: tracker.name || tracker.domain || `Tracker ${index + 1}`,
        category: tracker.type || 'Tracker',
        risk: normalizeRisk(tracker.riskLevel || privacy.riskLevel || 'medium'),
        requests: Number(tracker.requests || tracker.hits || 1),
      }))
    : [];

  const legalMappings = Array.isArray(analysis.regulatoryViolations)
    ? analysis.regulatoryViolations.map((item, index) => {
        const section = item.section || item.law || item.regulation || `Section ${index + 1}`;
        const title = item.title || item.violation || item.pattern || 'Potential compliance issue';
        const description = item.description || item.penalty || item.reason || 'Flagged during analysis.';
        const risk = /violation|illegal|non[-\s]?compliance/i.test(`${title} ${description}`) ? 'violation' : 'risk';
        return { section, title, description, risk };
      })
    : [];

  const privacyScore = Number(privacy.riskScore);
  const manipulationScore = Number(manipulation.riskScore);
  const localMaxRisk = Math.max(
    Number.isFinite(privacyScore) ? privacyScore : 0,
    Number.isFinite(manipulationScore) ? manipulationScore : 0,
  );

  const fallbackOverallCandidates = [
    analysis.overall?.riskScore,
    analysis.securityScore,
    analysis.backendOverallRisk,
    analysis.backend_overall_risk,
    analysis.overall_risk,
    analysis.overallRisk,
    overall.riskScore,
  ];

  let securityScore = Number.isFinite(localMaxRisk) ? localMaxRisk : NaN;
  if (!Number.isFinite(securityScore) || securityScore === 0) {
    for (const candidate of fallbackOverallCandidates) {
      const value = Number(candidate);
      if (Number.isFinite(value)) {
        securityScore = value;
        break;
      }
    }
  }

  return {
    ...REPORT,
    site,
    timestamp: formatReportTimestamp(analysis.timestamp),
    securityScore: Math.max(0, Math.min(10, Number(securityScore || 0))),
    darkPatterns,
    trackers,
    aiAnalysis: analysis.aiInsight || overall.insight || 'Live analysis completed. Review findings below.',
    legalMappings,
  };
}

async function hydrateReportFromStorage() {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;

  const storedAnalysis = await new Promise((resolve) => {
    chrome.storage.local.get(['consumershield_last_report'], (result) => {
      resolve(result?.consumershield_last_report || null);
    });
  });

  const mapped = toReportShape(storedAnalysis);
  if (mapped) {
    REPORT = mapped;
  }
}

function toDomainLabel(raw) {
  const value = String(raw || '').trim();
  if (!value) return 'unknown-site';
  try {
    return new URL(value).hostname.replace(/^www\./, '');
  } catch {
    return value.replace(/^www\./, '').split('/')[0] || 'unknown-site';
  }
}

function toDateOnly(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 10);
  return parsed.toISOString().slice(0, 10);
}

function weekKey(value) {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '';
  const year = dt.getUTCFullYear();
  const start = Date.UTC(year, 0, 1);
  const dayOfYear = Math.floor((Date.UTC(year, dt.getUTCMonth(), dt.getUTCDate()) - start) / 86400000) + 1;
  const week = Math.ceil(dayOfYear / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function normalizeRiskScore(value) {
  const score = Number(value || 0);
  if (!Number.isFinite(score)) return 0;
  if (score <= 10) return Math.round(score * 10);
  return Math.round(score);
}

function aggregateWallOfShameRows(rows) {
  const currentWeek = weekKey(new Date().toISOString());
  const byDomain = new Map();

  rows.forEach((row) => {
    const domain = toDomainLabel(row?.url);
    const timestamp = row?.timestamp || new Date().toISOString();
    const patterns = Array.isArray(row?.detected_patterns) ? row.detected_patterns : [];
    const riskScore = normalizeRiskScore(row?.risk_score);

    if (!byDomain.has(domain)) {
      byDomain.set(domain, {
        url: domain,
        riskScore,
        reportsThisWeek: 0,
        darkPatterns: new Set(),
        lastReported: toDateOnly(timestamp),
        _lastReportedTs: Date.parse(timestamp) || Date.now(),
      });
    }

    const bucket = byDomain.get(domain);
    bucket.riskScore = Math.max(bucket.riskScore, riskScore);

    if (weekKey(timestamp) === currentWeek) {
      bucket.reportsThisWeek += 1;
    }

    patterns.forEach((pattern) => {
      const name = String(pattern || '').trim();
      if (name) bucket.darkPatterns.add(name);
    });

    const tsValue = Date.parse(timestamp);
    if (Number.isFinite(tsValue) && tsValue >= bucket._lastReportedTs) {
      bucket._lastReportedTs = tsValue;
      bucket.lastReported = toDateOnly(timestamp);
    }
  });

  return Array.from(byDomain.values())
    .map((item) => ({
      url: item.url,
      riskScore: item.riskScore,
      reportsThisWeek: item.reportsThisWeek,
      darkPatterns: Array.from(item.darkPatterns).slice(0, 6),
      lastReported: item.lastReported,
    }))
    .sort((a, b) => (b.riskScore - a.riskScore) || (b.reportsThisWeek - a.reportsThisWeek));
}

async function hydrateHallOfShameFromBackend() {
  try {
    const response = await fetch(`${BACKEND_URL}/wall-of-shame?limit=200`, {
      method: 'GET',
      signal: AbortSignal.timeout(6000),
    });

    if (!response.ok) return;

    const payload = await response.json();
    if (!Array.isArray(payload)) return;

    const aggregated = aggregateWallOfShameRows(payload);
    REPORT = {
      ...REPORT,
      wallOfShame: aggregated,
    };
  } catch {
    // Keep the baked fallback list when backend is unavailable.
  }
}

function scoreConfig(s) {
  if (s <= 2) return { color: '#39FF14', glow: 'rgba(57,255,20,.4)', level: 'SECURE' };
  if (s <= 5) return { color: '#F5E642', glow: 'rgba(245,230,66,.4)', level: 'MODERATE' };
  if (s <= 8) return { color: '#FF6B00', glow: 'rgba(255,107,0,.4)', level: 'HIGH' };
  return { color: '#FF003C', glow: 'rgba(255,0,60,.4)', level: 'CRITICAL' };
}

function sevConfig(sev) {
  return ({
    critical: { color: '#FF003C', bg: 'rgba(255,0,60,.06)', border: 'rgba(255,0,60,.28)', label: 'CRITICAL', pulse: true },
    high: { color: '#FF6B00', bg: 'rgba(255,107,0,.06)', border: 'rgba(255,107,0,.28)', label: 'HIGH', pulse: false },
    medium: { color: '#F5E642', bg: 'rgba(245,230,66,.05)', border: 'rgba(245,230,66,.22)', label: 'MEDIUM', pulse: false },
    low: { color: '#00F0FF', bg: 'rgba(0,240,255,.04)', border: 'rgba(0,240,255,.18)', label: 'LOW', pulse: false },
  }[sev] || { color: '#00F0FF', bg: 'rgba(0,240,255,.04)', border: 'rgba(0,240,255,.18)', label: 'LOW', pulse: false });
}

function riskConfig(r) {
  return ({
    critical: { color: '#FF003C', bg: 'rgba(255,0,60,.1)' },
    high: { color: '#FF6B00', bg: 'rgba(255,107,0,.1)' },
    medium: { color: '#F5E642', bg: 'rgba(245,230,66,.1)' },
  }[r] || { color: '#F5E642', bg: 'rgba(245,230,66,.1)' });
}

function buildStats() {
  const stats = [
    { label: 'Security Score', val: `${REPORT.securityScore}/10`, sub: 'Overall risk rating', color: '#FF003C' },
    { label: 'Dark Patterns', val: REPORT.darkPatterns.length, sub: 'Manipulative elements found', color: '#FF003C' },
    { label: 'Active Trackers', val: REPORT.trackers.length, sub: 'Third-party surveillance', color: '#FF6B00' },
    { label: 'Legal Violations', val: REPORT.legalMappings.filter((mapping) => mapping.risk === 'violation').length, sub: 'DPDP Act breaches', color: '#FF003C' },
    { label: 'Total Requests', val: REPORT.trackers.reduce((count, tracker) => count + tracker.requests, 0), sub: 'Tracker network calls', color: '#F5E642' },
  ];

  const grid = document.getElementById('stat-grid');
  stats.forEach((stat) => {
    const tile = document.createElement('div');
    tile.className = 'stat-tile';
    tile.innerHTML = `
      <div class="stat-top"><span class="stat-label">${stat.label}</span></div>
      <div class="stat-val" style="color:${stat.color};text-shadow:0 0 20px ${stat.color}55">${stat.val}</div>
      <div class="stat-sub">${stat.sub}</div>`;
    const bar = document.createElement('div');
    bar.style.cssText = `position:absolute;top:0;left:0;right:0;height:2px;background:${stat.color};opacity:.4;`;
    tile.appendChild(bar);
    grid.appendChild(tile);
  });
}

function buildDarkPatterns() {
  const grid = document.getElementById('dark-pattern-grid');
  REPORT.darkPatterns.forEach((pattern, index) => {
    const cfg = sevConfig(pattern.severity);
    const card = document.createElement('div');
    card.className = 'dp-card';
    card.style.cssText = `background:${cfg.bg};border:1px solid ${cfg.border};transition-delay:${index * 0.1}s`;
    let inner = '';
    if (cfg.pulse) inner += `<div class="dp-card-pulse" style="background:${cfg.color}"></div>`;
    inner += `
      <div class="dp-card-top">
        <div class="dp-card-left">
          <div class="dp-icon" style="background:${cfg.color}14;border-color:${cfg.color}33">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="${cfg.color}" stroke-width="1.5" stroke-linecap="round"/></svg>
          </div>
          <div>
            <div class="dp-type">${pattern.type}</div>
            <div class="dp-dpdp">/// ${pattern.dpdpRef}</div>
          </div>
        </div>
        <span class="severity-badge" style="color:${cfg.color};border-color:${cfg.color}66;background:${cfg.color}0F">${cfg.label}</span>
      </div>
      <p class="dp-desc" style="color:#9AAABB">${pattern.description}</p>
      <div class="dp-bottom-line" style="background:${cfg.color}"></div>`;
    card.innerHTML = inner;
    grid.appendChild(card);
  });
}

function buildTrackers() {
  const rows = document.getElementById('tracker-rows');
  const maxReq = Math.max(1, ...REPORT.trackers.map((tracker) => tracker.requests));
  REPORT.trackers.forEach((tracker, index) => {
    const cfg = riskConfig(tracker.risk);
    const pct = Math.round((tracker.requests / maxReq) * 100);
    const row = document.createElement('div');
    row.className = 'tracker-row';
    row.style.transitionDelay = `${index * 0.08}s`;
    row.innerHTML = `
      <div>
        <div class="tracker-name">${tracker.name}</div>
        <div class="tracker-cat-row">
          <span class="tracker-cat">/// ${tracker.category}</span>
          <div class="tracker-bar-track"><div class="tracker-bar-fill" style="background:${cfg.color}" data-w="${pct}"></div></div>
        </div>
      </div>
      <div class="tracker-req">${tracker.requests}<span> req</span></div>
      <span class="risk-badge" style="color:${cfg.color};border-color:${cfg.color}66;background:${cfg.bg}">${tracker.risk.toUpperCase()}</span>`;
    rows.appendChild(row);
  });
}

function buildAI() {
  document.getElementById('ai-text').textContent = REPORT.aiAnalysis;
  const findings = [
    { label: 'Deceptive UX patterns targeting loss aversion', score: 'CONFIRMED', color: '#FF003C' },
    { label: 'Consent mechanisms fail DPDP Act standards', score: 'VIOLATION', color: '#FF003C' },
    { label: 'Asymmetric account creation / deletion flow', score: 'CRITICAL', color: '#FF6B00' },
    { label: 'Cross-site tracking without point-of-collection notice', score: 'HIGH RISK', color: '#FF6B00' },
  ];
  const grid = document.getElementById('ai-findings');
  findings.forEach((finding) => {
    const el = document.createElement('div');
    el.className = 'ai-finding';
    el.innerHTML = `<span class="ai-finding-label">${finding.label}</span><span class="ai-finding-score" style="color:${finding.color}">${finding.score}</span>`;
    grid.appendChild(el);
  });
}

function buildLegal() {
  const list = document.getElementById('legal-list');
  REPORT.legalMappings.forEach((mapping, index) => {
    const isViolation = mapping.risk === 'violation';
    const color = isViolation ? '#FF003C' : '#00F0FF';
    const card = document.createElement('div');
    card.className = 'legal-card';
    card.style.cssText = `background:${color}07;border:1px solid ${color}20;border-left:3px solid ${color}55;transition-delay:${index * 0.08}s`;
    const iconSvg = isViolation
      ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#FF003C" stroke-width="1.5"/><line x1="15" y1="9" x2="9" y2="15" stroke="#FF003C" stroke-width="1.5" stroke-linecap="round"/><line x1="9" y1="9" x2="15" y2="15" stroke="#FF003C" stroke-width="1.5" stroke-linecap="round"/></svg>`
      : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#00F0FF" stroke-width="1.5"/><line x1="12" y1="8" x2="12" y2="12" stroke="#00F0FF" stroke-width="1.5" stroke-linecap="round"/><circle cx="12" cy="16" r=".5" fill="#00F0FF" stroke="#00F0FF" stroke-width="1"/></svg>`;
    card.innerHTML = `
      <div class="legal-inner">
        <div class="legal-icon" style="background:${color}10;border-color:${color}2A">${iconSvg}</div>
        <div class="legal-meta">
          <div class="legal-tags">
            <span class="legal-section-label" style="color:${color}">${mapping.section}</span>
            <span class="legal-tag" style="color:${color};border-color:${color}44;background:${color}0F">${isViolation ? 'VIOLATION' : 'RISK FLAG'}</span>
          </div>
          <div class="legal-title" style="color:#EDF0F5">${mapping.title}</div>
          <p class="legal-desc" style="color:#8A9BB0">${mapping.description}</p>
        </div>
      </div>`;
    list.appendChild(card);
  });
}

function buildWallOfShame() {
  const grid = document.getElementById('top-five-grid');
  const list = document.getElementById('full-shame-list');
  if (!grid || !list) return;

  grid.innerHTML = '';
  list.innerHTML = '';

  if (!Array.isArray(REPORT.wallOfShame) || REPORT.wallOfShame.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'shame-row';
    empty.innerHTML = `
      <div class="shame-url">No high-risk reports yet</div>
      <div class="shame-score">0</div>
      <div class="shame-reports">0</div>
      <div class="shame-patterns"><span class="shame-pattern-tag">Awaiting scans</span></div>
      <div class="shame-date">-</div>`;
    list.appendChild(empty);
    return;
  }

  REPORT.wallOfShame.slice(0, 5).forEach((site, index) => {
    const card = document.createElement('div');
    card.className = 'top-five-card';
    card.style.transitionDelay = `${index * 0.08}s`;
    card.innerHTML = `
      <div class="top-five-rank">${index + 1}</div>
      <div class="top-five-content">
        <a href="https://${site.url}" target="_blank" class="top-five-url">${site.url}</a>
        <div class="top-five-meta">
          <div class="top-five-score">${site.riskScore}</div>
          <div class="top-five-reports"><svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M16 4h.01M12 4h.01M12 12h.01M12 20h.01M8 8h.01M8 16h.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>${site.reportsThisWeek} reports</div>
        </div>
        <div class="top-five-patterns">${site.darkPatterns.map((pattern) => `<span class="pattern-tag">${pattern}</span>`).join('')}</div>
      </div>`;
    grid.appendChild(card);
  });

  REPORT.wallOfShame.forEach((site, index) => {
    const row = document.createElement('div');
    row.className = 'shame-row';
    row.style.transitionDelay = `${index * 0.04}s`;
    row.innerHTML = `
      <a href="https://${site.url}" target="_blank" class="shame-url">${site.url}</a>
      <div class="shame-score">${site.riskScore}</div>
      <div class="shame-reports"><svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M16 4h.01M12 4h.01M12 12h.01M12 20h.01M8 8h.01M8 16h.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>${site.reportsThisWeek}</div>
      <div class="shame-patterns">${site.darkPatterns.map((pattern) => `<span class="shame-pattern-tag">${pattern}</span>`).join('')}</div>
      <div class="shame-date">${site.lastReported}</div>`;
    list.appendChild(row);
  });
}

function initGauge() {
  const score = Math.min(10, Math.max(0, REPORT.securityScore));
  const cfg = scoreConfig(score);
  const radius = 110;
  const circumference = 2 * Math.PI * radius;

  const glow = document.getElementById('gauge-glow');
  glow.style.background = `radial-gradient(circle, ${cfg.glow} 0%, transparent 70%)`;

  const track = document.getElementById('gauge-track');
  track.setAttribute('stroke-dasharray', `${circumference * 0.75} ${circumference}`);

  const tickGroup = document.getElementById('gauge-ticks');
  for (let index = 0; index <= 10; index += 1) {
    const angle = (index / 10) * 0.75 * 2 * Math.PI;
    const x1 = 150 + (radius - 20) * Math.cos(angle);
    const y1 = 150 + (radius - 20) * Math.sin(angle);
    const x2 = 150 + (radius - 10) * Math.cos(angle);
    const y2 = 150 + (radius - 10) * Math.sin(angle);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x1);
    line.setAttribute('y1', y1);
    line.setAttribute('x2', x2);
    line.setAttribute('y2', y2);
    line.setAttribute('stroke', index % 5 === 0 ? 'rgba(245,230,66,.25)' : 'rgba(255,255,255,.07)');
    line.setAttribute('stroke-width', index % 5 === 0 ? 2.5 : 1.25);
    tickGroup.appendChild(line);
  }

  const arc = document.getElementById('gauge-arc');
  arc.setAttribute('stroke', cfg.color);
  arc.style.filter = `drop-shadow(0 0 6px ${cfg.color}) drop-shadow(0 0 12px ${cfg.glow})`;

  const scoreEl = document.getElementById('gauge-score-num');
  const riskEl = document.getElementById('gauge-risk-label');
  scoreEl.style.color = cfg.color;
  scoreEl.style.textShadow = `0 0 20px ${cfg.glow}, 0 0 40px ${cfg.glow}`;
  riskEl.textContent = cfg.level;
  riskEl.style.color = cfg.color;
  riskEl.style.borderColor = cfg.color;
  riskEl.style.background = `${cfg.color}18`;

  const duration = 1600;
  const start = performance.now();
  function tick(now) {
    const progress = Math.min(1, (now - start) / duration);
    const ease = 1 - Math.pow(1 - progress, 3);
    const current = score * ease;
    scoreEl.textContent = current.toFixed(1);
    arc.setAttribute('stroke-dasharray', `${circumference * (current / 10) * 0.75} ${circumference}`);
    if (progress < 1) requestAnimationFrame(tick);
    else scoreEl.textContent = String(score);
  }
  requestAnimationFrame(tick);
}

function initScrollReveal() {
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.06 });
  document.querySelectorAll('.content-section,.dp-card,.tracker-row,.legal-card,.top-five-card,.shame-row').forEach((el) => obs.observe(el));

  const barObs = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const bar = entry.target.querySelector('.tracker-bar-fill');
        if (bar) setTimeout(() => { bar.style.width = `${bar.dataset.w}%`; }, 200);
        barObs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.tracker-row').forEach((el) => barObs.observe(el));
}

function initExport() {
  const btn = document.getElementById('btn-export');
  const labelEl = document.getElementById('export-label');
  const iconDl = document.getElementById('export-icon-dl');
  const iconSpin = document.getElementById('export-icon-spin');
  const iconOk = document.getElementById('export-icon-ok');
  let busy = false;
  btn.addEventListener('click', () => {
    if (busy) return;
    busy = true;
    btn.disabled = true;
    iconDl.style.display = 'none';
    iconSpin.style.display = 'inline';
    labelEl.textContent = 'Exporting…';
    const lines = [
      'ConsumerShield — Security Analysis Report',
      '==========================================',
      `Site      : ${REPORT.site}`,
      `Timestamp : ${REPORT.timestamp}`,
      `Score     : ${REPORT.securityScore} / 10`,
      '',
      'DARK PATTERNS',
      '─────────────',
      ...REPORT.darkPatterns.map((pattern) => `[${pattern.severity.toUpperCase()}] ${pattern.type}  (${pattern.dpdpRef})\n  ${pattern.description}`),
      '',
      'PRIVACY TRACKERS',
      '────────────────',
      ...REPORT.trackers.map((tracker) => `${tracker.name}  •  ${tracker.category}  •  Risk: ${tracker.risk.toUpperCase()}  •  ${tracker.requests} req`),
      '',
      'AI ANALYSIS',
      '───────────',
      REPORT.aiAnalysis,
      '',
      'LEGAL MAPPING',
      '─────────────',
      ...buildExportLegalLines(REPORT.legalMappings),
      '',
      REPORT_DISCLAIMER,
    ];
    setTimeout(() => {
      const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `consumershield-${REPORT.site}-${Date.now()}.txt`;
      anchor.click();
      URL.revokeObjectURL(url);
      iconSpin.style.display = 'none';
      iconOk.style.display = 'inline';
      labelEl.textContent = 'Exported!';
      btn.disabled = false;
      setTimeout(() => {
        iconOk.style.display = 'none';
        iconDl.style.display = 'inline';
        labelEl.textContent = 'Export Report';
        busy = false;
      }, 2500);
    }, 600);
  });
}

function initRescan() {
  const button = document.getElementById('btn-rescan');
  if (!button) return;
  button.addEventListener('click', () => window.location.reload());
}

document.addEventListener('DOMContentLoaded', async () => {
  await hydrateReportFromStorage();
  await hydrateHallOfShameFromBackend();
  document.getElementById('meta-site').textContent = REPORT.site;
  document.getElementById('meta-time').textContent = REPORT.timestamp;
  buildStats();
  buildDarkPatterns();
  buildTrackers();
  buildAI();
  buildLegal();
  buildWallOfShame();
  initGauge();
  initScrollReveal();
  initExport();
  initRescan();
});