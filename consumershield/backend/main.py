"""
ConsumerShield — FastAPI Backend
Provides: AI-enhanced analysis, regulatory mapping, dual risk scoring
Endpoints:
  POST /analyze-complete       → full analysis (privacy + manipulation)
  POST /analyze-privacy        → privacy-only
  POST /analyze-dark-patterns  → manipulation-only
  POST /test-ethereum-anchor   → developer test for blockchain anchoring
  GET  /health
"""

import os
import json
import time
import logging
from pathlib import Path
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

try:
    from .ethereum_anchor import (
        BlockchainAnchoringError,
        DuplicateReportAnchoringError,
        store_report_hash_on_chain,
    )
    from .regulatory_database import (
        get_privacy_violations,
        get_manipulation_violations,
        REGULATORY_FRAMEWORK,
    )
except ImportError:
    from ethereum_anchor import (
        BlockchainAnchoringError,
        DuplicateReportAnchoringError,
        store_report_hash_on_chain,
    )
    from regulatory_database import (
        get_privacy_violations,
        get_manipulation_violations,
        REGULATORY_FRAMEWORK,
    )

BASE_DIR = Path(__file__).resolve().parent
REPORTS_DIR = BASE_DIR / "reports"
load_dotenv(dotenv_path=BASE_DIR / ".env")
logger = logging.getLogger("consumershield.api")

# ── OpenAI setup (optional) ───────────────────────────────────
OPENAI_AVAILABLE = False
try:
    from openai import OpenAI
    api_key = os.getenv("OPENAI_API_KEY")
    if api_key:
        client = OpenAI(api_key=api_key)
        OPENAI_AVAILABLE = True
        print("[ConsumerShield] OpenAI enabled — AI insights active")
    else:
        print("[ConsumerShield] No OPENAI_API_KEY found — using rule-based insights")
except ImportError:
    print("[ConsumerShield] openai package not installed — using rule-based insights")

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
    blockchain_proof_stored: bool = False
    ethereum_tx_hash: Optional[str] = None
    report: Dict[str, Any] = {}
    report_file: Optional[str] = None
    error: Optional[str] = None


class EthereumAnchorTestResponse(BaseModel):
    blockchain_proof_stored: bool
    ethereum_tx_hash: Optional[str] = None
    report: Dict[str, Any] = {}
    report_file: Optional[str] = None
    error: Optional[str] = None


def anchor_report_proof(report_data: Dict[str, Any]) -> Dict[str, Any]:
    """Log, persist, and anchor the report hash on-chain without breaking API responses."""
    # A) Log full report JSON to console
    print("Generated report JSON:")
    print(json.dumps(report_data, indent=2))

    # B) Persist to local reports/ directory
    REPORTS_DIR.mkdir(exist_ok=True)
    report_filename = f"report_{int(time.time())}.json"
    filepath = REPORTS_DIR / report_filename
    with open(filepath, "w") as f:
        json.dump(report_data, f, indent=2)
    report_file = f"reports/{report_filename}"
    print(f"[ConsumerShield] Report saved: {filepath}")

    # C) Blockchain anchoring
    try:
        tx_hash = store_report_hash_on_chain(report_data)
        if tx_hash and not tx_hash.startswith("0x"):
            tx_hash = f"0x{tx_hash}"
        return {
            "blockchain_proof_stored": True,
            "ethereum_tx_hash": tx_hash,
            "report_file": report_file,
            "error": None,
        }
    except DuplicateReportAnchoringError as exc:
        logger.info("[ConsumerShield] Duplicate blockchain report ignored: %s", exc)
        return {
            "blockchain_proof_stored": False,
            "ethereum_tx_hash": None,
            "report_file": report_file,
            "error": str(exc),
        }
    except BlockchainAnchoringError as exc:
        logger.warning("[ConsumerShield] Blockchain anchoring failed: %s", exc)
        return {
            "blockchain_proof_stored": False,
            "ethereum_tx_hash": None,
            "report_file": report_file,
            "error": str(exc),
        }

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
    if not OPENAI_AVAILABLE:
        return make_rule_insight(url, privacy, manipulation,
                                 calc_privacy_risk(privacy),
                                 calc_manipulation_risk(manipulation))
    try:
        tracker_names = [t.name for t in privacy.trackers[:5]]
        pattern_names = [p.name for p in manipulation.patterns[:5]]
        prompt = f"""You are a consumer rights expert focused on Indian digital law.

Website: {url}

Privacy issues found:
- Trackers: {len(privacy.trackers)} ({', '.join(tracker_names) or 'none'})
- Third-party sharing: {privacy.policy.thirdPartySharing if privacy.policy else False}
- No opt-out: {privacy.policy.noOptOut if privacy.policy else False}
- Fingerprinting: {privacy.fingerprinting}

Manipulation tactics found:
- Dark patterns: {len(manipulation.patterns)} ({', '.join(pattern_names) or 'none'})

In 2–3 sentences, explain:
1. How this site exploits users (privacy + manipulation combined)
2. Which Indian laws apply (DPDP Act 2023 / CCPA Guidelines 2023)
3. One actionable recommendation

Be direct, clear, and empowering. No bullet points."""

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=180,
            temperature=0.4,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"[ConsumerShield] OpenAI error: {e}")
        return make_rule_insight(url, privacy, manipulation,
                                 calc_privacy_risk(privacy),
                                 calc_manipulation_risk(manipulation))

