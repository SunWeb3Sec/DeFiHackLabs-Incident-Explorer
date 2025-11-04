#!/usr/bin/env python3
import os
import re
import json
import argparse
from typing import Dict, Any, List, Optional, Tuple


SRC_ROOT = os.path.join("source", "src", "test")
OUT_PATH = "incidents.json"


def _norm_date(raw: str) -> Optional[str]:
    if not raw:
        return None
    raw = raw.strip()
    if len(raw) == 8 and raw.isdigit():
        return raw
    if "-" in raw or "." in raw:
        parts = re.split(r"[-.]", raw)
        if len(parts) == 3 and all(p.isdigit() for p in parts):
            return f"{parts[0]}{parts[1]}{parts[2]}"
    return None


def _normalize_currency(token: str) -> str:
    t = (token or "").strip()
    if not t:
        return "USD"
    t = t.upper()
    t = re.sub(r"\s+", "", t)
    t = t.replace("US$", "USD")
    t = t.replace("$", "")
    if t in {"US", "USD", ""}:
        return "USD"
    return t


def _parse_loss(text: str) -> Tuple[float, str]:
    """Extract numeric loss and currency/token from a section of text.

    Handles lines like:
      - Lost: 18167.8 USD
      - Loss - ~$6.8k
      - Total Lost: 20 WBNB
      - ### Lost: 15,261.68 BUSD
      - Lost: 1.23M US$ / $ 1.23M
      - Lost: ~ $88.1K
      - Lost: 41M USD
      - Lost: ~ 105.5K USD
      - Lost: ~2.16 M BUSD


    """
    patterns = [
        # Generic lost/loss line; allow optional en/em dash, fullwidth tilde, parens, and space before K/M/B suffix
        re.compile(
            r"(?:Total\s+)?Lo(?:ss|st)\s*[:\-–—]\s*[~～]?\s*\(?\s*\$?\s*"
            r"([0-9][0-9,\.]*)"  # numeric amount
            r"(?:\s*([KMBkmb])(?=\s|$))?"  # suffix only if followed by whitespace/line end
            r"(?:\s+([A-Za-z$][A-Za-z0-9$.+\-]{1,15}))?",  # optional token/currency
            re.IGNORECASE,
        ),
        # Heading style lost (e.g., '### Lost: $777k')
        re.compile(
            r"^\s*#+\s*Lo(?:ss|st):?\s*[~～]?\s*\$?\s*"
            r"([0-9][0-9,\.]*)"
            r"(?:\s*([KMBkmb])(?=\s|$))?"
            r"(?:\s+([A-Za-z$][A-Za-z0-9$.+\-]{1,15}))?",
            re.IGNORECASE | re.MULTILINE,
        ),
        # Adjacent token right after number (e.g., 'Lost: 1.7eth')
        re.compile(
            r"(?:Total\s+)?Lo(?:ss|st)\s*[:\-–—]\s*[~～]?\s*\(?\s*\$?\s*"
            r"([0-9][0-9,\.]*)\s*([KMBkmb])?([A-Za-z][A-Za-z0-9$.+\-]{1,15})",
            re.IGNORECASE,
        ),
    ]

    # Pre-clean: drop standalone '$' before numbers (keep 'US$' etc.)
    cleaned = re.sub(r"(?<![A-Za-z])\$(?=\s*[0-9])", "", text)

    m = None
    for pat in patterns:
        m = pat.search(cleaned)
        if m:
            break
    if not m:
        return 0.0, "USD"

    # Parse numeric value
    try:
        base = float((m.group(1) or "0").replace(",", ""))
    except Exception:
        base = 0.0

    # Apply suffix multiplier
    suf = (m.group(2) or "").upper()
    mult = 1.0
    if suf == "K":
        mult = 1_000
    elif suf == "M":
        mult = 1_000_000
    elif suf == "B":
        mult = 1_000_000_000

    # Clean currency/token: strip trailing punctuation
    cur_raw = (m.group(3) or "USD").strip()
    cur_raw = cur_raw.rstrip(",.;:)])")
    cur = _normalize_currency(cur_raw)
    return base * mult, cur


def _parse_chain_from_contract(full_contract_fs_path: str) -> str:
    try:
        text = open(full_contract_fs_path, encoding="utf-8", errors="ignore").read()
    except Exception:
        return "Unknown"

    m = re.search(r"createSelectFork\(\s*\"([a-zA-Z0-9_\-]+)\"", text)
    if not m:
        return "Unknown"
    net = m.group(1).lower()
    mapping = {
        "mainnet": "Ethereum",
        "eth_mainnet": "Ethereum",
        "ethereum": "Ethereum",
        "bsc": "BSC",
        "bnb": "BSC",
        "arbitrum": "Arbitrum",
        "arb": "Arbitrum",
        "base": "Base",
        "polygon": "Polygon",
        "matic": "Polygon",
        "optimism": "Optimism",
        "op": "Optimism",
        "fantom": "Fantom",
        "avalanche": "Avalanche",
        "avax": "Avalanche",
        "scroll": "Scroll",
        "blast": "Blast",
        "linea": "Linea",
    }
    return mapping.get(net, net.capitalize())


