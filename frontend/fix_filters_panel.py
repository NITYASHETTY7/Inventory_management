import re

with open('frontend/src/components/FiltersPanel.tsx', 'r') as f:
    content = f.read()

# Replace inner Select component with CustomSelect import
import_line = "import { Filter, ChevronDown, Calendar, Store, Tag, Box, IndianRupee } from 'lucide-react';\nimport CustomSelect from './CustomSelect';"
content = re.sub(r"import \{ Filter, ChevronDown, Calendar, Store, Tag, Box, IndianRupee \} from 'lucide-react';", import_line, content)

# Remove the internal Select function
select_func_regex = r"function Select\(\{ label, value, options, onChange, placeholder, formatLabel, groupedOptions, icon: Icon \}: \{.*?\}\) \{(?:\n.*?\n)+?    \);\n  \};\n\n  return \(\n    <div className=\"relative\" ref=\{dropdownRef\}>.*?\n    </div>\n  \);\n}\n"
content = re.sub(select_func_regex, '', content, flags=re.MULTILINE|re.DOTALL)

# Replace <Select with <CustomSelect
content = content.replace('<Select', '<CustomSelect')

with open('frontend/src/components/FiltersPanel.tsx', 'w') as f:
    f.write(content)
