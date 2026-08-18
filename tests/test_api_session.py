import pytest
from fastapi.testclient import TestClient

from opentab.main import app


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv('OPENTAB_DATA_DIR', str(tmp_path))
    return TestClient(app)


def test_load_empty(client):
    resp = client.get('/api/session/load')
    assert resp.status_code == 200
    assert resp.json() == {'exists': False, 'session': None}


def test_save_and_load(client):
    payload = {'version': 2, 'fileName': 'data.csv', 'csvData': 'a,b\n1,2\n', 'variables': {}}
    assert client.post('/api/session/save', json=payload).json()['status'] == 'ok'

    resp = client.get('/api/session/load')
    assert resp.status_code == 200
    body = resp.json()
    assert body['exists'] is True
    assert body['session']['fileName'] == 'data.csv'
    assert body['session']['csvData'] == 'a,b\n1,2\n'


def test_save_overwrites(client):
    client.post('/api/session/save', json={'version': 2, 'csvData': 'first'})
    client.post('/api/session/save', json={'version': 2, 'csvData': 'second'})
    assert client.get('/api/session/load').json()['session']['csvData'] == 'second'


def test_clear(client):
    client.post('/api/session/save', json={'version': 2, 'csvData': 'data'})
    assert client.delete('/api/session').json()['status'] == 'ok'
    assert client.get('/api/session/load').json() == {'exists': False, 'session': None}


def test_clear_when_empty_is_idempotent(client):
    assert client.delete('/api/session').json()['status'] == 'ok'


def test_load_corrupt_file(client):
    from opentab.api import session as session_module
    path = session_module._session_file()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text('{not valid json', encoding='utf-8')
    assert client.get('/api/session/load').json() == {'exists': False, 'session': None}
