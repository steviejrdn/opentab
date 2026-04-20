import streamlit as st
import pandas as pd
from core.tabulator import create_crosstab, calculate_base
from core.statistics import calculate_frequencies
from ui.data_upload import render_data_upload, load_sample_data

st.set_page_config(page_title="opentab_", page_icon="📊", layout="wide")

st.title("opentab_")

if 'data' not in st.session_state:
    st.session_state['data'] = None
if 'mdd' not in st.session_state:
    st.session_state['mdd'] = None
if 'tables' not in st.session_state:
    st.session_state['tables'] = []
if 'current_table' not in st.session_state:
    st.session_state['current_table'] = None

if st.session_state['data'] is None:
    st.header("Upload Data")
    if render_data_upload():
        pass
    if st.session_state['data'] is None:
        if st.button("Load Sample Data"):
            load_sample_data()
    st.stop()

df = st.session_state['data']
mdd = st.session_state.get('mdd', {})

main_col1, main_col2 = st.columns([1, 2])

with main_col1:
    st.subheader("Tables")

    if st.button("+ New Table"):
        new_table = {
            'name': f"Table {len(st.session_state['tables']) + 1}",
            'row_items': [],
            'col_items': [],
            'filter_def': '',
            'weight_col': None,
            'result': None,
            'stats': None
        }
        st.session_state['tables'].append(new_table)
        st.session_state['current_table'] = len(st.session_state['tables']) - 1

    for i, tbl in enumerate(st.session_state['tables']):
        selected = i == st.session_state.get('current_table')
        if st.button(f"{tbl['name']}", key=f"tbl_{i}", type="primary" if selected else "secondary"):
            st.session_state['current_table'] = i

    if st.session_state['tables']:
        st.markdown("---")
        st.subheader("Variables")

        for col_name in df.columns:
            if st.button(f"{col_name}", key=f"var_{col_name}"):
                st.session_state['selected_var'] = col_name

