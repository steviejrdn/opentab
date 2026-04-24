# Test Scenarios & Challenges - opentab

Dokumen ini berisi serangkaian challenge dan test scenarios untuk memastikan semua fitur opentab berfungsi dengan baik menggunakan data `comprehensive_survey_data.csv`.

**IMPORTANT**: Semua variable dalam dataset menggunakan kode NUMERIK. Lihat DATA_DICTIONARY.md untuk mapping kode ke label.

---

## Quick Reference: Code Mappings

| Variable | Code → Label |
|----------|-------------|
| Region | 1=Jakarta, 2=Bandung, 3=Surabaya, 4=Medan, 5=Makassar |
| Gender | 1=Male, 2=Female |
| Age_Group | 1=18-24, 2=25-34, 3=35-44, 4=45-54, 5=55+ |
| Income_Level | 1=<2jt, 2=2-3jt, 3=3-5jt, 4=5-10jt, 5=10-20jt, 6=20jt+ |
| Education | 1=SMA, 2=D3, 3=S1, 4=S2, 5=S3 |
| Q1 (Awareness) | 0=No, 1=Yes |
| Q2 (Usage) | 1=Light, 2=Medium, 3=Heavy |
| Q3 (Satisfaction) | 1-5 scale |
| Q5 (Price Sens) | 1=Low, 2=Medium, 3=High |
| Q6 (Features) | 1=Design, 2=Performance, 3=Durability, 4=Price |
| Q9 (Channels) | 1=Online, 2=Retail, 3=Social, 4=TV, 5=WOM |
| Cluster | 1=Premium, 2=Standard, 3=Budget, 4=Excluded |

---

## Challenge Level 1: Basic Crosstab

### 1.1 Simple One-Way Table
**Task**: Buat tabel distribusi Brand Awareness (Q1)
- **Rows**: Q1
- **Expected**: Lihat distribusi 73% aware (code 1) vs 27% not aware (code 0)
- **Verify**: Total base = 500

### 1.2 Two-Way Cross
**Task**: Crosstab Region vs Gender
- **Rows**: Region
- **Columns**: Gender
- **Expected**: Lihat distribusi gender per region (kode 1-5 vs kode 1-2)
- **Verify**: Row percentages dan column percentages

### 1.3 Three Variables
**Task**: Age Group by Region by Gender
- **Rows**: Age_Group (nested under Region)
- **Columns**: Gender
- **Expected**: Nested structure muncul dengan benar

---

## Challenge Level 2: Filters & Logic

### 2.1 Simple Filter
**Task**: Analisis Usage (Q2) hanya untuk yang aware (Q1=1)
- **Filter**: `Q1/1`
- **Rows**: Q2
- **Expected**: Base = 365 (hanya yang aware)
- **Verify**: Tidak ada missing/blank dalam hasil

### 2.2 Negation Filter
**Task**: Demographics untuk yang TIDAK aware
- **Filter**: `!Q1/1`
- **Rows**: Region
- **Expected**: Base = 135 (yang tidak aware)

### 2.3 OR Condition (Union)
**Task**: Usage untuk Jakarta (1) ATAU Bandung (2)
- **Filter**: `Region/1+Region/2`
- **Rows**: Q2
- **Expected**: Hanya respondents dari 2 kota tersebut

### 2.4 AND Condition (Intersection)
**Task**: Analisis untuk Female (2) DI JAKARTA (1) yang aware
- **Filter**: `Region/1.Gender/2.Q1/1`
- **Rows**: Q2
- **Expected**: Very specific base (intersection ketiga kondisi)

### 2.5 Range Selection
**Task**: Satisfaction Top 2 Box (codes 4 & 5)
- **Filter**: `Q3/4+Q3/5`
- **Rows**: Region
- **Expected**: Hanya yang satisfied/very satisfied

---

## Challenge Level 3: Multiple Response Variables

### 3.1 Binary Split (Merge Variables)
**Task**: Split Q6 menjadi binary columns
- **Action**: Merge Variables → Binary → Q6
- **Columns**: Pilih Q6_1, Q6_2, Q6_3, Q6_4 (Design, Performance, Durability, Price)
- **Expected**: Kolom baru dengan 0/1 untuk setiap feature

