"""
NumDocMan Backend API Tests
Tests: auth, organizations, projects, documents, workflows, signatures, KPIs, admin, storage
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@numdocman.com"
ADMIN_PASSWORD = "Admin123!"

created_ids = {}


@pytest.fixture(scope="module")
def token():
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if resp.status_code != 200:
        pytest.skip(f"Auth failed: {resp.text}")
    return resp.json()["token"]


@pytest.fixture(scope="module")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


# ─── Auth Tests ────────────────────────────────────────────────────────────────

class TestAuth:
    def test_health(self):
        r = requests.get(f"{BASE_URL}/api/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"

    def test_login_success(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        data = r.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["is_superadmin"] == True

    def test_login_invalid(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_get_me(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL


# ─── Organizations ─────────────────────────────────────────────────────────────

class TestOrganizations:
    def test_list_orgs(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/organizations", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_org(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/organizations", headers=auth_headers, json={
            "name": "TEST_Organization Alpha",
            "code": "TESTALPHA",
            "description": "Test org"
        })
        assert r.status_code == 201
        data = r.json()
        assert data["name"] == "TEST_Organization Alpha"
        assert data["code"] == "TESTALPHA"
        created_ids["org_id"] = data["id"]

    def test_get_org(self, auth_headers):
        if "org_id" not in created_ids:
            pytest.skip("No org created")
        r = requests.get(f"{BASE_URL}/api/organizations/{created_ids['org_id']}", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["code"] == "TESTALPHA"

    def test_duplicate_org_code(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/organizations", headers=auth_headers, json={
            "name": "Duplicate Org",
            "code": "TESTALPHA"
        })
        assert r.status_code == 400


# ─── Projects ──────────────────────────────────────────────────────────────────

class TestProjects:
    def test_list_projects(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/projects", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_project(self, auth_headers):
        if "org_id" not in created_ids:
            pytest.skip("No org available")
        r = requests.post(f"{BASE_URL}/api/projects", headers=auth_headers, json={
            "org_id": created_ids["org_id"],
            "name": "TEST_Project Beta",
            "code": "TESTBETA",
            "description": "Test project",
            "phases": ["DES", "DEV", "TEST"]
        })
        assert r.status_code == 201
        data = r.json()
        assert data["code"] == "TESTBETA"
        assert data["phases"] == ["DES", "DEV", "TEST"]
        created_ids["project_id"] = data["id"]

    def test_get_project(self, auth_headers):
        if "project_id" not in created_ids:
            pytest.skip("No project created")
        r = requests.get(f"{BASE_URL}/api/projects/{created_ids['project_id']}", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["code"] == "TESTBETA"
        assert "org" in data

    def test_workflow_states_created(self, auth_headers):
        if "project_id" not in created_ids:
            pytest.skip("No project created")
        r = requests.get(f"{BASE_URL}/api/projects/{created_ids['project_id']}/workflow-states", headers=auth_headers)
        assert r.status_code == 200
        states = r.json()
        codes = [s["code"] for s in states]
        for code in ["DRAFT", "REVIEW", "APPROVED", "PUBLISHED", "ARCHIVED"]:
            assert code in codes, f"Missing state: {code}"

    def test_workflow_transitions_created(self, auth_headers):
        if "project_id" not in created_ids:
            pytest.skip("No project created")
        r = requests.get(f"{BASE_URL}/api/projects/{created_ids['project_id']}/workflow-transitions", headers=auth_headers)
        assert r.status_code == 200
        assert len(r.json()) > 0

    def test_id_rule_created(self, auth_headers):
        if "project_id" not in created_ids:
            pytest.skip("No project created")
        r = requests.get(f"{BASE_URL}/api/projects/{created_ids['project_id']}/id-rule", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "pattern" in data


# ─── Document Types ────────────────────────────────────────────────────────────

class TestDocumentTypes:
    def test_create_doc_type(self, auth_headers):
        if "project_id" not in created_ids:
            pytest.skip("No project created")
        r = requests.post(f"{BASE_URL}/api/projects/{created_ids['project_id']}/document-types", headers=auth_headers, json={
            "name": "Plan",
            "code": "PLA",
            "description": "Plan documents",
            "color": "#2E60CC"
        })
        assert r.status_code == 201
        data = r.json()
        assert data["code"] == "PLA"
        created_ids["doc_type_id"] = data["id"]

    def test_list_doc_types(self, auth_headers):
        if "project_id" not in created_ids:
            pytest.skip("No project created")
        r = requests.get(f"{BASE_URL}/api/projects/{created_ids['project_id']}/document-types", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ─── Documents ─────────────────────────────────────────────────────────────────

class TestDocuments:
    def test_create_document(self, auth_headers):
        if "project_id" not in created_ids:
            pytest.skip("No project created")
        r = requests.post(f"{BASE_URL}/api/documents", headers=auth_headers, json={
            "project_id": created_ids["project_id"],
            "doc_type_id": created_ids.get("doc_type_id"),
            "title": "TEST_Document One",
            "phase": "DES"
        })
        assert r.status_code == 201
        data = r.json()
        assert "doc_id" in data
        assert data["doc_id"] != ""
        # Verify ID format: ORG_PROJ_PHASE_TYPE_SEQ
        doc_id = data["doc_id"]
        parts = doc_id.split("_")
        assert len(parts) >= 5, f"Doc ID format wrong: {doc_id}"
        created_ids["document_id"] = data["id"]
        created_ids["document_doc_id"] = doc_id
        print(f"Generated doc_id: {doc_id}")

    def test_list_documents(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/documents", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_get_document(self, auth_headers):
        if "document_id" not in created_ids:
            pytest.skip("No document created")
        r = requests.get(f"{BASE_URL}/api/documents/{created_ids['document_id']}", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "current_state" in data
        assert data["current_state"]["code"] == "DRAFT"

    def test_document_history(self, auth_headers):
        if "document_id" not in created_ids:
            pytest.skip("No document created")
        r = requests.get(f"{BASE_URL}/api/documents/{created_ids['document_id']}/history", headers=auth_headers)
        assert r.status_code == 200
        history = r.json()
        assert len(history) > 0
        assert history[0]["action"] == "create"

    def test_workflow_transition(self, auth_headers):
        if "document_id" not in created_ids:
            pytest.skip("No document created")
        # Get workflow states to find REVIEW state id
        r = requests.get(f"{BASE_URL}/api/projects/{created_ids['project_id']}/workflow-states", headers=auth_headers)
        states = {s["code"]: s["id"] for s in r.json()}

        r = requests.post(f"{BASE_URL}/api/documents/{created_ids['document_id']}/transition", headers=auth_headers, json={
            "to_state_id": states["REVIEW"],
            "comment": "Sending for review"
        })
        assert r.status_code == 200
        data = r.json()
        assert data["current_state"]["code"] == "REVIEW"

    def test_add_signature(self, auth_headers):
        if "document_id" not in created_ids:
            pytest.skip("No document created")
        r = requests.post(f"{BASE_URL}/api/documents/{created_ids['document_id']}/signatures", headers=auth_headers, json={
            "name": "Admin User",
            "company": "RealCMB Group",
            "email": ADMIN_EMAIL,
            "signed_at": "2024-01-15T10:00:00Z",
            "timezone": "Europe/Paris",
            "signature_data": "data:image/png;base64,test",
            "signature_type": "drawn"
        })
        assert r.status_code == 201
        data = r.json()
        assert data["name"] == "Admin User"


# ─── KPI ───────────────────────────────────────────────────────────────────────

class TestKPI:
    def test_kpi_overview(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/kpi/overview", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "total_documents" in data
        assert "total_projects" in data
        assert "total_signatures" in data

    def test_kpi_overview_with_org(self, auth_headers):
        if "org_id" not in created_ids:
            pytest.skip("No org available")
        r = requests.get(f"{BASE_URL}/api/kpi/overview", headers=auth_headers, params={"org_id": created_ids["org_id"]})
        assert r.status_code == 200

    def test_kpi_by_project(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/kpi/by-project", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ─── Admin ─────────────────────────────────────────────────────────────────────

class TestAdmin:
    def test_list_users(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/admin/users", headers=auth_headers)
        assert r.status_code == 200
        users = r.json()
        assert isinstance(users, list)
        # Admin user should be in list
        emails = [u["email"] for u in users]
        assert ADMIN_EMAIL in emails

    def test_admin_stats(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/admin/stats", headers=auth_headers)
        assert r.status_code == 200


# ─── Storage ───────────────────────────────────────────────────────────────────

class TestStorage:
    def test_list_storage_configs(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/storage-configs", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ─── Cleanup ───────────────────────────────────────────────────────────────────

class TestCleanup:
    def test_cleanup_document(self, auth_headers):
        if "document_id" not in created_ids:
            return
        r = requests.delete(f"{BASE_URL}/api/documents/{created_ids['document_id']}", headers=auth_headers)
        assert r.status_code == 204

    def test_cleanup_project(self, auth_headers):
        if "project_id" not in created_ids:
            return
        r = requests.delete(f"{BASE_URL}/api/projects/{created_ids['project_id']}", headers=auth_headers)
        assert r.status_code == 204
