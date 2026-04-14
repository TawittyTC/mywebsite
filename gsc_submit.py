#!/usr/bin/env python3
"""
Google Search Console — Submit sitemap & request indexing
=========================================================
Setup (one-time):
  1. ไปที่ https://console.cloud.google.com/
  2. สร้าง project ใหม่ (หรือเลือก project ที่มี)
  3. APIs & Services → Enable APIs → เปิด "Google Search Console API"
  4. APIs & Services → Credentials → Create Credentials → OAuth client ID
     - Application type: Desktop app
     - ดาวน์โหลด JSON → เปลี่ยนชื่อเป็น client_secrets.json → วางไว้ในโฟลเดอร์นี้
  5. รัน: pip install google-auth-oauthlib google-api-python-client
  6. รัน: python gsc_submit.py
     (browser จะเปิดขึ้นมาให้ login ครั้งแรก — หลังจากนั้นไม่ต้อง login ซ้ำ)
"""

import os
import sys
import json
from pathlib import Path

SITE_URL   = "sc-domain:tawittytc.github.io"       # Domain property (ถ้า verify แบบ URL prefix ให้ใช้ URL เต็ม)
SITE_URL_PREFIX = "https://tawittytc.github.io/mywebsite/"  # URL prefix fallback
SITEMAP_URL = "https://tawittytc.github.io/mywebsite/sitemap.xml"
INSPECT_URL = "https://tawittytc.github.io/mywebsite/"
SECRETS_FILE = Path(__file__).parent / "client_secrets.json"
TOKEN_FILE   = Path(__file__).parent / "gsc_token.json"

SCOPES = [
    "https://www.googleapis.com/auth/webmasters",
    "https://www.googleapis.com/auth/webmasters.readonly",
]


def get_credentials():
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from google.auth.transport.requests import Request

    creds = None
    if TOKEN_FILE.exists():
        creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not SECRETS_FILE.exists():
                print(f"[ERROR] ไม่พบ {SECRETS_FILE}")
                print("       โปรดดาวน์โหลด OAuth client secrets จาก Google Cloud Console")
                print("       แล้วเปลี่ยนชื่อเป็น client_secrets.json วางไว้ในโฟลเดอร์นี้")
                sys.exit(1)
            flow = InstalledAppFlow.from_client_secrets_file(str(SECRETS_FILE), SCOPES)
            creds = flow.run_local_server(port=0)

        # บันทึก token สำหรับรันครั้งต่อไป
        TOKEN_FILE.write_text(creds.to_json())
        print(f"[OK] บันทึก token ที่ {TOKEN_FILE}")

    return creds


def submit_sitemap(service, site_url):
    print(f"\n[*] Submitting sitemap: {SITEMAP_URL}")
    try:
        service.sitemaps().submit(siteUrl=site_url, feedpath=SITEMAP_URL).execute()
        print(f"[OK] Sitemap submitted สำเร็จ")
    except Exception as e:
        print(f"[WARN] Sitemap submit: {e}")


def list_sitemaps(service, site_url):
    print(f"\n[*] Sitemaps ที่ GSC รู้จัก:")
    try:
        result = service.sitemaps().list(siteUrl=site_url).execute()
        sitemaps = result.get("sitemap", [])
        if not sitemaps:
            print("    (ยังไม่มี)")
        for sm in sitemaps:
            status = sm.get("lastDownloaded", "ยังไม่ได้ crawl")
            errors = sm.get("errors", 0)
            print(f"    • {sm['path']}  |  last crawled: {status}  |  errors: {errors}")
    except Exception as e:
        print(f"[WARN] List sitemaps: {e}")


def inspect_url(creds):
    """URL Inspection API — ขอ re-index"""
    print(f"\n[*] Requesting indexing for: {INSPECT_URL}")
    import google.auth.transport.requests
    import requests as req

    headers = {"Authorization": f"Bearer {creds.token}"}
    payload = {
        "inspectionUrl": INSPECT_URL,
        "siteUrl": SITE_URL_PREFIX,
        "languageCode": "th",
    }
    r = req.post(
        "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect",
        headers=headers,
        json=payload,
        timeout=30,
    )
    if r.status_code == 200:
        data = r.json()
        result = data.get("inspectionResult", {})
        index_status = result.get("indexStatusResult", {}).get("coverageState", "unknown")
        last_crawl  = result.get("indexStatusResult", {}).get("lastCrawlTime", "N/A")
        verdict     = result.get("indexStatusResult", {}).get("verdict", "unknown")
        print(f"[OK] Verdict: {verdict}  |  Coverage: {index_status}  |  Last crawl: {last_crawl}")
    else:
        print(f"[WARN] URL Inspection API: {r.status_code} — {r.text[:200]}")


def get_verified_site_url(service):
    """หา site URL ที่ verify แล้วใน GSC"""
    try:
        result = service.sites().list().execute()
        sites  = result.get("siteEntry", [])
        if not sites:
            print("[WARN] ไม่พบ site ที่ verify ใน GSC account นี้")
            return None
        print("\n[*] Sites ที่ verified ใน GSC:")
        for s in sites:
            print(f"    • {s['siteUrl']}  ({s.get('permissionLevel', '?')})")
        # หา site ที่ตรงกับ portfolio
        for s in sites:
            url = s["siteUrl"]
            if "tawittytc" in url or "mywebsite" in url:
                return url
        # fallback: ใช้อันแรก
        return sites[0]["siteUrl"]
    except Exception as e:
        print(f"[WARN] List sites: {e}")
        return SITE_URL_PREFIX


def main():
    try:
        from googleapiclient.discovery import build
    except ImportError:
        print("[ERROR] กรุณา install dependencies ก่อน:")
        print("        pip install google-auth-oauthlib google-api-python-client requests")
        sys.exit(1)

    print("=" * 55)
    print("  Google Search Console — Sitemap & Index Submission")
    print("=" * 55)

    creds       = get_credentials()
    service     = build("searchconsole", "v1", credentials=creds)
    site_url    = get_verified_site_url(service)

    if not site_url:
        print("[ERROR] ไม่พบ site URL — ตรวจสอบว่า verify site ใน GSC แล้ว")
        sys.exit(1)

    print(f"\n[*] Using site: {site_url}")
    submit_sitemap(service, site_url)
    list_sitemaps(service, site_url)
    inspect_url(creds)

    print("\n[DONE] เสร็จแล้ว — Google จะ crawl ใหม่ภายใน 1-3 วัน")
    print(f"       ตรวจสอบผลที่: https://search.google.com/search-console/")


if __name__ == "__main__":
    main()
