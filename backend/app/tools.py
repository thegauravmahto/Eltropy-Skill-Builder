"""Mocked banking tools for the Skill Builder harness.

Each function is exposed to ADK as a FunctionTool. Schemas match lib/seed.ts exactly.
No real API calls — fixtures only.
"""

from __future__ import annotations

from datetime import timedelta
from typing import Any

from .fixtures import (
    ACCOUNTS,
    CARDS,
    LOANS,
    MEMBERS,
    TODAY,
    TRANSACTIONS,
    skip_a_pay_eligibility,
)


# ---- Authentication ----

def authenticate_member(member_id: str, channel: str) -> dict[str, Any]:
    """Verify a member identity using channel-appropriate factors.

    Args:
        member_id: The member's ID, e.g. "M-1001".
        channel: The channel performing auth, e.g. "voice", "chat", "web".

    Returns:
        A dict with verified status and auth level: {"verified": true, "level": "L2", ...}
    """
    member = MEMBERS.get(member_id)
    if not member:
        return {"verified": False, "level": "none", "reason": "member_not_found"}
    # Mock: pretend the channel-appropriate factor succeeded for known members.
    return {
        "verified": True,
        "level": "L2",
        "member_id": member.id,
        "member_name": member.name,
        "channel": channel,
    }


# ---- Account Services ----

def get_account_balance(member_id: str, account_id: str) -> dict[str, Any]:
    """Return the available and current balance for a member's account.

    Args:
        member_id: The member's ID.
        account_id: The account to query.
    """
    account = ACCOUNTS.get(account_id)
    if not account or account.member_id != member_id:
        return {"error": "account_not_found_or_not_owned"}
    return {
        "account_id": account.id,
        "type": account.type,
        "last4": account.last4,
        "available": account.available,
        "current": account.current,
    }


def get_recent_transactions(account_id: str, limit: int = 5) -> dict[str, Any]:
    """Return the most recent transactions on an account.

    Args:
        account_id: The account to query.
        limit: Max number of transactions to return.
    """
    account = ACCOUNTS.get(account_id)
    if not account:
        return {"error": "account_not_found"}
    txs = [t for t in TRANSACTIONS if t.account_id == account_id]
    txs.sort(key=lambda t: t.posted_at, reverse=True)
    txs = txs[:limit]
    return {
        "account_id": account_id,
        "count": len(txs),
        "transactions": [
            {
                "id": t.id,
                "posted_at": t.posted_at.isoformat(),
                "merchant": t.merchant,
                "amount": t.amount,
                "category": t.category,
            }
            for t in txs
        ],
    }


def lock_card(card_id: str, reason: str = "member_request") -> dict[str, Any]:
    """Place a freeze on a member's card. Reversible.

    Args:
        card_id: The card ID, e.g. "C-4001".
        reason: Why the card is being locked.
    """
    card = CARDS.get(card_id)
    if not card:
        return {"success": False, "reason": "card_not_found"}
    if card.status == "locked":
        return {"success": False, "reason": "already_locked", "card_id": card.id}
    if card.status == "expired":
        return {"success": False, "reason": "card_expired", "card_id": card.id}
    # Mutate in-memory state for realistic demo
    card.status = "locked"
    return {
        "success": True,
        "card_id": card.id,
        "last4": card.last4,
        "new_status": "locked",
        "lock_reason": reason,
    }


# ---- Loan Servicing ----

def get_loan_status(loan_id: str) -> dict[str, Any]:
    """Return current loan principal, next due date, and payment history.

    Args:
        loan_id: The loan ID, e.g. "L-2001".
    """
    loan = LOANS.get(loan_id)
    if not loan:
        return {"error": "loan_not_found"}
    return {
        "loan_id": loan.id,
        "type": loan.type,
        "principal_remaining": loan.principal_remaining,
        "next_due_date": loan.next_due_date.isoformat(),
        "payment_amount": loan.payment_amount,
        "status": loan.status,
        "prior_deferral_count": len(loan.prior_deferrals),
        "most_recent_deferral": (
            max(loan.prior_deferrals).isoformat() if loan.prior_deferrals else None
        ),
    }


def defer_payment(
    loan_id: str, days: int = 30, reason: str = "member_request"
) -> dict[str, Any]:
    """Defer a scheduled loan payment by N days. Financial side-effect.

    Args:
        loan_id: The loan ID to defer.
        days: Number of days to defer the next payment.
        reason: Reason for the deferral, for the audit trail.
    """
    loan = LOANS.get(loan_id)
    if not loan:
        return {"success": False, "reason": "loan_not_found"}

    eligible, why_not = skip_a_pay_eligibility(loan)
    if not eligible:
        return {"success": False, "reason": why_not, "loan_id": loan.id}

    new_due = loan.next_due_date + timedelta(days=days)
    loan.next_due_date = new_due
    loan.prior_deferrals.append(TODAY)

    return {
        "success": True,
        "loan_id": loan.id,
        "deferred_days": days,
        "new_next_due_date": new_due.isoformat(),
        "audit_reason": reason,
    }


# ---- Payments ----

def initiate_payment(
    from_account_id: str, to_account_id: str, amount: float
) -> dict[str, Any]:
    """Initiate an internal transfer between member accounts. Financial side-effect.

    Args:
        from_account_id: Source account.
        to_account_id: Destination account.
        amount: Transfer amount in USD.
    """
    src = ACCOUNTS.get(from_account_id)
    dst = ACCOUNTS.get(to_account_id)
    if not src or not dst:
        return {"success": False, "reason": "account_not_found"}
    if src.member_id != dst.member_id:
        return {"success": False, "reason": "cross_member_transfer_not_allowed"}
    if amount <= 0:
        return {"success": False, "reason": "amount_must_be_positive"}
    if src.available < amount:
        return {
            "success": False,
            "reason": "insufficient_funds",
            "available": src.available,
        }
    # Mutate
    src.available -= amount
    src.current -= amount
    dst.available += amount
    dst.current += amount
    return {
        "success": True,
        "from_account_id": from_account_id,
        "to_account_id": to_account_id,
        "amount": amount,
        "new_source_balance": src.available,
        "new_dest_balance": dst.available,
    }


ALL_TOOLS = [
    authenticate_member,
    get_account_balance,
    get_recent_transactions,
    lock_card,
    get_loan_status,
    defer_payment,
    initiate_payment,
]
