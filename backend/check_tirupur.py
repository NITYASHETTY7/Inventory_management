from prediction_service import run_prediction
res = run_prediction(branch="Tirupur - 7 - (Mangalam Road)", brand="Apple", model=None, price_range=None, days=30, festival_multiplier=1.0)
print("Baseline:", res["model_stats"]["baseline"])
print("First 5 preds:", [p["predicted_qty"] for p in res["predicted_sales"][:5]])
