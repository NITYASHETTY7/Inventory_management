from data_processing import load_clean_data
df = load_clean_data()
print("Columns:", df.columns.tolist())
if "price" in df.columns:
    print("Non-zero prices count:", (df['price'] > 0).sum())
    print(df[['Model', 'price']].head())
