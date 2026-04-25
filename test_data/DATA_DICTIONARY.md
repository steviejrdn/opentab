# Data Dictionary - Comprehensive Survey Data

## Overview
Dataset ini berisi **500 responden** hasil survei dengan **semua variable dalam bentuk kode numerik**. Label untuk setiap kode dapat dilihat di bawah ini.

---

## File Data
- **Filename**: `comprehensive_survey_data.csv`
- **Total Respondents**: 500
- **Total Variables**: 25
- **Format**: CSV dengan encoding UTF-8
- **Note**: Semua categorical variable menggunakan kode numerik (1, 2, 3, dst.)

---

## Variable List

### 1. Respondent_ID
- **Type**: ID Unik (String)
- **Format**: R001, R002, ..., R500
- **Description**: Unique identifier untuk setiap responden

### 2. Weight
- **Type**: Numeric (continuous)
- **Range**: 0.5 - 1.5
- **Description**: Sampling weight untuk weighted analysis
- **Usage**: Gunakan sebagai Weight Column saat run crosstab

### 3. Region
- **Type**: Categorical (Single choice)
- **Codes & Labels**:
  - `1` = Jakarta
  - `2` = Bandung
  - `3` = Surabaya
  - `4` = Medan
  - `5` = Makassar

### 4. Gender
- **Type**: Categorical (Single choice)
- **Codes & Labels**:
  - `1` = Male
  - `2` = Female

### 5. Age_Group
- **Type**: Categorical (Single choice)
- **Codes & Labels**:
  - `1` = 18-24
  - `2` = 25-34
  - `3` = 35-44
  - `4` = 45-54
  - `5` = 55+

### 6. Income_Level
- **Type**: Categorical (Ordinal)
- **Codes & Labels**:
  - `1` = <2jt (Di bawah 2 juta)
  - `2` = 2-3jt
  - `3` = 3-5jt
  - `4` = 5-10jt
  - `5` = 10-20jt
  - `6` = 20jt+ (Di atas 20 juta)

### 7. Education
- **Type**: Categorical (Ordinal)
- **Codes & Labels**:
  - `1` = SMA (Sekolah Menengah Atas)
  - `2` = D3 (Diploma 3)
  - `3` = S1 (Sarjana)
  - `4` = S2 (Magister)
  - `5` = S3 (Doktor)

---

## Survey Questions

### Q1A. Brand Awareness - Brand A
- **Type**: Categorical (Binary)
- **Codes & Labels**:
  - `1` = Yes (Tahu brand A)
  - `0` = No (Tidak tahu brand A)
- **Base**: All respondents (500)
- **Distribution**: ~63% aware

### Q1B. Brand Awareness - Brand B
- **Type**: Categorical (Binary)
- **Codes & Labels**:
  - `1` = Yes (Tahu brand B)
  - `0` = No (Tidak tahu brand B)
- **Base**: All respondents (500)
- **Distribution**: ~43% aware

### Q1C. Brand Awareness - Brand C
- **Type**: Categorical (Binary)
- **Codes & Labels**:
  - `1` = Yes (Tahu brand C)
  - `0` = No (Tidak tahu brand C)
- **Base**: All respondents (500)
- **Distribution**: ~32% aware

### Q1D. Brand Awareness - Brand D
- **Type**: Categorical (Binary)
- **Codes & Labels**:
  - `1` = Yes (Tahu brand D)
  - `0` = No (Tidak tahu brand D)
- **Base**: All respondents (500)
- **Distribution**: ~21% aware

### Q1E. Brand Awareness - Brand E
- **Type**: Categorical (Binary)
- **Codes & Labels**:
  - `1` = Yes (Tahu brand E)
  - `0` = No (Tidak tahu brand E)
- **Base**: All respondents (500)
- **Distribution**: ~17% aware

### Q2. Brand Usage
- **Type**: Categorical (Single choice)
- **Codes & Labels**:
  - `1` = Light user (Pengguna ringan)
  - `2` = Medium user (Pengguna sedang)
  - `3` = Heavy user (Pengguna berat)
- **Base**: Yang aware of at least one brand (~454 respondents)
- **Filter Logic**: Hanya ditanyakan jika aware of at least one brand (Q1A=1 OR Q1B=1 OR Q1C=1 OR Q1D=1 OR Q1E=1)

