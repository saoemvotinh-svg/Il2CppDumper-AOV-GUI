import re

with open(r"c:\Users\hung\Desktop\REATEST\Il2CppDumper-AOV-GUI\server\bridge.cjs", "r", encoding="utf-8") as f:
    raw = f.read()

# Normalize multiple blank lines: collapse 2 or more blank lines into 1
lines = raw.splitlines()
cleaned_lines = []
blank = False
for l in lines:
    is_empty = not l.strip()
    if is_empty:
        if not blank:
            cleaned_lines.append("")
            blank = True
    else:
        cleaned_lines.append(l)
        blank = False

content = "\n".join(cleaned_lines)

# 1. Patch brace tracking in getOrBuildDumpRegistry
new_brace = """            // In C# dump files, class closing brace is at column 0 (line.startsWith('}'))
            // or when a new namespace begins. Methods and inner statements are indented by tabs.
            if (line.startsWith('}') || line.startsWith('// Namespace:')) {
              inClassScope = false;
              currentClass = null;
              lastRva = null;
              bytePos += lineByteLength;
              continue;
            }"""

content = re.sub(
    r"// Track brace depth within class scope\s*if\s*\(inClassScope\)\s*\{[\s\S]*?inClassScope = false;\s*currentClass = null;\s*\}\s*\}",
    lambda m: new_brace,
    content
)
print("Applied brace tracking")

# 2. Patch method detection condition and regex
old_method_pat = r"// Detect method declaration: handles both dump\.cs and decompiled dumpv2\.cs[\s\S]*?const methodMatch = trimmed\.match\([\s\S]*?\);"
new_method_code = """// Detect method declaration: handles both dump.cs and decompiled dumpv2.cs
            if (currentClass && trimmed.includes('(') && !trimmed.startsWith('//') && !trimmed.startsWith('[') &&
                (lastRva !== null || trimmed.endsWith(');') || trimmed.includes('{ }') || trimmed.includes('{') || trimmed.endsWith(')'))) {
              const methodMatch = trimmed.match(/(public|protected|private|internal)?\\s*(virtual|override|abstract|static|unsafe|sealed|new)?\\s*([A-Za-z0-9_<>`\\[\\],\\s]+?)\\s+([A-Za-z0-9_<>`\\.]+)\\((.*?)\\)/);"""

content = re.sub(old_method_pat, lambda m: new_method_code, content)
print("Applied method detection")

# 3. Patch lastRva reset logic
old_rva_pat = r"if \(!trimmed\.startsWith\('// RVA:'\)\) \{\s*lastRva = null;\s*\}"
new_rva_code = """// Only clear lastRva on non-empty lines that are NOT comments and NOT attributes
            if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('[')) {
              lastRva = null;
            }"""
content = re.sub(old_rva_pat, lambda m: new_rva_code, content)
print("Applied lastRva reset")

# 4. Patch searchDumpSymbols and searchDumpBodies
new_search_symbols = """  async function searchDumpSymbols(dumpPath, registry, query, symbolTypeFilter = 'all', limit = 100, searchBody = false) {
    if (symbolTypeFilter === 'body' || searchBody) {
      return await searchDumpBodies(dumpPath, registry, query, limit);
    }

    const qLower = query.toLowerCase().trim();
    if (!qLower) return [];

    // Prioritized scoring: Exact match (100) > Starts-with (50) > Substring (20)
    // RVA / Offset exact match: 95
    const scoreMatch = (nameLower, rva, offset) => {
      if (nameLower === qLower) return 100;
      if (rva && rva.toLowerCase() === qLower) return 95;
      if (offset && offset.toLowerCase() === qLower) return 90;
      if (nameLower.startsWith(qLower)) return 50;
      if (rva && rva.toLowerCase().includes(qLower)) return 40;
      if (offset && offset.toLowerCase().includes(qLower)) return 35;
      if (nameLower.includes(qLower)) return 20;
      return 0;
    };

    if (symbolTypeFilter === 'class') {
      const matched = [];
      for (const c of registry.classes) {
        const score = scoreMatch(c.nameLower, null, null) || (c.namespace && c.namespace.toLowerCase().includes(qLower) ? 15 : 0);
        if (score > 0) matched.push({ item: c, score });
      }
      matched.sort((a, b) => b.score - a.score);
      return matched.slice(0, limit).map(({ item: c }) => {
        const childClasses = registry.childrenByBase.get(c.name) || [];
        return {
          symbolType: 'class',
          name: c.name,
          kind: c.kind,
          signature: `${c.access} ${c.modifier ? c.modifier + ' ' : ''}${c.kind} ${c.name}`,
          access: c.access,
          returnType: c.kind,
          parameters: [],
          paramCount: 0,
          rva: null,
          offset: null,
          enclosingClass: c.name,
          baseClass: c.baseClass,
          childClasses,
          childCount: childClasses.length,
          interfaces: c.interfaces,
          namespace: c.namespace,
          dll: c.dll,
          typeDefIndex: c.typeDefIndex,
          line: c.startLine
        };
      });
    }

    if (symbolTypeFilter === 'method') {
      const matched = [];
      if (registry.methods) {
        for (const m of registry.methods) {
          const score = scoreMatch(m.nameLower, m.rva, m.offset);
          if (score > 0) matched.push({ item: m, score });
        }
      }
      matched.sort((a, b) => b.score - a.score);
      return matched.slice(0, limit).map(({ item: m }) => {
        const childClasses = registry.childrenByBase.get(m.enclosingClass) || [];
        return { ...m, childClasses, childCount: childClasses.length };
      });
    }

    if (symbolTypeFilter === 'field') {
      const matched = [];
      if (registry.fields) {
        for (const f of registry.fields) {
          const score = scoreMatch(f.nameLower, null, f.offset);
          if (score > 0) matched.push({ item: f, score });
        }
      }
      matched.sort((a, b) => b.score - a.score);
      return matched.slice(0, limit).map(({ item: f }) => {
        const childClasses = registry.childrenByBase.get(f.enclosingClass) || [];
        return { ...f, childClasses, childCount: childClasses.length };
      });
    }

    // symbolTypeFilter === 'all': Scored across all types so methods are never starved!
    const allMatches = [];
    if (registry.methods) {
      for (const m of registry.methods) {
        const score = scoreMatch(m.nameLower, m.rva, m.offset);
        if (score > 0) allMatches.push({ item: m, type: 'method', score });
      }
    }
    if (registry.classes) {
      for (const c of registry.classes) {
        const score = scoreMatch(c.nameLower, null, null) || (c.namespace && c.namespace.toLowerCase().includes(qLower) ? 15 : 0);
        if (score > 0) allMatches.push({ item: c, type: 'class', score });
      }
    }
    if (registry.fields) {
      for (const f of registry.fields) {
        const score = scoreMatch(f.nameLower, null, f.offset);
        if (score > 0) allMatches.push({ item: f, type: 'field', score });
      }
    }

    allMatches.sort((a, b) => b.score - a.score);
    return allMatches.slice(0, limit).map(({ item, type }) => {
      if (type === 'class') {
        const childClasses = registry.childrenByBase.get(item.name) || [];
        return {
          symbolType: 'class',
          name: item.name,
          kind: item.kind,
          signature: `${item.access} ${item.modifier ? item.modifier + ' ' : ''}${item.kind} ${item.name}`,
          access: item.access,
          returnType: item.kind,
          parameters: [],
          paramCount: 0,
          rva: null,
          offset: null,
          enclosingClass: item.name,
          baseClass: item.baseClass,
          childClasses,
          childCount: childClasses.length,
          interfaces: item.interfaces,
          namespace: item.namespace,
          dll: item.dll,
          typeDefIndex: item.typeDefIndex,
          line: item.startLine
        };
      }
      const childClasses = registry.childrenByBase.get(item.enclosingClass) || [];
      return { ...item, childClasses, childCount: childClasses.length };
    });
  }"""

