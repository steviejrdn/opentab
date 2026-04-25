import random
import csv

# Set random seed for reproducibility
random.seed(42)

# Define value labels for reference
# Region: 1=Jakarta, 2=Bandung, 3=Surabaya, 4=Medan, 5=Makassar
# Gender: 1=Male, 2=Female
# Age_Group: 1=18-24, 2=25-34, 3=35-44, 4=45-54, 5=55+
# Income_Level: 1=<2jt, 2=2-3jt, 3=3-5jt, 4=5-10jt, 5=10-20jt, 6=20jt+
# Education: 1=SMA, 2=D3, 3=S1, 4=S2, 5=S3
# Q1A-E: Brand Awareness (1=Yes, 0=No) - binary columns for 5 brands
# Q2: Brand Usage (1=Light, 2=Medium, 3=Heavy)
# Q3: 1-5 (Very Dissatisfied to Very Satisfied)
# Q4: 0-10 (NPS scale)
# Q5: 1=Low, 2=Medium, 3=High
# Q6: Features (1=Design, 2=Performance, 3=Durability, 4=Price) - semicolon delimited
# Q7: 1-5 (Purchase Intent)
# Q8: Numeric (spend in thousands)
# Q9: Channels (1=Online, 2=Retail, 3=Social Media, 4=TV, 5=WOM) - semicolon delimited
# Q11A-D: 1-5 (Ratings)
# Q12: Interests (1=Sports, 2=Music, 3=Travel, 4=Technology, 5=Food, 6=Reading) - semicolon delimited (for spread merge testing)
# Cluster_Segment: 1=Premium, 2=Standard, 3=Budget, 4=Excluded

REGIONS = [1, 2, 3, 4, 5]
GENDERS = [1, 2]
AGE_GROUPS = [1, 2, 3, 4, 5]
INCOME_LEVELS = [1, 2, 3, 4, 5, 6]
EDUCATION_LEVELS = [1, 2, 3, 4, 5]
SEGMENTS = [1, 2, 3, 4]

# Brand names for reference
BRANDS = ['Q1A', 'Q1B', 'Q1C', 'Q1D', 'Q1E']

