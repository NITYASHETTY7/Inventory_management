import pandas as pd
import numpy as np
import json
import os
from datetime import datetime

ALLOWED_BRANCHES = [
    "Anna Nagar - 1 - (Near Thirumangalam Metro Station)",
    "Hosur - 2 - (Bagalur Circle)",
    "Vadapalani - 1 - (Near Signal)",
    "Chengalpattu - 2 - (GST Road)",
    "Virudhachalam - 1 - (ARK Complex)",
    "Dindigul - 3 - (Salai Road)",
    "Ambattur - 2 - (Near Rakki Cenimas)"
]

def load_data():
    train_path = os.path.join(os.path.dirname(__file__), 'Sales_Combined.xlsx')
    df_train = pd.read_excel(train_path, header=2)
    
    # Rename columns
    df_train.columns = df_train.columns.str.strip()
    rename_cols = {}
    for c in df_train.columns:
        low = c.lower().replace('.', '').replace(' ', '')
        if low == 'date': rename_cols[c] = 'Date'
        if low in ['sumofqty', 'qty']: rename_cols[c] = 'Qty'
        if low == 'branch': rename_cols[c] = 'Branch'
        if low == 'brand': rename_cols[c] = 'Brand'
        if low == 'item/model': rename_cols[c] = 'Item/Model'
    df_train = df_train.rename(columns=rename_cols)
    
    df_train['Date'] = pd.to_datetime(df_train['Date'], dayfirst=True, errors='coerce')
    df_train = df_train.dropna(subset=['Date', 'Branch', 'Item/Model'])
    df_train['Qty'] = pd.to_numeric(df_train.get('Qty', 0), errors='coerce').fillna(0)
    
    def get_model(s):
        parts = str(s).rsplit('-', 1)
        return parts[0].strip() if len(parts)==2 else str(s).strip()
    df_train['Model'] = df_train['Item/Model'].apply(get_model)
    
    def get_brand(s):
        parts = str(s).rsplit('-', 1)
        return parts[-1].strip() if len(parts)==2 else 'Unknown'
    if 'Brand' not in df_train.columns:
        df_train['Brand'] = df_train['Item/Model'].apply(get_brand)
        
    df_train = df_train[df_train['Branch'].isin(ALLOWED_BRANCHES)]
    
    # Load Feb
    feb_path = os.path.join(os.path.dirname(__file__), 'feb_sales.xlsx')
    df_feb = pd.read_excel(feb_path, header=0)
    
    df_feb = df_feb.rename(columns={
        df_feb.columns[0]: 'Branch',
        df_feb.columns[2]: 'Item/Model',
        df_feb.columns[3]: 'Date',
        df_feb.columns[12]: 'Qty',
        df_feb.columns[16]: 'Brand'
    })
    
    df_feb = df_feb.dropna(subset=['Date', 'Branch', 'Item/Model', 'Qty'])
    df_feb['Qty'] = pd.to_numeric(df_feb['Qty'], errors='coerce').fillna(0)
    df_feb['Date'] = pd.to_datetime(df_feb['Date'], dayfirst=True, errors='coerce')
    if 'Model' not in df_feb.columns:
        df_feb['Model'] = df_feb['Item/Model'].apply(get_model)
    df_feb = df_feb[df_feb['Branch'].isin(ALLOWED_BRANCHES)]
    
    return df_train, df_feb

def tune_models(df_train, df_feb):
    results = {}
    combos = df_train.groupby(['Branch', 'Brand', 'Model']).size().reset_index()
    
    for _, row in combos.iterrows():
        branch, brand, model_name = row['Branch'], row['Brand'], row['Model']
        
        train_grp = df_train[(df_train['Branch']==branch) & (df_train['Brand']==brand) & (df_train['Model']==model_name)]
        val_grp = df_feb[(df_feb['Branch']==branch) & (df_feb['Brand']==brand) & (df_feb['Model']==model_name)]
        
        train_daily = train_grp.groupby('Date')['Qty'].sum()
        val_daily = val_grp.groupby('Date')['Qty'].sum()
        
        if len(train_daily) == 0 or len(val_daily) == 0:
            continue
            
        median_val = train_daily.median()
        mean_val = train_daily.mean()
        sma_7 = train_daily.rolling(7, min_periods=1).mean().iloc[-1]
        wma_7 = train_daily.iloc[-7:].mean()
        
        predictions = {'median_dow': median_val, 'sma': sma_7, 'wma': wma_7}
        best_model = 'sma'
        best_mae = float('inf')
        
        for name, pred_val in predictions.items():
            errors = (val_daily - pred_val).abs()
            mae = errors.mean()
            if mae < best_mae:
                best_mae = mae
                best_model = name
                
        results[f"{branch}|{brand}|{model_name}"] = {
            "best_model": best_model,
            "params": {"window": 7} if best_model in ['sma', 'wma'] else {}
        }
    return results

def main():
    print("Loading data...")
    df_train, df_feb = load_data()
    print("Tuning models...")
    tuning = tune_models(df_train, df_feb)
    
    profiles_path = os.path.join(os.path.dirname(__file__), 'store_profiles.json')
    if os.path.exists(profiles_path):
        with open(profiles_path, 'r') as f:
            profiles = json.load(f)
    else:
        profiles = {}
        
    for key, val in tuning.items():
        parts = key.split('|')
        if len(parts) != 3: continue
        branch, brand, model_name = parts
        
        if branch not in profiles:
            profiles[branch] = {}
        if brand not in profiles[branch]:
            profiles[branch][brand] = {}
        if model_name not in profiles[branch][brand]:
            profiles[branch][brand][model_name] = {}
            
        profiles[branch][brand][model_name]['best_model'] = val['best_model']
        profiles[branch][brand][model_name]['params'] = val['params']
             
    with open(profiles_path, 'w') as f:
        json.dump(profiles, f, indent=2)
    print("Finished tuning. Profiles saved.")

if __name__ == "__main__":
    main()
