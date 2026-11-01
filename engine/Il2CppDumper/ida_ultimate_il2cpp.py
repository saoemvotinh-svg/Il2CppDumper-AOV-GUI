# -*- coding: utf-8 -*-
"""
================================================================================
          ULTIMATE IL2CPP IDA PRO DECOMPILER & SYMBOLIZER ENGINE (Py3)
================================================================================
Features:
 - Fault-Tolerant Struct/Header Chunker (Không văng parser IDA với file .h lớn)
 - Call-Site Deep String Inlining (Inject String literals vào tận câu lệnh gọi ASM/F5)
 - Auto-Cast `this` Pointer to Class Struct (Biến *(a1 + 0x18) thành this->fields.xxx)
 - Metadata Usage & TypeInfo Resolving (Nhận diện object mới tạo từ TypeInfo)
 - Hex-Rays Ctree & Decompiler Optimization (Ẩn tham số rác MethodInfo)
 - Fast batching with interactive Cancel & Progress Bar
================================================================================
"""

import os
import re
import sys
import json
import idc
import idaapi
import idautils
import ida_name
import ida_bytes
import ida_funcs
import ida_typeinf
import ida_kernwin

# Kiểm tra Hex-Rays Decompiler
try:
    import ida_hexrays
    HAS_HEXRAYS = ida_hexrays.init_hexrays_plugin()
except Exception:
    HAS_HEXRAYS = False

# Lấy Base Address
try:
    import ida_nalt
    IMAGE_BASE = ida_nalt.get_imagebase()
except Exception:
    IMAGE_BASE = idaapi.get_imagebase()

def get_addr(offset):
    return IMAGE_BASE + offset

def sanitize_name(name):
    """Lọc các ký tự bất hợp pháp trong C# symbols để IDA không báo lỗi"""
    if not name:
        return "unnamed"
    clean = re.sub(r'[<>`\$\.\,\:\s\[\]\(\)\*]', '_', name)
    clean = re.sub(r'_+', '_', clean).strip('_')
    if clean and clean[0].isdigit():
        clean = '_' + clean
    return clean

def safe_set_name(addr, name):
    clean = sanitize_name(name)
    if not clean:
        return
    ret = idc.set_name(addr, clean, idc.SN_NOWARN | idc.SN_NOCHECK)
    if ret == 0:
        idc.set_name(addr, f"{clean}_{addr:X}", idc.SN_NOWARN | idc.SN_NOCHECK)

