import pandas as pd
df = pd.read_excel('backend/Sales_Combined.xlsx', header=2)
branches = df['Branch'].dropna().unique()
targets = ['redhills', 'arumbakkam', 'cuddalore', 'cuddallore', 'tirunelveli', 'coimbatore', 'sivaganga', 'tirupathur']
for t in targets:
    print(f"--- Matches for {t} ---")
    for b in branches:
        if t.lower() in str(b).lower():
            print(repr(b))
