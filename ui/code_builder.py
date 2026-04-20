import streamlit as st


def render_code_builder(var_name, available_vars, code_frame, key_prefix):
    st.subheader(f"Code Definition for: {var_name}")

    key = f"{key_prefix}_{var_name}"

    if var_name in available_vars:
        codes = available_vars[var_name].get('codes', [])
        if codes:
            code_options = {}
            for c in codes:
                code_val = c.get('code', '')
                code_label = c.get('label', str(code_val))
                code_options[f"{code_val}"] = code_label

            selected_codes = st.multiselect(
                "Select codes",
                options=list(code_options.keys()),
                format_func=lambda x: f"{x} - {code_options[x]}",
                key=f"{key}_codes"
            )

            if selected_codes:
                if len(selected_codes) == 1:
                    code_def = f"{var_name}/{selected_codes[0]}"
                else:
                    nums = sorted([int(c) for c in selected_codes])
                    if _is_consecutive(nums):
                        code_def = f"{var_name}/{nums[0]}..{nums[-1]}"
                    else:
                        code_parts = ','.join(selected_codes)
                        code_def = f"{var_name}/{code_parts}"

                st.text_input("Code definition", value=code_def, key=f"{key}_def", disabled=True)
                return code_def

    return None


def render_combined_builder(all_code_defs, key_prefix):
    st.subheader("Combine Code Definitions")

    if not all_code_defs:
        st.info("Add row/column definitions first")
        return None

    selected_defs = st.multiselect(
        "Select definitions to combine",
        options=list(all_code_defs.keys()),
        format_func=lambda x: f"{x}: {all_code_defs[x]}",
        key=f"{key_prefix}_combine_select"
    )

    if len(selected_defs) >= 2:
        operator = st.radio("Combine with:", ["OR (+)", "AND (.)"], horizontal=True, key=f"{key_prefix}_operator")

        op_symbol = '+' if 'OR' in operator else '.'
        combined = op_symbol.join([all_code_defs[d] for d in selected_defs])

        st.text_input("Combined definition", value=combined, key=f"{key_prefix}_combined", disabled=True)
        return combined

    return None


def _is_consecutive(nums):
    if len(nums) < 2:
        return False
    sorted_nums = sorted(nums)
    for i in range(1, len(sorted_nums)):
        if sorted_nums[i] != sorted_nums[i-1] + 1:
            return False
    return True