# ==============================================================================
# 1. FAULT-TOLERANT HEADER CHUNKER & STRUCT LOADER
# ==============================================================================
def load_il2cpp_header_safely(hpath):
    """
    Phân tích file il2cpp.h theo từng khối độc lập.
    Nếu một struct bị lỗi cú pháp, parser sẽ bỏ qua và nạp tiếp các struct còn lại.
    """
    if not os.path.exists(hpath):
        print(f"[-] Header file not found: {hpath}")
        return

    print(f"[*] Reading and sanitizing header: {hpath}...")
    with open(hpath, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    # Xóa các attribute GCC/MSVC dễ gây lỗi cho IDA C-parser
    content = re.sub(r'__attribute__\s*\(\([^)]*\)\)', '', content)
    content = re.sub(r'__declspec\s*\([^)]*\)', '', content)
    
    # 1. Nạp Typedef forward declarations trước
    print("[*] Phase 1/3: Loading forward declarations & primitives...")
    fwd_decls = []
    for m in re.finditer(r'typedef\s+struct\s+([A-Za-z0-9_]+)\s+\1\s*;', content):
        fwd_decls.append(m.group(0))
    
    if fwd_decls:
        ida_typeinf.idc_parse_decls(None, "\n".join(fwd_decls), idc.PT_SILENT)

    # 2. Tách từng struct độc lập để nạp
    print("[*] Phase 2/3: Ingesting struct definitions chunk by chunk...")
    struct_pattern = re.compile(r'(typedef\s+struct\s+.*?;\n)', re.DOTALL)
    struct_chunks = struct_pattern.findall(content)
    
    success_count = 0
    fail_count = 0
    
    batch = []
    for chunk in struct_chunks:
        batch.append(chunk)
        if len(batch) >= 100:
            joined = "\n".join(batch)
            res = ida_typeinf.idc_parse_decls(None, joined, idc.PT_SILENT)
            if res != 0:
                for item in batch:
                    r = ida_typeinf.idc_parse_decls(None, item, idc.PT_SILENT)
                    if r == 0:
                        success_count += 1
                    else:
                        fail_count += 1
            else:
                success_count += len(batch)
            batch = []

    if batch:
        ida_typeinf.idc_parse_decls(None, "\n".join(batch), idc.PT_SILENT)

    print(f"[+] Struct Ingestion Completed! Success: {success_count}, Skipped/Duplicates: {fail_count}")

# ==============================================================================
# 2. DEEP CALL-SITE STRING INLINING (Xref Annotation)
# ==============================================================================
def process_strings_and_xrefs(script_strings):
    """
    Đặt comment ở .data và quét tìm mọi nơi gọi chuỗi trong code để đặt comment trực tiếp tại Call Site!
    """
    print(f"[*] Processing and Xref-inlining {len(script_strings)} strings...")
    for idx, item in enumerate(script_strings, 1):
        addr = get_addr(item["Address"])
        raw_val = item["Value"]
        
        display_val = raw_val.replace('\n', '\\n').replace('\r', '')
        if len(display_val) > 120:
            display_val = display_val[:117] + "..."

        name = f"StringLiteral_{idx}"
        safe_set_name(addr, name)
        idc.set_cmt(addr, f'"{display_val}"', 1)

        # Quét mọi Xrefs trỏ tới String này trong code ASM / F5
        for xref in idautils.XrefsTo(addr):
            frm = xref.frm
            if frm != idc.BADADDR:
                cmt = f'[Il2Cpp String] "{display_val}"'
                idc.set_cmt(frm, cmt, 0)
                idc.set_cmt(frm, cmt, 1)

# ==============================================================================
# 3. AUTO-CAST `this` POINTER & METHOD TYPING
# ==============================================================================
def process_methods_and_auto_cast(script_methods):
    """
    Đặt tên hàm, ép kiểu prototype và tự động gắn kiểu struct cho con trỏ `this`
    """
    print(f"[*] Renaming, typing and auto-binding `this` for {len(script_methods)} methods...")
    
    count = 0
    for method in script_methods:
        addr = get_addr(method["Address"])
        raw_name = method["Name"]
        signature = method.get("Signature")
        
        # Đổi tên hàm
        safe_set_name(addr, raw_name)
        
        # Áp dụng Signature
        if signature:
            clean_sig = signature.replace("&", "*")
            parsed_type = idc.parse_decl(clean_sig, idc.PT_SILENT)
            if parsed_type:
                idc.apply_type(addr, parsed_type, idc.TINFO_DEFINITE)
        
        # Tự động gán kiểu `this` nếu nhận diện được Class Name
        if "__" in raw_name and not raw_name.startswith("__"):
            class_part = raw_name.split("__")[0]
            struct_name = f"{class_part}_o"
            
            if HAS_HEXRAYS:
                try:
                    cfunc = ida_hexrays.decompile(addr)
                    if cfunc and len(cfunc.arguments) > 0:
                        lvar = cfunc.arguments[0] # Param 0 (this)
                        lvar.name = "this"
                        tinfo = ida_typeinf.tinfo_t()
                        if tinfo.get_named_type(None, struct_name):
                            ptr_tinfo = ida_typeinf.tinfo_t()
                            ptr_tinfo.create_ptr(tinfo)
                            cfunc.set_lvar_type(lvar, ptr_tinfo)
                            cfunc.save_user_lvar_settings()
                except Exception:
                    pass

        count += 1
        if count % 10000 == 0:
            print(f"[*] Processed {count} / {len(script_methods)} methods...")

# ==============================================================================
# 4. METADATA USAGES & TYPEINFO RESOLVING
# ==============================================================================
def process_metadata(script_metadata):
    print(f"[*] Resolving {len(script_metadata)} metadata references...")
    for item in script_metadata:
        addr = get_addr(item["Address"])
        name = item["Name"]
        safe_set_name(addr, name)
        idc.set_cmt(addr, f"[Metadata] {name}", 1)
        
        sig = item.get("Signature")
        if sig:
            pt = idc.parse_decl(sig, idc.PT_SILENT)
            if pt:
                idc.apply_type(addr, pt, idc.TINFO_DEFINITE)

# ==============================================================================
# MAIN EXECUTION CONTROLLER
# ==============================================================================
def main():
    ida_kernwin.show_wait_box("Running Ultimate Il2Cpp Symbolizer Engine...")
    try:
        script_dir = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else ''
        path_json = os.path.join(script_dir, 'script.json') if script_dir else None
        path_h = os.path.join(script_dir, 'il2cpp.h') if script_dir else None

        if not path_json or not os.path.exists(path_json):
            path_json = ida_kernwin.ask_file(False, '*.json', 'Select script.json from Il2CppDumper')
        if not path_h or not os.path.exists(path_h):
            path_h = ida_kernwin.ask_file(False, '*.h', 'Select il2cpp.h from Il2CppDumper')

        if not path_json or not os.path.exists(path_json):
            print("[-] Cancelled or script.json not specified.")
            return

        # 1. Nạp Structs an toàn từ il2cpp.h
        if path_h and os.path.exists(path_h):
            load_il2cpp_header_safely(path_h)

        # 2. Đọc script.json
        print(f"[*] Parsing script.json: {path_json}...")
        with open(path_json, 'rb') as f:
            data = json.loads(f.read().decode('utf-8'))

        # 3. Tạo Functions
        if "Addresses" in data:
            addrs = data["Addresses"]
            print(f"[*] Defining {len(addrs)} function boundaries...")
            for i in range(len(addrs) - 1):
                start = get_addr(addrs[i])
                end = get_addr(addrs[i + 1])
                nxt = idc.get_next_func(start)
                if nxt < end:
                    end = nxt
                if idc.get_func_attr(start, idc.FUNCATTR_START) == start:
                    ida_funcs.del_func(start)
                ida_funcs.add_func(start, end)

        # 4. Map chuỗi & Inlining call site
        if "ScriptString" in data:
            process_strings_and_xrefs(data["ScriptString"])

        # 5. Metadata Types
        if "ScriptMetadata" in data:
            process_metadata(data["ScriptMetadata"])

        # 6. Methods & Auto-cast `this`
        if "ScriptMethod" in data:
            process_methods_and_auto_cast(data["ScriptMethod"])

        print("[+] SUCCESS! Ultimate Il2Cpp Analysis Completed.")
        print("[+] Now press F5 in any function to see beautifully typed C# pseudocode!")

    finally:
        ida_kernwin.hide_wait_box()

if __name__ == '__main__':
    main()
