"""
ConsumerShield — FastAPI Backend
Provides: AI-enhanced analysis, regulatory mapping, dual risk scoring
Endpoints:
  POST /analyze-complete       → full analysis (privacy + manipulation)
  POST /analyze-privacy        → privacy-only
  POST /analyze-dark-patterns  → manipulation-only
  GET  /health
"""

import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

from regulatory_database import (
    get_privacy_violations,
    get_manipulation_violations,
    REGULATORY_FRAMEWORK,
)

load_dotenv()

# ── Gemini API setup (optional) ──────────────────────────────
import google.generativeai as genai
GEMINI_AVAILABLE = False
try:
    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key:
        genai.configure(api_key=gemini_key)
        gemini_model = genai.GenerativeModel("gemini-1.5-flash")
        GEMINI_AVAILABLE = True
        print("[ConsumerShield] Gemini enabled")
    else:
        print("[ConsumerShield] No GEMINI_API_KEY found — using rule-based insights")
except Exception as e:
    print(f"[ConsumerShield] Gemini error: {e}")

# ── App ───────────────────────────────────────────────────────
app = FastAPI(
    title="ConsumerShield API",
    description="Complete consumer protection analysis — privacy + dark patterns",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Schemas ───────────────────────────────────────────────────

class TrackerItem(BaseModel):
    domain: str
    type: str
    name: str

class PolicyData(BaseModel):
    thirdPartySharing: Optional[bool] = False
    noOptOut: Optional[bool] = False
    extensiveCollection: Optional[bool] = False
    hasOptOut: Optional[bool] = False

class PrivacyData(BaseModel):
    trackers: List[TrackerItem] = []
    policy: Optional[PolicyData] = PolicyData()
    fingerprinting: Optional[bool] = False

class PatternItem(BaseModel):
    type: str
    name: str
    severity: str       # low | medium | high
    confidence: float = 1.0
    law: Optional[str] = None
    penalty: Optional[str] = None
    description: Optional[str] = None
    text: Optional[str] = None

class ManipulationData(BaseModel):
    patterns: List[PatternItem] = []

class CompleteRequest(BaseModel):
    url: str
    privacy_data: PrivacyData
    manipulation_data: ManipulationData

class PrivacyOnlyRequest(BaseModel):
    url: str
    privacy_data: PrivacyData

class ManipulationOnlyRequest(BaseModel):
    url: str
    manipulation_data: ManipulationData

class RegulatoryViolation(BaseModel):
    violation_type: str
    issue: str
    law: str
    section: str
    penalty: str
    authority: str

class CompleteResponse(BaseModel):
    url: str
    privacy_risk: float
    manipulation_risk: float
    overall_risk: float
    privacy_level: str
    manipulation_level: str
    overall_level: str
    total_violations: int
    privacy_insights: List[str]
    manipulation_insights: List[str]
    combined_insight: str
    regulatory_violations: List[Dict[str, str]]
    ai_powered: bool

# ── Risk Calculators ──────────────────────────────────────────

def calc_privacy_risk(data: PrivacyData) -> float:
    score = 0.0
    tc = len(data.trackers)
    if   tc >= 10: score += 4.0
    elif tc >= 6:  score += 3.0
    elif tc >= 3:  score += 2.0
    elif tc >= 1:  score += 1.0

    if data.policy:
        if data.policy.thirdPartySharing:  score += 1.5
        if data.policy.noOptOut:           score += 1.5
        if data.policy.extensiveCollection:score += 1.0
    if data.fingerprinting:                score += 2.0

    return min(10.0, round(score, 1))

def calc_manipulation_risk(data: ManipulationData) -> float:
    weights = {"low": 0.8, "medium": 2.0, "high": 4.0}
    score = sum(weights.get(p.severity, 0.8) * p.confidence for p in data.patterns)
    return min(10.0, round(score, 1))

def get_risk_level(score: float) -> str:
    if score >= 8.5: return "CRITICAL"
    if score >= 6.5: return "HIGH"
    if score >= 4.0: return "MEDIUM"
    if score >= 2.0: return "LOW"
    return "SAFE"

# ── Insight Generators ────────────────────────────────────────

def make_privacy_insights(data: PrivacyData) -> List[str]:
    insights = []
    tc = len(data.trackers)
    if tc > 0:
        types = list({t.type for t in data.trackers})
        insights.append(f"{tc} tracker(s) detected ({', '.join(types)}). Your browsing behavior is being monitored.")
    if data.policy and data.policy.thirdPartySharing:
        insights.append("Your data is shared with third parties. Potential DPDP Act 2023 Section 8 violation.")
    if data.policy and data.policy.noOptOut:
        insights.append("No opt-out mechanism found. Violates DPDP Act 2023 Section 12 (right to withdraw consent).")
    if data.fingerprinting:
        insights.append("Canvas/device fingerprinting detected. Unauthorized unique ID generation.")
    if not insights:
        insights.append("No significant privacy violations detected on this page.")
    return insights

def make_manipulation_insights(data: ManipulationData) -> List[str]:
    insights = []
    for p in data.patterns:
        insights.append(f"{p.name} [{p.severity.upper()}]: {p.description or 'Manipulation tactic detected.'}")
    if not insights:
        insights.append("No dark patterns detected on this page.")
    return insights

def make_rule_insight(url: str, privacy: PrivacyData, manipulation: ManipulationData,
                      p_risk: float, m_risk: float) -> str:
    tc = len(privacy.trackers)
    pc = len(manipulation.patterns)

    if p_risk >= 7 and m_risk >= 7:
        return (
            f"This site aggressively exploits you on BOTH fronts — {tc} tracker(s) stealing "
            f"your data and {pc} manipulation tactic(s) pressuring your decisions. "
            f"It likely violates the DPDP Act 2023 (up to ₹250 crore penalty) and "
            f"CCPA Dark Patterns Guidelines 2023 (up to ₹50 lakh per tactic)."
        )
    if p_risk >= 6.5:
        return (
            f"This site invades your privacy with {tc} tracker(s) and appears to share your "
            f"data with third parties without clear consent — a potential violation of the "
            f"Digital Personal Data Protection Act 2023."
        )
    if m_risk >= 6.5:
        return (
            f"{pc} dark pattern(s) detected — psychological manipulation designed to pressure "
            f"your purchasing decisions. Prohibited under CCPA Dark Patterns Guidelines 2023."
        )
    if tc > 0 or pc > 0:
        return f"Moderate concerns: {tc} tracker(s) and {pc} dark pattern(s) found. Review the details below."
    return "No major privacy violations or dark patterns detected on this page. ✅"

async def make_ai_insight(url: str, privacy: PrivacyData, manipulation: ManipulationData) -> str:
    if GEMINI_AVAILABLE:
        try:
            prompt = f"""You are a consumer rights expert focused on Indian law.
Website: {url}
Trackers found: {len(privacy.trackers)}
Dark patterns found: {len(manipulation.patterns)} ({', '.join([p.name for p in manipulation.patterns[:3]])})
In 2 sentences explain: how this site exploits users and which Indian law (DPDP Act 2023 / CCPA Guidelines 2023) is violated."""
            response = gemini_model.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            print(f"Gemini error: {e}")
    return make_rule_insight(url, privacy, manipulation,
                             calc_privacy_risk(privacy),
                             calc_manipulation_risk(manipulation))

# ── Endpoints ─────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status": "ok",
        "version": "1.0.0",
        "gemini_enabled": GEMINI_AVAILABLE,
        "ai_powered": GEMINI_AVAILABLE
    }


