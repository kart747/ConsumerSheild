# ConsumerShield Extension Test Report
**Generated:** 2026-03-13 13:49:45
**Backend:** http://localhost:8000
**Extension:** /home/kart/Desktop/hackathon/ConsumerShield-Backup-/consumershield/extension

## Executive Summary
- **Tests Run:** 4
- **Successful:** 3
- **Failed:** 1

- **Dark Patterns on deceptive.design:** 3
- **Detection Threshold (3+ patterns):** ✅ PASS

## Detailed Results

### Deceptive Design
- **Category:** Known Dark Patterns Database
- **URL:** https://www.deceptive.design/
- **Status:** SUCCESS
- **Privacy Risk Score:** 0.0/10
- **Manipulation Risk Score:** 9.8/10
- **Dark Patterns Detected:** 3
  ```
  • Forced Continuity [HIGH]
  • Nagging / Persistent Prompts [MEDIUM]
  • Obstruction / Roach Motel [HIGH]
  ```
- **Trackers Found:** None

### Flipkart
- **Category:** E-Commerce
- **URL:** https://www.flipkart.com
- **Status:** SUCCESS
- **Privacy Risk Score:** 1.0/10
- **Manipulation Risk Score:** 10.0/10
- **Dark Patterns Detected:** 5
  ```
  • False Urgency [HIGH]
  • Disguised Advertisements [MEDIUM]
  • Misdirection [MEDIUM]
  • Nagging / Persistent Prompts [MEDIUM]
  • Obstruction / Roach Motel [HIGH]
  ```
- **Trackers Found:** 2
  ```
  • Facebook Pixel (social)
  • LinkedIn Insight (social)
  ```

### Amazon India
- **Category:** E-Commerce
- **URL:** https://www.amazon.in
- **Status:** SUCCESS
- **Privacy Risk Score:** 1.0/10
- **Manipulation Risk Score:** 10.0/10
- **Dark Patterns Detected:** 5
  ```
  • False Urgency [HIGH]
  • Disguised Advertisements [MEDIUM]
  • Misdirection [MEDIUM]
  • Nagging / Persistent Prompts [MEDIUM]
  • Obstruction / Roach Motel [HIGH]
  ```
- **Trackers Found:** 1
  ```
  • Facebook Pixel (social)
  ```

### MakeMyTrip
- **Category:** Travel
- **URL:** https://www.makemytrip.com
- **Status:** FAILED
- **Error:** Page.goto: net::ERR_HTTP2_PROTOCOL_ERROR at https://www.makemytrip.com/
Call log:
  - navigating to "https://www.makemytrip.com/", waiting until "domcontentloaded"


## Accuracy Summary

- **Average Privacy Risk:** 0.7/10
- **Average Manipulation Risk:** 9.9/10
- **Total Dark Patterns Found:** 13
- **Total Trackers Found:** 3

### Detection Performance
- **Overall:** Excellent dark pattern detection
