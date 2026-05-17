"""Mock banking fixtures for the Skill Builder harness.

Internally-consistent data: 4 members, 10 accounts, 4 loans, 5 cards, ~40 transactions.
The 7 mocked tool functions in tools.py read from this module.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from typing import Literal


@dataclass
class Member:
    id: str
    name: str
    auth_level: Literal["none", "L1", "L2", "L3"]
    account_ids: list[str]
    loan_ids: list[str]
    card_ids: list[str]


@dataclass
class Account:
    id: str
    member_id: str
    type: Literal["checking", "savings", "money_market"]
    last4: str
    available: float
    current: float
    opened: date


@dataclass
class Loan:
    id: str
    member_id: str
    type: Literal["auto", "mortgage", "personal", "heloc"]
    principal_remaining: float
    next_due_date: date
    payment_amount: float
    status: Literal["current", "delinquent", "paid_off"]
    prior_deferrals: list[date] = field(default_factory=list)


@dataclass
class Card:
    id: str
    member_id: str
    type: Literal["debit", "credit"]
    last4: str
    status: Literal["active", "locked", "expired"]
    credit_limit: float | None = None


@dataclass
class Transaction:
    id: str
    account_id: str
    posted_at: datetime
    merchant: str
    amount: float  # negative = debit, positive = credit
    category: str


TODAY = date(2026, 5, 15)


MEMBERS: dict[str, Member] = {
    "M-1001": Member(
        id="M-1001",
        name="Alex Chen",
        auth_level="L3",
        account_ids=["A-3001", "A-3002"],
        loan_ids=["L-2001"],
        card_ids=["C-4001", "C-4002"],
    ),
    "M-1002": Member(
        id="M-1002",
        name="Priya Patel",
        auth_level="L2",
        account_ids=["A-3003"],
        loan_ids=["L-2002"],
        card_ids=["C-4003", "C-4004"],
    ),
    "M-1003": Member(
        id="M-1003",
        name="Marcus Johnson",
        auth_level="none",
        account_ids=["A-3004"],
        loan_ids=["L-2003"],
        card_ids=[],
    ),
    "M-1004": Member(
        id="M-1004",
        name="Linda Okafor",
        auth_level="L3",
        account_ids=["A-3005", "A-3006", "A-3007"],
        loan_ids=["L-2004"],
        card_ids=["C-4005"],
    ),
}


ACCOUNTS: dict[str, Account] = {
    "A-3001": Account("A-3001", "M-1001", "checking", "4127", 4231.07, 4231.07, date(2021, 3, 12)),
    "A-3002": Account("A-3002", "M-1001", "savings", "8843", 12_540.22, 12_540.22, date(2021, 3, 12)),
    "A-3003": Account("A-3003", "M-1002", "checking", "9012", 1_876.50, 1_876.50, date(2019, 11, 3)),
    "A-3004": Account("A-3004", "M-1003", "checking", "5511", 312.88, 312.88, date(2024, 8, 21)),
    "A-3005": Account("A-3005", "M-1004", "checking", "2266", 8_904.10, 8_904.10, date(2017, 2, 1)),
    "A-3006": Account("A-3006", "M-1004", "savings", "7733", 45_120.00, 45_120.00, date(2017, 2, 1)),
    "A-3007": Account("A-3007", "M-1004", "money_market", "3399", 102_445.55, 102_445.55, date(2020, 6, 15)),
}


LOANS: dict[str, Loan] = {
    "L-2001": Loan(
        id="L-2001",
        member_id="M-1001",
        type="auto",
        principal_remaining=14_200.00,
        next_due_date=date(2026, 6, 1),
        payment_amount=412.55,
        status="current",
        prior_deferrals=[],  # eligible
    ),
    "L-2002": Loan(
        id="L-2002",
        member_id="M-1002",
        type="mortgage",
        principal_remaining=287_450.00,
        next_due_date=date(2026, 6, 1),
        payment_amount=2_180.00,
        status="current",
        prior_deferrals=[],  # ineligible (mortgage policy)
    ),
    "L-2003": Loan(
        id="L-2003",
        member_id="M-1003",
        type="personal",
        principal_remaining=4_500.00,
        next_due_date=date(2026, 6, 5),
        payment_amount=185.00,
        status="current",
        prior_deferrals=[date(2026, 2, 14)],  # 90 days ago, eligible
    ),
    "L-2004": Loan(
        id="L-2004",
        member_id="M-1004",
        type="personal",
        principal_remaining=2_100.00,
        next_due_date=date(2026, 6, 3),
        payment_amount=95.00,
        status="current",
        prior_deferrals=[date(2026, 5, 1)],  # 14 days ago, INELIGIBLE - drives edge case #3
    ),
}


CARDS: dict[str, Card] = {
    "C-4001": Card("C-4001", "M-1001", "debit", "1109", "active"),
    "C-4002": Card("C-4002", "M-1001", "credit", "5544", "active", credit_limit=8_000.00),
    "C-4003": Card("C-4003", "M-1002", "credit", "8821", "active", credit_limit=15_000.00),
    "C-4004": Card("C-4004", "M-1002", "credit", "3360", "expired", credit_limit=5_000.00),
    "C-4005": Card("C-4005", "M-1004", "debit", "7011", "locked"),
}


def _dt(days_ago: int, hour: int = 10) -> datetime:
    return datetime.combine(TODAY - timedelta(days=days_ago), datetime.min.time()).replace(hour=hour)


TRANSACTIONS: list[Transaction] = [
    # A-3001 Alex checking
    Transaction("T-001", "A-3001", _dt(0, 9), "Blue Bottle Coffee", -6.25, "dining"),
    Transaction("T-002", "A-3001", _dt(1, 18), "Whole Foods Market", -84.10, "groceries"),
    Transaction("T-003", "A-3001", _dt(2, 12), "Shell Gas", -47.30, "gas"),
    Transaction("T-004", "A-3001", _dt(3, 8), "ACH Payroll - ACME Corp", 3_120.00, "income"),
    Transaction("T-005", "A-3001", _dt(5, 14), "Amazon", -129.55, "shopping"),
    Transaction("T-006", "A-3001", _dt(7, 19), "PG&E Electric", -118.40, "utilities"),
    Transaction("T-007", "A-3001", _dt(9, 11), "Trader Joe's", -67.90, "groceries"),
    Transaction("T-008", "A-3001", _dt(12, 15), "Auto Loan Payment", -412.55, "loan"),
    Transaction("T-009", "A-3001", _dt(14, 8), "ACH Payroll - ACME Corp", 3_120.00, "income"),
    Transaction("T-010", "A-3001", _dt(18, 20), "Netflix", -15.49, "subscription"),
    # A-3003 Priya checking
    Transaction("T-011", "A-3003", _dt(1, 11), "Starbucks", -7.85, "dining"),
    Transaction("T-012", "A-3003", _dt(2, 9), "Safeway", -112.40, "groceries"),
    Transaction("T-013", "A-3003", _dt(4, 8), "ACH Payroll - StateGov", 2_240.00, "income"),
    Transaction("T-014", "A-3003", _dt(6, 16), "Mortgage Payment", -2_180.00, "loan"),
    Transaction("T-015", "A-3003", _dt(8, 13), "Costco", -287.66, "groceries"),
    Transaction("T-016", "A-3003", _dt(10, 19), "Comcast", -94.99, "utilities"),
    Transaction("T-017", "A-3003", _dt(15, 11), "REI", -156.20, "shopping"),
    Transaction("T-018", "A-3003", _dt(20, 8), "ACH Payroll - StateGov", 2_240.00, "income"),
    # A-3004 Marcus checking (thin)
    Transaction("T-019", "A-3004", _dt(2, 17), "McDonald's", -9.42, "dining"),
    Transaction("T-020", "A-3004", _dt(5, 8), "Walmart", -34.55, "shopping"),
    Transaction("T-021", "A-3004", _dt(7, 9), "Cash App Deposit", 600.00, "income"),
    Transaction("T-022", "A-3004", _dt(10, 14), "Personal Loan Payment", -185.00, "loan"),
    Transaction("T-023", "A-3004", _dt(14, 12), "Gas Station", -38.10, "gas"),
    # A-3005 Linda checking
    Transaction("T-024", "A-3005", _dt(0, 11), "Erewhon Market", -204.85, "groceries"),
    Transaction("T-025", "A-3005", _dt(1, 19), "United Airlines", -612.40, "travel"),
    Transaction("T-026", "A-3005", _dt(3, 8), "Wire In - Acme Holdings", 8_500.00, "income"),
    Transaction("T-027", "A-3005", _dt(5, 14), "Apple", -1_299.00, "shopping"),
    Transaction("T-028", "A-3005", _dt(7, 9), "Equinox", -310.00, "subscription"),
    Transaction("T-029", "A-3005", _dt(9, 16), "Personal Loan Payment", -95.00, "loan"),
    Transaction("T-030", "A-3005", _dt(12, 12), "Bristol Farms", -178.22, "groceries"),
    Transaction("T-031", "A-3005", _dt(15, 8), "Wire In - Acme Holdings", 8_500.00, "income"),
    # A-3006 Linda savings
    Transaction("T-032", "A-3006", _dt(15, 9), "Internal Transfer from Checking", 2_000.00, "transfer"),
    Transaction("T-033", "A-3006", _dt(30, 9), "Interest Credit", 18.42, "interest"),
    # A-3002 Alex savings
    Transaction("T-034", "A-3002", _dt(15, 9), "Internal Transfer from Checking", 500.00, "transfer"),
    Transaction("T-035", "A-3002", _dt(30, 9), "Interest Credit", 8.05, "interest"),
    # A-3007 Linda money market
    Transaction("T-036", "A-3007", _dt(30, 9), "Interest Credit", 165.20, "interest"),
]


# ---- Skip-A-Pay eligibility ----

DEFERRAL_LOCKOUT_DAYS = 30


def skip_a_pay_eligibility(loan: Loan) -> tuple[bool, str | None]:
    """Return (eligible, reason_if_not). Encodes the rules in DESIGN_SPEC.md."""
    if loan.type == "mortgage":
        return False, "Mortgage loans are not eligible for Skip-A-Pay."
    if loan.status != "current":
        return False, f"Loan must be current; status is {loan.status}."
    if loan.prior_deferrals:
        most_recent = max(loan.prior_deferrals)
        days_since = (TODAY - most_recent).days
        if days_since < DEFERRAL_LOCKOUT_DAYS:
            return False, (
                f"Prior deferral was {days_since} days ago; "
                f"must be at least {DEFERRAL_LOCKOUT_DAYS} days between deferrals."
            )
    return True, None
