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
  // TRACKER EXTRACTOR (Dynamic collection for Backend Radar Lite)
  // ═══════════════════════════════════════════════════════════════════════════
  
  // The backend now handles the DDG Tracker Radar DB. We just collect third-party domains.

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
        /(?:highly\s*|most\s*|top\s*)?recommended\s*(?:plan|product|offer|choice|option)/i,
        /best.*seller|best.*choice/i,
        /customers?\s*(?:also\s*)?(?:like|buy|chose|prefer)/i,
        /popular\s*(?:choice|item|product)/i,
        /trending\s*(?:deal|offer|product|item|plan)/i,
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
    detectedDomains: [], // Store domains to send to background
    trackers: [],        // Will be empty in content.js now, fulfilled by background.js
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
    const mainHost = window.location.hostname;
    const thirdPartyDomains = new Set();
    
    // Check performance resource timings (iframes, scripts, xhr, fetches)
    if (window.performance && performance.getEntriesByType) {
      const resources = performance.getEntriesByType('resource');
      for (const res of resources) {
        try {
          const url = new URL(res.name);
          if (url.hostname && url.hostname !== mainHost && !url.hostname.endsWith('.' + mainHost)) {
            thirdPartyDomains.add(url.hostname);
          }
        } catch(e) {}
      }
    }
    
    // Check script tags explicitly
    document.querySelectorAll('script[src], iframe[src], link[href]').forEach(el => {
      try {
        const urlStr = el.src || el.href;
        if (urlStr) {
          const url = new URL(urlStr, window.location.href);
          if (url.hostname && url.hostname !== mainHost && !url.hostname.endsWith('.' + mainHost)) {
            thirdPartyDomains.add(url.hostname);
          }
        }
      } catch(e) {}
    });

    state.detectedDomains = Array.from(thirdPartyDomains);
    console.log('[ConsumerShield] 3rd party domains extracted:', state.detectedDomains);

    // Canvas fingerprinting signal - optimized check
    const pageStart = (document.body?.innerText || "").slice(0, 10000); 
    if (
      pageStart.includes('getImageData') || 
      pageStart.includes('toDataURL')
    ) {
      state.fingerprinting = true;
    }
    
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
    const candidates = collectDarkPatternCandidates(bodyText);

    Object.entries(DARK_PATTERNS).forEach(([type, config]) => {
      // Text pattern matching
      config.patterns.forEach((regex) => {
        const matchedCandidate = candidates.find((candidate) => regex.test(candidate.text));
        if (!matchedCandidate) return;

        const existing = state.patterns.find((p) => p.type === type);
        const sampleText = getPatternSample(matchedCandidate.text, regex) || matchedCandidate.text.slice(0, 100).trim();
        const confidence = Math.min(0.97, (matchedCandidate.contextScore || 0.7) + (matchedCandidate.element ? 0.08 : 0));

        if (!existing) {
          state.patterns.push({
            type,
            name: config.name,
            severity: config.severity,
            confidence,
            law: config.law,
            penalty: config.penalty,
            description: config.description,
            element: matchedCandidate.element,
            text: sampleText,
          });
        } else if ((existing.confidence || 0) < confidence) {
          existing.confidence = confidence;
          existing.text = sampleText;
          existing.element = matchedCandidate.element || existing.element;
        }

        if (matchedCandidate.element) {
          applyOverlay(matchedCandidate.element, 'manipulation', config.name);
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
    detectTrickWordingAdvanced();
    detectVisualInterference();
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
    // Only look at common container elements for timers to save performance
    const targetSelectors = 'span, div, b, p, strong, section';
    const elements = document.querySelectorAll(targetSelectors);
    
    const timerElements = [];
    for (let i = 0; i < Math.min(elements.length, 1000); i++) { // Limit scan to first 100 elements
      const el = elements[i];
      const text = el.textContent || '';
      if (text.length > 50) continue; // Skip large text blocks
      
      const isTimer = text.match(/\d+\s*(?:hours?|mins?|minutes?|seconds?)\s*(?:left|remaining)/i);
      const isVisible = el.offsetHeight > 0 && window.getComputedStyle(el).display !== 'none';
      if (isTimer && isVisible) {
        timerElements.push(el);
      }
    }

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
      if (!isVisible || !notTooBig) return false;

      const text = normalizeScanText(el.textContent || '');
      const hasPersuasiveText = /(subscribe|sign\s*up|allow\s*notifications|accept\s*all|limited|offer|deal|save|continue|cookie|consent)/i.test(text);
      const style = window.getComputedStyle(el);
      const looksBlocking = style.position === 'fixed' || style.zIndex === '9999' || style.zIndex === '10000' || /overlay|backdrop/i.test(el.className || '');
      const hasActionControls = !!el.querySelector('button, a, [role="button"], input[type="submit"], input[type="button"]');
      const isFocusedContainer = text.length > 0 && text.length < 1600;
      return isFocusedContainer && hasActionControls && (hasPersuasiveText || looksBlocking);
    });

    if (visibleModals.length > 0) {
      const existing = state.patterns.find(p => p.type === 'nagging');
      if (!existing) {
        state.patterns.push({
          type: 'nagging',
          name: 'Intrusive Modals',
          severity: 'medium',
          confidence: Math.min(0.9, 0.72 + (visibleModals.length * 0.04)),
          law: DARK_PATTERNS.nagging.law,
          penalty: DARK_PATTERNS.nagging.penalty,
          description: `${visibleModals.length} persuasive/blocking modal(s) detected that may pressure user action.`,
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

  function detectTrickWordingAdvanced() {
    const explicitFormCueRegex = /\b(uncheck|untick|opt[\s-]?out|do\s*not|don't|not\s*receive|not\s*want|without\s*consent)\b/i;
    const candidates = collectDarkPatternCandidates(document.body?.innerText || '')
      .filter((candidate) => (
        candidate.text.length <= 220
        && /\b(consent|cookie|marketing|newsletter|email|updates?|notifications?|subscribe|opt|receive|communication)\b/i.test(candidate.text)
        && explicitFormCueRegex.test(candidate.text)
      ));

    const negationRegex = /\b(no|not|never|without|uncheck|untick|opt[\s-]?out|do\s*not|don't|cannot|can't)\b/gi;
    let bestMatch = null;

    candidates.forEach((candidate) => {
      const negations = candidate.text.match(negationRegex) || [];
      if (negations.length < 2) return;
      const score = Math.min(0.95, 0.72 + (negations.length * 0.07));
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { candidate, score, negationCount: negations.length };
      }
    });

    if (!bestMatch) return;

    const existing = state.patterns.find((p) => p.type === 'trick_questions');
    const description = `Consent text contains ${bestMatch.negationCount} negation cues, indicating possible double-negative wording.`;

    if (!existing) {
      state.patterns.push({
        type: 'trick_questions',
        name: DARK_PATTERNS.trick_questions.name,
        severity: bestMatch.negationCount >= 3 ? 'high' : 'medium',
        confidence: bestMatch.score,
        law: DARK_PATTERNS.trick_questions.law,
        penalty: DARK_PATTERNS.trick_questions.penalty,
        description,
        element: bestMatch.candidate.element,
        text: bestMatch.candidate.text.slice(0, 120),
      });
    } else if ((existing.confidence || 0) < bestMatch.score) {
      existing.confidence = bestMatch.score;
      existing.description = description;
      existing.text = bestMatch.candidate.text.slice(0, 120);
      existing.element = bestMatch.candidate.element || existing.element;
    }

    if (bestMatch.candidate.element) {
      applyOverlay(bestMatch.candidate.element, 'manipulation', DARK_PATTERNS.trick_questions.name);
    }
  }

  function detectVisualInterference() {
    const containers = findConsentContainers();
    let bestFinding = null;

    containers.forEach((container) => {
      const actions = Array.from(container.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"]'))
        .filter((el) => isElementVisibleForDetection(el));
      if (actions.length < 2) return;

      const acceptEl = actions.find((el) => /\b(accept|allow|agree|yes|continue|ok|got\s*it)\b/i.test(getElementActionText(el)));
      const rejectEl = actions.find((el) => /\b(reject|decline|deny|manage|settings|customi[sz]e|no\s*thanks|necessary|essential|only)\b/i.test(getElementActionText(el)));
      if (!acceptEl || !rejectEl || acceptEl === rejectEl) return;

      const acceptWeight = buttonVisualWeight(acceptEl);
      const rejectWeight = Math.max(1, buttonVisualWeight(rejectEl));
      const ratio = acceptWeight / rejectWeight;
      const rejectWeak = isWeaklyVisibleAction(rejectEl);
      const isManipulative = ratio >= 1.6 || rejectWeak;
      if (!isManipulative) return;

      if (!bestFinding || ratio > bestFinding.ratio) {
        bestFinding = { acceptEl, rejectEl, ratio, rejectWeak };
      }
    });

    if (!bestFinding) return;

    const confidence = Math.min(0.96, 0.7 + Math.min(0.2, (bestFinding.ratio - 1.0) * 0.09) + (bestFinding.rejectWeak ? 0.08 : 0));
    const evidence = `Accept-vs-reject visual weight ratio: ${bestFinding.ratio.toFixed(2)}x${bestFinding.rejectWeak ? '; reject appears weak/hidden.' : '.'}`;
    const existing = state.patterns.find((p) => p.type === 'misdirection' && /visual interference/i.test(p.name || ''));

    if (!existing) {
      state.patterns.push({
        type: 'misdirection',
        name: 'Visual Interference',
        severity: (bestFinding.ratio >= 2.0 || bestFinding.rejectWeak) ? 'high' : 'medium',
        confidence,
        law: DARK_PATTERNS.misdirection.law,
        penalty: DARK_PATTERNS.misdirection.penalty,
        description: 'Acceptance path is visually emphasized over rejection in a consent-style UI.',
        element: bestFinding.acceptEl,
        text: evidence,
      });
    } else if ((existing.confidence || 0) < confidence) {
      existing.confidence = confidence;
      existing.text = evidence;
      existing.element = bestFinding.acceptEl;
    }

    applyOverlay(bestFinding.acceptEl, 'manipulation', 'Visual Interference');
    applyOverlay(bestFinding.rejectEl, 'manipulation', 'Visual Interference');
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

  function normalizeScanText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function isElementVisibleForDetection(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    if (Number(style.opacity || 1) < 0.08) return false;
    const rect = el.getBoundingClientRect();
    return rect.width >= 24 && rect.height >= 12;
  }

  function getElementActionText(el) {
    const aria = el.getAttribute?.('aria-label') || '';
    const title = el.getAttribute?.('title') || '';
    const text = el.innerText || el.textContent || '';
    return normalizeScanText(`${aria} ${title} ${text}`);
  }

  function isTransparentColor(colorValue) {
    if (!colorValue) return true;
    const lower = String(colorValue).toLowerCase().trim();
    return lower === 'transparent' || /rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0(?:\.0+)?\s*\)/.test(lower);
  }

  function buttonVisualWeight(el) {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    const area = Math.max(1, rect.width * rect.height);

    const fontWeightRaw = parseInt(style.fontWeight, 10);
    const fontFactor = Number.isFinite(fontWeightRaw)
      ? 1 + Math.max(0, Math.min(0.45, (fontWeightRaw - 400) / 1000))
      : 1;

    const backgroundFactor = isTransparentColor(style.backgroundColor) ? 1 : 1.2;
    const opacityFactor = Math.max(0.4, Math.min(1, Number(style.opacity || 1)));

    return area * fontFactor * backgroundFactor * opacityFactor;
  }

  function isWeaklyVisibleAction(el) {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      Number(style.opacity || 1) < 0.6 ||
      rect.width < 48 ||
      rect.height < 20
    );
  }

  function collectDarkPatternCandidates(bodyText) {
    const selectors = [
      'button',
      'a',
      'label',
      '[role="button"]',
      '[role="dialog"]',
      'input[type="checkbox"]',
      'input[type="radio"]',
      '[aria-label]',
      '[class*="cookie"]',
      '[id*="cookie"]',
      '[class*="consent"]',
      '[id*="consent"]',
      '.modal',
      '.popup',
    ];

    const nodes = Array.from(document.querySelectorAll(selectors.join(', ')));
    const candidates = [];
    const seen = new Set();

    nodes.forEach((el) => {
      if (!isElementVisibleForDetection(el)) return;
      const text = getElementActionText(el);
      if (text.length < 8) return;
      const dedupeKey = text.toLowerCase();
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);

      const hasConsentCue = /\b(cookie|consent|accept|reject|decline|allow|manage|settings|opt\s*out|unsubscribe|cancel|no\s*thanks)\b/i.test(text);
      candidates.push({
        text: text.slice(0, 260),
        element: el,
        contextScore: hasConsentCue ? 0.84 : 0.72,
      });
    });

    const highSignalSentenceRegex = /\b(cookie|consent|accept|reject|decline|no\s*thanks|uncheck|untick|opt\s*out|newsletter|unsubscribe|allow|manage|settings|marketing|double\s*negative)\b/i;
    const bodySentences = normalizeScanText(bodyText || '')
      .split(/(?<=[.!?])\s+/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length >= 20 && entry.length <= 180 && highSignalSentenceRegex.test(entry));

    bodySentences.slice(0, 10).forEach((entry) => {
      const dedupeKey = entry.toLowerCase();
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      candidates.push({
        text: entry,
        element: document.body,
        contextScore: 0.68,
      });
    });

    if (candidates.length === 0) {
      const compactFallback = normalizeScanText(bodyText || '').slice(0, 220);
      if (compactFallback) {
        candidates.push({
          text: compactFallback,
          element: document.body,
          contextScore: 0.58,
        });
      }
    }

    return candidates;
  }

  function findConsentContainers() {
    const containerSelectors = [
      '[role="dialog"]',
      '[class*="cookie"]',
      '[id*="cookie"]',
      '[class*="consent"]',
      '[id*="consent"]',
      '.modal',
      '.popup',
    ];

    return Array.from(document.querySelectorAll(containerSelectors.join(', ')))
      .filter((el) => {
        if (!isElementVisibleForDetection(el)) return false;
        const text = normalizeScanText(el.textContent || '');
        return /\b(cookie|consent|privacy|accept|reject|decline|manage|settings|preferences)\b/i.test(text);
      })
      .slice(0, 8);
  }

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
      console.log('[ConsumerShield] Style injected');
      
      try { detectTrackers(); } catch(e) { console.error('Tracker detection failed', e); }
      try { analyzePrivacyPolicy(); } catch(e) { console.error('Policy analysis failed', e); }
      try { detectDarkPatterns(); } catch(e) { console.error('Dark pattern detection failed', e); }

      console.log('[ConsumerShield] Detection phase complete, sending to background...');

      // Send results to background worker
      if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({
          action: 'analyzeComplete',
          data: {
            url: window.location.href,
            domain: window.location.hostname,
            timestamp: Date.now(),
            privacy: {
              detectedDomains: state.detectedDomains,
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
        }, (response) => {
          console.log('[ConsumerShield] Background acknowledged:', response);
          if (chrome.runtime.lastError) { 
             console.warn('[ConsumerShield] Send error:', chrome.runtime.lastError);
          }
        });
      }
    } catch (err) {
      console.error('[ConsumerShield] Critical analysis error:', err);
    }
  }

  // Run after page is interactive
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runAnalysis);
  } else {
    // Slight delay so dynamic content has time to render
    setTimeout(runAnalysis, 800);
  }

  // Re-run on SPA navigation (More efficient check)
  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      analysisRun = false;
      state.detectedDomains = [];
      state.trackers = [];
      state.patterns = [];
      state.policy = { thirdPartySharing: false, noOptOut: false, extensiveCollection: false, hasOptOut: false };
      state.fingerprinting = false;
      setTimeout(runAnalysis, 1500);
    }
  }, 2000);

})();
