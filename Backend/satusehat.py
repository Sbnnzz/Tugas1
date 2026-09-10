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


# Exam codes (LOINC) per DICOM modality and body region, used for
# ServiceRequest/Observation/DiagnosticReport.code. Every code was checked on loinc.org
# and accepted by the SATUSEHAT sandbox terminology check.
_LOINC = {
    ("CT", "chest"): ("24627-2", "CT Chest"),
    ("CT", "abdomen"): ("41806-1", "CT Abdomen"),
    ("CT", "head"): ("24725-4", "CT Head"),
    ("DX", "chest"): ("24648-8", "XR Chest PA upright"),
    ("CR", "chest"): ("24648-8", "XR Chest PA upright"),
    ("MR", "head"): ("24590-2", "MR Brain"),
    ("MR", "abdomen"): ("24556-3", "MR Abdomen"),
    ("US", "abdomen"): ("24558-9", "US Abdomen"),
}

# Region assumed when the exam description names none we have a code for.
_DEFAULT_REGION = {"CT": "chest", "DX": "chest", "CR": "chest", "MR": "head", "US": "abdomen"}

# Words (Indonesian and English) that identify the body region in an exam description.
_REGION_WORDS = {
    "chest": ("thorax", "toraks", "chest", "dada", "paru", "lung"),
    "abdomen": ("abdomen", "abdominal", "perut", "apendi", "appendi", "hepar", "liver", "ginjal", "kidney"),
    "head": ("kepala", "head", "brain", "otak", "kranial", "cranial"),
}


def _exam_loinc(modality, description):
    """Pick the LOINC exam code from the modality and the body region named in the description."""
    text = (description or "").lower()
    region = next((r for r, words in _REGION_WORDS.items() if any(w in text for w in words)), None)
    if (modality, region) not in _LOINC:
        region = _DEFAULT_REGION.get(modality, "chest")
    if (modality, region) not in _LOINC:
        modality, region = "DX", "chest"
    return _LOINC[(modality, region)]

# DICOM SOP Class UID per modality, used for ImagingStudy.series.instance.sopClass.
_SOP_CLASS = {
    "DX": "1.2.840.10008.5.1.4.1.1.1.1",
    "CR": "1.2.840.10008.5.1.4.1.1.1",
    "CT": "1.2.840.10008.5.1.4.1.1.2",
    "MR": "1.2.840.10008.5.1.4.1.1.4",
    "US": "1.2.840.10008.5.1.4.1.1.6.1",
}

DCM = "http://dicom.nema.org/resources/ontology/DCM"


def _dicom_uid():
    """Globally unique DICOM UID derived from a UUID (the 2.25 root)."""
    return "2.25." + str(uuid.uuid4().int)