def generate_respondent(resp_id):
    """Generate a single respondent's data with numeric codes only"""
    
    # Basic demographics
    region = random.choice(REGIONS)
    gender = random.choice(GENDERS)
    age_group = random.choice(AGE_GROUPS)
    
    # Income correlated with age and education
    if age_group == 1:  # 18-24
        income = random.choices([1, 2, 3], weights=[40, 35, 25])[0]
        education = random.choices([1, 2], weights=[70, 30])[0]
    elif age_group == 2:  # 25-34
        income = random.choices([2, 3, 4, 5], weights=[15, 35, 35, 15])[0]
        education = random.choices([1, 2, 3], weights=[25, 35, 40])[0]
    elif age_group in [3, 4]:  # 35-44, 45-54
        income = random.choices([3, 4, 5, 6], weights=[25, 40, 25, 10])[0]
        education = random.choices([2, 3, 4], weights=[15, 50, 35])[0]
    else:  # 55+
        income = random.choices([3, 4, 5], weights=[30, 45, 25])[0]
        education = random.choices([1, 2, 3], weights=[40, 30, 30])[0]
    
    # Weight for weighted analysis (0.5 to 1.5)
    weight = round(random.uniform(0.5, 1.5), 1)
    
    # Q1A-E: Brand Awareness (multiple binary columns)
    # Each brand has different awareness levels
    # Brand A: 65% aware, Brand B: 45% aware, Brand C: 35% aware, Brand D: 25% aware, Brand E: 15% aware
    brand_awareness = {
        'Q1A': random.choices([1, 0], weights=[65, 35])[0],
        'Q1B': random.choices([1, 0], weights=[45, 55])[0],
        'Q1C': random.choices([1, 0], weights=[35, 65])[0],
        'Q1D': random.choices([1, 0], weights=[25, 75])[0],
        'Q1E': random.choices([1, 0], weights=[15, 85])[0]
    }
    
    # Check if aware of at least one brand (for determining if they get usage questions)
    aware_any = any(brand_awareness.values())
    
    if not aware_any:
        # Not aware of any brand - skip all usage-related questions
        segment = 4  # Excluded
        
        # Generate Q12 (Interests) for ALL respondents including non-aware
        # Q12: 1=Sports, 2=Music, 3=Travel, 4=Technology, 5=Food, 6=Reading
        interests = []
        if random.random() < 0.5:
            interests.append('1')  # Sports
        if random.random() < 0.6:
            interests.append('2')  # Music
        if random.random() < 0.4:
            interests.append('3')  # Travel
        if random.random() < 0.35:
            interests.append('4')  # Technology
        if random.random() < 0.55:
            interests.append('5')  # Food
        if random.random() < 0.25:
            interests.append('6')  # Reading
        q12_interests = ';'.join(interests) if interests else ''
        
        return {
            'Respondent_ID': f'R{resp_id:03d}',
            'Weight': weight,
            'Region': region,
            'Gender': gender,
            'Age_Group': age_group,
            'Income_Level': income,
            'Education': education,
            'Q1A': brand_awareness['Q1A'],
            'Q1B': brand_awareness['Q1B'],
            'Q1C': brand_awareness['Q1C'],
            'Q1D': brand_awareness['Q1D'],
            'Q1E': brand_awareness['Q1E'],
            'Q2': '',
            'Q3': '',
            'Q4': '',
            'Q5': '',
            'Q6': '',
            'Q7': '',
            'Q8': '',
            'Q9': '',
            'Q11A': '',
            'Q11B': '',
            'Q11C': '',
            'Q11D': '',
            'Q12': q12_interests,
            'Cluster': segment
        }
    
    # Q2: Brand Usage (correlated with income)
    if income in [1, 2]:
        q2_usage = random.choices([1, 2, 3], weights=[50, 35, 15])[0]
    elif income in [3, 4]:
        q2_usage = random.choices([1, 2, 3], weights=[25, 45, 30])[0]
    else:
        q2_usage = random.choices([1, 2, 3], weights=[15, 35, 50])[0]
    
    # Determine segment based on usage and income
    if q2_usage == 3 and income in [5, 6]:
        segment = 1  # Premium
    elif q2_usage == 1 and income in [1, 2, 3]:
        segment = 3  # Budget
    else:
        segment = 2  # Standard
    
    # Q3: Satisfaction (correlated with usage)
    if q2_usage == 1:
        q3_satisfaction = random.choices([1, 2, 3, 4, 5], weights=[10, 20, 35, 25, 10])[0]
    elif q2_usage == 2:
        q3_satisfaction = random.choices([1, 2, 3, 4, 5], weights=[5, 10, 30, 40, 15])[0]
    else:  # Heavy user
        q3_satisfaction = random.choices([1, 2, 3, 4, 5], weights=[2, 5, 20, 45, 28])[0]
    
    # Q4: Recommendation (NPS 0-10, correlated with satisfaction)
    if q3_satisfaction <= 2:
        q4_recommendation = random.randint(0, 5)
    elif q3_satisfaction == 3:
        q4_recommendation = random.randint(3, 7)
    elif q3_satisfaction == 4:
        q4_recommendation = random.randint(5, 9)
    else:
        q4_recommendation = random.randint(7, 10)
    
    # Q5: Price Sensitivity (inverse correlated with income)
    if income in [1, 2]:
        q5_price_sens = random.choices([1, 2, 3], weights=[15, 35, 50])[0]
    elif income in [3, 4]:
        q5_price_sens = random.choices([1, 2, 3], weights=[30, 45, 25])[0]
    else:
        q5_price_sens = random.choices([1, 2, 3], weights=[50, 35, 15])[0]
    
    # Q6: Features Preferred (multiple response - semicolon delimited)
    # Features: 1=Design, 2=Performance, 3=Durability, 4=Price
    features = []
    if random.random() < 0.7:
        features.append('1')
    if random.random() < 0.6:
        features.append('2')
    if random.random() < 0.5:
        features.append('3')
    if q5_price_sens >= 2 and random.random() < 0.6:
        features.append('4')
    q6_features = ';'.join(features) if features else ''
    
    # Q7: Purchase Intent (correlated with satisfaction and recommendation)
    avg_score = (q3_satisfaction + q4_recommendation/2) / 2
    if avg_score < 2:
        q7_intent = random.choices([1, 2, 3, 4, 5], weights=[40, 30, 20, 8, 2])[0]
    elif avg_score < 3:
        q7_intent = random.choices([1, 2, 3, 4, 5], weights=[15, 25, 35, 20, 5])[0]
    elif avg_score < 4:
        q7_intent = random.choices([1, 2, 3, 4, 5], weights=[5, 10, 30, 40, 15])[0]
    else:
        q7_intent = random.choices([1, 2, 3, 4, 5], weights=[2, 5, 15, 45, 33])[0]
    
    # Q8: Spend Last Month (numeric, correlated with usage and income)
    if income == 1:
        base_spend = random.randint(100, 400)
    elif income == 2:
        base_spend = random.randint(250, 600)
    elif income == 3:
        base_spend = random.randint(400, 900)
    elif income == 4:
        base_spend = random.randint(600, 1400)
    elif income == 5:
        base_spend = random.randint(1000, 2200)
    else:  # 6 = 20jt+
        base_spend = random.randint(1500, 3000)
    
    # Adjust by usage level
    spend_multiplier = {1: 0.6, 2: 1.0, 3: 1.6}[q2_usage]
    q8_spend = int(base_spend * spend_multiplier * random.uniform(0.9, 1.1))
    
    # Q9: Channels Used (multiple response - semicolon delimited)
    # Channels: 1=Online, 2=Retail Store, 3=Social Media, 4=TV, 5=Word of Mouth
    channels = []
    if random.random() < 0.8:
        channels.append('1')  # Online
    if random.random() < 0.4:
        channels.append('2')  # Retail
    if random.random() < 0.6:
        channels.append('3')  # Social Media
    if random.random() < 0.3:
        channels.append('4')  # TV
    if q4_recommendation >= 7 and random.random() < 0.5:
        channels.append('5')  # Word of Mouth
    q9_channels = ';'.join(channels) if channels else '1'  # At least online
    
    # Q11: Ratings (1-5 scale, individual ratings)
    # Correlated with satisfaction
    base_rating = q3_satisfaction
    q11a_product = max(1, min(5, base_rating + random.randint(-1, 1)))
    q11b_service = max(1, min(5, base_rating + random.randint(-1, 1)))
    q11c_value = max(1, min(5, base_rating + random.randint(-2, 1)))
    q11d_quality = max(1, min(5, base_rating + random.randint(-1, 1)))
    
    # Q12: Interests (multiple response - semicolon delimited, for spread merge testing)
    # Interests: 1=Sports, 2=Music, 3=Travel, 4=Technology, 5=Food, 6=Reading
    interests = []
    if random.random() < 0.5:
        interests.append('1')  # Sports
    if random.random() < 0.6:
        interests.append('2')  # Music
    if random.random() < 0.4:
        interests.append('3')  # Travel
    if random.random() < 0.35:
        interests.append('4')  # Technology
    if random.random() < 0.55:
        interests.append('5')  # Food
    if random.random() < 0.25:
        interests.append('6')  # Reading
    q12_interests = ';'.join(interests) if interests else ''
    
    return {
        'Respondent_ID': f'R{resp_id:03d}',
        'Weight': weight,
        'Region': region,
        'Gender': gender,
        'Age_Group': age_group,
        'Income_Level': income,
        'Education': education,
        'Q1A': brand_awareness['Q1A'],
        'Q1B': brand_awareness['Q1B'],
        'Q1C': brand_awareness['Q1C'],
        'Q1D': brand_awareness['Q1D'],
        'Q1E': brand_awareness['Q1E'],
        'Q2': q2_usage,
        'Q3': q3_satisfaction,
        'Q4': q4_recommendation,
        'Q5': q5_price_sens,
        'Q6': q6_features,
        'Q7': q7_intent,
        'Q8': q8_spend,
        'Q9': q9_channels,
        'Q11A': q11a_product,
        'Q11B': q11b_service,
        'Q11C': q11c_value,
        'Q11D': q11d_quality,
        'Q12': q12_interests,
        'Cluster': segment
    }