### 3.2 MR Analysis
**Task**: Analisis features preferred by segment
- **Rows**: Q6 (setelah split)
- **Columns**: Cluster
- **Expected**: Lihat feature preference per segment (1=Premium, 2=Standard, 3=Budget)

### 3.3 Channel Analysis
**Task**: Channel usage by demographics
- **Rows**: Q9 (setelah split: Q9_1=Online, Q9_2=Retail, etc.)
- **Columns**: Age_Group
- **Filter**: Q1/1 (base aware)

---

## Challenge Level 4: Weighted Analysis

### 4.1 Apply Weights
**Task**: Weighted crosstab Region vs Gender
- **Rows**: Region
- **Columns**: Gender
- **Weight Column**: Weight
- **Expected**: Weighted counts berbeda dari unweighted

### 4.2 Weighted with Filter
**Task**: Weighted satisfaction by region (aware only)
- **Rows**: Q3
- **Columns**: Region
- **Filter**: `Q1/1`
- **Weight Column**: Weight
- **Verify**: Weighted base terlihat di hasil

---

## Challenge Level 5: Net Codes & Custom Codes

### 5.1 Create Net Code (Top 2 Box)
**Task**: Buat Net Code untuk Satisfaction Top 2 Box
- **Variable**: Q3_Satisfaction
- **Net Of**: Code 4 dan 5
- **Label**: "Satisfied (T2B)"
- **Verify**: Net code muncul di variable list

### 5.2 Create Net Code (OR Logic)
**Task**: Buat Net Code untuk "Jabodetabek"
- **Variable**: Region
- **Net Of**: Jakarta + Bandung (OR)
- **Label**: "Jabodetabek"
- **Syntax**: `Region/Jakarta+Region/Bandung`

### 5.3 Create Custom Code
**Task**: Buat custom code untuk "Young Adults"
- **Variable**: Age_Group
- **Codes**: 18-24 dan 25-34
- **Label**: "Young Adults"
- **Syntax**: `Age_Group/18-24+Age_Group/25-34`

### 5.4 Nested Analysis dengan Net Codes
**Task**: Crosstab Usage by Net Satisfaction
- **Rows**: Q2_Brand_Usage
- **Columns**: Q3_Satisfaction (dengan Net Code T2B)
- **Filter**: Q1_Brand_Awareness/1

---

## Challenge Level 6: Mean Score & Statistics

### 6.1 Assign Mean Scores
**Task**: Assign mean scores ke Q3_Satisfaction
- **Variable**: Q3_Satisfaction
- **Enable**: Show Mean di variable settings
- **Scores**: 1=1, 2=2, 3=3, 4=4, 5=5

### 6.2 Mean Score by Segment
**Task**: Mean satisfaction by cluster segment
- **Rows**: Q3_Satisfaction (dengan mean scores assigned)
- **Columns**: Cluster_Segment
- **Filter**: Q1_Brand_Awareness/1
- **Expected**: Mean values muncul di tabel

### 6.3 Multiple Statistics
**Task**: Tampilkan semua statistik untuk NPS Score
- **Variable**: Q10_NPS_Score
- **Enable**: Show Mean, Std Error, Std Dev, Variance
- **Rows**: Q10_NPS_Score
- **Columns**: Region
- **Filter**: Q1_Brand_Awareness/1

### 6.4 Weighted Statistics
**Task**: Weighted mean spend by segment
- **Rows**: Q8_Spend_Last_Month
- **Columns**: Cluster_Segment
- **Weight Column**: Weight
- **Enable**: Show Mean
- **Verify**: Weighted mean berbeda dari unweighted

---

## Challenge Level 7: Complex Nesting

### 7.1 Three-Level Nesting (Rows)
**Task**: Usage by Region → Gender → Age
- **Rows**: Region → Gender (nested) → Age_Group (nested)
- **Columns**: Q2_Brand_Usage
- **Filter**: Q1_Brand_Awareness/1
- **Expected**: Hierarchical structure dengan proper indentation

