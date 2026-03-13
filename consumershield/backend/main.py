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
import asyncio
import json
import math
import re
import ipaddress
from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv
from transformers import pipeline

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

# ── Local BERT model for dark pattern classification ──────────
LOCAL_NLP_AVAILABLE = False
try:
    print("[ConsumerShield] Loading local BERT model...")
    # Using a lightweight model fine-tuned specifically for dark patterns
    nlp_classifier = pipeline("text-classification", model="aditizingre07/distilroberta-dark-pattern")
    LOCAL_NLP_AVAILABLE = True
    print("[ConsumerShield] Local BERT loaded successfully!")
except Exception as e:
    print(f"[ConsumerShield] Failed to load BERT: {e}")

# ── Tracker Radar + heuristic intelligence ───────────────────
TRACKING_KEYWORDS = ("ads", "pixel", "analytics", "metrics", "track", "telemetry")
CDN_KEYWORDS = ("cdn", "static", "assets", "cloudfront", "akamai", "fastly", "jsdelivr", "gstatic")

RADAR_DOMAIN_MAP: Dict[str, Dict[str, Any]] = {}
RADAR_SOURCE_PATH: Optional[str] = None
RADAR_LOAD_ERROR: Optional[str] = None


def normalize_domain(domain: str) -> str:
    if not domain:
        return ""
    cleaned = domain.strip().lower()
    if "://" in cleaned:
        cleaned = cleaned.split("://", 1)[1]
    cleaned = cleaned.split("/", 1)[0]
    cleaned = cleaned.split(":", 1)[0]
    return cleaned.strip(".")


def walk_subdomains(domain: str) -> List[str]:
    """Walk from full host to parent domain, e.g. a.b.c.com -> [a.b.c.com, b.c.com, c.com]."""
    normalized = normalize_domain(domain)
    if not normalized:
        return []
    parts = normalized.split(".")
    if len(parts) == 1:
        return [normalized]
    return [".".join(parts[idx:]) for idx in range(0, len(parts) - 1)]


def _to_float(value: Any) -> Optional[float]:
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _extract_entity_name(record: Dict[str, Any]) -> str:
    owner = record.get("owner")
    if isinstance(owner, dict):
        for key in ("displayName", "name", "organization"):
            value = owner.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
    elif isinstance(owner, str) and owner.strip():
        return owner.strip()

    for key in ("entity", "company", "organization", "org", "ownerName"):
        value = record.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()

    return "Unknown Entity"


def _extract_categories(record: Dict[str, Any]) -> List[str]:
    for key in ("categories", "tags", "types"):
        value = record.get(key)
        if isinstance(value, list):
            return [str(item) for item in value if item is not None]
        if isinstance(value, str) and value:
            return [value]
    record_type = record.get("type")
    if isinstance(record_type, str) and record_type:
        return [record_type]
    return []


def _iter_radar_records(raw_data: Any):
    if isinstance(raw_data, list):
        for item in raw_data:
            if isinstance(item, dict):
                yield item
        return

    if not isinstance(raw_data, dict):
        return

    domains_field = raw_data.get("domains")
    if isinstance(domains_field, dict):
        for domain, info in domains_field.items():
            if isinstance(info, dict):
                merged = dict(info)
                merged.setdefault("domain", domain)
                yield merged
        return
    if isinstance(domains_field, list):
        for item in domains_field:
            if isinstance(item, dict):
                yield item
        return

    # Fallback: assume top-level mapping of domain -> record
    for domain, info in raw_data.items():
        if isinstance(info, dict):
            merged = dict(info)
            merged.setdefault("domain", domain)
            yield merged


def _candidate_radar_paths() -> List[str]:
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    repo_dir = os.path.dirname(backend_dir)
    configured = os.getenv("RADAR_LITE_PATH", "").strip()
    candidates = [
        configured,
        os.path.join(backend_dir, "radar_lite.json"),
        os.path.join(repo_dir, "radar_lite.json"),
        os.path.join(os.getcwd(), "radar_lite.json"),
    ]

    seen = set()
    deduped = []
    for path in candidates:
        if path and path not in seen:
            seen.add(path)
            deduped.append(path)
    return deduped


