import streamlit as st
import pandas as pd
import os


def render_data_upload():
    st.header("Upload Data")

    col1, col2 = st.columns(2)

    with col1:
        csv_file = st.file_uploader("Upload CSV file", type=['csv', 'txt'], key='csv_uploader')

    with col2:
        mdd_file = st.file_uploader("Upload MDD file (optional)", type=['mdd', 'json'], key='mdd_uploader')

    if csv_file is not None:
        try:
            df = pd.read_csv(csv_file, dtype=str)
            st.session_state['data'] = df
            st.success(f"Loaded {len(df)} rows, {len(df.columns)} columns")
            st.dataframe(df.head(10), use_container_width=True)

            if mdd_file is not None:
                try:
                    from core.mdd_parser import parse_mdd
                    mdd_path = os.path.join('sample_data', mdd_file.name)
                    with open(mdd_path, 'wb') as f:
                        f.write(mdd_file.getbuffer())
                    mdd = parse_mdd(mdd_path)
                    st.session_state['mdd'] = mdd
                    st.success(f"Loaded MDD: {len(mdd)} variables")
                except Exception as e:
                    st.warning(f"MDD parse error: {e}")

            return True
        except Exception as e:
            st.error(f"Error loading CSV: {e}")
            return False

    return False


def load_sample_data():
    try:
        from core.data_loader import load_csv
        df, metadata = load_csv('sample_data/sample.csv')
        st.session_state['data'] = df

        try:
            from core.mdd_parser import parse_mdd
            mdd = parse_mdd('sample_data/sample.mdd')
            st.session_state['mdd'] = mdd
        except:
            pass

        st.success(f"Loaded sample data: {len(df)} rows, {len(df.columns)} columns")
        return True
    except Exception as e:
        st.error(f"Error loading sample data: {e}")
        return False