def _parse_section(
    section_text: str, folder_year: str, folder_month: str
) -> Optional[Dict[str, Any]]:
    # Header with date: e.g., '### 20251007 Name - Type' or '## 2025-10-07 Name - Type'
    pat_hdr = re.compile(
        r"^[#*\-\s]*"
        r"(?P<date>(?:\d{8}|\d{4}[\-.]\d{2}[\-.]\d{2}))\s+"
        r"(?P<proj>.+?)\s+[-–—:]\s+(?P<type>[^|#\r\n]+)",
        re.IGNORECASE | re.MULTILINE,
    )
    # Header without date (rare): '### Name - Type'
    pat_hdr_nodate = re.compile(
        r"^[#*\-\s]*(?P<proj>.+?)\s+[-–—:]\s+(?P<type>[^|#\r\n]+)",
        re.IGNORECASE | re.MULTILINE,
    )

    date = None
    name = None
    type_ = None

    m1 = pat_hdr.search(section_text)
    if m1:
        date = _norm_date(m1.group("date"))
        name = (m1.group("proj") or "").strip()
        type_ = (m1.group("type") or "").strip()
        if "|" in type_:
            type_ = type_.split("|", 1)[0].strip()
    else:
        m2 = pat_hdr_nodate.search(section_text)
        if m2:
            name = (m2.group("proj") or "").strip()
            type_ = (m2.group("type") or "").strip()

    # If date missing, try to synthesize from folder YM
    if not date and folder_year and folder_month:
        date = f"{folder_year}{folder_month}01"

    # Extract contract path (prefer markdown link in section)
    contract = None
    m_mdlink = re.search(
        r"\[[^\]]+\]\((src/test/[^\)]+\.sol)\)", section_text, re.IGNORECASE
    )
    if m_mdlink:
        contract = m_mdlink.group(1).lstrip("./")
    else:
        # Look for forge test line (capture any contract path, not only *_exp.sol)
        m_forge = re.search(
            r"forge\s+test[^\n]*--contracts\s+(\S+)", section_text, re.IGNORECASE
        )
        if m_forge:
            cand = m_forge.group(1).strip()
            # Stop at first whitespace or flag
            cand = re.split(r"\s+|(?=--)", cand)[0]
            contract = cand.lstrip("./")
    # Or '#### Contract' block
    if not contract:
        m_block = re.search(
            r"####\s*Contract[\s\S]{0,80}?\((src/test/[^\)]+)\)",
            section_text,
            re.IGNORECASE,
        )
        if m_block:
            contract = m_block.group(1).lstrip("./")
    # Or two-line plain Contract block: a line 'Contract' followed by filename
    if not contract:
        lines = section_text.splitlines()
        for i, ln in enumerate(lines):
            if re.match(r"^\s*Contract\s*$", ln, re.IGNORECASE):
                # next non-empty line
                k = i + 1
                while k < len(lines) and not lines[k].strip():
                    k += 1
                if k < len(lines):
                    fname = lines[k].strip()
                    # If it's a path under src/test, use as-is
                    if fname.startswith("src/test/"):
                        contract = fname
                        break
                    # If looks like a filename, build monthly path if YM known
                    if folder_year and folder_month:
                        contract = f"src/test/{folder_year}-{folder_month}/{fname}"
                        break

    # Loss
    lost, loss_type = _parse_loss(section_text)

    if not (date and name and type_ and contract):
        return None

    return {
        "date": date,
        "name": name,
        "type": type_,
        "Lost": float(lost),
        "lossType": loss_type,
        "Contract": contract,
    }


def _split_sections_fallback(content: str) -> List[str]:
    """Split content into sections by header lines if '---' dividers are absent.

    Header forms like:
      - 20251004 Name - Type
      - 2025-10-04 Name - Type
    """
    header_re = re.compile(
        r"^\s*(?:\d{8}|\d{4}[\-.]\d{2}[\-.]\d{2})\s+.+?\s+[-–—:]\s+.+$",
        re.MULTILINE,
    )
    matches = list(header_re.finditer(content))
    if not matches:
        return []
    sections: List[str] = []
    for idx, m in enumerate(matches):
        start = m.start()
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(content)
        sections.append(content[start:end].strip())
    return sections


def _iter_readmes() -> List[str]:
    paths: List[str] = []
    # Root-level README-POC.md (primary source in this repo)
    root_poc = os.path.join("source", "README-POC.md")
    if os.path.exists(root_poc):
        paths.append(root_poc)
    # Also consider root README.md if POC file missing
    root_readme = os.path.join("source", "README.md")
    if os.path.exists(root_readme):
        paths.append(root_readme)
    # Monthly READMEs (if present)
    for root, _, files in os.walk(SRC_ROOT):
        for f in files:
            if f.lower() == "readme.md":
                paths.append(os.path.join(root, f))
    return paths


