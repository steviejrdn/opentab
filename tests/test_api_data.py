import os

import pytest
from fastapi.testclient import TestClient

from opentab.main import app


@pytest.fixture
def client():
    return TestClient(app)


CSV_BYTES = b'Gender,Satisfaction,Brands\n1,5,1;3\n2,4,2\n1,5,3;5\n'


def test_upload_csv(client):
    resp = client.post(
        '/api/data/upload',
        files={'file': ('test_upload.csv', CSV_BYTES, 'text/csv')},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert set(body['columns']) == {'Gender', 'Satisfaction', 'Brands'}
    assert body['row_count'] == 3
    assert body['format'] == 'csv'
    _cleanup('test_upload.csv')


def test_upload_rejects_unsupported_extension(client):
    resp = client.post(
        '/api/data/upload',
        files={'file': ('data.pdf', b'not-a-csv', 'application/pdf')},
    )
    assert resp.status_code == 400


def test_load_sample(client):
    resp = client.post('/api/data/load-sample')
    assert resp.status_code == 200
    body = resp.json()
    assert body['row_count'] > 0
    assert 'Satisfaction' in body['columns']


def test_get_variables(client):
    client.post('/api/data/upload', files={'file': ('vars.csv', CSV_BYTES, 'text/csv')})
    resp = client.get('/api/data/variables')
    assert resp.status_code == 200
    variables = resp.json()['variables']
    assert 'Gender' in variables
    assert variables['Brands']['answer_type'] == 'multiple_answer'
    _cleanup('vars.csv')


def test_get_info(client):
    client.post('/api/data/upload', files={'file': ('info.csv', CSV_BYTES, 'text/csv')})
    resp = client.get('/api/data/info')
    assert resp.status_code == 200
    body = resp.json()
    assert body['row_count'] == 3
    assert body['column_count'] == 3
    assert body['file_name'] == 'info.csv'
    _cleanup('info.csv')


def test_raw_upload_text_roundtrip(client):
    client.post('/api/data/upload', files={'file': ('roundtrip.csv', CSV_BYTES, 'text/csv')})
    raw = client.get('/api/data/raw')
    assert raw.status_code == 200
    csv_text = raw.text
    assert 'Gender' in csv_text

    # Reset and restore via upload-text
    resp = client.post('/api/data/upload-text', json={'csv_text': csv_text, 'file_name': 'restored.csv'})
    assert resp.status_code == 200
    assert resp.json()['row_count'] == 3
    _cleanup('roundtrip.csv')


def test_merge_mr(client):
    client.post('/api/data/upload', files={'file': ('mr.csv', CSV_BYTES, 'text/csv')})
    resp = client.post(
        '/api/data/merge-mr',
        json={'name': 'brand_net', 'source_columns': ['Gender', 'Satisfaction'], 'label': 'Brand net'},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body['name'] == 'brand_net'
    assert len(body['codes']) == 2

    merged = client.get('/api/data/merged-variables').json()['variables']
    assert 'brand_net' in merged
    _cleanup('mr.csv')


def test_merge_codes(client):
    df = (
        'tom_1,tom_2,spont_1,spont_2\n'
        '1,0,0,1\n'
        '0,1,1,0\n'
        '1,1,1,1\n'
    )
    client.post('/api/data/upload', files={'file': ('codes.csv', df.encode(), 'text/csv')})
    resp = client.post(
        '/api/data/merge_codes',
        json={'variables': ['tom', 'spont'], 'new_variable_name': 'net', 'merge_operator': 'OR'},
    )
    assert resp.status_code == 200
    assert resp.json()['name'] == 'net'
    _cleanup('codes.csv')


def test_register_net_and_registry(client):
    client.post('/api/data/upload', files={'file': ('net.csv', CSV_BYTES, 'text/csv')})
    resp = client.post(
        '/api/data/register-net',
        json={'code': '99', 'variable': 'Gender', 'label': 'Net', 'netOf': ['1', '2'], 'syntax': 'Gender/1+Gender/2'},
    )
    assert resp.status_code == 200

    registry = client.get('/api/data/net-registry').json()
    assert '99' in registry['net_registry']
    assert registry['net_registry']['99']['label'] == 'Net'
    _cleanup('net.csv')


def test_data_endpoints_require_data(client):
    assert client.get('/api/data/variables').status_code == 400
    assert client.get('/api/data/info').status_code == 400
    assert client.get('/api/data/raw').status_code == 400


def _cleanup(filename):
    try:
        os.remove(os.path.join('temp', filename))
    except FileNotFoundError:
        pass
