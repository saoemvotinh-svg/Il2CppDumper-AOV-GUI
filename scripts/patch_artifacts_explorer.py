with open(r"c:\Users\hung\Desktop\REATEST\Il2CppDumper-AOV-GUI\src\components\ArtifactsExplorer.tsx", "r", encoding="utf-8") as f:
    text = f.read()

# 1. Search Debounce & Shortcut ref
old_search_func = """  // Perform Deep Symbol Search
  const handleSearch = async (e?: React.FormEvent, overrideType?: 'all' | 'method' | 'field' | 'class' | 'body') => {
    if (e) e.preventDefault();
    if (!searchQuery.trim() || searchQuery.length < 2) return;

    const filterType = overrideType || symbolTypeFilter;
    setIsSearching(true);
    try {
      const res = await fetch(
        apiUrl(
          `/api/search-dump?query=${encodeURIComponent(searchQuery)}&type=${filterType}&limit=50&source=${activeSource}${filterType === 'body' ? '&searchBody=true' : ''}&dir=${encodeURIComponent(
            artifacts?.directory || ''
          )}`
        )
      );
      const data = await res.json();
      setSymbolResults(data.results || []);
      setTookMs(data.tookMs || null);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setIsSearching(false);
    }
  };"""

new_search_func = """  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Perform Deep Symbol Search
  const handleSearch = async (
    e?: React.FormEvent,
    overrideType?: 'all' | 'method' | 'field' | 'class' | 'body',
    overrideQuery?: string
  ) => {
    if (e) e.preventDefault();
    const q = (overrideQuery !== undefined ? overrideQuery : searchQuery).trim();
    if (!q || q.length < 2) {
      setSymbolResults([]);
      return;
    }

    const filterType = overrideType || symbolTypeFilter;
    setIsSearching(true);
    try {
      const res = await fetch(
        apiUrl(
          `/api/search-dump?query=${encodeURIComponent(q)}&type=${filterType}&limit=100&source=${activeSource}${filterType === 'body' ? '&searchBody=true' : ''}&dir=${encodeURIComponent(
            artifacts?.directory || ''
          )}`
        )
      );
      const data = await res.json();
      setSymbolResults(data.results || []);
      setTookMs(data.tookMs || null);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced search to ensure 60fps ultra-smooth typing without lag
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        handleSearch(undefined, symbolTypeFilter, searchQuery);
      } else if (searchQuery.trim().length === 0) {
        setSymbolResults([]);
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [searchQuery, symbolTypeFilter, activeSource]);

  // Desktop keyboard shortcuts: Ctrl+F to focus search, Esc to close inspector
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
      if (e.key === 'Escape' && (selectedDll || selectedClass)) {
        e.preventDefault();
        setSelectedDll(null);
        setSelectedClass(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDll, selectedClass]);"""

text = text.replace(old_search_func, new_search_func)

# 2. Attach ref to search input
text = text.replace(
    'onChange={(e) => setSearchQuery(e.target.value)}',
    'ref={searchInputRef}\n                onChange={(e) => setSearchQuery(e.target.value)}'
)

# 3. Replace Modal with Full-Screen Docked Inspector
old_modal = """      {/* FULL-SCREEN WORKSTATION MODAL: DLL ASSEMBLY & CLASS INSPECTOR */}
      {(selectedDll || selectedClass) && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 sm:p-6 backdrop-blur-sm">
          <div className="w-full max-w-7xl h-[92vh] bg-app-workspace border border-app-border rounded-lg flex flex-col overflow-hidden shadow-2xl">
            {/* Modal Top Bar */}
            <div className="px-4 py-2.5 bg-app-elevated border-b border-app-border flex items-center justify-between">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <Box className="w-4 h-4 text-accent shrink-0" />
                <span className="text-xs font-mono font-semibold uppercase tracking-wider text-ink-primary truncate">
                  Assembly Inspector: {selectedDll || selectedClass?.meta.dll || 'Symbol Explorer'}
                </span>
                {dllClasses.length > 0 && (
                  <span className="text-[11px] font-mono text-ink-muted bg-app-bg px-2 py-0.5 rounded border border-app-border shrink-0">
                    {dllClasses.length} Types
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setSelectedDll(null);
                    setSelectedClass(null);
                  }}
                  className="p-1.5 rounded text-ink-muted hover:text-ink-primary hover:bg-app-bg transition-colors cursor-pointer"
                  title="Close Inspector"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>"""

