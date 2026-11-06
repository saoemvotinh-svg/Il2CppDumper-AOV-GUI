import sys

with open(r"c:\Users\hung\Desktop\REATEST\Il2CppDumper-AOV-GUI\server\bridge.cjs", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update indexing brace tracking and class boundaries
old_brace_tracking = """            // Track brace depth within class scope
            if (inClassScope) {
              for (const ch of line) {
                if (ch === '{') braceDepth++;
                else if (ch === '}') braceDepth--;
              }
              if (braceDepth <= 0 && line.includes('}')) {
                inClassScope = false;
                currentClass = null;
              }
            }"""

new_brace_tracking = """            // In C# dump files, class closing brace is at column 0 (line.startsWith('}'))
            // or when a new namespace begins. Methods and inner statements are indented by tabs.
            if (line.startsWith('}') || line.startsWith('// Namespace:')) {
              inClassScope = false;
              currentClass = null;
              lastRva = null;
              bytePos += lineByteLength;
              continue;
            }"""

if old_brace_tracking in content:
    content = content.replace(old_brace_tracking, new_brace_tracking)
    print("Updated class scope tracking")
else:
    # Try normalized CRLF/LF
    norm_content = content.replace('\r\n', '\n')
    norm_old = old_brace_tracking.replace('\r\n', '\n')
    norm_new = new_brace_tracking.replace('\r\n', '\n')
    if norm_old in norm_content:
        norm_content = norm_content.replace(norm_old, norm_new)
        content = norm_content
        print("Updated class scope tracking (normalized)")
    else:
        print("ERROR: Could not find old_brace_tracking")

# 2. Update method declaration regex and condition in indexing
old_method_check = """            // Detect method declaration: handles both dump.cs and decompiled dumpv2.cs
            if (currentClass && (braceDepth <= 1 || lastRva !== null) && trimmed.includes('(') && !trimmed.startsWith('//') && !trimmed.startsWith('[') &&
                (lastRva !== null || trimmed.endsWith(');') || trimmed.includes('{ }'))) {
              const methodMatch = trimmed.match(/(public|protected|private|internal)?\\s*(virtual|override|abstract|static)?\\s*([A-Za-z0-9_<>`\\[\\],\\s]+?)\\s+([A-Za-z0-9_<>`\\.]+)\\((.*?)\\)/);"""

new_method_check = """            // Detect method declaration: handles both dump.cs and decompiled dumpv2.cs
            if (currentClass && trimmed.includes('(') && !trimmed.startsWith('//') && !trimmed.startsWith('[') &&
                (lastRva !== null || trimmed.endsWith(');') || trimmed.includes('{ }') || trimmed.includes('{') || trimmed.endsWith(')'))) {
              const methodMatch = trimmed.match(/(public|protected|private|internal)?\\s*(virtual|override|abstract|static|unsafe|sealed|new)?\\s*([A-Za-z0-9_<>`\\[\\],\\s]+?)\\s+([A-Za-z0-9_<>`\\.]+)\\((.*?)\\)/);"""

norm_content = content.replace('\r\n', '\n')
norm_old_method = old_method_check.replace('\r\n', '\n')
norm_new_method = new_method_check.replace('\r\n', '\n')
if norm_old_method in norm_content:
    norm_content = norm_content.replace(norm_old_method, norm_new_method)
    content = norm_content
    print("Updated method detection regex")
else:
    print("ERROR: Could not find old_method_check")

# 3. Update lastRva reset so attributes like [CompilerGenerated] do not clear lastRva
old_rva_clear = """            if (!trimmed.startsWith('// RVA:')) {
              lastRva = null;
            }"""

new_rva_clear = """            // Only clear lastRva on non-empty lines that are NOT comments and NOT attributes
            if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('[')) {
              lastRva = null;
            }"""

norm_content = content.replace('\r\n', '\n')
norm_old_rva = old_rva_clear.replace('\r\n', '\n')
norm_new_rva = new_rva_clear.replace('\r\n', '\n')
if norm_old_rva in norm_content:
    norm_content = norm_content.replace(norm_old_rva, norm_new_rva)
    content = norm_content
    print("Updated lastRva reset logic")
else:
    print("ERROR: Could not find old_rva_clear")

with open(r"c:\Users\hung\Desktop\REATEST\Il2CppDumper-AOV-GUI\server\bridge.cjs", "w", encoding="utf-8") as f:
    f.write(content)
print("Saved bridge.cjs")
