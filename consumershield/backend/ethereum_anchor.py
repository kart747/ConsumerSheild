"""
Ethereum anchoring utilities for ConsumerShield evidence records.

This module stores a deterministic bytes32 keccak hash of a report payload in
the EvidenceRegistry contract on Sepolia, so the backend can return an
immutable proof transaction.
"""

import json
import logging
import os
from typing import Any, Dict

from web3 import Web3
from web3.exceptions import ContractLogicError

logger = logging.getLogger("consumershield.ethereum")

SEPOLIA_CHAIN_ID = 11155111

# Minimal ABI for the EvidenceRegistry contract.
EVIDENCE_REGISTRY_ABI = [
    {
        "inputs": [{"internalType": "bytes32", "name": "reportHash", "type": "bytes32"}],
        "name": "storeHash",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
]

ABI = EVIDENCE_REGISTRY_ABI


class BlockchainAnchoringError(Exception):
    """Raised when report anchoring on Ethereum fails."""


class DuplicateReportAnchoringError(BlockchainAnchoringError):
    """Raised when the contract rejects a report hash as already stored."""


def build_report_keccak(report_data: Dict[str, Any]) -> bytes:
    """Create a deterministic bytes32 keccak hash from report JSON.

    The timestamp remains in the stored/report response payload, but is excluded
    from hash computation so logically identical reports map to the same hash.
    """
    stable_report = {
        key: value for key, value in report_data.items() if key != "timestamp"
    }
    report_json = json.dumps(stable_report, sort_keys=True)
    return Web3.keccak(text=report_json)


def _first_available_env(*names: str) -> str:
    for name in names:
        value = os.getenv(name)
        if value and value.strip():
            return value.strip()
    raise BlockchainAnchoringError(
        "Missing required environment variable. Expected one of: " + ", ".join(names)
    )


def _is_duplicate_report_error(error: Exception) -> bool:
    return "report already stored" in str(error).lower()


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

        report_hash = build_report_keccak(report_data)

        web3 = Web3(Web3.HTTPProvider(rpc_url))
        if not web3.is_connected():
            raise BlockchainAnchoringError("Unable to connect to Ethereum RPC endpoint")

        contract = web3.eth.contract(
            address=Web3.to_checksum_address(contract_address),
            abi=ABI,
        )

        account = web3.eth.account.from_key(private_key)
        wallet_address = account.address

        tx_call = contract.functions.storeHash(report_hash)
        try:
            tx_call.call({"from": wallet_address})
        except ContractLogicError as exc:
            if _is_duplicate_report_error(exc):
                raise DuplicateReportAnchoringError(
                    "Duplicate report already anchored on blockchain"
                ) from exc
            raise BlockchainAnchoringError(
                f"Smart contract rejected report hash: {exc}"
            ) from exc
        except Exception as exc:
            if _is_duplicate_report_error(exc):
                raise DuplicateReportAnchoringError(
                    "Duplicate report already anchored on blockchain"
                ) from exc
            raise BlockchainAnchoringError(
                f"Failed preflight contract call: {exc}"
            ) from exc

        transaction = tx_call.build_transaction(
            {
                "from": wallet_address,
                "nonce": web3.eth.get_transaction_count(wallet_address),
                "chainId": chain_id,
                "gas": 200000,
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

    except DuplicateReportAnchoringError:
        raise
    except BlockchainAnchoringError:
        raise
    except Exception as exc:
        if _is_duplicate_report_error(exc):
            raise DuplicateReportAnchoringError(
                "Duplicate report already anchored on blockchain"
            ) from exc
        raise BlockchainAnchoringError(f"Failed to store report hash on-chain: {exc}") from exc