new_modal = """      {/* FULL-WINDOW DOCKED ASSEMBLY & CLASS INSPECTOR (VS Code / dnSpy desktop view) */}
      {(selectedDll || selectedClass) && (
        <div className="fixed inset-0 z-50 bg-[#121416] flex flex-col overflow-hidden select-none">
          <div className="w-full h-full bg-[#17191C] flex flex-col overflow-hidden">
            {/* Desktop Command Bar */}
            <div className="h-9 px-3 bg-[#151719] border-b border-[#2C3236] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <Box className="w-4 h-4 text-[#C49B66] shrink-0" />
                <div className="flex items-center gap-1.5 text-xs font-mono text-[#E6E8E6] truncate">
                  <span className="text-[#9FA6A2]">Assembly:</span>
                  <span className="font-semibold text-[#C49B66]">{selectedDll || selectedClass?.meta.dll || 'Symbol Explorer'}</span>
                  {selectedClass && (
                    <>
                      <span className="text-[#676E6A]">›</span>
                      <span className="text-[#9FA6A2]">Class:</span>
                      <span className="font-semibold text-[#E6E8E6]">{selectedClass.meta.name}</span>
                      <span className="text-[10px] text-[#676E6A] bg-[#121416] px-1.5 py-0.2 rounded border border-[#2C3236]">
                        TypeDef: {selectedClass.meta.typeDefIndex}
                      </span>
                    </>
                  )}
                  {dllClasses.length > 0 && (
                    <span className="text-[11px] font-mono text-[#9FA6A2] bg-[#121416] px-2 py-0.5 rounded border border-[#2C3236] shrink-0 ml-1">
                      {dllClasses.length} Types
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDll(null);
                    setSelectedClass(null);
                  }}
                  className="btn-secondary-action px-2.5 py-1 text-xs flex items-center gap-1.5 cursor-default font-mono"
                  title="Close Inspector (Esc)"
                >
                  <span>Close</span>
                  <kbd className="text-[10px] bg-[#121416] px-1 py-0.2 rounded border border-[#2C3236] text-[#676E6A]">Esc</kbd>
                  <X className="w-3.5 h-3.5 text-[#9FA6A2]" />
                </button>
              </div>
            </div>"""

text = text.replace(old_modal, new_modal)

