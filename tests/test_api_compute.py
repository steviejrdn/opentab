import pytest
from fastapi.testclient import TestClient

from opentab.main import app


@pytest.fixture
def client():
    return TestClient(app)


DATA_CSV = (
    'Gender,Satisfaction,Age\n'
    '1,5,25\n'
    '2,4,30\n'
    '1,5,35\n'
    '2,3,40\n'
    '1,4,45\n'
    '2,5,50\n'
)


@pytest.fixture
def loaded_client(client):
    client.post('/api/data/upload-text', json={'csv_text': DATA_CSV, 'file_name': 'data.csv'})
    return client


def test_compute_requires_data(client):
    resp = client.post('/api/compute/crosstab', json={'row_items': [{'variable': 'Gender', 'codeDef': 'Gender/1'}]})
    assert resp.status_code == 400


def test_crosstab_counts(loaded_client):
    resp = loaded_client.post('/api/compute/crosstab', json={
        'row_items': [
            {'variable': 'Gender', 'codeDef': 'Gender/1'},
            {'variable': 'Gender', 'codeDef': 'Gender/2'},
        ],
        'col_items': [
            {'variable': 'Satisfaction', 'codeDef': 'Satisfaction/3'},
            {'variable': 'Satisfaction', 'codeDef': 'Satisfaction/4'},
            {'variable': 'Satisfaction', 'codeDef': 'Satisfaction/5'},
        ],
    })
    assert resp.status_code == 200
    body = resp.json()

    assert body['base'] == 6
    counts = body['counts']
    assert counts['Gender/1']['Satisfaction/5'] == 2
    assert counts['Gender/1']['Satisfaction/4'] == 1
    assert counts['Gender/2']['Satisfaction/3'] == 1
    assert counts['Total']['Total'] == 6


def test_crosstab_percentages(loaded_client):
    resp = loaded_client.post('/api/compute/crosstab', json={
        'row_items': [{'variable': 'Gender', 'codeDef': 'Gender/1'}],
        'col_items': [{'variable': 'Satisfaction', 'codeDef': 'Satisfaction/5'}],
    })
    body = resp.json()
    # Row %: Gender/1 has 3 rows, 2 of which are Satisfaction/5 -> 66.67%
    assert body['row_pct']['Gender/1']['Satisfaction/5'] == pytest.approx(200 / 3)
    # Col %: Satisfaction/5 total = 3, Gender/1 contributes 2 -> 66.67%
    assert body['col_pct']['Gender/1']['Satisfaction/5'] == pytest.approx(200 / 3)


def test_scale_rows(loaded_client):
    resp = loaded_client.post('/api/compute/crosstab', json={
        'row_items': [{'variable': 'Age', 'codeDef': '__scale__'}],
        'col_items': [
            {'variable': 'Gender', 'codeDef': 'Gender/1'},
            {'variable': 'Gender', 'codeDef': 'Gender/2'},
        ],
    })
    assert resp.status_code == 200
    scale_rows = resp.json()['scale_rows']
    assert 'Age' in scale_rows
    # Gender/1 ages: 25, 35, 45 -> mean 35
    assert scale_rows['Age']['mean']['Gender/1'] == 35.0
    # Gender/2 ages: 30, 40, 50 -> mean 40
    assert scale_rows['Age']['mean']['Gender/2'] == 40.0


def test_mean_score_mapping(loaded_client):
    resp = loaded_client.post('/api/compute/crosstab', json={
        'row_items': [{'variable': 'Satisfaction', 'codeDef': 'Satisfaction/5'}],
        'col_items': [
            {'variable': 'Gender', 'codeDef': 'Gender/1'},
            {'variable': 'Gender', 'codeDef': 'Gender/2'},
        ],
        'mean_score_mappings': [
            {'variable': 'Satisfaction', 'codeScores': {'3': 1, '4': 2, '5': 3}},
        ],
    })
    assert resp.status_code == 200
    mean = resp.json()['mean']
    # Gender/1 satisfaction: 5,5,4 -> scores 3,3,2 -> mean 8/3
    assert mean['Gender/1'] == pytest.approx(8 / 3, abs=0.01)
    # Gender/2 satisfaction: 4,3,5 -> scores 2,1,3 -> mean 2
    assert mean['Gender/2'] == 2.0


def test_weighted_crosstab(loaded_client):
    loaded_client.post('/api/data/upload-text', json={
        'csv_text': 'Gender,Satisfaction,W\n1,5,1.0\n2,4,2.0\n1,5,1.5\n2,3,2.5\n',
        'file_name': 'w.csv',
    })
    resp = loaded_client.post('/api/compute/crosstab', json={
        'row_items': [{'variable': 'Gender', 'codeDef': 'Gender/1'}],
        'col_items': [{'variable': 'Satisfaction', 'codeDef': 'Satisfaction/5'}],
        'weight_col': 'W',
    })
    assert resp.status_code == 200
    counts = resp.json()['counts']
    # Gender/1 x Satisfaction/5 weighted: rows 0 (1.0) + 2 (1.5) = 2.5
    assert counts['Gender/1']['Satisfaction/5'] == 2.5