### 7.2 Three-Level Nesting (Columns)
**Task**: Segment by Usage → Satisfaction → NPS
- **Rows**: Cluster_Segment
- **Columns**: Q2_Brand_Usage → Q3_Satisfaction (nested) → Q10_NPS_Score
- **Filter**: Q1_Brand_Awareness/1

### 7.3 Both Sides Nesting
**Task**: Complex nested table
- **Rows**: Region → Gender
- **Columns**: Q2_Brand_Usage → Q3_Satisfaction
- **Filter**: Q1_Brand_Awareness/1

---

## Challenge Level 8: Filter Tab Deep Dive

### 8.1 Multiple Filter Items
**Task**: Kombinasi filter kompleks menggunakan Filter Tab
- **Filter 1**: Q1_Brand_Awareness/1
- **Filter 2**: Gender/Female
- **Operator**: AND
- **Rows**: Q2_Brand_Usage
- **Columns**: Region

### 8.2 Filter dengan OR Logic
**Task**: Filter dengan OR condition
- **Filter 1**: Region/Jakarta
- **Filter 2**: Region/Bandung
- **Operator**: OR
- **Rows**: Q3_Satisfaction
- **Columns**: Gender

### 8.3 Exclusion Filter
**Task**: Exclude certain respondents
- **Filter 1**: !Cluster_Segment/Excluded
- **Rows**: Q2_Brand_Usage
- **Columns**: Age_Group
- **Expected**: Hanya 365 responden (yang aware)

---

## Challenge Level 9: Edge Cases & Error Handling

### 9.1 Empty Result
**Task**: Filter yang menghasilkan base = 0
- **Filter**: `Region/Jakarta.Gender/Female.Age_Group/55+` (kemungkinan kecil ada data)
- **Rows**: Q2_Brand_Usage
- **Expected**: Error message atau empty table dengan grace

### 9.2 Very Small Base
**Task**: Filter dengan base < 10
- **Filter**: `Region/Makassar.Gender/Female.Education/S3`
- **Rows**: Q2_Brand_Usage
- **Expected**: Warning atau very small counts

### 9.3 Invalid Code Definition
**Task**: Test invalid syntax
- **Filter**: `Region/Jakarta..Bandung` (double dot)
- **Expected**: Error message yang informatif

### 9.4 Missing Data Handling
**Task**: Analisis variable dengan banyak missing
- **Rows**: Q4_Recommendation
- **Columns**: Region
- **Filter**: (tidak ada filter - all respondents)
- **Expected**: Missing/blank dihandle dengan benar

---

## Challenge Level 10: Real-World Scenarios

### 10.1 Marketing Segmentation Report
**Task**: Comprehensive segmentation analysis
- **Rows**: Cluster
- **Columns**: Q3 (dengan T2B net code: codes 4+5)
- **Filter**: Q1/1
- **Weight Column**: Weight
- **Enable**: Show Mean untuk Q3
- **Goal**: Lihat satisfaction index per segment (1=Premium, 2=Standard, 3=Budget)

### 10.2 Channel Effectiveness Analysis
**Task**: Channel performance by demographics
- **Rows**: Q9 (split binary: 1=Online, 2=Retail, 3=Social, 4=TV, 5=WOM)
- **Columns**: Age_Group → Income_Level (nested)
- **Filter**: Q1/1
- **Goal**: Identify channel preference per demographic

### 10.3 NPS Deep Dive
**Task**: NPS breakdown analysis
- **Buat Net Codes**:
  - Promoters: Q4/9+Q4/10
  - Passives: Q4/7+Q4/8
  - Detractors: Q4/0..6
- **Rows**: Q4 (dengan net codes)
- **Columns**: Cluster
- **Filter**: Q1/1
- **Goal**: Calculate NPS score per segment

### 10.4 Purchase Funnel
**Task**: Funnel analysis
- **Awareness**: Q1/1
- **Consideration**: Q7/4+Q7/5 (net code)
- **Current Users**: Q2/2+Q2/3 (net code)
- **Buat tabel**: Funnel progression by demographics

