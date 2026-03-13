/**
 * ConsumerShield — Content Script
 * Runs on every page. Detects:
 *   1. Privacy violations (trackers, policy issues, fingerprinting)
 *   2. Dark patterns (8 types per CCPA Guidelines 2023)
 *   3. Applies visual overlays (blue = privacy, red = manipulation)
 */

(() => {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // TRACKER DATABASE
  // ═══════════════════════════════════════════════════════════════════════════

  const KNOWN_TRACKERS = [
    // Analytics
    { domain: 'google-analytics.com',  type: 'analytics',    name: 'Google Analytics' },
    { domain: 'googletagmanager.com',  type: 'analytics',    name: 'Google Tag Manager' },
    { domain: 'analytics.google.com',  type: 'analytics',    name: 'Google Analytics 4' },
    { domain: 'hotjar.com',            type: 'analytics',    name: 'Hotjar' },
    { domain: 'mixpanel.com',          type: 'analytics',    name: 'Mixpanel' },
    { domain: 'amplitude.com',         type: 'analytics',    name: 'Amplitude' },
    { domain: 'segment.com',           type: 'analytics',    name: 'Segment' },
    { domain: 'heap.io',               type: 'analytics',    name: 'Heap Analytics' },
    // Advertising
    { domain: 'doubleclick.net',       type: 'advertising',  name: 'DoubleClick (Google)' },
    { domain: 'googlesyndication.com', type: 'advertising',  name: 'Google AdSense' },
    { domain: 'googleadservices.com',  type: 'advertising',  name: 'Google Ad Services' },
    { domain: 'criteo.com',            type: 'advertising',  name: 'Criteo' },
    { domain: 'taboola.com',           type: 'advertising',  name: 'Taboola' },
    { domain: 'outbrain.com',          type: 'advertising',  name: 'Outbrain' },
    { domain: 'moat.com',              type: 'advertising',  name: 'Moat Analytics' },
    // Social
    { domain: 'facebook.com',          type: 'social',       name: 'Facebook Pixel' },
    { domain: 'connect.facebook.net',  type: 'social',       name: 'Facebook SDK' },
    { domain: 'platform.twitter.com',  type: 'social',       name: 'Twitter Analytics' },
    { domain: 'linkedin.com',          type: 'social',       name: 'LinkedIn Insight' },
    { domain: 'snap.com',              type: 'social',       name: 'Snapchat Pixel' },
    // Data Brokers
    { domain: 'scorecardresearch.com', type: 'data_broker',  name: 'Comscore/Scorecard' },
    { domain: 'quantserve.com',        type: 'data_broker',  name: 'Quantcast' },
    { domain: 'bluekai.com',           type: 'data_broker',  name: 'Oracle BlueKai' },
    { domain: 'adnxs.com',             type: 'data_broker',  name: 'AppNexus (Xandr)' },
    { domain: 'rubiconproject.com',    type: 'data_broker',  name: 'Rubicon Project' },
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  // DARK PATTERN SIGNATURES
  // ═══════════════════════════════════════════════════════════════════════════

  const DARK_PATTERNS = {
    urgency: {
      name: 'False Urgency',
      severity: 'high',
      law: 'CCPA Dark Patterns Guidelines 2023 — False Urgency',
      penalty: '₹10 lakh – ₹50 lakh',
      description: 'Creates artificial scarcity or time pressure to force rushed decisions.',
      patterns: [
        /only\s*(\d+|one|two|three|few|several)\s*(left|remaining|in stock|available|spots)/i,
        /hurry[!,\s]*only/i,
        /selling\s*out|sold\s*out/i,
        /selling\s*fast|going\s*fast/i,
        /limited\s*(time|offer|stock|quantity|edition|seats|availability)/i,
        /(\d+)\s*people\s*(are\s*)?(viewing|watching|looking at|browsing|interested)/i,
        /sale\s*ends?\s*(in|at|tonight|today|tomorrow|soon)/i,
        /(\d+)\s*(hours?|mins?|minutes?|seconds?)\s*(left|remaining|till|until)/i,
        /don'?t\s*miss\s*(out|this|the)/i,
        /last\s*(chance|opportunity|few|day|hours?|minute)/i,
        /ends?\s*(tonight|today|noon|midnight|soon|very soon)/i,
        /act\s*now/i,
        /before\s*(it's?\s*)?(gone|sold out)/i,
        /countdown\s*timer|timer\s*countdown/i,
        /offer\s*expires?/i,
        /\d+%\s*off.*only.*today/i,
        /flash\s*sale/i,
        /exclusive.*limited/i,
        /buy\s*now/i,
        /(?:almost|nearly|almost all)\s*(?:gone|sold out|sold)/i,
      ],
    },
    sneaking: {
      name: 'Hidden Costs (Drip Pricing)',
      severity: 'high',
      law: 'CCPA Dark Patterns Guidelines 2023 — Drip Pricing',
      penalty: '₹25 lakh – ₹50 lakh',
      description: 'Hides additional charges until late in the checkout process.',
      patterns: [
        /convenience\s*fee/i,
        /handling\s*(charges?|fee|cost)/i,
        /platform\s*fee/i,
        /processing\s*(fee|charges?|cost)/i,
        /\+\s*(?:taxes?|tds)?\s*&?\s*(?:and\s*)?fees?/i,
        /additional\s*(?:charges?|fees?|costs?)\s*(?:may\s*)?apply/i,
        /delivery\s*(?:fee|charges?|cost)\s*(?:added\s*)?(?:at\s*|during\s*)?checkout/i,
        /service\s*(?:fee|charges?)/i,
        /booking\s*fee/i,
        /transaction\s*fee/i,
        /surcharge/i,
        /(?:see|view|check).*charges.*at.*checkout/i,
        /final\s*(?:price|total).*may\s*differ/i,
        /taxes?\s*(?:and\s*)?(?:fees?|duties)\s*(?:to\s*)?(?:be\s*)?(?:added|calculated)/i,
      ],
    },
    confirmshaming: {
      name: 'Confirmshaming',
      severity: 'medium',
      law: 'CCPA Dark Patterns Guidelines 2023 — Confirmshaming',
      penalty: '₹10 lakh – ₹25 lakh',
      description: 'Uses guilt-inducing language to shame users into accepting offers.',
      patterns: [
        /no\s*(?:thanks?|thanx)[,.]?\s*i\s*(?:don'?t|prefer not|hate|refuse|skip|decline)/i,
        /no[,.]?\s*i\s*(?:enjoy|love|like|prefer)\s*(?:paying|spending|wasting|overpaying)/i,
        /i\s*(?:don'?t|do not|really don'?t|never)\s*(?:care|want|need)\s*(?:about|for)?\s*(?:saving|discount|deals?|money)/i,
        /skip[,.]?\s*i'?m?\s*(?:fine|okay|good|happy)\s*(?:with|without)\s*(?:paying|high prices|full price)/i,
        /no\s*thanks\s*i\s*prefer\s*to\s*(?:pay|overpay)/i,
        /decline.*(?:pay more|lose|miss)/i,
        /i'?d\s*rather\s*(?:not|decline)/i,
        /maybe\s*later.*let.*miss/i,
        /turn\s*(?:down|away|decline).*(?:save|offer|deal)/i,
      ],
    },
    trick_questions: {
      name: 'Trick Questions / Double Negatives',
      severity: 'medium',
      law: 'CCPA Dark Patterns Guidelines 2023 — Trick Questions',
      penalty: '₹10 lakh – ₹25 lakh',
      description: 'Uses confusing double negatives or ambiguous language on consent forms.',
      patterns: [
        /uncheck\s*(?:this\s*)?(?:box|if)\s*(?:to\s*)?(?:not|stop|opt[\s-]?out)/i,
        /do\s*not\s*(?:un)?check\s*(?:if\s*)?you\s*do\s*not\s*want/i,
        /opt\s*out\s*of\s*(?:not\s*)?receiving/i,
        /untick\s*(?:to\s*)?(?:opt[\s-]?out|receive|unsubscribe)/i,
        /leave.*checked.*continue/i,
        /(?:leaving|keep|keep it)\s*(?:this|this box|it)\s*checked.*(?:means|means you|opt|agree|accept)/i,
        /double\s*negative/i,
      ],
    },
    forced_continuity: {
      name: 'Forced Continuity',
      severity: 'high',
      law: 'CCPA Dark Patterns Guidelines 2023 — Forced Continuity',
      penalty: '₹25 lakh – ₹50 lakh',
      description: 'Auto-renews subscriptions without clear notice or easy cancellation.',
      patterns: [
        /automatically\s*(?:renew|charge|bill|debit)(?:ed)?/i,
        /auto[\s-]?(?:renew|renewal|billing)/i,
        /cancel\s*(?:any\s*)?time|cancel\s*(?:within|after)/i,
        /charged\s*(?:automatically|recurring)/i,
        /free\s*trial.*(?:then\s*)?(?:\$|₹|rs\.?)\s*[\d,\.]+/i,
        /subscription\s*(?:renews?|billed|charged)\s*(?:monthly|annually|yearly|quarterly)/i,
        /after.*free.*trial.*will.*charge/i,
        /continue.*subscription/i,
        /billing\s*(?:will|by default|automatically)/i,
        /recurring\s*(?:charges?|billing)/i,
        /to\s*(?:cancel|stop)\s*(?:subscription|charges?|billing).*(?:contact|call|visit)/i,
      ],
    },
    disguised_ads: {
      name: 'Disguised Advertisements',
      severity: 'medium',
      law: 'CCPA Dark Patterns Guidelines 2023 — Disguised Ads',
      penalty: '₹10 lakh – ₹25 lakh',
      description: 'Presents paid advertisements as organic content or results.',
      patterns: [
        /sponsored\s*(?:result|post|content|link|listing|product|ad)/i,
        /(?:^\s*|\s+)ad\s*(?:\s*·|:|\s*-|\s*$)/i,
        /promoted\s*(?:listing|result|product|post|content|by)/i,
        /advertisement/i,
        /from\s*(?:our\s*)?sponsor/i,
        /in\s*partnership\s*with/i,
        /partners\s*content/i,
        /\[ad\]/i,
        /#ad|#sponsored/i,
        /brand\s*content/i,
      ],
    },
    misdirection: {
      name: 'Misdirection',
      severity: 'medium',
      law: 'CCPA Dark Patterns Guidelines 2023 — Misdirection',
      penalty: '₹10 lakh – ₹25 lakh',
      description: 'Directs users toward unintended options through visual or hierarchical emphasis.',
      patterns: [
        /(?:highly\s*|most\s*|top\s*)?recommended/i,
        /best.*seller|best.*choice/i,
        /customers?\s*(?:also\s*)?(?:like|buy|chose|prefer)/i,
        /popular\s*(?:choice|item|product)/i,
        /trending/i,
        /(?:click\s*|tap\s*)?here\s*for\s*(?:savings?|discount|deal)/i,
        /pre[\s-]?selected/i,
        /default.*(?:yes|selected|opted)/i,
        /(?:yes|true|agree|accept).*by\s*default/i,
      ],
    },
    nagging: {
      name: 'Nagging / Persistent Prompts',
      severity: 'medium',
      law: 'CCPA Dark Patterns Guidelines 2023 — Nagging',
      penalty: '₹10 lakh – ₹25 lakh',
      description: 'Repeatedly prompts or nags users to take an action.',
      patterns: [
        /(?:newsletter|subscription|notification|offer|deal|popup|modal).*(?:subscribe|sign[\s-]?up|get|receive)/i,
        /(?:don'?t|never).*(?:show|tell|remind) .*again/i,
        /subscribe.*newsletter|newsletter.*subscribe/i,
        /get\s*(?:the latest|updates?|offers?|deals?|notifications?)/i,
        /sign\s*up\s*(?:for|to)/i,
        /stay\s*(?:updated|informed|in\s*touch)/i,
        /join.*(?:our\s*)?(?:community|list|subscribers)/i,
      ],
    },
    obstruction: {
      name: 'Obstruction / Roach Motel',
      severity: 'high',
      law: 'CCPA Dark Patterns Guidelines 2023 — Obstruction',
      penalty: '₹25 lakh – ₹50 lakh',
      description: 'Makes it difficult to cancel subscriptions, delete accounts, or compare alternatives.',
      patterns: [
        /to\s*(?:cancel|delete|unsubscribe|opt[\s-]?out)[,.]?\s*(?:call|contact|visit|go\s*to|email)/i,
        /cancel.*(?:by\s*)?(?:phone|calling|mail|email|customer\s*service)/i,
        /speak.*(?:to|with).*(?:an?\s*)?agent.*(?:to\s*)?cancel/i,
        /delete\s*account.*(?:contact|call|email)/i,
        /(?:cannot|can't|unable|not possible).*(?:cancel|delete|unsubscribe).*online/i,
        /logout.*automatic.*re[\s-]?enable/i,
      ],
    },
    preselected: {
      name: 'Pre-selected Harmful Options',
      severity: 'medium',
      law: 'CCPA Dark Patterns Guidelines 2023 — Pre-selected Options',
      penalty: '₹10 lakh – ₹25 lakh',
      description: 'Automatically selects options that benefit the company over the user.',
      patterns: [],   // detected via DOM inspection below
      domCheck: true,
    },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVACY POLICY SIGNALS
  // ═══════════════════════════════════════════════════════════════════════════

  const POLICY_SIGNALS = {
    thirdPartySharing: [
      /share\s*(your\s*)?(personal\s*)?data\s*with\s*(third[\s-]parties|partners|affiliates)/i,
      /third[\s-]party\s*(sharing|disclosure)/i,
      /sell\s*(your\s*)?data/i,
      /data\s*(may\s*be)?\s*(shared|disclosed|transferred)\s*to/i,
    ],
    noOptOut: [
      /cannot\s*opt[\s-]out/i,
      /no\s*opt[\s-]out/i,
    ],
    extensiveCollection: [
      /collect\s*(the following|information|data)\s*(including|such as)/i,
      /we\s*collect.*location.*device.*browsing/i,
    ],
    hasOptOut: [
      /opt[\s-]out/i,
      /unsubscribe/i,
      /manage\s*(your\s*)?preferences/i,
      /right\s*to\s*(withdraw|erasure|deletion)/i,
    ],
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════════

  const state = {
    trackers: [],
    policy: { thirdPartySharing: false, noOptOut: false, extensiveCollection: false, hasOptOut: false },
    fingerprinting: false,
    patterns: [],
    overlayElements: [],
  };

  // Avoid re-running on dynamic pages
  let analysisRun = false;

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. TRACKER DETECTION
  // ═══════════════════════════════════════════════════════════════════════════

  function detectTrackers() {
    const found = new Set();
    const currentDomain = window.location.hostname;

    // ─────────────────────────────────────────────────────────────────────
    // SCAN 1: Explicit script[src] attribute scanning
    // ─────────────────────────────────────────────────────────────────────
    const scriptElements = Array.from(document.querySelectorAll('script[src]'));
    scriptElements.forEach(scriptEl => {
      const scriptSrc = scriptEl.src || '';
      if (!scriptSrc) return;
      KNOWN_TRACKERS.forEach(tracker => {
        if (scriptSrc.includes(tracker.domain) && !found.has(tracker.domain)) {
          found.add(tracker.domain);
          state.trackers.push({ ...tracker, source: 'script[src]', url: scriptSrc });
        }
      });
    });

    // ─────────────────────────────────────────────────────────────────────
    // SCAN 2: Explicit iframe, img, link scanning
    // ─────────────────────────────────────────────────────────────────────
    const resourceElements = Array.from(document.querySelectorAll('iframe[src], img[src], link[href]'));
    resourceElements.forEach(el => {
      const src = el.src || el.href || '';
      if (!src) return;
      KNOWN_TRACKERS.forEach(tracker => {
        if (src.includes(tracker.domain) && !found.has(tracker.domain)) {
          found.add(tracker.domain);
          state.trackers.push({ ...tracker, source: 'resource_element', url: src });
        }
      });
    });

    // ─────────────────────────────────────────────────────────────────────
    // SCAN 3: Network requests via performance.getEntriesByType('resource')
    // ─────────────────────────────────────────────────────────────────────
    try {
      const networkRequests = performance.getEntriesByType('resource');
      networkRequests.forEach(req => {
        const reqName = req.name || '';
        KNOWN_TRACKERS.forEach(tracker => {
          if (reqName.includes(tracker.domain) && !found.has(tracker.domain)) {
            found.add(tracker.domain);
            state.trackers.push({ ...tracker, source: 'network_request', url: reqName });
          }
        });
      });
    } catch {
      // Performance API might be restricted; skip silently
    }

    // ─────────────────────────────────────────────────────────────────────
    // SCAN 4: Inline scripts for known tracker calls
    // ─────────────────────────────────────────────────────────────────────
    const inlineScripts = Array.from(document.querySelectorAll('script:not([src])'));
    const trackerKeywordMap = {
      'gtag(': { domain: 'google-analytics.com', type: 'analytics', name: 'Google Analytics (inline)' },
      'ga(':   { domain: 'google-analytics.com', type: 'analytics', name: 'Google Analytics (legacy)' },
      'fbq(':  { domain: 'facebook.com', type: 'social', name: 'Facebook Pixel (inline)' },
      'mixpanel.track': { domain: 'mixpanel.com', type: 'analytics', name: 'Mixpanel (inline)' },
      'amplitude.getInstance': { domain: 'amplitude.com', type: 'analytics', name: 'Amplitude (inline)' },
    };

    inlineScripts.forEach(el => {
      const text = el.textContent || '';
      Object.entries(trackerKeywordMap).forEach(([kw, tracker]) => {
        if (text.includes(kw) && !found.has(tracker.domain)) {
          found.add(tracker.domain);
          state.trackers.push({ ...tracker, source: 'inline_script' });
        }
      });
    });

    // Canvas fingerprinting signal
    const src = document.documentElement.innerHTML;
    if (
      src.includes('getImageData') && src.includes('canvas') ||
      src.includes('HTMLCanvasElement') && src.includes('toDataURL')
    ) {
      state.fingerprinting = true;
    }
    
    // DEBUG: Log tracker detection results
    console.log('[ConsumerShield] Trackers found:', state.trackers);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. PRIVACY POLICY ANALYSIS
  // ═══════════════════════════════════════════════════════════════════════════

  function analyzePrivacyPolicy() {
    // Look for privacy policy links on page
    const policyLinks = Array.from(document.querySelectorAll('a'))
      .filter(a => /privacy\s*policy|privacy\s*statement|data\s*protection/i.test(a.textContent));

    // Scan visible page text for policy signals (works if policy is on same page)
    const pageText = document.body?.innerText || '';

    Object.entries(POLICY_SIGNALS).forEach(([signal, regexList]) => {
      regexList.forEach(re => {
        if (re.test(pageText)) {
          state.policy[signal] = true;
        }
      });
    });

    // If has opt-out, noOptOut becomes false (opt-out available overrides detection)
    if (state.policy.hasOptOut) {
      state.policy.noOptOut = false;
    }

    // If no policy link found at all → flag as missing opt-out
    if (policyLinks.length === 0 && !state.policy.hasOptOut) {
      state.policy.noOptOut = true;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. DARK PATTERN DETECTION
  // ═══════════════════════════════════════════════════════════════════════════

  function detectDarkPatterns() {
    const bodyText = document.body?.innerText || '';
    const allButtons = Array.from(document.querySelectorAll('button, a, label, span, div, p'));

    Object.entries(DARK_PATTERNS).forEach(([type, config]) => {
      // Text pattern matching
      config.patterns.forEach(regex => {
        if (regex.test(bodyText)) {
          // Find the actual DOM element containing this text for overlay
          const el = findElementContaining(regex);
          const existing = state.patterns.find(p => p.type === type);
          if (!existing) {
            state.patterns.push({
              type,
              name: config.name,
              severity: config.severity,
              confidence: el ? 0.9 : 0.7,
              law: config.law,
              penalty: config.penalty,
              description: config.description,
              element: el,
              text: el ? (el.innerText || el.textContent).slice(0, 100).trim() : getPatternSample(bodyText, regex),
            });
          }
          if (el) applyOverlay(el, 'manipulation', config.name);
        }
      });
    });

    // Pre-selected checkboxes / radio buttons
    detectPreselectedOptions();
    
    // DOM-based detections for visual patterns
    detectCountdownTimers();
    detectStickyBanners();
    detectModalsAndPopups();
    detectDifficultCancellation();
  }

  function detectPreselectedOptions() {
    const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]:checked, input[type="radio"]:checked'));
    const suspicious = checkboxes.filter(el => {
      const label = getLabel(el);
      return label && /(newsletter|marketing|offers|updates|promotional)/i.test(label);
    });

    if (suspicious.length > 0) {
      const existing = state.patterns.find(p => p.type === 'preselected');
      if (!existing) {
        state.patterns.push({
          type: 'preselected',
          name: DARK_PATTERNS.preselected.name,
          severity: 'medium',
          confidence: 0.85,
          law: DARK_PATTERNS.preselected.law,
          penalty: DARK_PATTERNS.preselected.penalty,
          description: `${suspicious.length} pre-checked option(s) detected for marketing/promotional content.`,
          element: suspicious[0],
          text: getLabel(suspicious[0]) || 'Pre-selected checkbox',
        });
      }
      suspicious.forEach(el => {
        const parent = el.closest('label') || el.parentElement;
        if (parent) applyOverlay(parent, 'manipulation', 'Pre-selected Option');
      });
    }
  }

  // DOM-based dark pattern detection functions
  function detectCountdownTimers() {
    const timerElements = Array.from(document.querySelectorAll('*')).filter(el => {
      const text = el.textContent || '';
      const isTimer = text.match(/\d+\s*(?:hours?|mins?|minutes?|seconds?)\s*(?:left|remaining)/i);
      const isVisible = el.offsetHeight > 0 && window.getComputedStyle(el).display !== 'none';
      const isReasonableSize = el.offsetWidth > 30 && el.offsetHeight > 12;
      return isTimer && isVisible && isReasonableSize;
    });

    if (timerElements.length > 0) {
      const existing = state.patterns.find(p => p.type === 'urgency' && p.text === 'Countdown Timer');
      if (!existing) {
        state.patterns.push({
          type: 'urgency',
          name: 'Countdown Timer',
          severity: 'high',
          confidence: 0.9,
          law: DARK_PATTERNS.urgency.law,
          penalty: DARK_PATTERNS.urgency.penalty,
          description: 'Countdown timer detected to create artificial urgency.',
          element: timerElements[0],
          text: 'Countdown Timer',
        });
      }
      timerElements.slice(0, 3).forEach(el => applyOverlay(el, 'manipulation', 'Countdown Timer'));
    }
  }

  function detectStickyBanners() {
    const stickyBanners = Array.from(document.querySelectorAll('[style*="position"][style*="sticky"], [style*="position"][style*="fixed"]')).filter(el => {
      const text = (el.textContent || '').toLowerCase();
      const hasUrgency = text.match(/urgent|hurry|now|limited|only|ends?|sale|offer|deal|buy|subscribe|sign up/i);
      const isVisible = el.offsetHeight > 0 && window.getComputedStyle(el).display !== 'none';
      const notTooLarge = el.offsetHeight < 400;
      return isVisible && hasUrgency && notTooLarge;
    });

    if (stickyBanners.length > 0) {
      const existing = state.patterns.find(p => p.type === 'urgency' && p.text === 'Sticky Banner');
      if (!existing) {
        state.patterns.push({
          type: 'urgency',
          name: 'Sticky Urgency Banner',
          severity: 'high',
          confidence: 0.88,
          law: DARK_PATTERNS.urgency.law,
          penalty: DARK_PATTERNS.urgency.penalty,
          description: 'Persistent banner with urgency language designed to distract and pressure.',
          element: stickyBanners[0],
          text: 'Sticky Banner',
        });
      }
      stickyBanners.slice(0, 2).forEach(el => applyOverlay(el, 'manipulation', 'Sticky Urgency Banner'));
    }
  }

  function detectModalsAndPopups() {
    const modals = document.querySelectorAll('[role="dialog"], .modal, .popup, [class*="modal"], [id*="popup"], [class*="overlay"]');
    const visibleModals = Array.from(modals).filter(el => {
      const isVisible = el.offsetHeight > 0 && window.getComputedStyle(el).display !== 'none' && window.getComputedStyle(el).visibility !== 'hidden';
      const notTooBig = el.offsetHeight < 800 && el.offsetWidth < 800;
      return isVisible && notTooBig;
    });

    if (visibleModals.length > 0) {
      const existing = state.patterns.find(p => p.type === 'nagging');
      if (!existing) {
        state.patterns.push({
          type: 'nagging',
          name: 'Intrusive Modals',
          severity: 'medium',
          confidence: 0.8,
          law: DARK_PATTERNS.nagging.law,
          penalty: DARK_PATTERNS.nagging.penalty,
          description: `${visibleModals.length} modal(s) or popup(s) detected to interrupt user experience.`,
          element: visibleModals[0],
          text: `${visibleModals.length} modal/popup detected`,
        });
      }
      visibleModals.forEach(el => applyOverlay(el, 'manipulation', 'Intrusive Modal'));
    }
  }

  function detectDifficultCancellation() {
    const bodyText = (document.body?.innerText || '').toLowerCase();
    const hasSubscription = bodyText.match(/subscribe|newsletter|unsubscribe|membership|account/i);
    
    if (hasSubscription) {
      const cancelLinks = document.querySelectorAll('[href*="unsubscribe"], [href*="cancel"], [href*="delete"]');
      const cancelButtons = document.querySelectorAll('button[aria-label*="cancel" i], button[title*="cancel" i], button[aria-label*="unsubscribe" i]');
      
      const allCancelElements = Array.from([...cancelLinks, ...cancelButtons]);
      const isBuried = allCancelElements.length === 0 || allCancelElements.every(el => {
        const rect = el.getBoundingClientRect();
        return rect.height < 15 || rect.width < 30 || window.getComputedStyle(el).display === 'none';
      });

      if (isBuried && hasSubscription) {
        const existing = state.patterns.find(p => p.type === 'obstruction' && p.text === 'Difficult Cancellation');
        if (!existing) {
          state.patterns.push({
            type: 'obstruction',
            name: 'Difficult Cancellation',
            severity: 'high',
            confidence: 0.75,
            law: DARK_PATTERNS.obstruction.law,
            penalty: DARK_PATTERNS.obstruction.penalty,
            description: 'Unsubscribe or cancel button is hidden, buried, or non-functional.',
            element: allCancelElements[0] || document.body,
            text: 'Difficult Cancellation',
          });
        }
      }
    }
  }

  function getLabel(input) {
    const id = input.id;
    if (id) {
      const label = document.querySelector(`label[for="${id}"]`);
      if (label) return label.innerText || label.textContent;
    }
    const parent = input.closest('label');
    if (parent) return parent.innerText || parent.textContent;
    const next = input.nextElementSibling;
    if (next) return next.innerText || next.textContent;
    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. VISUAL OVERLAYS
  // ═══════════════════════════════════════════════════════════════════════════

  function injectOverlayStyles() {
    if (document.getElementById('cs-overlay-styles')) return;
    const style = document.createElement('style');
    style.id = 'cs-overlay-styles';
    style.textContent = `
      .cs-overlay-privacy {
        outline: 2.5px solid #3b82f6 !important;
        outline-offset: 2px !important;
        position: relative !important;
      }
      .cs-overlay-manipulation {
        outline: 2.5px solid #ef4444 !important;
        outline-offset: 2px !important;
        animation: cs-pulse 2s infinite !important;
        position: relative !important;
      }
      @keyframes cs-pulse {
        0%   { outline-color: #ef4444; box-shadow: 0 0 0 0 rgba(239,68,68,0.4); }
        50%  { outline-color: #f97316; box-shadow: 0 0 0 5px rgba(239,68,68,0); }
        100% { outline-color: #ef4444; box-shadow: 0 0 0 0 rgba(239,68,68,0); }
      }
      .cs-tooltip {
        position: absolute !important;
        top: -38px !important;
        left: 0 !important;
        background: rgba(17,17,17,0.95) !important;
        color: #fff !important;
        font-size: 11px !important;
        font-family: 'Inter', -apple-system, sans-serif !important;
        padding: 5px 9px !important;
        border-radius: 5px !important;
        white-space: nowrap !important;
        z-index: 2147483647 !important;
        pointer-events: none !important;
        display: none !important;
        box-shadow: 0 2px 8px rgba(0,0,0,0.4) !important;
        line-height: 1.4 !important;
      }
      .cs-overlay-manipulation:hover .cs-tooltip,
      .cs-overlay-privacy:hover .cs-tooltip {
        display: block !important;
      }
    `;
    document.head.appendChild(style);
  }

  function applyOverlay(el, type, label) {
    if (!el || el.dataset?.csTagged) return;
    el.dataset.csTagged = '1';
    el.classList.add(type === 'privacy' ? 'cs-overlay-privacy' : 'cs-overlay-manipulation');

    const tooltip = document.createElement('div');
    tooltip.className = 'cs-tooltip';
    const icon = type === 'privacy' ? '🔒' : '⚠️';
    tooltip.textContent = `${icon} ConsumerShield: ${label}`;

    // Make element relative if static
    const pos = window.getComputedStyle(el).position;
    if (pos === 'static') el.style.position = 'relative';
    el.appendChild(tooltip);

    state.overlayElements.push(el);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  function findElementContaining(regex) {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null
    );
    let node;
    while ((node = walker.nextNode())) {
      if (regex.test(node.textContent)) {
        const el = node.parentElement;
        if (el && el.offsetWidth > 0 && el.offsetHeight > 0) return el;
      }
    }
    return null;
  }

  function getPatternSample(text, regex) {
    const match = text.match(regex);
    return match ? match[0].slice(0, 80) : '';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN RUNNER
  // ═══════════════════════════════════════════════════════════════════════════

  async function runAnalysis() {
    if (analysisRun) return;
    analysisRun = true;

    try {
      injectOverlayStyles();
      detectTrackers();
      analyzePrivacyPolicy();
      detectDarkPatterns();

      // Send results to background worker
      chrome.runtime.sendMessage({
        action: 'analyzeComplete',
        data: {
          url: window.location.href,
          domain: window.location.hostname,
          timestamp: Date.now(),
          privacy: {
            trackers: state.trackers,
            policy: state.policy,
            fingerprinting: state.fingerprinting,
          },
          manipulation: {
            patterns: state.patterns.map(p => ({
              type: p.type,
              name: p.name,
              severity: p.severity,
              confidence: p.confidence,
              law: p.law,
              penalty: p.penalty,
              description: p.description,
              text: p.text,
            })),
          },
        }
      }, () => {
        // Ignore connection errors (popup may not be open)
        if (chrome.runtime.lastError) { /* noop */ }
      });
    } catch (err) {
      console.warn('[ConsumerShield] Analysis error:', err);
    }
  }

  // Run after page is interactive
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runAnalysis);
  } else {
    // Slight delay so dynamic content has time to render
    setTimeout(runAnalysis, 800);
  }

  // Re-run on SPA navigation
  let lastUrl = location.href;
  const observer = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      analysisRun = false;
      state.trackers = [];
      state.patterns = [];
      state.policy = { thirdPartySharing: false, noOptOut: false, extensiveCollection: false, hasOptOut: false };
      state.fingerprinting = false;
      setTimeout(runAnalysis, 1200);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

})();
