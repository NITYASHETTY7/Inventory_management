import sys
sys.path.insert(0, '.')
from data_processing import load_clean_data, _extract_model
from shuffle_service import load_asm_mapping, detect_cross_asm_xmc
from closing_stock_loader import load_all_closing_stock_sheets, get_most_recent_sheet
from datetime import date
import os

sales_df = load_clean_data()
asm_mapping_df = load_asm_mapping()

path = 'CLOSING STOCK FINAL.xlsx'
if not os.path.exists(path):
    path = 'data/CLOSING STOCK FINAL.xlsx'
sheets = load_all_closing_stock_sheets(path)
_, closing_stock_df = get_most_recent_sheet(sheets, date.today())
closing_stock_df.columns = [c.lower().strip() for c in closing_stock_df.columns]

cs_models = set(closing_stock_df["item_model"].apply(_extract_model).str.strip().str.lower())
sales_models = set(sales_df["Model"].str.strip().str.lower())
overlap = cs_models & sales_models
print("cs models count:", len(cs_models))
print("sales models count:", len(sales_models))
print("overlap count:", len(overlap))
print("overlap sample:", list(overlap)[:10])

result = detect_cross_asm_xmc(sales_df, closing_stock_df, asm_mapping_df, 30)
print("opportunities:", len(result))
if result:
    print("first:", result[0])