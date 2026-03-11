from data_processing import get_price_ranges
from curated_msp import run_curated_msp_window
import numpy as np

def calculate_accuracy(predicted, actual):
    if actual == 0:
        return 0 if predicted == 0 else -np.inf
    return max(0, 100 - (abs(actual - predicted) / actual) * 100)

def get_accuracy_for_price_ranges(branch: str, brand: str):
    price_ranges = get_price_ranges(brand=brand)
    accuracy_map = {}

    for price_range in price_ranges:
        result = run_curated_msp_window(branch=branch, brand=brand, model=None, price_range=price_range)
        
        total_predicted = sum(d['predicted'] for d in result['daily_data'])
        total_actual = sum(d['actual'] for d in result['daily_data'])
        
        accuracy = calculate_accuracy(total_predicted, total_actual)
        accuracy_map[price_range] = accuracy if np.isfinite(accuracy) else 'N/A'

    return accuracy_map