### Q3. Satisfaction
- **Type**: Categorical (Scale 1-5)
- **Codes & Labels**:
  - `1` = Very Dissatisfied
  - `2` = Dissatisfied
  - `3` = Neutral
  - `4` = Satisfied
  - `5` = Very Satisfied
- **Base**: Yang aware of at least one brand (~454 respondents)

### Q4. Recommendation (Likelihood) / NPS
- **Type**: Numeric (Scale 0-10)
- **Range**: 0-10 (NPS scale)
- **Base**: Yang aware of at least one brand (~454 respondents)
- **Net Code Opportunity**:
  - Promoters: 9-10
  - Passives: 7-8
  - Detractors: 0-6

### Q5. Price Sensitivity
- **Type**: Categorical (Single choice)
- **Codes & Labels**:
  - `1` = Low (Tidak sensitif harga)
  - `2` = Medium (Cukup sensitif)
  - `3` = High (Sangat sensitif harga)
- **Base**: Yang aware of at least one brand (~454 respondents)

### Q6. Features Preferred
- **Type**: Multiple Response (semicolon-delimited)
- **Codes & Labels**:
  - `1` = Design
  - `2` = Performance
  - `3` = Durability
  - `4` = Price
- **Base**: Yang aware of at least one brand (~454 respondents)
- **Format Example**: `1;2;4` (Design + Performance + Price)

### Q7. Purchase Intent
- **Type**: Categorical (Scale 1-5)
- **Codes & Labels**:
  - `1` = Definitely will not buy
  - `2` = Probably will not buy
  - `3` = Might or might not buy
  - `4` = Probably will buy
  - `5` = Definitely will buy
- **Base**: Yang aware of at least one brand (~454 respondents)

### Q8. Spend Last Month
- **Type**: Numeric (continuous)
- **Range**: 100 - 3000 (dalam ribuan Rupiah)
- **Base**: Yang aware of at least one brand (~454 respondents)

### Q9. Channels Used
- **Type**: Multiple Response (semicolon-delimited)
- **Codes & Labels**:
  - `1` = Online
  - `2` = Retail Store
  - `3` = Social Media
  - `4` = TV
  - `5` = Word of Mouth
- **Base**: Yang aware of at least one brand (~454 respondents)
- **Format Example**: `1;3;5` (Online + Social Media + WOM)

### Q11A-D. Individual Ratings
- **Type**: Categorical (Scale 1-5)
- **Variables**:
  - `Q11A` = Product Rating
  - `Q11B` = Service Rating
  - `Q11C` = Value Rating
  - `Q11D` = Quality Rating
- **Codes & Labels** (sama untuk semua):
  - `1` = Very Poor
  - `2` = Poor
  - `3` = Average
  - `4` = Good
  - `5` = Excellent
- **Base**: Yang aware of at least one brand (~454 respondents)

### Q12. Interests / Hobbies (Spread/Delimited Test Variable)
- **Type**: Multiple Response (semicolon-delimited) - untuk testing fitur "Spread (delimited)" merge
- **Codes & Labels**:
  - `1` = Sports
  - `2` = Music
  - `3` = Travel
  - `4` = Technology
  - `5` = Food
  - `6` = Reading
- **Base**: All respondents (500)
- **Format Example**: `1;3;5` (Sports + Travel + Food)
- **Usage**: Variable ini sengaja dibuat untuk test fitur "Spread (delimited)" merge di opentab
- **Note**: Data tersedia untuk semua responden (bukan hanya yang aware)

---

## Derived Variables

### Cluster
- **Type**: Categorical (derived)
- **Codes & Labels**:
  - `1` = Premium (Heavy users dengan income tinggi)
  - `2` = Standard (Users dengan penggunaan normal)
  - `3` = Budget (Light users dengan income rendah)
  - `4` = Excluded (Non-aware respondents)
- **Base**: All respondents (500)

---

## Filter Base Summary

| Filter Condition | Base Count | % of Total |
|------------------|------------|------------|
| All respondents | 500 | 100% |
| Aware of Brand A (Q1A=1) | ~313 | ~63% |
| Aware of Brand B (Q1B=1) | ~215 | ~43% |
| Aware of Brand C (Q1C=1) | ~161 | ~32% |
| Aware of Brand D (Q1D=1) | ~106 | ~21% |
| Aware of Brand E (Q1E=1) | ~83 | ~17% |
| Aware of at least one brand | ~454 | ~91% |
| Not aware of any brand | ~46 | ~9% |
| Light Users (Q2=1) | ~114 | ~25% dari aware |
| Medium Users (Q2=2) | ~205 | ~45% dari aware |
| Heavy Users (Q2=3) | ~135 | ~30% dari aware |