class SatuSehat:
    def __init__(self):
        self._token = None
        self._expires_at = 0.0
        self._location_ref = None

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

    async def search(self, resource_type, params):
        """Generic FHIR search. Returns {mode, request, response (Bundle), status}."""
        url = f"{config.FHIR_URL}/{resource_type}"
        if config.MOCK:
            return {
                "mode": "MOCK",
                "request": {"method": "GET", "url": url, "params": params},
                "response": {"resourceType": "Bundle", "type": "searchset", "total": 0, "entry": []},
                "status": 200,
            }
        headers = await self._auth_headers()
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.get(url, headers=headers, params=params)
        try:
            body = r.json()
        except ValueError:
            body = {"raw": r.text}
        return {"mode": "LIVE", "request": {"method": "GET", "url": str(r.request.url)},
                "response": body, "status": r.status_code}

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

    # ---- actors used by the radiology chain ----
    async def _patient(self, study, logs):
        """Resolve the patient reference: search by NIK when a 16-digit NIK is given,
        otherwise fall back to the configured sandbox dummy patient."""
        nik = str(study.get("nik", "")).strip()
        if nik.isdigit() and len(nik) == 16:
            res = await self.search_patient(nik)
            logs.append({"step": "Patient", **res})
            body = res["response"] if isinstance(res["response"], dict) else {}
            entries = body.get("entry", [])
            if res["status"] < 300 and entries:
                return {"reference": f"Patient/{entries[0]['resource']['id']}",
                        "display": study.get("name") or config.DEFAULT_PATIENT_NAME}
        return {"reference": f"Patient/{config.DEFAULT_PATIENT_ID}", "display": config.DEFAULT_PATIENT_NAME}

    async def _location(self, logs):
        """Resolve the radiology Location: configured ID, cached ID, the org's first
        Location, or a newly created one (done once, then cached)."""
        if config.LOCATION_ID:
            return {"reference": f"Location/{config.LOCATION_ID}", "display": "Instalasi Radiologi"}
        if self._location_ref:
            return self._location_ref
        found = await self.search("Location", {"organization": config.ORG_ID})
        logs.append({"step": "Location", **found})
        body = found["response"] if isinstance(found["response"], dict) else {}
        if found["status"] < 300 and body.get("entry"):
            loc = body["entry"][0]["resource"]
            self._location_ref = {"reference": f"Location/{loc['id']}",
                                  "display": loc.get("name", "Instalasi Radiologi")}
            return self._location_ref
        org = config.ORG_ID or "ORG-SANDBOX"
        created = await self.create("Location", {
            "resourceType": "Location",
            "identifier": [{"system": f"http://sys-ids.kemkes.go.id/location/{org}", "value": "RAD-01"}],
            "status": "active",
            "name": "Instalasi Radiologi",
            "description": "Instalasi Radiologi - Ruang Pemeriksaan",
            "mode": "instance",
            "physicalType": {"coding": [{"system": "http://terminology.hl7.org/CodeSystem/location-physical-type",
                                         "code": "ro", "display": "Room"}]},
            "position": {"longitude": 112.7952, "latitude": -7.2819, "altitude": 0},
            "managingOrganization": {"reference": f"Organization/{org}"},
        })
        logs.append({"step": "Location", **created})
        if created["status"] >= 300:
            return None
        self._location_ref = {"reference": f"Location/{created['response']['id']}",
                              "display": "Instalasi Radiologi"}
        return self._location_ref

    # ---- high-level: the full radiology chain ----
    async def send_study(self, study):
        """Send one radiology exam as the chain SATUSEHAT requires:
        Patient -> Encounter -> ServiceRequest (ACSN) -> ImagingStudy -> Observation -> DiagnosticReport.

        study: {name, nik, modality, description, icd10, diagnosis, finding, instalasi}
        Stops at the first failed step. Every step is logged for the frontend API console."""
        logs = []
        result = {"ok": False, "mode": config.MODE, "logs": logs,
                  "imaging_study_id": "", "diagnostic_report_id": ""}

        tok = await self.get_token()
        logs.append({"step": "token", **tok})
        if tok["status"] >= 300:
            return result

        org = config.ORG_ID or "ORG-SANDBOX"
        now = _now_iso()
        tag = datetime.datetime.now().strftime("%y%m%d%H%M%S") + uuid.uuid4().hex[:4].upper()
        modality = (study.get("modality") or "DX").split()[0].upper()
        loinc_code, loinc_display = _exam_loinc(modality, study.get("description"))
        exam_code = {"coding": [{"system": "http://loinc.org", "code": loinc_code, "display": loinc_display}],
                     "text": study.get("description") or loinc_display}
        icd = str(study.get("icd10", "")).strip()
        icd_coding = [{"system": "http://hl7.org/fhir/sid/icd-10", "code": icd,
                       "display": study.get("diagnosis", "")}] if icd else []
        finding = study.get("finding") or study.get("diagnosis") or "-"
        acsn = {"use": "usual",
                "type": {"coding": [{"system": "http://terminology.hl7.org/CodeSystem/v2-0203", "code": "ACSN"}]},
                "system": f"http://sys-ids.kemkes.go.id/acsn/{org}", "value": "ACSN" + tag}

        patient = await self._patient(study, logs)
        practitioner = {"reference": f"Practitioner/{config.PRACTITIONER_ID}", "display": config.PRACTITIONER_NAME}
        location = await self._location(logs)
        if location is None:
            return result

        async def step(resource_type, resource):
            res = await self.create(resource_type, resource)
            logs.append({"step": resource_type, **res})
            body = res["response"] if isinstance(res["response"], dict) else {}
            return body.get("id") if res["status"] < 300 else None

        enc_id = await step("Encounter", {
            "resourceType": "Encounter",
            "identifier": [{"system": f"http://sys-ids.kemkes.go.id/encounter/{org}", "value": "ENC" + tag}],
            "status": "arrived",
            "class": {"system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
                      "code": "AMB", "display": "ambulatory"},
            "subject": patient,
            "participant": [{"type": [{"coding": [{"system": "http://terminology.hl7.org/CodeSystem/v3-ParticipationType",
                                                   "code": "ATND", "display": "attender"}]}],
                             "individual": practitioner}],
            "period": {"start": now},
            "location": [{"location": location}],
            "statusHistory": [{"status": "arrived", "period": {"start": now}}],
            "serviceProvider": {"reference": f"Organization/{org}"},
        })
        if not enc_id:
            return result
        encounter = {"reference": f"Encounter/{enc_id}"}

        sr_id = await step("ServiceRequest", {
            "resourceType": "ServiceRequest",
            "identifier": [{"system": f"http://sys-ids.kemkes.go.id/servicerequest/{org}", "value": "SR" + tag}, acsn],
            "status": "active",
            "intent": "original-order",
            "priority": "routine",
            "category": [{"coding": [{"system": "http://snomed.info/sct", "code": "363679005", "display": "Imaging"}]}],
            "code": exam_code,
            "subject": patient,
            "encounter": encounter,
            "occurrenceDateTime": now,
            "authoredOn": now,
            "requester": practitioner,
            "performer": [practitioner],
            "reasonCode": [{"coding": icd_coding}] if icd_coding else [],
        })
        if not sr_id:
            return result
        service_request = {"reference": f"ServiceRequest/{sr_id}"}

        is_id = await step("ImagingStudy", {
            "resourceType": "ImagingStudy",
            "identifier": [acsn],
            "status": "available",
            "modality": [{"system": DCM, "code": modality}],
            "subject": patient,
            "encounter": encounter,
            "basedOn": [service_request],
            "started": now,
            "description": study.get("description", ""),
            "numberOfSeries": 1,
            "numberOfInstances": 1,
            "series": [{
                "uid": _dicom_uid(),
                "number": 1,
                "modality": {"system": DCM, "code": modality},
                "numberOfInstances": 1,
                "started": now,
                "instance": [{"uid": _dicom_uid(), "number": 1,
                              "sopClass": {"system": "urn:ietf:rfc:3986",
                                           "code": "urn:oid:" + _SOP_CLASS.get(modality, _SOP_CLASS["DX"])}}],
            }],
        })
        if not is_id:
            return result
        result["imaging_study_id"] = is_id

        obs_id = await step("Observation", {
            "resourceType": "Observation",
            "identifier": [{"system": f"http://sys-ids.kemkes.go.id/observation/{org}", "value": "OBS" + tag}],
            "status": "final",
            "category": [{"coding": [{"system": "http://terminology.hl7.org/CodeSystem/observation-category",
                                      "code": "imaging", "display": "Imaging"}]}],
            "code": exam_code,
            "subject": patient,
            "encounter": encounter,
            "effectiveDateTime": now,
            "issued": now,
            "performer": [practitioner],
            "basedOn": [service_request],
            "derivedFrom": [{"reference": f"ImagingStudy/{is_id}"}],
            "valueString": finding,
        })
        if not obs_id:
            return result

        dr_id = await step("DiagnosticReport", {
            "resourceType": "DiagnosticReport",
            "identifier": [{"use": "official", "system": f"http://sys-ids.kemkes.go.id/diagnostic/{org}/rad",
                            "value": "DR" + tag}],
            "status": "final",
            "category": [{"coding": [{"system": "http://terminology.hl7.org/CodeSystem/v2-0074",
                                      "code": "RAD", "display": "Radiology"}]}],
            "code": exam_code,
            "subject": patient,
            "encounter": encounter,
            "effectiveDateTime": now,
            "issued": now,
            "performer": [practitioner, {"reference": f"Organization/{org}"}],
            "imagingStudy": [{"reference": f"ImagingStudy/{is_id}"}],
            "result": [{"reference": f"Observation/{obs_id}"}],
            "basedOn": [service_request],
            "conclusion": finding,
            "conclusionCode": [{"coding": icd_coding}] if icd_coding else [],
        })
        if not dr_id:
            return result

        result.update(ok=True, diagnostic_report_id=dr_id)
        return result

client = SatuSehat()
