import pandas as pd
import numpy as np
import os
from data_processing import load_clean_data, load_actual_feb_data

ALLOWED_BRANCHES = [
    "Anna Nagar - 1 - (Near Thirumangalam Metro Station)",
    "Hosur - 2 - (Bagalur Circle)",
    "Vadapalani - 1 - (Near Signal)",
    "Chengalpattu - 2 - (GST Road)",
    "Virudhachalam - 1 - (ARK Complex)",
    "Dindigul - 3 - (Salai Road)",
    "Ambattur - 2 - (Near Rakki Cenimas)"
]

def generate_hardcoded_msp_table():
    # Load Training Data
    print("Loading historical data...")
    df_train = load_clean_data()
    df_train = df_train[df_train['Branch'].isin(ALLOWED_BRANCHES)]
    
    # Load Validation Data (Feb)
    print("Loading Feb data...")
    df_feb = load_actual_feb_data()
    df_feb = df_feb[df_feb['Branch'].isin(ALLOWED_BRANCHES)]
    
    # Combine data to create a summary of actual sales
    combined_df = pd.concat([df_train, df_feb])
    
    if combined_df.empty:
        print("No data found for the allowed branches.")
        return
        
    print("Computing table...")
    # Group by Branch, Brand, Model, Date
    summary = combined_df.groupby(['Branch', 'Brand', 'Model', 'Date'])['Qty'].sum().reset_index()
    
    # Calculate target MSP: total qty / total days in the period
    min_date = combined_df['Date'].min()
    max_date = combined_df['Date'].max()
    total_days = (max_date - min_date).days + 1
    if total_days <= 0:
        total_days = 1
        
    model_branch_total = summary.groupby(['Branch', 'Brand', 'Model'])['Qty'].sum().reset_index()
    model_branch_total['Target_Daily_MSP'] = (model_branch_total['Qty'] / total_days).round(4)
    model_branch_total.drop(columns=['Qty'], inplace=True)
    
    # Create the final table layout requested: branch, brand, date, item, Target_MSP
    final_table = pd.merge(summary, model_branch_total, on=['Branch', 'Brand', 'Model'], how='left')
    
    # Optional: ensure columns are ordered: branch, brand, date, item/model, qty, target_daily_msp
    final_table = final_table[['Branch', 'Brand', 'Date', 'Model', 'Qty', 'Target_Daily_MSP']]
    
    output_path = os.path.join(os.path.dirname(__file__), 'curated_stores_msp_targets.csv')
    final_table.to_csv(output_path, index=False)
    
    # Also create a small summary lookup table for the fast prediction model
    lookup_path = os.path.join(os.path.dirname(__file__), 'curated_stores_msp_lookup.json')
    # Use branch|brand|model as key -> target_msp
    lookup_dict = {}
    for _, row in model_branch_total.iterrows():
        key = f"{row['Branch']}|{row['Brand']}|{row['Model']}"
        lookup_dict[key] = row['Target_Daily_MSP']
        
    import json
    with open(lookup_path, 'w') as f:
        json.dump(lookup_dict, f, indent=2)
    print(f"Created target MSP table at {output_path}")

if __name__ == "__main__":
    generate_hardcoded_msp_table()