@app.post("/analyze-complete", response_model=CompleteResponse)
async def analyze_complete(req: CompleteRequest):
    p_risk = calc_privacy_risk(req.privacy_data)
    m_risk = calc_manipulation_risk(req.manipulation_data)
    o_risk = round((p_risk + m_risk) / 2, 1)

    p_level = get_risk_level(p_risk)
    m_level = get_risk_level(m_risk)
    o_level = get_risk_level(o_risk)

    p_insights = make_privacy_insights(req.privacy_data)
    m_insights = make_manipulation_insights(req.manipulation_data)
    combined   = await make_ai_insight(req.url, req.privacy_data, req.manipulation_data)

    violations = (
        get_privacy_violations(req.privacy_data.dict()) +
        get_manipulation_violations([p.dict() for p in req.manipulation_data.patterns])
    )

    total = len(req.privacy_data.trackers) + len(req.manipulation_data.patterns)

    return CompleteResponse(
        url=req.url,
        privacy_risk=p_risk,
        manipulation_risk=m_risk,
        overall_risk=o_risk,
        privacy_level=p_level,
        manipulation_level=m_level,
        overall_level=o_level,
        total_violations=total,
        privacy_insights=p_insights,
        manipulation_insights=m_insights,
        combined_insight=combined,
        regulatory_violations=violations,
        ai_powered=GEMINI_AVAILABLE,
    )


@app.post("/analyze-privacy")
async def analyze_privacy(req: PrivacyOnlyRequest):
    risk  = calc_privacy_risk(req.privacy_data)
    level = get_risk_level(risk)
    return {
        "url": req.url,
        "privacy_risk": risk,
        "privacy_level": level,
        "insights": make_privacy_insights(req.privacy_data),
        "violations": get_privacy_violations(req.privacy_data.dict()),
    }


@app.post("/analyze-dark-patterns")
async def analyze_dark_patterns(req: ManipulationOnlyRequest):
    risk  = calc_manipulation_risk(req.manipulation_data)
    level = get_risk_level(risk)
    return {
        "url": req.url,
        "manipulation_risk": risk,
        "manipulation_level": level,
        "insights": make_manipulation_insights(req.manipulation_data),
        "violations": get_manipulation_violations([p.dict() for p in req.manipulation_data.patterns]),
    }