---

## Code Definition Syntax Examples

### Simple Filters:
- `Region/1` = Hanya responden Jakarta
- `Gender/2` = Hanya perempuan
- `Q1A/1` = Yang aware Brand A saja
- `Q1A/1+Q1B/1` = Yang aware Brand A OR Brand B
- `Q2/1,2,3` = Semua level usage

### Range Filters:
- `Age_Group/1..2` = Usia 18-34 (kode 1 dan 2)
- `Q3/4..5` = Top 2 Box satisfaction

### Combined Filters (AND/OR):
- `Region/1.Gender/2` = Perempuan di Jakarta (AND)
- `Q3/4+Q3/5` = Top 2 Box (OR)
- `Region/1+Region/2` = Jakarta atau Bandung (OR)

### Negation:
- `!Q1A/1` = Yang tidak aware Brand A
- `!Cluster/4` = Semua kecuali excluded

### Has Any Value:
- `Q2/*` = Yang punya data usage (base aware)

---

## Mean Score Mapping Opportunities

Beberapa variable bisa di-assign mean score untuk statistik:

### Satisfaction (Q3):
| Code | Score |
|------|-------|
| 1 | 1.0 |
| 2 | 2.0 |
| 3 | 3.0 |
| 4 | 4.0 |
| 5 | 5.0 |

### Recommendation (Q4) - NPS:
- Code 0-10 → Score 0-10 (linear)

### Income_Level (ordinal):
| Code | Score |
|------|-------|
| 1 | 1.0 |
| 2 | 2.0 |
| 3 | 3.0 |
| 4 | 4.0 |
| 5 | 5.0 |
| 6 | 6.0 |

### Education (ordinal):
| Code | Score |
|------|-------|
| 1 | 1.0 |
| 2 | 2.0 |
| 3 | 3.0 |
| 4 | 4.0 |
| 5 | 5.0 |

---

## Sample Data Row

```
Respondent_ID: R001
Weight: 0.6
Region: 1 (Jakarta)
Gender: 1 (Male)
Age_Group: 3 (35-44)
Income_Level: 3 (3-5jt)
Education: 2 (D3)
Q1A: 0 (No - Not aware of Brand A)
Q1B: 0 (No - Not aware of Brand B)
Q1C: 0 (No - Not aware of Brand C)
Q1D: 1 (Yes - Aware of Brand D)
Q1E: 1 (Yes - Aware of Brand E)
Q2-Q11: (Has data - aware of at least one brand)
Q12: 1;3 (Sports + Travel)
Cluster: 2 (Standard)
```

---

## Notes for Testing

1. **Missing Data**: Variable Q2-Q11 memiliki missing data untuk responden yang tidak aware of any brand (~46 orang)
2. **Multiple Response**: Q6, Q9, dan Q12 menggunakan format semicolon-delimited dengan kode numerik
3. **Q12 untuk Spread Merge**: Q12 sengaja dibuat untuk test fitur "Spread (delimited)" merge - data tersedia untuk semua responden
4. **Correlations**: Ada korelasi sengaja antara income, usage, dan satisfaction
5. **Weight**: Gunakan kolom Weight untuk weighted crosstab
6. **Base Sizes**: Perhatikan base size saat membuat filter untuk menghindari cell count terlalu kecil
7. **All Numeric**: Semua categorical variable menggunakan kode numerik, bukan label text

---

## Changes from Previous Version

### Removed:
- **Q10 (NPS Score)**: Dihapus karena redundant dengan Q4 (Recommendation)

### Changed:
- **Q1 (Brand Awareness)**: Dari binary single column (0/1) menjadi **5 binary columns** (Q1A-Q1E) untuk merepresentasikan awareness terhadap 5 brand berbeda
  - Q1A: Brand A (~63% aware)
  - Q1B: Brand B (~43% aware)
  - Q1C: Brand C (~32% aware)
  - Q1D: Brand D (~21% aware)
  - Q1E: Brand E (~17% aware)

### Added:
- **Q12 (Interests)**: Variable multiple response baru untuk test fitur "Spread (delimited)" merge
  - Kode: 1=Sports, 2=Music, 3=Travel, 4=Technology, 5=Food, 6=Reading
  - Format: semicolon-delimited (contoh: "1;3;5")
  - Base: All respondents (500)
