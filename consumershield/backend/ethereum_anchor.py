"""
Ethereum anchoring utilities for ConsumerShield evidence records.

This module stores a SHA256 hash of a report payload in the EvidenceRegistry
contract on Sepolia, so the backend can return an immutable proof transaction.
"""

import hashlib
import json
import logging
import os
from typing import Any, Dict

from web3 import Web3

logger = logging.getLogger("consumershield.ethereum")

SEPOLIA_CHAIN_ID = 11155111

# Minimal ABI for the EvidenceRegistry contract.
EVIDENCE_REGISTRY_ABI = [
    {
        "inputs": [{"internalType": "string", "name": "hash", "type": "string"}],
        "name": "storeHash",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "name": "reports",
        "outputs": [{"internalType": "string", "name": "", "type": "string"}],
        "stateMutability": "view",
        "type": "function",
    },
]

ABI = EVIDENCE_REGISTRY_ABI


class BlockchainAnchoringError(Exception):
    """Raised when report anchoring on Ethereum fails."""


def build_report_sha256(report_data: Dict[str, Any]) -> str:
    """Create a deterministic SHA256 hash from report JSON."""
    report_json = json.dumps(
        report_data,
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    )
    return hashlib.sha256(report_json.encode("utf-8")).hexdigest()


def build_report_keccak(report_data: Dict[str, Any]) -> str:
    """Create deterministic EVM-compatible hash (0x...) from sorted report JSON."""
    report_json = json.dumps(
        report_data,
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    )
    return Web3.keccak(text=report_json).hex()


def _first_available_env(*names: str) -> str:
    for name in names:
        value = os.getenv(name)
        if value and value.strip():
            return value.strip()
    raise BlockchainAnchoringError(
        "Missing required environment variable. Expected one of: " + ", ".join(names)
    )


def _store_hash_string_on_chain(report_hash: str) -> str:
    """Store a precomputed hash string in EvidenceRegistry and return tx hash."""
    rpc_url = _first_available_env("RPC_URL", "ETH_RPC_URL")
    contract_address = _first_available_env(
        "CONTRACT_ADDRESS",
        "EVIDENCE_REGISTRY_CONTRACT_ADDRESS",
    )
    private_key = _first_available_env("PRIVATE_KEY", "ETH_PRIVATE_KEY")

    chain_id = int(os.getenv("ETH_CHAIN_ID", str(SEPOLIA_CHAIN_ID)))
    receipt_timeout = int(os.getenv("ETH_RECEIPT_TIMEOUT_SEC", "180"))

    web3 = Web3(Web3.HTTPProvider(rpc_url))
    if not web3.is_connected():
        raise BlockchainAnchoringError("Unable to connect to Ethereum RPC endpoint")

    contract = web3.eth.contract(
        address=Web3.to_checksum_address(contract_address),
        abi=ABI,
    )

    account = web3.eth.account.from_key(private_key)
    nonce = web3.eth.get_transaction_count(account.address)

    tx_call = contract.functions.storeHash(report_hash)
    gas_estimate = tx_call.estimate_gas({"from": account.address})

    transaction = tx_call.build_transaction(
        {
            "from": account.address,
            "nonce": nonce,
            "chainId": chain_id,
            "gas": int(gas_estimate * 1.2),
            "gasPrice": web3.eth.gas_price,
        }
    )

    signed_txn = web3.eth.account.sign_transaction(transaction, private_key=private_key)
    tx_hash = web3.eth.send_raw_transaction(signed_txn.raw_transaction)
    receipt = web3.eth.wait_for_transaction_receipt(tx_hash, timeout=receipt_timeout)

    if receipt.status != 1:
        raise BlockchainAnchoringError("Ethereum transaction reverted")

    tx_hash_hex = Web3.to_hex(tx_hash)
    logger.info("Blockchain proof stored successfully. tx_hash=%s", tx_hash_hex)
    return tx_hash_hex


def store_report_hash_on_chain(report_data: dict) -> str:
    """
    Hash a report payload and store that hash in EvidenceRegistry on Ethereum.

    Returns the Ethereum transaction hash if successful.
    """
    try:
        report_hash = build_report_sha256(report_data)
        return _store_hash_string_on_chain(report_hash)
    except BlockchainAnchoringError:
        raise
    except Exception as exc:
        raise BlockchainAnchoringError(f"Failed to store report hash on-chain: {exc}") from exc


def store_precomputed_hash_on_chain(report_hash: str) -> str:
    """Store caller-supplied hash directly in contract (no backend re-hashing)."""
    normalized_hash = str(report_hash or "").strip()
    if not normalized_hash:
        raise BlockchainAnchoringError("Cannot anchor empty report hash")

    try:
        return _store_hash_string_on_chain(normalized_hash)
    except BlockchainAnchoringError:
        raise
    except Exception as exc:
        raise BlockchainAnchoringError(f"Failed to store precomputed hash on-chain: {exc}") from exc


def get_stored_hash_from_tx(tx_hash: str) -> str:
    """Decode `storeHash(string)` calldata and return the stored hash string."""
    if not tx_hash or not str(tx_hash).strip():
        raise BlockchainAnchoringError("Missing transaction hash for verification")

    rpc_url = _first_available_env("RPC_URL", "ETH_RPC_URL")
    contract_address = _first_available_env(
        "CONTRACT_ADDRESS",
        "EVIDENCE_REGISTRY_CONTRACT_ADDRESS",
    )

    web3 = Web3(Web3.HTTPProvider(rpc_url))
    if not web3.is_connected():
        raise BlockchainAnchoringError("Unable to connect to Ethereum RPC endpoint")

    contract = web3.eth.contract(
        address=Web3.to_checksum_address(contract_address),
        abi=ABI,
    )

    try:
        tx = web3.eth.get_transaction(str(tx_hash).strip())
    except Exception as exc:
        raise BlockchainAnchoringError(f"Unable to fetch transaction {tx_hash}: {exc}") from exc

    input_data = tx.get("input") or ""
    if not input_data or input_data == "0x":
        raise BlockchainAnchoringError("Transaction input is empty; cannot decode stored hash")

    try:
        function_obj, params = contract.decode_function_input(input_data)
    except Exception as exc:
        raise BlockchainAnchoringError(f"Failed to decode transaction calldata: {exc}") from exc

    if getattr(function_obj, "fn_name", "") != "storeHash":
        raise BlockchainAnchoringError("Transaction is not a storeHash call")

    on_chain_hash = str(params.get("hash") or "").strip()
    if not on_chain_hash:
        raise BlockchainAnchoringError("Decoded transaction does not contain a hash value")

    return on_chain_hash


def verify_report_hash_on_chain(tx_hash: str, expected_hash: str) -> Dict[str, Any]:
    """Cross-check DB hash against the hash committed in Ethereum transaction calldata."""
    normalized_expected = str(expected_hash or "").strip().lower()
    if not normalized_expected:
        return {
            "verified": False,
            "on_chain_hash": None,
            "expected_hash": "",
            "error": "Missing expected hash for verification",
        }

    try:
        on_chain_hash = get_stored_hash_from_tx(tx_hash)
        normalized_on_chain = on_chain_hash.lower()
        return {
            "verified": normalized_on_chain == normalized_expected,
            "on_chain_hash": on_chain_hash,
            "expected_hash": expected_hash,
            "error": None,
        }
    except Exception as exc:
        return {
            "verified": False,
            "on_chain_hash": None,
            "expected_hash": expected_hash,
            "error": str(exc),
        }
