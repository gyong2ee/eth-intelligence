#!/usr/bin/env python3
"""Read CryptoKeyhole's publicly visible active ETH staking share (not APR)."""
import json
import re
import urllib.request
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

URL = "https://cryptokeyhole.com/ethereum-staking/"
OUT = Path(__file__).resolve().parents[1] / "data" / "staking-rate.json"

class Visible(HTMLParser):
    def __init__(self):
        super().__init__()
        self.text = []
        self.skip = 0
    def handle_starttag(self, tag, attrs):
        if tag in ("script","style","svg"):
            self.skip += 1
    def handle_endtag(self, tag):
        if tag in ("script","style","svg") and self.skip:
            self.skip -= 1
    def handle_data(self, data):
        if not self.skip and data.strip():
            self.text.append(data.strip())

def main():
    req = urllib.request.Request(URL, headers={"User-Agent":"Mozilla/5.0","Accept":"text/html"})
    with urllib.request.urlopen(req, timeout=35) as response:
        html = response.read().decode("utf-8")
    parser = Visible()
    parser.feed(html)
    text = re.sub(r"\s+", " ", " ".join(parser.text))
    m = re.search(r"\b(\d{1,2}(?:\.\d{1,4})?)\s*%\s+of all ETH is staked by active validators\b", text, re.I)
    n = re.search(r"Counting all ETH on the consensus layer[^:]{0,250}:\s*(\d{1,2}(?:\.\d{1,4})?)\s*%", text, re.I)
    if not m:
        raise RuntimeError("CryptoKeyhole active staking share not found")
    rate = float(m.group(1))
    consensus = float(n.group(1)) if n else None
    if not 1 < rate < 95 or (consensus is not None and not rate <= consensus < 100):
        raise RuntimeError("Invalid staking share")
    payload = {"stakeRate":rate,"consensusLayerShare":consensus,"updatedAt":datetime.now(timezone.utc).isoformat(),"source":URL}
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(payload,ensure_ascii=False,separators=(",",":"))+"\n")
    print("CryptoKeyhole active stake share:",rate,"%; consensus layer:",consensus)

if __name__=="__main__":
    main()