### 10.5 Regional Comparison Report
**Task**: Regional deep dive
- **Rows**: Region
- **Columns**: Multiple metrics:
  - Q3 (mean)
  - Q4 (mean)
  - Q8 (mean)
  - Q10 (mean)
- **Filter**: Q1/1
- **Weight Column**: Weight
- **Goal**: Regional performance dashboard

---

## Challenge Level 11: Session Management

### 11.1 Save Session
**Task**: Save current work
- **Action**: Export → Save .opentab file
- **Contains**: Variables, tables, display options
- **Verify**: File tersimpan dengan benar

### 11.2 Restore Session
**Task**: Restore from saved session
- **Action**: Import .opentab file
- **Verify**: Semua tables dan variable definitions restored

### 11.3 Multiple Tables
**Task**: Manage multiple tables dalam satu session
- **Buat**: Table 1 (Demographics)
- **Buat**: Table 2 (Usage Analysis)
- **Buat**: Table 3 (Satisfaction)
- **Action**: Switch antara tables
- **Organize**: Masukkan tables ke folders

---

## Challenge Level 12: Display Options

### 12.1 Toggle Counts/Percentages
**Task**: Test display options
- **Action**: Toggle counts ON/OFF
- **Action**: Toggle column percentages ON/OFF
- **Action**: Toggle percentage sign ON/OFF
- **Verify**: Table update dengan benar

### 12.2 Decimal Places
**Task**: Test decimal precision
- **Action**: Set decimal places = 0
- **Action**: Set decimal places = 2
- **Verify**: Percentages rounded dengan benar

### 12.3 Statistical Decimal Places
**Task**: Test stat decimal places
- **Action**: Set stat decimal places = 3
- **Rows**: Variable dengan mean scores
- **Verify**: Means displayed dengan 3 decimal places

---

## Challenge Level 13: Duplicate & Clone Workflows

### 13.1 Duplicate Table - Quick Variant Testing
**Task**: Buat multiple variants dari satu table dasar
- **Step 1**: Buat table "Base Analysis" dengan Region di rows, Q3 di columns
- **Step 2**: Klik ⋮ → "duplicate" table
- **Expected**: Table "Base Analysis (copy)" muncul dengan konfigurasi identik
- **Step 3**: Modifikasi copy: ganti Q3 dengan Q4
- **Goal**: Bandingkan Satisfaction vs Recommendation tanpa rebuild dari nol

### 13.2 Duplicate Table - Filter Comparison
**Task**: Compare filtered vs unfiltered dalam satu session
- **Step 1**: Buat table "All Respondents" - Region vs Q2
- **Step 2**: Duplicate table → "Aware Only"
- **Step 3**: Apply filter Q1/1 di "Aware Only"
- **Step 4**: Compare hasil antara 2 tables
- **Goal**: Lihat impact dari filter dengan mudah

### 13.3 Duplicate Table - Weighted vs Unweighted
**Task**: Bandingkan weighted dan unweighted analysis
- **Step 1**: Buat table "Unweighted" - Region vs Gender
- **Step 2**: Duplicate → "Weighted"
- **Step 3**: Apply Weight Column = Weight di "Weighted"
- **Step 4**: Compare counts antara 2 tables
- **Goal**: Visualisasi efek weighting

---

## Challenge Level 14: Custom Variable Management

### 14.1 Create & Duplicate Custom Variable
**Task**: Buat custom variable dan clone untuk modifikasi
- **Step 1**: Go to Edit Variables
- **Step 2**: Create custom variable "YoungAdults" dengan syntax Age_Group/1+Age_Group/2
- **Step 3**: Klik ⧉ duplicate "YoungAdults" → "YoungAdults_copy"
- **Step 4**: Edit copy jadi "MidAge" dengan syntax Age_Group/3+Age_Group/4
- **Expected**: Dua custom variables dengan definisi berbeda

### 14.2 Duplicate Variable dengan Codes
**Task**: Duplicate variable yang sudah punya custom codes
- **Step 1**: Di Variable Detail Q3 (Satisfaction)
- **Step 2**: Add custom code "Top2Box" dengan syntax Q3/4+Q3/5
- **Step 3**: Back to Edit Variables, duplicate Q3 → Q3_copy
- **Expected**: Q3_copy punya semua original codes + custom "Top2Box" code

