# Test Data Summary

## 📁 Files Created

| File | Description | Size |
|------|-------------|------|
| `comprehensive_survey_data.csv` | Main dataset (500 respondents, ALL NUMERIC CODES) | ~100 KB |
| `DATA_DICTIONARY.md` | Code-to-label mappings untuk SEMUA variable | - |
| `TEST_SCENARIOS.md` | 50+ test scenarios dengan numeric codes | - |
| `generate_data.py` | Python script untuk regenerate data | - |

---

## ⚠️ IMPORTANT: All Numeric Codes

**Dataset ini menggunakan KODE NUMERIK untuk semua categorical variable.**

Contoh:
- Region: `1`=Jakarta, `2`=Bandung, `3`=Surabaya (bukan "Jakarta", "Bandung")
- Gender: `1`=Male, `2`=Female (bukan "Male", "Female")
- Q1A-E: `0`=No, `1`=Yes (binary untuk masing-masing brand)
- Q12: `1`=Sports, `2`=Music, dll. (semicolon-delimited)

**Lihat DATA_DICTIONARY.md untuk lengkapnya!**

---

## 🚀 Quick Start

### 1. Upload Data
1. Buka opentab di browser (http://localhost:5173)
2. Klik "Upload CSV"
3. Pilih file: `test_data/comprehensive_survey_data.csv`
4. Data akan ter-load dengan 500 respondents dan 25 variables (semua numeric)

### 2. Your First Crosstab
**Simple Test**: Brand A Awareness by Region
- Drag `Q1A` ke **Sidebreak (Rows)**
- Drag `Region` ke **Header (Columns)**
- Klik **Run**
- Expected: ~63% code 1 (aware), ~37% code 0 (not aware)

### 3. Apply Filter (Numeric Codes!)
- Buka **Filter Tab**
- Add filter: `Q1A` includes code `1` (untuk yang aware Brand A)
- Klik **Run**
- Expected: Base = ~313 (hanya yang aware Brand A)

### 4. Try Weighted Analysis
- Di **Build Tab**, pilih **Weight Column** = `Weight`
- Klik **Run**
- Compare weighted vs unweighted counts

### 5. Test Spread (Delimited) Merge - NEW!
- Go to **Edit Variables**
- Pilih **Q12** (Interests)
- Klik **Merge Variables** → **Spread (delimited)**
- Set delimiter: `;` (semicolon)
- **Expected**: Variable Q12_spread dengan 6 kategori (1-6)

### 6. Duplicate & Manage Features
**Duplicate Table**:
- Di sidebar, klik ⋮ di table row → "duplicate"
- Table baru dengan "(copy)" suffix muncul dengan config identik

**Duplicate Variable**:
- Go to **Edit Variables** page
- Klik ⧉ di kolom actions untuk duplicate variable
- Variable baru dengan semua codes tercopy

**Duplicate Code**:
- Open variable detail
- Klik ⧉ di row code untuk duplicate
- Code baru dengan syntax yang sama

**Delete Custom Variable**:
- Di Edit Variables, klik × di custom variable (amber dot)
- Konfirmasi dialog muncul sebelum delete

---

## 📊 Variable Categories

### Demographics (6 variables + Weight)
- Respondent_ID (string), Weight (numeric)
- Region (1-5), Gender (1-2), Age_Group (1-5)
- Income_Level (1-6), Education (1-5)

### Brand Awareness (5 variables - NEW!)
- **Q1A**: Brand A Awareness (0=No, 1=Yes) - ~63% aware
- **Q1B**: Brand B Awareness (0=No, 1=Yes) - ~43% aware
- **Q1C**: Brand C Awareness (0=No, 1=Yes) - ~32% aware
- **Q1D**: Brand D Awareness (0=No, 1=Yes) - ~21% aware
- **Q1E**: Brand E Awareness (0=No, 1=Yes) - ~17% aware

### Survey Questions (11 variables)
- **Q2**: Brand Usage (1=Light, 2=Medium, 3=Heavy)
- **Q3**: Satisfaction (1-5 scale)
- **Q4**: Recommendation/NPS (0-10 scale)
- **Q5**: Price Sensitivity (1=Low, 2=Medium, 3=High)
- **Q6**: Features Preferred (1=Design, 2=Performance, 3=Durability, 4=Price) - MR format
- **Q7**: Purchase Intent (1-5 scale)
- **Q8**: Spend Last Month (numeric)
- **Q9**: Channels Used (1=Online, 2=Retail, 3=Social, 4=TV, 5=WOM) - MR format
- **Q11A-D**: Ratings (1-5 scale)
- **Q12**: Interests (1=Sports, 2=Music, 3=Travel, 4=Technology, 5=Food, 6=Reading) - MR format

### Derived (1 variable)
- **Cluster**: 1=Premium, 2=Standard, 3=Budget, 4=Excluded

---

## 🎯 Key Testing Areas

| Feature | Variables to Use | Test Scenario |
|---------|------------------|---------------|
| **Basic Crosstab** | Region (1-5) vs Gender (1-2) | Simple two-way table |
| **Filters** | Q1A=1 filter pada Q2 | Base aware Brand A only |
| **Multiple Response** | Q6 (1-4) atau Q9 (1-5) | Split & analyze |
| **Spread (Delimited)** | **Q12** (1-6) | **NEW! Test spread merge** |
| **Net Codes** | Q3 (satisfaction, codes 1-5) | Create T2B net (4+5) |
| **Mean Scores** | Q3, Q4, Q8 | Enable statistics |
| **Weighting** | Weight column | Weighted crosstab |
| **Nesting** | Region→Gender→Age | 3-level nesting |
| **Complex Filters** | AND/OR combinations | Filter tab test |
| **Duplicate Table** | Any table | Click ⋮ menu → duplicate |
| **Duplicate Variable** | Custom variables | Edit Variables page, click ⧉ |
| **Duplicate Code** | Variable codes | Variable Detail, click ⧉ on code row |
| **Delete Variable** | Custom variables (amber dot) | Edit Variables page, click × |

---

## 📖 Documentation

- **DATA_DICTIONARY.md** - Detail lengkap semua kode:
  - Code definitions (1=Jakarta, 2=Bandung, etc.)
  - 5 brand awareness variables (Q1A-Q1E)
  - Q12 untuk spread merge testing
  - Base sizes
  - Filter logic dengan numeric codes
  - Mean score opportunities
  - Code syntax examples

- **TEST_SCENARIOS.md** - 50+ test cases:
  - Level 1-18 (Basic to Advanced)
  - **Level 9**: Spread (Delimited) Merge Testing - NEW!
  - Brand comparison scenarios
  - Menggunakan numeric codes
  - Edge cases
  - Real-world scenarios
  - Verification checklist

---

## 💡 Tips

### Data & Analysis
1. **All Numeric**: Semua categorical menggunakan kode (1, 2, 3), bukan label text
2. **Multi-Brand Awareness**: Q1A-Q1E adalah 5 kolom binary terpisah untuk 5 brand berbeda
3. **Filter Base**: Selalu perhatikan base size setelah apply filter
4. **Missing Data**: Q2-Q11 punya missing untuk yang tidak aware of any brand (~46 orang)
5. **Multiple Response**: Q6, Q9, Q12 pakai semicolon-delimited dengan kode (e.g., `1;2;4`)
6. **Weight**: Gunakan untuk melihat efek weighting pada hasil
7. **Code Reference**: Bookmark DATA_DICTIONARY.md untuk referensi kode!

### Spread (Delimited) Merge - NEW!
8. **Q12 untuk Testing**: Variable Q12 sengaja dibuat untuk test fitur spread merge
9. **Delimiter**: Gunakan semicolon (`;`) sebagai delimiter
10. **Result**: Spread merge akan membuat variable baru dengan kategori 1-6

### Duplicate & Clone Features
11. **Duplicate Table**: Use untuk A/B testing, backup sebelum modifikasi, atau compare variants
12. **Duplicate Variable**: Use untuk create variations dari custom variable dengan base logic yang sama
13. **Duplicate Code**: Use untuk build incremental logic atau test definisi yang mirip
14. **Delete Safety**: Hanya custom variables (amber dot) yang bisa didelete. Original variables (grey dot) protected!
15. **Workflow Pattern**: Duplicate → Rename → Modify → Compare. Great untuk iterative analysis!

---

## 🔧 Regenerate Data

Jika perlu data baru dengan distribusi berbeda:

```bash
cd test_data
python generate_data.py
```

Script akan generate 500 respondents baru dengan semua kode numerik.

---

## ⚠️ Important Notes

- **Format**: CSV dengan encoding UTF-8
- **All Numeric**: Semua categorical variable pakai kode numerik
- **Missing values**: Represented as empty strings (bukan "NA" atau "null")
- **Multiple response**: Format `code1;code2;code3` (semua numerik)

---

## Changes from Previous Version

### Removed:
- **Q10 (NPS Score)**: Dihapus karena redundant dengan Q4 (Recommendation)

### Changed:
- **Q1 (Brand Awareness)**: Dari binary single column menjadi **5 binary columns** (Q1A-Q1E) untuk merepresentasikan awareness terhadap 5 brand berbeda

### Added:
- **Q12 (Interests)**: Variable multiple response baru untuk test fitur "Spread (delimited)" merge
  - Kode: 1=Sports, 2=Music, 3=Travel, 4=Technology, 5=Food, 6=Reading
  - Format: semicolon-delimited
  - Base: All respondents (500)

---

Ready to test! 🎉
