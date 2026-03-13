import pandas as pd
from backend.data_processing import _extract_model, _find_data_file

path = _find_data_file()
if path.suffix.lower() == ".xlsx":
    df = pd.read_excel(path)
elif path.suffix.lower() == ".csv":
    df = pd.read_csv(path)

for r in df['Item/Model'].unique():
    if 'iphone 15' in str(r).lower():
        print(f"Original: {r} -> Mapped: {_extract_model(r)}")