### 14.3 Variable Versioning Workflow
**Task**: Simpan versi original sebelum modifikasi
- **Step 1**: Edit Variables → Duplicate Q6 (Features) → Q6_backup
- **Step 2**: Di Q6 original, hide beberapa codes dan add net codes
- **Step 3**: Jika perlu revert, delete Q6 dan duplicate Q6_backup → Q6
- **Goal**: Safe experimentation dengan backup

### 14.4 Delete Custom Variable Cleanup
**Task**: Bersihkan custom variables yang tidak dipakai
- **Step 1**: Create test variable "TempVar" 
- **Step 2**: Verify muncul di Edit Variables list (dot amber)
- **Step 3**: Klik × delete (konfirmasi dialog muncul)
- **Expected**: Variable hilang dari list
- **Note**: Original variables (dot grey) tidak bisa didelete

---

## Challenge Level 15: Code Duplication & Modification

### 15.1 Duplicate Code - Net Code Variants
**Task**: Buat multiple net codes dari base yang sama
- **Step 1**: Di Variable Detail Q3, create net "Satisfied" = Q3/4+Q3/5
- **Step 2**: Duplicate "Satisfied" → "Satisfied_copy"
- **Step 3**: Edit label jadi "VerySatisfied" dan ubah syntax jadi Q3/5 only
- **Expected**: Dua net codes dengan base yang mirip tapi definisi berbeda

### 15.2 Duplicate Code - Incremental Logic
**Task**: Build complex codes step-by-step
- **Step 1**: Add custom code "OnlineOnly" dengan syntax Q9/1
- **Step 2**: Duplicate → "OnlinePlusRetail"
- **Step 3**: Edit syntax jadi Q9/1+Q9/2
- **Step 4**: Duplicate lagi → "AllChannels"
- **Step 5**: Edit syntax jadi Q9/1+Q9/2+Q9/3+Q9/4+Q9/5
- **Goal**: Incremental build tanpa retype dari nol

### 15.3 Code A/B Testing
**Task**: Test dua definisi code yang berbeda
- **Step 1**: Duplicate Q2 (Usage)
- **Step 2**: Di copy, duplicate code "2" (Medium) → "2_copy"
- **Step 3**: Edit "2_copy" label jadi "Med-High" dan tambahkan factor score
- **Step 4**: Buat 2 tables: satu pakai "2", satu pakai "2_copy"
- **Goal**: Compare hasil dengan definisi yang sedikit berbeda

---

## Challenge Level 16: Real-World Production Workflow

### 16.1 Standard Report Template
**Task**: Buat template report yang reusable
- **Step 1**: Buat table "Template_Demographics" dengan struktur:
  - Rows: Region, Gender (nested)
  - Cols: Q1 (Awareness)
  - Filter: None
- **Step 2**: Duplicate → "Template_Usage"
- **Step 3**: Ganti Cols jadi Q2 (Usage), tambahkan filter Q1/1
- **Step 4**: Duplicate → "Template_Satisfaction"
- **Step 5**: Ganti Cols jadi Q3 (Satisfaction)
- **Goal**: Series reports dengan konsistent structure

### 16.2 Segmentation Analysis Suite
**Task**: Analisis segment dengan multiple cuts
- **Step 1**: Create custom variable "HighValue" = Q8/1000..3000 (spend)
- **Step 2**: Duplicate → "MidValue" = Q8/500..999
- **Step 3**: Duplicate → "LowValue" = Q8/1..499
- **Step 4**: Buat 3 tables masing-masing filtered by segment variable
- **Goal**: Profile tiap segment secara detail

### 16.3 Channel Migration Analysis
**Task**: Analisis perubahan channel preference
- **Step 1**: Di Q9 (Channels), duplicate code "1" (Online) → "1_Weighted"
- **Step 2**: Edit syntax tetap Q9/1 tapi tambahkan factor untuk weighting
- **Step 3**: Buat 2 tables: raw vs weighted channel usage
- **Step 4**: Compare untuk lihat impact weighting per channel