# ── Endpoints ─────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "version": "1.0.0", "ai_enabled": OPENAI_AVAILABLE}


@app.post("/test-ethereum-anchor", response_model=EthereumAnchorTestResponse)
async def test_ethereum_anchor():
    report_data = {
        "url": "https://example.com",
        "violation_type": "fake urgency countdown",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "details": "Countdown timer resets after refresh",
    }
    try:
        result = anchor_report_proof(report_data)
        return EthereumAnchorTestResponse(
            blockchain_proof_stored=result["blockchain_proof_stored"],
            ethereum_tx_hash=result["ethereum_tx_hash"],
            report=report_data,
            report_file=result["report_file"],
            error=result["error"],
        )
    except Exception as exc:
        logger.warning("[ConsumerShield] Test Ethereum anchor failed: %s", exc)
        return EthereumAnchorTestResponse(
            blockchain_proof_stored=False,
            ethereum_tx_hash=None,
            report=report_data,
            report_file=None,
            error=str(exc),
        )


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

    report_data = {
        "url": req.url,
        "violation_type": "complete_analysis",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "detection_details": {
            "privacy": req.privacy_data.dict(),
            "manipulation": req.manipulation_data.dict(),
            "risk": {
                "privacy_risk": p_risk,
                "manipulation_risk": m_risk,
                "overall_risk": o_risk,
            },
            "regulatory_violations": violations,
        },
    }
    blockchain_result = anchor_report_proof(report_data)

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
        ai_powered=OPENAI_AVAILABLE,
        blockchain_proof_stored=blockchain_result["blockchain_proof_stored"],
        ethereum_tx_hash=blockchain_result["ethereum_tx_hash"],
        report=report_data,
        report_file=blockchain_result["report_file"],
        error=blockchain_result["error"],
    )


@app.post("/analyze-privacy")
async def analyze_privacy(req: PrivacyOnlyRequest):
    risk  = calc_privacy_risk(req.privacy_data)
    level = get_risk_level(risk)
    violations = get_privacy_violations(req.privacy_data.dict())

    report_data = {
        "url": req.url,
        "violation_type": "privacy_analysis",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "detection_details": {
            "privacy": req.privacy_data.dict(),
            "risk": {"privacy_risk": risk, "privacy_level": level},
            "regulatory_violations": violations,
        },
    }
    blockchain_result = anchor_report_proof(report_data)

    return {
        "url": req.url,
        "privacy_risk": risk,
        "privacy_level": level,
        "insights": make_privacy_insights(req.privacy_data),
        "violations": violations,
        "blockchain_proof_stored": blockchain_result["blockchain_proof_stored"],
        "ethereum_tx_hash": blockchain_result["ethereum_tx_hash"],
        "report": report_data,
        "report_file": blockchain_result["report_file"],
        "error": blockchain_result["error"],
    }


@app.post("/analyze-dark-patterns")
async def analyze_dark_patterns(req: ManipulationOnlyRequest):
    risk  = calc_manipulation_risk(req.manipulation_data)
    level = get_risk_level(risk)
    violations = get_manipulation_violations([p.dict() for p in req.manipulation_data.patterns])

    report_data = {
        "url": req.url,
        "violation_type": "dark_pattern_analysis",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "detection_details": {
            "manipulation": req.manipulation_data.dict(),
            "risk": {"manipulation_risk": risk, "manipulation_level": level},
            "regulatory_violations": violations,
        },
    }
    blockchain_result = anchor_report_proof(report_data)

    return {
        "url": req.url,
        "manipulation_risk": risk,
        "manipulation_level": level,
        "insights": make_manipulation_insights(req.manipulation_data),
        "violations": violations,
        "blockchain_proof_stored": blockchain_result["blockchain_proof_stored"],
        "ethereum_tx_hash": blockchain_result["ethereum_tx_hash"],
        "report": report_data,
        "report_file": blockchain_result["report_file"],
        "error": blockchain_result["error"],
    }