with main_col2:
    if st.session_state['current_table'] is None:
        st.info("Click '+ New Table' to start building a table")
    else:
        tbl = st.session_state['tables'][st.session_state['current_table']]

        tab1, tab2 = st.tabs(["Build", "Result"])

        with tab1:
            st.subheader("Row")
            row_container = st.container(border=True)
            with row_container:
                if tbl['row_items']:
                    for j, item in enumerate(tbl['row_items']):
                        col_btn, col_code, col_del = st.columns([3, 4, 1])
                        with col_btn:
                            st.write(f"📌 {item['var']}")
                        with col_code:
                            st.text_input("Code definition", value=item['code_def'], key=f"row_code_{j}", label_visibility="collapsed")
                        with col_del:
                            if st.button("✕", key=f"row_del_{j}"):
                                tbl['row_items'].pop(j)
                                st.rerun()
                else:
                    st.caption("Click a variable from the left panel to add")

            st.subheader("Column")
            col_container = st.container(border=True)
            with col_container:
                if tbl['col_items']:
                    for j, item in enumerate(tbl['col_items']):
                        col_btn, col_code, col_del = st.columns([3, 4, 1])
                        with col_btn:
                            st.write(f"📌 {item['var']}")
                        with col_code:
                            st.text_input("Code definition", value=item['code_def'], key=f"col_code_{j}", label_visibility="collapsed")
                        with col_del:
                            if st.button("✕", key=f"col_del_{j}"):
                                tbl['col_items'].pop(j)
                                st.rerun()
                else:
                    st.caption("Click a variable from the left panel to add")

            if 'selected_var' in st.session_state:
                var_name = st.session_state['selected_var']
                st.markdown("---")
                st.subheader(f"Add {var_name}")

                var_data = mdd.get(var_name, {})
                codes = var_data.get('codes', [])

                if not codes:
                    unique_vals = sorted(df[var_name].dropna().unique().tolist())
                    codes = [{'code': c, 'label': str(c)} for c in unique_vals]

                code_options = {str(c['code']): c['label'] for c in codes}
                selected_codes = st.multiselect(
                    "Select codes",
                    options=list(code_options.keys()),
                    format_func=lambda x: f"{x} - {code_options[x]}",
                    key=f"add_codes_{var_name}"
                )

                if selected_codes:
                    nums = sorted([int(c) for c in selected_codes])
                    if len(nums) > 1 and all(nums[i] == nums[i-1] + 1 for i in range(1, len(nums))):
                        code_def = f"{var_name}/{nums[0]}..{nums[-1]}"
                    elif len(selected_codes) == 1:
                        code_def = f"{var_name}/{selected_codes[0]}"
                    else:
                        code_def = f"{var_name}/{','.join(selected_codes)}"

                    st.text_input("Code definition", value=code_def, disabled=True)

                    add_col1, add_col2 = st.columns(2)
                    with add_col1:
                        if st.button("Add to Row"):
                            tbl['row_items'].append({'var': var_name, 'code_def': code_def})
                            st.session_state.pop('selected_var', None)
                            st.rerun()
                    with add_col2:
                        if st.button("Add to Column"):
                            tbl['col_items'].append({'var': var_name, 'code_def': code_def})
                            st.session_state.pop('selected_var', None)
                            st.rerun()

            st.markdown("---")
            st.subheader("Options")
            opt1, opt2 = st.columns(2)
            with opt1:
                tbl['weight_col'] = st.selectbox(
                    "Weight column",
                    options=[None] + list(df.columns),
                    index=0 if tbl['weight_col'] is None else list(df.columns).index(tbl['weight_col']) + 1,
                    key="weight_select"
                )
            with opt2:
                tbl['filter_def'] = st.text_input(
                    "Filter (code definition)",
                    value=tbl.get('filter_def', ''),
                    placeholder="e.g., Q1/1+Q2/2",
                    key="filter_input"
                )

            if st.button("Generate Table", type="primary", use_container_width=True):
                if not tbl['row_items'] or not tbl['col_items']:
                    st.error("Please add at least one item to Row and Column")
                else:
                    try:
                        row_defs = [{'name': item['var'], 'code_def': item['code_def']} for item in tbl['row_items']]
                        col_defs = [{'name': item['var'], 'code_def': item['code_def']} for item in tbl['col_items']]

                        crosstab = create_crosstab(df, row_defs, col_defs, tbl['weight_col'], tbl['filter_def'] if tbl['filter_def'] else None)
                        stats = calculate_frequencies(crosstab)

                        tbl['result'] = crosstab
                        tbl['stats'] = stats

                        st.success("Table generated! Switch to Result tab")
                    except Exception as e:
                        st.error(f"Error: {e}")

        with tab2:
            if tbl['stats'] is None:
                st.info("Generate a table first in the Build tab")
            else:
                st.subheader(tbl['name'])

                st.dataframe(tbl['result'], use_container_width=True)

                disp_col1, disp_col2, disp_col3, disp_col4 = st.columns(4)
                with disp_col1:
                    show_counts = st.checkbox("Counts", value=True, key=f"show_counts_{st.session_state['current_table']}")
                with disp_col2:
                    show_row_pct = st.checkbox("Row %", key=f"show_row_{st.session_state['current_table']}")
                with disp_col3:
                    show_col_pct = st.checkbox("Col %", key=f"show_col_{st.session_state['current_table']}")
                with disp_col4:
                    show_total_pct = st.checkbox("Total %", key=f"show_total_{st.session_state['current_table']}")

                from core.statistics import format_table_for_html
                html = format_table_for_html(tbl['stats'], show_counts, show_row_pct, show_col_pct, show_total_pct)
                st.markdown(html, unsafe_allow_html=True)

                st.info("Tip: Select the table above and copy (Ctrl+C), then paste directly into Excel")

                dl_col1, dl_col2 = st.columns(2)
                with dl_col1:
                    csv_data = tbl['result'].to_csv(index=True)
                    st.download_button("Download CSV", data=csv_data, file_name=f"{tbl['name']}.csv", mime="text/csv")
                with dl_col2:
                    tsv_data = tbl['result'].to_csv(sep='\t', index=True)
                    st.download_button("Download TSV", data=tsv_data, file_name=f"{tbl['name']}.tsv", mime="text/tab-separated-values")