def _norm_start_ym(s: Optional[str]) -> Optional[str]:
    if not s:
        return None
    digits = re.sub(r"[^0-9]", "", str(s))
    return digits[:6] if len(digits) >= 6 else None


def build_incidents(start_ym: Optional[str] = None) -> List[Dict[str, Any]]:
    incidents_by_contract: Dict[str, Dict[str, Any]] = {}
    start_ym = _norm_start_ym(start_ym)

    for readme_path in _iter_readmes():
        # Derive folder year/month from path .../YYYY-MM/README.md. For root README-POC.md this will be None.
        m = re.search(r"(\\|/)src(\\|/)test(\\|/)(\d{4})-(\d{2})(\\|/)", readme_path)
        folder_y = m.group(4) if m else None
        folder_m = m.group(5) if m else None

        try:
            content = open(readme_path, encoding="utf-8", errors="ignore").read()
        except Exception:
            continue

        # Split into sections by '---' divider; fallback to header-based split if needed
        sections = re.split(r"^\s*---\s*$", content, flags=re.MULTILINE)
        if len(sections) <= 1:
            sections = _split_sections_fallback(content)
        for sec in sections:
            inc = _parse_section(sec, folder_y, folder_m)
            if not inc:
                continue
            # Skip incidents older than requested start year-month
            if start_ym:
                d = inc.get("date") or ""
                if len(d) >= 6 and d[:6] < start_ym:
                    continue

            # Determine chain from referenced contract
            contract_rel = inc.get("Contract") or ""
            contract_fs = os.path.join("source", contract_rel)
            chain = _parse_chain_from_contract(contract_fs)
            if chain:
                inc["chain"] = chain

            key = inc["Contract"]
            incidents_by_contract[key] = inc

    incidents = list(incidents_by_contract.values())
    incidents.sort(key=lambda x: x.get("date", "00000000"), reverse=True)
    return incidents


def main():
    if not os.path.isdir(SRC_ROOT):
        raise SystemExit(
            f"Missing source repo at {SRC_ROOT}. Shallow-clone DeFiHackLabs into ./source."
        )

    # Build from READMEs
    parser = argparse.ArgumentParser(
        description="Build incidents.json from README sources"
    )
    parser.add_argument(
        "--start-ym",
        dest="start_ym",
        help="Include only incidents from this YYYYMM onward (e.g., 202505)",
        default=None,
    )
    parser.add_argument(
        "--preserve-order",
        dest="preserve_order",
        help="Preserve existing incidents.json order and append new items at the end",
        action="store_true",
    )
    args = parser.parse_args()

    new_incidents = build_incidents(start_ym=args.start_ym)

    # Load existing incidents.json if present and merge (add-on, not overwrite)
    existing: List[Dict[str, Any]] = []
    if os.path.exists(OUT_PATH):
        try:
            with open(OUT_PATH, "r", encoding="utf-8") as f:
                existing = json.load(f)
        except Exception:
            existing = []

    def merge_item(prev: Dict[str, Any], it: Dict[str, Any]) -> Dict[str, Any]:
        def pick(field: str, transform=None):
            nv = it.get(field)
            pv = prev.get(field)
            if transform:
                nv = transform(nv)
            if isinstance(nv, (int, float)):
                return (
                    nv
                    if (nv or nv == 0) and (nv > 0 or isinstance(nv, int) and nv == 0)
                    else pv
                )
            if isinstance(nv, str):
                return nv.strip() if nv and nv.strip() else pv
            return nv if nv is not None else pv

        key = it.get("Contract") or prev.get("Contract")
        return {
            "date": pick("date"),
            "name": pick("name"),
            "type": pick("type"),
            "Lost": pick("Lost"),
            "lossType": pick("lossType"),
            "Contract": key,
            "chain": pick("chain"),
        }

    if args.preserve_order:
        # Update in place and append new items; do not reorder existing
        existing_by_contract: Dict[str, Dict[str, Any]] = {}
        for it in existing:
            k = it.get("Contract")
            if k:
                existing_by_contract[k] = it

        new_to_append: List[Dict[str, Any]] = []
        for it in new_incidents:
            key = it.get("Contract")
            if not key:
                continue
            if key in existing_by_contract:
                updated = merge_item(existing_by_contract[key], it)
                # mutate the original dict to keep reference in existing list
                existing_by_contract[key].clear()
                existing_by_contract[key].update(updated)
            else:
                new_to_append.append(it)

        out_list = existing + new_to_append
    else:
        merged: Dict[str, Dict[str, Any]] = {}
        for it in existing:
            key = it.get("Contract")
            if not key:
                continue
            merged[key] = it
        for it in new_incidents:
            key = it.get("Contract")
            if not key:
                continue
            prev = merged.get(key, {})
            merged[key] = merge_item(prev, it)

        out_list = list(merged.values())
        out_list.sort(key=lambda x: x.get("date", "00000000"), reverse=True)

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(out_list, f, indent=2, ensure_ascii=False)

    print(
        f"Parsed {len(new_incidents)} new incidents; merged into {len(out_list)} total at {OUT_PATH}"
    )


if __name__ == "__main__":
    main()