def load_radar_lite() -> None:
    global RADAR_DOMAIN_MAP, RADAR_SOURCE_PATH, RADAR_LOAD_ERROR

    RADAR_DOMAIN_MAP = {}
    RADAR_SOURCE_PATH = None
    RADAR_LOAD_ERROR = None

    for path in _candidate_radar_paths():
        if not os.path.isfile(path):
            continue
        try:
            with open(path, "r", encoding="utf-8") as handle:
                raw_data = json.load(handle)

            domain_map: Dict[str, Dict[str, Any]] = {}
            for record in _iter_radar_records(raw_data):
                record_domain = normalize_domain(str(record.get("domain", "")))
                if not record_domain:
                    continue
                domain_map[record_domain] = {
                    "domain": record_domain,
                    "entity": _extract_entity_name(record),
                    "prevalence": _to_float(record.get("prevalence")),
                    "categories": _extract_categories(record),
                }

            RADAR_DOMAIN_MAP = domain_map
            RADAR_SOURCE_PATH = path
            print(f"[ConsumerShield] Loaded radar_lite.json with {len(domain_map)} domains from {path}")
            return
        except Exception as exc:
            RADAR_LOAD_ERROR = f"{type(exc).__name__}: {exc}"
            print(f"[ConsumerShield] Failed to load radar_lite.json from {path}: {RADAR_LOAD_ERROR}")
            return

    RADAR_LOAD_ERROR = "radar_lite.json not found"
    print("[ConsumerShield] radar_lite.json not found; using heuristic-only domain intelligence")


def resolve_radar_entity(domain: str) -> Optional[Dict[str, Any]]:
    """Tier 1: exact/subdomain-walk lookup in Tracker Radar map."""
    for candidate in walk_subdomains(domain):
        found = RADAR_DOMAIN_MAP.get(candidate)
        if found:
            return {
                **found,
                "matched_domain": candidate,
                "input_domain": normalize_domain(domain),
            }
    return None


def _has_tracking_keywords(domain: str) -> List[str]:
    lowered = normalize_domain(domain)
    return [keyword for keyword in TRACKING_KEYWORDS if keyword in lowered]


def _is_ip_domain(domain: str) -> bool:
    try:
        ipaddress.ip_address(normalize_domain(domain))
        return True
    except ValueError:
        return False


def _shannon_entropy(value: str) -> float:
    if not value:
        return 0.0
    counts: Dict[str, int] = {}
    for ch in value:
        counts[ch] = counts.get(ch, 0) + 1
    entropy = 0.0
    total = len(value)
    for count in counts.values():
        probability = count / total
        entropy -= probability * math.log2(probability)
    return entropy


def _has_suspicious_entropy(domain: str) -> bool:
    normalized = normalize_domain(domain)
    labels = [label for label in normalized.split(".") if label]
    if not labels:
        return False

    longest = max(labels, key=len)
    if len(longest) < 14:
        return False

    entropy = _shannon_entropy(longest)
    has_letters = bool(re.search(r"[a-z]", longest))
    has_digits = bool(re.search(r"\d", longest))
    return entropy >= 3.5 and (has_letters and has_digits)


def _is_standard_cdn(domain: str) -> bool:
    lowered = normalize_domain(domain)
    return any(keyword in lowered for keyword in CDN_KEYWORDS)


def predict_tracker_score(domain: str, radar_match: Optional[Dict[str, Any]], reasons: List[str]) -> float:
    """Tier 3: risk scoring from 1-10 based on known prevalence and heuristics."""
    if radar_match:
        prevalence = radar_match.get("prevalence")
        if isinstance(prevalence, (int, float)):
            if prevalence >= 0.05:
                return 10.0
            if prevalence >= 0.02:
                return 9.0
            if prevalence >= 0.005:
                return 8.0
        categories = [str(cat).lower() for cat in radar_match.get("categories", [])]
        if any(cat in {"advertising", "analytics", "tracker", "fingerprinting"} for cat in categories):
            return 8.0
        return 7.0

    if any(reason.startswith("keyword:") for reason in reasons):
        return 6.5
    if "ip-domain" in reasons or "suspicious-entropy" in reasons:
        return 6.0
    if _is_standard_cdn(domain):
        return 2.5
    return 4.0


load_radar_lite()

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
    ai_details: Optional[Dict[str, Any]] = None  # Contains gemini_insight, bert_classification, timestamp


class AnalyzeDomainsRequest(BaseModel):
    domains: List[str]
    first_party_domain: Optional[str] = None


class AnalyzeDomainsResponse(BaseModel):
    resolved_trackers: List[Dict[str, Any]]
    suspicious_domains: List[Dict[str, Any]]
    total_privacy_score: float

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