# 4. Replace Vietnamese strings
vn_replacements = [
    ('Chưa có dumpv2.cs (Hãy chạy script xuất IDA trước)', 'dumpv2.cs not generated yet (run IDA export script first)'),
    ('Tự động map tên hàm & struct vào libil2cpp.so', 'Auto-symbolize functions & inject structures into libil2cpp.so'),
    ('HƯỚNG DẪN 3 BƯỚC MAP TÊN HÀM & STRUCT VÀO IDA PRO:', '3-STEP GUIDE TO MAP NAMES & STRUCTS IN IDA PRO:'),
    ('Mở libil2cpp.so</span> trong IDA Pro (chọn đúng ELF 64-bit hoặc 32-bit). Đợi IDA hoàn tất phân tích ban đầu (thanh trạng thái dưới đáy báo <code className="px-1 py-0.5 rounded bg-app-elevated border border-app-border text-accent">AU: idle</code>).',
     'Open libil2cpp.so</span> in IDA Pro (64-bit ARM64 ELF). Wait for initial auto-analysis to finish (bottom status bar shows <code className="px-1 py-0.5 rounded bg-app-elevated border border-app-border text-accent">AU: idle</code>).'),
    ('Nhấn tổ hợp phím <kbd className="px-1.5 py-0.5 rounded bg-app-elevated border border-app-border text-ink-primary font-bold">Alt + F7</kbd> (hoặc vào menu <code className="text-ink-primary">File -&gt; Script file...</code>).',
     'Press <kbd className="px-1.5 py-0.5 rounded bg-app-elevated border border-app-border text-ink-primary font-bold">Alt + F7</kbd> (or navigate to <code className="text-ink-primary">File -&gt; Script file...</code>).'),
    ('Chọn file <span className="text-accent font-bold">ida_ultimate_il2cpp.py</span> (Tối thượng ⭐⭐⭐) hoặc <code className="text-ink-primary">ida_with_struct_py3.py</code> trong thư mục output để nạp struct, map tên hàm, gán kiểu this và inline toàn bộ String Xrefs!',
     'Select <span className="text-accent font-bold">ida_ultimate_il2cpp.py</span> (Supreme Engine ⭐⭐⭐) or <code className="text-ink-primary">ida_with_struct_py3.py</code> in output folder to inject structures, rename methods, auto-cast this, and inline string literals.'),
    ('Để xuất toàn bộ mã logic thân hàm C# vào file <span className="text-accent font-bold">dumpv2.cs</span>, chọn file <span className="text-accent font-bold">ida_export_dumpv2.py</span>. Script sẽ tự động dùng Hex-Rays decompile toàn bộ hàm trong dump.cs, làm sạch tên hàm trong IDA và xuất dumpv2.cs hoàn chỉnh!',
     'To export all decompiled C# method bodies into <span className="text-accent font-bold">dumpv2.cs</span>, run <span className="text-accent font-bold">ida_export_dumpv2.py</span>. The script uses Hex-Rays to decompile methods from dump.cs, normalizes IDB names, and writes dumpv2.cs.'),
    ("title: 'IDA Pro Ultimate Engine (Tối thượng ⭐⭐⭐)',", "title: 'IDA Pro Ultimate Engine (Supreme ⭐⭐⭐)',"),
    ("desc: 'Đỉnh cao Decompiler: Fault-Tolerant Header Chunker, tự inline String Xrefs vào câu lệnh F5, Auto-Cast con trỏ this sang struct & lọc tham số rác MethodInfo.',",
     "desc: 'Premier Decompiler: Fault-tolerant header chunker, inline string Xrefs in Hex-Rays F5, auto-cast this to struct & strip MethodInfo params.',"),
    ("desc: 'Tự động decompile toàn bộ hàm trong dump.cs bằng IDA Hex-Rays, chuẩn hóa tên hàm trong database IDB và xuất ra file dumpv2.cs có đầy đủ thân hàm C#.',",
     "desc: 'Automatically decompiles all functions in dump.cs via Hex-Rays, normalizes IDB names, and generates dumpv2.cs with full C# method bodies.',"),
    ("title: 'IDA Pro with Structs (Khuyên dùng ⭐)',", "title: 'IDA Pro with Structs (Standard Recommended ⭐)',"),
    ("desc: 'Đọc script.json & nạp il2cpp.h vào IDA Type Engine. Tự động đổi tên toàn bộ hàm, ép kiểu tham số, gán struct và string literals.',",
     "desc: 'Parses script.json & loads il2cpp.h into IDA Type Engine. Auto-renames methods, parameter types, structs, and string literals.',"),
    ("desc: 'Đổi tên hàm và chuỗi nhanh chóng từ script.json (dành cho trường hợp không cần nạp struct C hoặc binary có định nghĩa xung đột).',",
     "desc: 'Quickly renames methods and strings from script.json without requiring C structs.',"),
    ("desc: 'Nạp cấu trúc struct từ il2cpp.h và map symbol từ script.json vào dự án Ghidra 10.x / 11.x.',",
     "desc: 'Imports struct definitions from il2cpp.h and maps symbols from script.json into Ghidra 10.x / 11.x.',"),
    ("{matched ? `Kích thước: ${formatBytes(matched.size)}` : 'Sẵn sàng trong thư mục output'}",
     "{matched ? `Size: ${formatBytes(matched.size)}` : 'Ready in output folder'}"),
    ('title="Mở thư mục chứa file"', 'title="Open enclosing folder"'),
    ('title="Tải riêng class này thành file .cs hoàn chỉnh"', 'title="Download this class as standalone .cs file"'),
]

for old, new in vn_replacements:
    text = text.replace(old, new)

with open(r"c:\Users\hung\Desktop\REATEST\Il2CppDumper-AOV-GUI\src\components\ArtifactsExplorer.tsx", "w", encoding="utf-8") as f:
    f.write(text)

print("Updated ArtifactsExplorer.tsx successfully!")
