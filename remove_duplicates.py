#!/usr/bin/env python3
"""
Remove all duplicate renameChannel functions from bot/index.js
These functions have syntax errors with escaped template literals
"""

import re

# Read the file
with open('bot/index.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Pattern to detect the duplicate function
function_start_pattern = r'^\s*async function renameChannel\(channelId, newName\) \{$'

# Find all instances
to_remove = []
i = 0
while i < len(lines):
    if re.match(function_start_pattern, lines[i]):
        start = i
        # Find the end of this function (closing brace at same indentation)
        indent_level = len(lines[i]) - len(lines[i].lstrip())
        i += 1
        brace_count = 1
        
        while i < len(lines) and brace_count > 0:
            stripped = lines[i].strip()
            if '{' in stripped:
                brace_count += stripped.count('{')
            if '}' in stripped:
                brace_count -= stripped.count('}')
            i += 1
        
        end = i
        to_remove.append((start, end))
        print(f"Found duplicate function at lines {start+1}-{end}")
    else:
        i += 1

print(f"\nTotal duplicates found: {len(to_remove)}")

# Remove from end to start to preserve line numbers
for start, end in reversed(to_remove):
    del lines[start:end]
    print(f"Removed lines {start+1}-{end}")

# Write back
with open('bot/index.js', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print(f"\n✅ Successfully removed {len(to_remove)} duplicate renameChannel functions")
print(f"Original file had {len(to_remove) * 16} extra lines (approx)")
