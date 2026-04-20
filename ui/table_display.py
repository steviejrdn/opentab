import streamlit as st
import pandas as pd


def render_table_display(stats, show_counts=True, show_row_pct=False, show_col_pct=False, show_total_pct=False):
    from core.statistics import format_table_for_html

    html = format_table_for_html(stats, show_counts, show_row_pct, show_col_pct, show_total_pct)

    st.subheader("Cross-tabulation Table")

    st.markdown(html, unsafe_allow_html=True)

    st.markdown("---")
    st.info("Tip: Click and drag to select the table above, then copy (Ctrl+C) and paste directly into Excel")

    col1, col2 = st.columns(2)

    with col1:
        if st.button("Copy as CSV"):
            csv_data = stats['counts'].to_csv(index=True)
            st.session_state['clipboard_csv'] = csv_data
            st.success("CSV ready for download below")

    with col2:
        if st.button("Copy as TSV (Excel-friendly)"):
            tsv_data = stats['counts'].to_csv(sep='\t', index=True)
            st.session_state['clipboard_tsv'] = tsv_data
            st.success("TSV ready for download below")

    if 'clipboard_csv' in st.session_state:
        st.download_button(
            label="Download CSV",
            data=st.session_state['clipboard_csv'],
            file_name="crosstab.csv",
            mime="text/csv"
        )

    if 'clipboard_tsv' in st.session_state:
        st.download_button(
            label="Download TSV",
            data=st.session_state['clipboard_tsv'],
            file_name="crosstab.tsv",
            mime="text/tab-separated-values"
        )


def render_stats_summary(stats):
    col1, col2, col3 = st.columns(3)

    with col1:
        st.subheader("Row %")
        st.dataframe(stats['row_pct'].round(1), use_container_width=True)

    with col2:
        st.subheader("Column %")
        st.dataframe(stats['col_pct'].round(1), use_container_width=True)

    with col3:
        st.subheader("Total %")
        st.dataframe(stats['total_pct'].round(1), use_container_width=True)