### 16.4 Satisfaction Deep-Dive Series
**Task**: Satisfaction analysis dengan berbagai cuts
- **Step 1**: Create custom net code "T2B" (Top 2 Box) = Q3/4+Q3/5
- **Step 2**: Duplicate → "T2B_Young" (tambahkan filter Age_Group/1,2 di syntax)
- **Step 3**: Duplicate → "T2B_MidAge" (filter Age_Group/3,4)
- **Step 4**: Buat table per region, compare T2B vs T2B_Young vs T2B_MidAge
- **Goal**: Satisfaction breakdown by age group

---

## Challenge Level 17: Collaboration & Backup Patterns

### 17.1 Before-After Comparison
**Task**: Compare state sebelum dan sesudah modifikasi
- **Step 1**: Setup table complex dengan nesting, filters, weights
- **Step 2**: Duplicate table → "[BACKUP] Original Config"
- **Step 3**: Modifikasi original: tambah variables, ubah filter, etc.
- **Step 4**: Run both tables, compare results
- **Goal**: Safe experimentation dengan rollback option

### 17.2 Client Presentation Prep
**Task**: Siapkan multiple views untuk presentasi
- **Step 1**: Buat "Master_Table" dengan semua detail
- **Step 2**: Duplicate → "Executive_Summary" (simplified, key metrics only)
- **Step 3**: Duplicate → "Detail_Technical" (full nesting, all stats)
- **Step 4**: Duplicate → "Client_View" (hide sensitive variables)
- **Goal**: Multiple perspectives dari satu source

### 17.3 A/B Test Setup
**Task**: Setup untuk A/B testing analysis
- **Step 1**: Create custom variable "Group_A" dengan random/sample logic
- **Step 2**: Duplicate → "Group_B" dengan complement logic
- **Step 3**: Buat 2 tables identik, filter masing-masing dengan Group_A dan Group_B
- **Step 4**: Compare metrics antara 2 groups
- **Goal**: Controlled comparison setup

---

## Quick Verification Checklist

### Data Loading
- [ ] CSV upload works
- [ ] Variable list populated correctly
- [ ] Data types detected correctly

### Basic Crosstab
- [ ] Simple one-way table works
- [ ] Two-way cross works
- [ ] Row percentages calculate correctly
- [ ] Column percentages calculate correctly
- [ ] Total percentages calculate correctly

### Filters
- [ ] Simple filter works
- [ ] Negation filter works
- [ ] OR condition works
- [ ] AND condition works
- [ ] Multiple filters work

### Multiple Response
- [ ] Merge variables (binary) works
- [ ] Merge variables (spread) works
- [ ] MR analysis produces correct counts

### Net Codes
- [ ] Create net code works
- [ ] Net code appears in variable list
- [ ] Net code used in crosstab works

### Mean Scores
- [ ] Assign mean scores works
- [ ] Mean values appear in results
- [ ] Std Error calculated
- [ ] Std Dev calculated
- [ ] Variance calculated

### Weighting
- [ ] Apply weight column works
- [ ] Weighted counts differ from unweighted
- [ ] Weighted statistics calculated correctly

### Nesting
- [ ] Single nesting works
- [ ] Double nesting works
- [ ] Triple nesting works
- [ ] Both sides nesting works

### Display
- [ ] Toggle counts works
- [ ] Toggle percentages works
- [ ] Decimal places setting works
- [ ] Stat decimal places setting works

### Duplicate & Clone Features
- [ ] Duplicate table works (menu → duplicate)
- [ ] Duplicated table has identical config (rows, cols, filters, weight)
- [ ] Duplicate variable in Edit Variables works
- [ ] Duplicated variable copies all codes with labels and syntax
- [ ] Duplicate code in Variable Detail works
- [ ] Duplicated code preserves original syntax
- [ ] Delete custom variable works (with confirmation)
- [ ] Cannot delete original variables (safety check)

---

## Known Limitations to Test

1. **MDD files**: NOT supported (removed)
2. **DDF/DZF files**: NOT supported
3. **ZIP upload**: CSV only, no metadata
4. **Base size warnings**: Very small cells may need warning
5. **Missing data**: Blank/missing values should be handled gracefully
