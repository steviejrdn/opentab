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
- Q1: `0`=No, `1`=Yes (bukan 0/1 dengan label text)

**Lihat DATA_DICTIONARY.md untuk lengkapnya!**

---

## 🚀 Quick Start

### 1. Upload Data
1. Buka opentab di browser (http://localhost:5173)
2. Klik "Upload CSV"
3. Pilih file: `test_data/comprehensive_survey_data.csv`
4. Data akan ter-load dengan 500 respondents dan 21 variables (semua numeric)

### 2. Your First Crosstab
**Simple Test**: Brand Awareness by Region
- Drag `Q1` ke **Sidebreak (Rows)**
- Drag `Region` ke **Header (Columns)**
- Klik **Run**
- Expected: 73% code 1 (aware), 27% code 0 (not aware)

### 3. Apply Filter (Numeric Codes!)
- Buka **Filter Tab**
- Add filter: `Q1` includes code `1` (untuk yang aware)
- Klik **Run**
- Expected: Base = 365 (hanya yang aware)

### 4. Try Weighted Analysis
- Di **Build Tab**, pilih **Weight Column** = `Weight`
- Klik **Run**
- Compare weighted vs unweighted counts

### 5. Duplicate & Manage Features
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

### Survey Questions (14 variables)
- **Q1**: Brand Awareness (0=No, 1=Yes)
- **Q2**: Brand Usage (1=Light, 2=Medium, 3=Heavy)
- **Q3**: Satisfaction (1-5 scale)
- **Q4**: Recommendation (0-10 NPS)
- **Q5**: Price Sensitivity (1=Low, 2=Medium, 3=High)
- **Q6**: Features Preferred (1=Design, 2=Performance, 3=Durability, 4=Price) - MR format
- **Q7**: Purchase Intent (1-5 scale)
- **Q8**: Spend Last Month (numeric)
- **Q9**: Channels Used (1=Online, 2=Retail, 3=Social, 4=TV, 5=WOM) - MR format
- **Q10**: NPS Score (0-10)
- **Q11A-D**: Ratings (1-5 scale)

### Derived (1 variable)
- **Cluster**: 1=Premium, 2=Standard, 3=Budget, 4=Excluded

---

## 🎯 Key Testing Areas

| Feature | Variables to Use | Test Scenario |
|---------|------------------|---------------|
| **Basic Crosstab** | Region (1-5) vs Gender (1-2) | Simple two-way table |
| **Filters** | Q1=1 filter pada Q2 | Base aware only |
| **Multiple Response** | Q6 (1-4) atau Q9 (1-5) | Split & analyze |
| **Net Codes** | Q3 (satisfaction, codes 1-5) | Create T2B net (4+5) |
| **Mean Scores** | Q3, Q4, Q8, Q10 | Enable statistics |
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
  - Base sizes
  - Filter logic dengan numeric codes
  - Mean score opportunities
  - Code syntax examples

- **TEST_SCENARIOS.md** - 50+ test cases:
  - Level 1-12 (Basic to Advanced)
  - Menggunakan numeric codes
  - Edge cases
  - Real-world scenarios
  - Verification checklist

---

## 💡 Tips

### Data & Analysis
1. **All Numeric**: Semua categorical menggunakan kode (1, 2, 3), bukan label text
2. **Filter Base**: Selalu perhatikan base size setelah apply filter
3. **Missing Data**: Q2-Q11 punya missing untuk yang tidak aware (Q1=0)
4. **Multiple Response**: Q6 & Q9 pakai semicolon-delimited dengan kode (e.g., `1;2;4`)
5. **Weight**: Gunakan untuk melihat efek weighting pada hasil
6. **Code Reference**: Bookmark DATA_DICTIONARY.md untuk referensi kode!

### Duplicate & Clone Features
7. **Duplicate Table**: Use untuk A/B testing, backup sebelum modifikasi, atau compare variants
8. **Duplicate Variable**: Use untuk create variations dari custom variable dengan base logic yang sama
9. **Duplicate Code**: Use untuk build incremental logic atau test definisi yang mirip
10. **Delete Safety**: Hanya custom variables (amber dot) yang bisa didelete. Original variables (grey dot) protected!
11. **Workflow Pattern**: Duplicate → Rename → Modify → Compare. Great untuk iterative analysis!

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

Ready to test! 🎉
