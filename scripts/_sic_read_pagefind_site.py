#!/usr/bin/env python3
# _sic_read_pagefind_site.py
# Helper: read the 'site' field from pagefind.json.
# Used by audit-search-index-completeness.sh to resolve the site dir.
import sys, json
path = sys.argv[1] if len(sys.argv) > 1 else "pagefind.json"
try:
    with open(path) as f:
        d = json.load(f)
    print(d.get("site", ".next/server/app"))
except Exception:
    print(".next/server/app")
