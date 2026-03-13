# ConsumerShield Development Log & Summary

## What We Built

We designed and implemented **ConsumerShield**, a comprehensive dual-protection browser extension and backend API designed to safeguard users against both **Privacy Violations** and **Dark Patterns**, with a specific focus on Indian regulations (DPDP Act 2023, CCPA Dark Patterns Guidelines, etc.).

### 1. Chrome Extension (Frontend)
- **`manifest.json` (Manifest V3):** Configured necessary permissions (`storage`, `activeTab`, `scripting`) for the extension to interact with page content and manage state.
- **`content.js` (Detection Engine):** 
  - Injects code into every visited webpage to look for known tracker scripts (e.g., Google Analytics, Meta Pixel) and fingerprinting techniques.
  - Scans the DOM for specific text patterns and element structures indicative of Dark Patterns (e.g., "Hurry, only 2 left!" for False Urgency, hidden pre-checked boxes).
  - Automatically draws visual overlays on the page: **Solid Blue borders** around privacy-invading elements and **Red pulsing borders** around manipulative dark patterns.
- **`dual-risk-calculator.js`:** A custom scoring module that calculates a 0-10 score for both Privacy Risk and Manipulation Risk based on the severity and frequency of detected issues.
- **`background.js`:** A service worker that acts as the central state manager. It updates the extension badge with the site's overall risk score and relays data between the content script and the popup.
- **`popup.html/css/js`:** We built a premium, tabbed user interface for the extension popup. It features:
  - **Overview Tab:** Shows aggregate scores, progress bars, and an AI-generated insight summary.
  - **Privacy Tab:** Lists specific trackers found and points out potential DPDP Act violations.
  - **Dark Patterns Tab:** Details manipulative tactics identified on the page and the corresponding consumer protection laws they violate.

### 2. Python FastAPI Backend (Intelligence Engine)
- **`main.py`:** Created a fast, asynchronous REST API using FastAPI. It exposes endpoints (`/analyze-complete`, `/analyze-privacy`, `/analyze-dark-patterns`) that the extension can call to get deeper analysis. It optionally integrates with OpenAI to generate natural language explanations of the risks.
- **`regulatory_database.py`:** Developed a structured, queryable database of Indian data protection laws (DPDP Act 2023) and consumer protection guidelines (CCPA Dark Patterns Guidelines). The backend uses this to map detected issues directly to specific legal clauses and potential penalties.
- **`test_api.py`:** Wrote a comprehensive test script to ensure all API endpoints return the expected JSON structures and handle mock payloads correctly.

## How We Built It

1. **Architecture & Planning:** We started by defining the core value proposition—combining privacy and dark pattern detection—and outlining the architecture (Chrome MV3 extension + optional FastAPI backend).
2. **Backend Foundation:** We initialized the Python backend first, building the API structure and the `regulatory_database` so the extension would have a reliable source of legal truth.
3. **Extension Core Logic (Scoring & Detection):** We implemented the `dual-risk-calculator` to establish how severity would be quantified. Then, we wrote `content.js` with robust regex handling and DOM traversal to find specific violations, ensuring it ran efficiently without slowing down page loads.
4. **Visual Feedback:** A key requirement was immediate user feedback, so we engineered `content.js` to dynamically inject highly visible, color-coded CSS outlines on offending page elements.
5. **UI & State Management:** We built the popup interface and connected it to `background.js` via Chrome's messaging API, ensuring the UI accurately reflected the state of the active tab in real-time.
6. **Integration & Polish:** We wired the frontend to the backend API, allowing the extension to pull in AI insights and detailed legal mappings to provide a complete user experience.
