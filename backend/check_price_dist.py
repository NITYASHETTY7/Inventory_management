from data_processing import load_clean_data
df = load_clean_data()
df = df[df['price'] > 0]
for brand in df['Brand'].unique():
    bdf = df[df['Brand'] == brand]
    print(f"Brand: {brand}, Min: {bdf['price'].min()}, Max: {bdf['price'].max()}")
