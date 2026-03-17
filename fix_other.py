import re

# LookalikeSuggestionCard.tsx
with open("frontend/src/components/LookalikeSuggestionCard.tsx", "r") as f:
    content = f.read()

content = re.sub(
    r"rank, im_code, item_model, brand, mop, price_band, lookalike_score,",
    "rank, item_model, mop, price_band, lookalike_score,",
    content
)

with open("frontend/src/components/LookalikeSuggestionCard.tsx", "w") as f:
    f.write(content)

# LookalikePage.tsx
with open("frontend/src/pages/LookalikePage.tsx", "r") as f:
    content = f.read()

content = re.sub(
    r"import \{ LookalikScenario, ModelCatalogItem, LookalikeSuggestion, StoreProximitySuggestion, LookalikeMspResult \} from '\.\./types/lookalike_types';",
    "import { LookalikScenario, ModelCatalogItem, LookalikeSuggestion, StoreProximitySuggestion, LookalikeMspResult, LookalikeMspRequest } from '../types/lookalike_types';",
    content
)

with open("frontend/src/pages/LookalikePage.tsx", "w") as f:
    f.write(content)

# lookalike_api.ts
with open("frontend/src/services/lookalike_api.ts", "r") as f:
    content = f.read()

content = re.sub(
    r"import \{ OtbRunResult \} from '\.\./types/shuffle_otb_types'; // assuming this exists or use any\n",
    "",
    content
)

with open("frontend/src/services/lookalike_api.ts", "w") as f:
    f.write(content)

