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


def _first_available_env(*names: str) -> str:
    for name in names:
        value = os.getenv(name)
        if value and value.strip():
            return value.strip()
    raise BlockchainAnchoringError(
        "Missing required environment variable. Expected one of: " + ", ".join(names)
    )


def store_report_hash_on_chain(report_data: dict) -> str:
    """
    Hash a report payload and store that hash in EvidenceRegistry on Ethereum.

    Returns the Ethereum transaction hash if successful.
    """
    try:
        rpc_url = _first_available_env("RPC_URL", "ETH_RPC_URL")
        contract_address = _first_available_env(
            "CONTRACT_ADDRESS",
            "EVIDENCE_REGISTRY_CONTRACT_ADDRESS",
        )
        private_key = _first_available_env("PRIVATE_KEY", "ETH_PRIVATE_KEY")

        chain_id = int(os.getenv("ETH_CHAIN_ID", str(SEPOLIA_CHAIN_ID)))
        receipt_timeout = int(os.getenv("ETH_RECEIPT_TIMEOUT_SEC", "180"))

        report_hash = build_report_sha256(report_data)

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

    except BlockchainAnchoringError:
        raise
    except Exception as exc:
        raise BlockchainAnchoringError(f"Failed to store report hash on-chain: {exc}") from exc