old_search_pat = r"async function searchDumpSymbols\(dumpPath, registry, query[\s\S]*?return results;\s*\}"
content = re.sub(old_search_pat, lambda m: new_search_symbols, content)
print("Applied searchDumpSymbols")

new_search_bodies = """  async function searchDumpBodies(dumpPath, registry, query, limit = 50) {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: fs.createReadStream(dumpPath, { encoding: 'utf8', highWaterMark: 4 * 1024 * 1024 })
    });
    const qLower = query.toLowerCase().trim();
    const results = [];
    let currentClass = null;
    let currentMethod = null;
    let lineNum = 0;

    for await (const line of rl) {
      lineNum++;
      if (line.includes('TypeDefIndex:')) {
        const m = line.match(/(class|struct|interface|enum)\s+([A-Za-z0-9_<>`]+)/);
        if (m) {
          const clsList = registry.classByName.get(m[2]);
          currentClass = (clsList && clsList.length > 0) ? clsList[0] : null;
        }
        currentMethod = null;
        continue;
      }
      const trimmed = line.trim();
      if (trimmed.includes('(') && !trimmed.startsWith('//') && !trimmed.startsWith('[') && !trimmed.includes(';')) {
        const mm = trimmed.match(/(public|protected|private|internal)?\\s*(virtual|override|abstract|static)?\\s*([A-Za-z0-9_<>`\\[\\],\\s]+?)\\s+([A-Za-z0-9_<>`\\.]+)\\((.*?)\\)/);
        if (mm) {
          currentMethod = mm[4].trim();
        }
      }

      if (trimmed.toLowerCase().includes(qLower) && !trimmed.startsWith('// Namespace:')) {
        results.push({
          symbolType: 'method-body',
          name: currentMethod ? `${currentMethod}() [Body Match]` : (currentClass?.name || 'Method Body'),
          signature: trimmed.length > 120 ? trimmed.slice(0, 117) + '...' : trimmed,
          access: 'internal',
          returnType: 'code',
          parameters: [],
          paramCount: 0,
          enclosingClass: currentClass?.name || 'Global',
          baseClass: currentClass?.baseClass || null,
          childClasses: [],
          childCount: 0,
          interfaces: currentClass?.interfaces || [],
          namespace: currentClass?.namespace || '',
          dll: currentClass?.dll || 'Unknown',
          typeDefIndex: currentClass?.typeDefIndex || 0,
          line: lineNum,
          bodySnippet: trimmed
        });
        if (results.length >= limit) {
          rl.close();
          break;
        }
      }
    }
    return results;
  }"""

old_bodies_pat = r"async function searchDumpBodies\(dumpPath, registry, query[\s\S]*?return results;\s*\}"
content = re.sub(old_bodies_pat, lambda m: new_search_bodies, content)
print("Applied searchDumpBodies")

with open(r"c:\Users\hung\Desktop\REATEST\Il2CppDumper-AOV-GUI\server\bridge.cjs", "w", encoding="utf-8") as f:
    f.write(content)

print("Saved cleaned bridge.cjs successfully!")