async def make_ai_insight(url: str, privacy: PrivacyData, manipulation: ManipulationData) -> Dict[str, Any]:
    """
    Run Gemini and BERT models simultaneously using asyncio.gather.
    Returns a dict with:
      - gemini_insight: str or None
      - bert_classification: dict with 'label' and 'confidence' or None
      - timestamp: ISO timestamp
      - combined_summary: human-readable summary
    """
    
    async def get_gemini_insight():
        """Task to fetch Gemini insight with 4-second timeout"""
        if not GEMINI_AVAILABLE:
            return None
        try:
            prompt = f"Website: {url}. Trackers: {len(privacy.trackers)}. Dark patterns: {len(manipulation.patterns)}. In 2 short sentences, explain the consumer risk and mention the DPDP Act 2023."
            response = await asyncio.wait_for(
                asyncio.to_thread(gemini_model.generate_content, prompt),
                timeout=4.0
            )
            return response.text.strip()
        except asyncio.TimeoutError:
            print("[ConsumerShield] Gemini timed out after 4s")
            return None
        except Exception as e:
            print(f"[ConsumerShield] Gemini error: {e}")
            return None

    async def get_bert_classification():
        """Task to classify first dark pattern using local BERT"""
        if not LOCAL_NLP_AVAILABLE or not manipulation.patterns:
            return None
        try:
            sample_text = manipulation.patterns[0].name
            bert_result = nlp_classifier(sample_text)
            return {
                "label": bert_result[0].get("label", "unknown"),
                "confidence": round(bert_result[0].get("score", 0.0) * 100, 1),
                "text_analyzed": sample_text
            }
        except Exception as e:
            print(f"[ConsumerShield] BERT error: {e}")
            return None

    # Run both models simultaneously
    gemini_insight, bert_classification = await asyncio.gather(
        get_gemini_insight(),
        get_bert_classification(),
        return_exceptions=False
    )

    # Build combined summary
    combined_parts = []
    if gemini_insight:
        combined_parts.append(f"🤖 Gemini: {gemini_insight}")
    if bert_classification:
        combined_parts.append(f"🧠 BERT: Detected '{bert_classification['label']}' with {bert_classification['confidence']}% confidence")
    
    if not combined_parts:
        combined_summary = "⚠️ Warning: High risk of psychological manipulation and data extraction detected on this site."
    else:
        combined_summary = " | ".join(combined_parts)

    return {
        "gemini_insight": gemini_insight,
        "bert_classification": bert_classification,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "combined_summary": combined_summary
    }

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
        combined_insight=combined.get("combined_summary", "Analysis complete."),
        regulatory_violations=violations,
        ai_powered=GEMINI_AVAILABLE,
        ai_details=combined,
    )


@app.post("/analyze-domains", response_model=AnalyzeDomainsResponse)
async def analyze_domains(req: AnalyzeDomainsRequest):
    first_party = normalize_domain(req.first_party_domain or "")

    unique_domains: List[str] = []
    seen = set()
    for raw_domain in req.domains:
        normalized = normalize_domain(raw_domain)
        if not normalized or normalized in seen:
            continue
        if first_party and (normalized == first_party or normalized.endswith(f".{first_party}")):
            continue
        seen.add(normalized)
        unique_domains.append(normalized)

    resolved_trackers: List[Dict[str, Any]] = []
    suspicious_domains: List[Dict[str, Any]] = []
    weighted_sum = 0.0
    total_weight = 0.0

    for domain in unique_domains:
        reasons: List[str] = []
        keyword_hits = _has_tracking_keywords(domain)
        reasons.extend([f"keyword:{keyword}" for keyword in keyword_hits])
        if _is_ip_domain(domain):
            reasons.append("ip-domain")
        if _has_suspicious_entropy(domain):
            reasons.append("suspicious-entropy")

        radar_match = resolve_radar_entity(domain)
        score = predict_tracker_score(domain, radar_match, reasons)

        weight = 1.0
        if radar_match and isinstance(radar_match.get("prevalence"), (int, float)):
            weight += min(1.0, float(radar_match["prevalence"]) * 20.0)
        if reasons:
            weight += 0.1

        weighted_sum += score * weight
        total_weight += weight

        if radar_match:
            resolved_trackers.append({
                "domain": domain,
                "matched_domain": radar_match.get("matched_domain"),
                "entity": radar_match.get("entity"),
                "prevalence": radar_match.get("prevalence"),
                "categories": radar_match.get("categories", []),
                "privacy_score": score,
            })
        elif reasons:
            suspicious_domains.append({
                "domain": domain,
                "reasons": reasons,
                "privacy_score": score,
            })

    total_privacy_score = round((weighted_sum / total_weight), 2) if total_weight > 0 else 1.0

    return AnalyzeDomainsResponse(
        resolved_trackers=resolved_trackers,
        suspicious_domains=suspicious_domains,
        total_privacy_score=total_privacy_score,
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
