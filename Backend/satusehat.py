"""SATUSEHAT FHIR R4 client.

Handles OAuth2 (client_credentials) token retrieval + caching and the
FHIR resource calls used by this SIMRS. Every method returns a dict of
{request, response, status} so the frontend "API Console" can show the
raw exchange as proof of integration.

When config.MOCK is True, no network call is made: realistic FHIR-shaped
responses are returned instead (same code path, mocked final hop).
"""
import time
import uuid
import datetime

import httpx

import config


def _now_iso():
    return datetime.datetime.now().astimezone().isoformat(timespec="seconds")


def _mock_id(suffix):
    return f"{uuid.uuid4()}"[:8] + "-mock-" + suffix


class SatuSehat:
    def __init__(self):
        self._token = None
        self._expires_at = 0.0

    # ---- OAuth2 ----
    async def get_token(self):
        if config.MOCK:
            return {
                "mode": "MOCK",
                "request": {"method": "POST", "url": f"{config.OAUTH_URL}/accesstoken"},
                "response": {
                    "access_token": "ey" + uuid.uuid4().hex,
                    "token_type": "BearerToken",
                    "expires_in": "3599",
                    "issued_at": str(int(time.time() * 1000)),
                    "status": "approved",
                },
                "status": 200,
                "token": "ey" + uuid.uuid4().hex,
            }

        # reuse a cached, still-valid token
        if self._token and time.time() < self._expires_at - 30:
            return {
                "mode": "LIVE",
                "request": {"method": "POST", "url": f"{config.OAUTH_URL}/accesstoken", "cached": True},
                "response": {"access_token": self._token[:12] + "…", "cached": True},
                "status": 200,
                "token": self._token,
            }

        url = f"{config.OAUTH_URL}/accesstoken?grant_type=client_credentials"
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.post(
                url,
                data={"client_id": config.CLIENT_ID, "client_secret": config.CLIENT_SECRET},
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            data = r.json()
        self._token = data.get("access_token")
        try:
            self._expires_at = time.time() + int(float(data.get("expires_in", 3599)))
        except (TypeError, ValueError):
            self._expires_at = time.time() + 3000
        safe = dict(data)
        if "access_token" in safe:
            safe["access_token"] = str(safe["access_token"])[:12] + "…"
        return {
            "mode": "LIVE",
            "request": {"method": "POST", "url": url},
            "response": safe,
            "status": r.status_code,
            "token": self._token,
        }

    async def _auth_headers(self):
        tok = await self.get_token()
        return {
            "Authorization": f"Bearer {tok['token']}",
            "Content-Type": "application/json",
        }

    # ---- FHIR reads ----
    async def search_patient(self, nik):
        url = f"{config.FHIR_URL}/Patient?identifier=https://fhir.kemkes.go.id/id/nik|{nik}"
        if config.MOCK:
            return {
                "mode": "MOCK",
                "request": {"method": "GET", "url": url},
                "response": {
                    "resourceType": "Bundle",
                    "type": "searchset",
                    "total": 1,
                    "entry": [{
                        "resource": {
                            "resourceType": "Patient",
                            "id": "P0" + nik[-8:] if len(nik) >= 8 else "P0-mock",
                            "identifier": [
                                {"system": "https://fhir.kemkes.go.id/id/nik", "value": nik},
                                {"system": "https://fhir.kemkes.go.id/id/ihs-number", "value": "P0" + nik[-8:]},
                            ],
                            "name": [{"text": "PASIEN SANDBOX"}],
                            "gender": "male",
                        }
                    }],
                },
                "status": 200,
            }
        headers = await self._auth_headers()
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.get(url, headers=headers)
        try:
            body = r.json()
        except ValueError:
            body = {"raw": r.text}
        return {"mode": "LIVE", "request": {"method": "GET", "url": url}, "response": body, "status": r.status_code}

    # ---- FHIR writes ----
    async def create(self, resource_type, payload):
        url = f"{config.FHIR_URL}/{resource_type}"
        if config.MOCK:
            created = dict(payload)
            created["id"] = _mock_id(resource_type[:2].lower())
            created["meta"] = {"versionId": "1", "lastUpdated": _now_iso()}
            return {
                "mode": "MOCK",
                "request": {"method": "POST", "url": url, "body": payload},
                "response": created,
                "status": 201,
            }
        headers = await self._auth_headers()
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(url, headers=headers, json=payload)
        try:
            body = r.json()
        except ValueError:
            body = {"raw": r.text}
        return {"mode": "LIVE", "request": {"method": "POST", "url": url, "body": payload}, "response": body, "status": r.status_code}

    # ---- high-level: build + send an imaging study ----
    async def send_study(self, study):
        """study: {name, nik, modality, description, icd10, diagnosis, finding, instalasi}"""
        logs = []
        tok = await self.get_token()
        logs.append({"step": "token", **tok})

        now = _now_iso()
        org_ref = f"Organization/{config.ORG_ID or 'ORG-SANDBOX'}"

        imaging_study = {
            "resourceType": "ImagingStudy",
            "status": "available",
            "modality": [{"system": "http://dicom.nema.org/resources/ontology/DCM",
                          "code": study.get("modality", "CT")}],
            "subject": {"display": study.get("name", "")},
            "started": now,
            "description": study.get("description", "Imaging Study"),
            "numberOfSeries": 1,
            "numberOfInstances": 1,
            "series": [{
                "uid": str(uuid.uuid4()),
                "number": 1,
                "modality": {"system": "http://dicom.nema.org/resources/ontology/DCM",
                             "code": study.get("modality", "CT")},
                "numberOfInstances": 1,
            }],
        }
        is_res = await self.create("ImagingStudy", imaging_study)
        logs.append({"step": "ImagingStudy", **is_res})
        is_id = is_res["response"].get("id", "")

        diagnostic_report = {
            "resourceType": "DiagnosticReport",
            "status": "final",
            "category": [{"coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/v2-0074",
                "code": "RAD", "display": "Radiology"}]}],
            "code": {"coding": [{
                "system": "http://hl7.org/fhir/sid/icd-10",
                "code": study.get("icd10", ""),
                "display": study.get("diagnosis", "")}]},
            "subject": {"display": study.get("name", "")},
            "effectiveDateTime": now,
            "issued": now,
            "imagingStudy": ([{"reference": f"ImagingStudy/{is_id}"}] if is_id else []),
            "conclusion": study.get("finding", ""),
            "performer": [{"reference": org_ref}],
        }
        dr_res = await self.create("DiagnosticReport", diagnostic_report)
        logs.append({"step": "DiagnosticReport", **dr_res})

        ok = all(l.get("status", 500) < 300 for l in logs)
        return {"ok": ok, "mode": config.MODE, "logs": logs,
                "imaging_study_id": is_id,
                "diagnostic_report_id": dr_res["response"].get("id", "")}


client = SatuSehat()
