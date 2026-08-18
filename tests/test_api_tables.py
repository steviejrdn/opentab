import pytest
from fastapi.testclient import TestClient

from opentab.main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_create_table(client):
    resp = client.post('/api/tables/', json={'name': 'My Table'})
    assert resp.status_code == 200
    body = resp.json()
    assert body['name'] == 'My Table'
    assert body['id']
    assert body['row_items'] == []
    assert body['col_items'] == []


def test_list_tables(client):
    client.post('/api/tables/', json={'name': 'T1'})
    client.post('/api/tables/', json={'name': 'T2'})
    resp = client.get('/api/tables/')
    assert resp.status_code == 200
    assert len(resp.json()) == 2


def test_get_table_not_found(client):
    resp = client.get('/api/tables/does-not-exist')
    assert resp.status_code == 404


def test_update_table(client):
    table_id = client.post('/api/tables/', json={'name': 'T'}).json()['id']
    updates = {
        'row_items': [{'variable': 'Gender', 'codeDef': 'Gender/1'}],
        'col_items': [{'variable': 'Satisfaction', 'codeDef': 'Satisfaction/5'}],
        'filter_items': [],
        'weight_col': None,
        'filter_def': None,
    }
    resp = client.put(f'/api/tables/{table_id}', json=updates)
    assert resp.status_code == 200
    body = resp.json()
    assert body['row_items'][0]['codeDef'] == 'Gender/1'
    assert body['weight_col'] is None


def test_delete_table(client):
    table_id = client.post('/api/tables/', json={'name': 'T'}).json()['id']
    resp = client.delete(f'/api/tables/{table_id}')
    assert resp.status_code == 200
    assert client.get(f'/api/tables/{table_id}').status_code == 404