# Generate 500 respondents
respondents = [generate_respondent(i+1) for i in range(500)]

# Write to CSV
with open('comprehensive_survey_data.csv', 'w', newline='', encoding='utf-8') as f:
    fieldnames = [
        'Respondent_ID', 'Weight', 'Region', 'Gender', 'Age_Group', 'Income_Level', 'Education',
        'Q1A', 'Q1B', 'Q1C', 'Q1D', 'Q1E',
        'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8', 'Q9',
        'Q11A', 'Q11B', 'Q11C', 'Q11D', 'Q12', 'Cluster'
    ]
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(respondents)

print(f"Generated {len(respondents)} respondents")
print(f"Data saved to comprehensive_survey_data.csv")

# Print summary statistics
print("\n=== BRAND AWARENESS SUMMARY ===")
for brand in BRANDS:
    aware_count = sum(1 for r in respondents if r[brand] == 1)
    print(f"  {brand}: {aware_count} ({aware_count/len(respondents)*100:.1f}%)")

# Count respondents aware of at least one brand
aware_any_count = sum(1 for r in respondents if any(r[b] == 1 for b in BRANDS))
print(f"\nAware of at least one brand: {aware_any_count} ({aware_any_count/len(respondents)*100:.1f}%)")
print(f"Not aware of any brand: {len(respondents)-aware_any_count} ({(len(respondents)-aware_any_count)/len(respondents)*100:.1f}%)")

segments = {}
for r in respondents:
    seg = r['Cluster']
    segments[seg] = segments.get(seg, 0) + 1
print(f"\n=== SEGMENTS ===")
seg_labels = {1: 'Premium', 2: 'Standard', 3: 'Budget', 4: 'Excluded'}
for seg, count in sorted(segments.items()):
    print(f"  {seg_labels[seg]} ({seg}): {count} ({count/len(respondents)*100:.1f}%)")

# Q12 Interests summary
print(f"\n=== INTERESTS (Q12) SAMPLE ===")
interests_with_data = [r for r in respondents if r['Q12']]
print(f"  Respondents with interest data: {len(interests_with_data)}")
print(f"  Sample values: {[r['Q12'] for r in interests_with_data[:5]]}")
