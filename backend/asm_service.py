import pandas as pd
import os

ASM_FILE_PATH = os.path.join(os.path.dirname(__file__), 'ASM.xlsx')

def get_asm_data():
    if not os.path.exists(ASM_FILE_PATH):
        return []
    
    df = pd.read_excel(ASM_FILE_PATH)
    
    # We want to group stores by ASM
    # Let's return a list of ASMs, and for each, the list of branches under them.
    # We can also include other details if necessary.
    
    # Fill NaN values with empty strings to avoid JSON serialization errors
    df = df.fillna("")
    
    # Group by ASM
    asm_groups = df.groupby('ASM')
    
    result = []
    for asm_name, group in asm_groups:
        if not asm_name:
            continue
            
        branches = []
        for _, row in group.iterrows():
            branches.append({
                "short_name": row.get('Short Name', ''),
                "branch": row.get('Branch', ''),
                "sales_head": row.get('Sales head', ''),
                "state_head": row.get('State head', ''),
                "geography": row.get('Geography', ''),
                "district": row.get('District', '')
            })
            
        result.append({
            "asm": asm_name,
            "branches": branches,
            "store_count": len(branches)
        })
        
    return result
