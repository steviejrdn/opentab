"""
Generate a synthetic .sav file for performance testing opentab with large datasets.

Usage:
    python scripts/generate_test_sav.py --rows 2000 --vars 2000 --output test_large.sav
    python scripts/generate_test_sav.py --rows 500 --vars 50 --output test_small.sav --seed 42
"""

import argparse
import time
import os
import numpy as np
import pandas as pd
import pyreadstat

TOPICS = [
    "product quality", "customer service", "price value", "brand trust",
    "ease of use", "overall satisfaction", "likelihood to recommend",
    "feature completeness", "support experience", "delivery speed",
    "website usability", "staff helpfulness", "return policy", "variety",
    "store cleanliness", "wait time", "communication clarity", "reliability",
    "innovation", "environmental impact",
]

NOMINAL_LABEL_SETS = [
    {1: "North", 2: "South", 3: "East", 4: "West"},
    {1: "18-24", 2: "25-34", 3: "35-44", 4: "45-54", 5: "55+"},
    {1: "Male", 2: "Female", 3: "Other", 4: "Prefer not to say"},
    {1: "High school", 2: "Bachelor", 3: "Master", 4: "Doctorate"},
    {1: "Full-time", 2: "Part-time", 3: "Self-employed", 4: "Unemployed", 5: "Student"},
    {1: "Brand A", 2: "Brand B", 3: "Brand C", 4: "Brand D", 5: "Brand E", 6: "Other"},
    {1: "Daily", 2: "Weekly", 3: "Monthly", 4: "Rarely", 5: "Never"},
]

LIKERT_LABELS = {1: "Strongly Disagree", 2: "Disagree", 3: "Neutral", 4: "Agree", 5: "Strongly Agree"}
BOOL_LABELS = {0: "No", 1: "Yes"}


def _var_type(i):
    """Assign variable type by index: 40% ordinal, 20% nominal, 20% numeric, 10% bool, 10% MA."""
    r = i % 10
    if r < 4:
        return "ordinal"
    elif r < 6:
        return "nominal"
    elif r < 8:
        return "numeric"
    elif r < 9:
        return "boolean"
    else:
        return "multiple_answer"


def build_variable_plan(n_vars):
    plan = []
    for i in range(n_vars):
        name = f"Q{i + 1}"
        topic = TOPICS[i % len(TOPICS)]
        vtype = _var_type(i)

        if vtype == "ordinal":
            plan.append({
                "name": name,
                "label": f"Q{i+1}: Rate {topic}",
                "type": "ordinal",
                "value_labels": LIKERT_LABELS,
                "n_codes": 5,
            })
        elif vtype == "nominal":
            label_set = NOMINAL_LABEL_SETS[i % len(NOMINAL_LABEL_SETS)]
            plan.append({
                "name": name,
                "label": f"Q{i+1}: Select {topic}",
                "type": "nominal",
                "value_labels": label_set,
                "n_codes": len(label_set),
            })
        elif vtype == "numeric":
            plan.append({
                "name": name,
                "label": f"Q{i+1}: Score for {topic} (0-100)",
                "type": "numeric",
                "value_labels": None,
            })
        elif vtype == "boolean":
            plan.append({
                "name": name,
                "label": f"Q{i+1}: Have you experienced {topic}?",
                "type": "boolean",
                "value_labels": BOOL_LABELS,
            })
        else:  # multiple_answer
            n_opts = min(6, 3 + (i % 4))
            plan.append({
                "name": name,
                "label": f"Q{i+1}: Which aspects of {topic} matter? (multi)",
                "type": "multiple_answer",
                "value_labels": None,
                "n_codes": n_opts,
            })
    return plan


def generate_dataframe(plan, n_rows, rng):
    columns = {}
    for v in plan:
        name = v["name"]
        vtype = v["type"]

        if vtype == "ordinal":
            columns[name] = rng.choice([1, 2, 3, 4, 5], size=n_rows,
                                       p=[0.05, 0.15, 0.25, 0.35, 0.20]).astype(float)
        elif vtype == "nominal":
            n_codes = v["n_codes"]
            columns[name] = rng.choice(range(1, n_codes + 1), size=n_rows).astype(float)
        elif vtype == "numeric":
            raw = rng.normal(loc=50, scale=20, size=n_rows)
            columns[name] = np.clip(raw, 0, 100)
        elif vtype == "boolean":
            columns[name] = rng.choice([0, 1], size=n_rows, p=[0.4, 0.6]).astype(float)
        else:  # multiple_answer
            n_opts = v["n_codes"]
            rows = []
            for _ in range(n_rows):
                k = rng.integers(1, min(4, n_opts + 1))
                chosen = sorted(rng.choice(range(1, n_opts + 1), size=k, replace=False))
                rows.append(";".join(str(c) for c in chosen))
            columns[name] = rows

    return pd.DataFrame(columns)


def build_metadata(plan):
    col_labels = []
    val_labels = {}
    measures = {}

    for v in plan:
        col_labels.append(v["label"])
        if v["value_labels"]:
            val_labels[v["name"]] = v["value_labels"]
        if v["type"] == "ordinal":
            measures[v["name"]] = "ordinal"
        elif v["type"] == "numeric":
            measures[v["name"]] = "scale"
        else:
            measures[v["name"]] = "nominal"

    return col_labels, val_labels, measures


def main():
    parser = argparse.ArgumentParser(description="Generate synthetic .sav for opentab perf testing")
    parser.add_argument("--rows", type=int, default=1000)
    parser.add_argument("--vars", type=int, default=500)
    parser.add_argument("--output", default="test_large.sav")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    rng = np.random.default_rng(args.seed)

    plan = build_variable_plan(args.vars)
    counts = {t: sum(1 for v in plan if v["type"] == t)
              for t in ["ordinal", "nominal", "numeric", "boolean", "multiple_answer"]}

    print(f"Generating {args.rows} rows x {args.vars} vars...")
    for t, n in counts.items():
        print(f"  - {n} {t}")

    df = generate_dataframe(plan, args.rows, rng)
    col_labels, val_labels, measures = build_metadata(plan)

    print(f"Writing {args.output}...")
    t0 = time.time()
    pyreadstat.write_sav(
        df,
        args.output,
        column_labels=col_labels,
        variable_value_labels=val_labels,
        variable_measure=measures,
    )
    elapsed = time.time() - t0
    size_mb = os.path.getsize(args.output) / 1_000_000

    print(f"Done. {size_mb:.1f} MB, {elapsed:.1f}s")


if __name__ == "__main__":
    main()
