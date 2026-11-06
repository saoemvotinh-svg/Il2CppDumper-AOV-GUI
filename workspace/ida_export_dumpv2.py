# -*- coding: utf-8 -*-
"""
================================================================================
       ULTIMATE IL2CPP DECOMPILER & DUMPV2 EXPORTER ENGINE FOR IDA PRO
================================================================================
Tác giả: Antigravity & saoemvotinh-svg
Mô tả:
 - Quét và phân tích toàn bộ file dump.cs & script.json từ Il2CppDumper.
 - "Chỉnh đốn" và chuẩn hóa toàn bộ tên hàm, kiểu con trỏ, struct và prototype bên trong IDA.
 - Dùng Hex-Rays Decompiler giải mã toàn bộ thân hàm (function bodies) của C#.
 - Thay thế `{ }` rỗng trong dump.cs bằng mã logic đã decompile, tạo ra dumpv2.cs hoàn chỉnh.
 - Tự động inline String Literals và dọn dẹp các tham số rác như `const MethodInfo* method`.
 - Quản lý bộ nhớ thông minh (streaming IO + auto-flush cache) không lo tràn RAM.
================================================================================
"""

import os
import re
import sys
import json
import time
import gc

import idc
import idaapi
import idautils
import ida_name
import ida_bytes
import ida_funcs
import ida_lines
import ida_typeinf
import ida_kernwin

# Kiểm tra Hex-Rays Decompiler
try:
    import ida_hexrays
    HAS_HEXRAYS = ida_hexrays.init_hexrays_plugin()
except Exception:
    HAS_HEXRAYS = False

# Lấy Base Address của Binary
try:
    import ida_nalt
    IMAGE_BASE = ida_nalt.get_imagebase()
except Exception:
    IMAGE_BASE = idaapi.get_imagebase()

def get_addr(offset):
    return IMAGE_BASE + offset

def sanitize_name(name):
    """Chuẩn hóa tên C# thành định danh C/C++ hợp lệ và rõ ràng trong IDA"""
    if not name:
        return "unnamed"
    clean = re.sub(r'[<>`\$\.\,\:\s\[\]\(\)\*]', '_', name)
    clean = re.sub(r'_+', '_', clean).strip('_')
    if clean and clean[0].isdigit():
        clean = '_' + clean
    return clean

def clean_hexrays_body(c_code, base_indent='\t', string_map=None):
    """
    Trích xuất và làm sạch phần thân hàm Hex-Rays:
    - Loại bỏ header C thừa thãi (vì dump.cs đã có chữ ký C#)
    - Loại bỏ tham số rác `const MethodInfo* method`
    - Inline chuỗi String Literals
    - Căn lề thụt dòng (indentation) chuẩn xác cho C#
    """
    lines = c_code.splitlines()
    if not lines:
        return ' { }'

    start_idx = 0
    while start_idx < len(lines) and '{' not in lines[start_idx]:
        start_idx += 1

    end_idx = len(lines) - 1
    while end_idx >= 0 and '}' not in lines[end_idx]:
        end_idx -= 1

    if start_idx >= end_idx:
        return ' { }'

    inner_lines = lines[start_idx + 1:end_idx]
    cleaned_lines = []

    for line in inner_lines:
        raw_stripped = line.rstrip()
        if not raw_stripped:
            cleaned_lines.append('')
            continue

        leading_spaces = len(line) - len(line.lstrip(' '))
        indent_level = max(0, (leading_spaces - 2) // 2)
        indent_str = base_indent + '\t' + ('\t' * indent_level)

        content = raw_stripped.lstrip(' ')

        # Dọn dẹp đối số MethodInfo thừa ở cuối các lệnh gọi hàm: `, 0LL)` hoặc `, nullptr)`
        content = re.sub(r',\s*0LL\)', ')', content)
        content = re.sub(r',\s*nullptr\)', ')', content)

        # Chuyển đổi các kiểu dữ liệu Hex-Rays thô thành kiểu dễ đọc
        content = re.sub(r'\b__int64\b', 'long', content)
        content = re.sub(r'\b_QWORD\b', 'ulong', content)
        content = re.sub(r'\b_DWORD\b', 'uint', content)
        content = re.sub(r'\b_WORD\b', 'ushort', content)
        content = re.sub(r'\b_BYTE\b', 'byte', content)
        content = re.sub(r'\bnullptr\b', 'null', content)
        content = re.sub(r'\b0LL\b', '0', content)

        # Inline chuỗi ký tự StringLiteral nếu có map
        if string_map and 'StringLiteral_' in content:
            for sl_match in re.finditer(r'\b(StringLiteral_\d+)\b', content):
                sl_name = sl_match.group(1)
                if sl_name in string_map:
                    escaped_str = string_map[sl_name].replace('"', '\\"').replace('\n', '\\n')
                    content = content.replace(sl_name, f'{sl_name} /* "{escaped_str}" */')

        cleaned_lines.append(indent_str + content)

    body_header = base_indent + '{\n' + base_indent + '\t// [Hex-Rays Decompiled Logic]\n'
    body_content = '\n'.join(cleaned_lines)
    body_footer = '\n' + base_indent + '}'
    return '\n' + body_header + body_content + body_footer

def main():
    if not HAS_HEXRAYS:
        ida_kernwin.warning("[-] Hex-Rays Decompiler chưa được kích hoạt hoặc không khả dụng trong bản IDA này!")
        return

    script_dir = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else ''
    
    # 1. Tìm file dump.cs & script.json
    dump_path = os.path.join(script_dir, 'dump.cs') if script_dir else None
    script_path = os.path.join(script_dir, 'script.json') if script_dir else None

    if not dump_path or not os.path.exists(dump_path):
        dump_path = ida_kernwin.ask_file(False, 'dump.cs', 'Chọn file dump.cs gốc từ Il2CppDumper')
    if not script_path or not os.path.exists(script_path):
        script_path = ida_kernwin.ask_file(False, 'script.json', 'Chọn file script.json từ Il2CppDumper')

    if not dump_path or not os.path.exists(dump_path):
        print("[-] Không tìm thấy file dump.cs. Hủy bỏ tác vụ.")
        return

    output_dir = os.path.dirname(dump_path)
    output_v2_path = os.path.join(output_dir, 'dumpv2.cs')

    # 2. Hộp thoại lựa chọn chế độ
    choice = ida_kernwin.ask_buttons(
        "Toàn bộ (All 320k)", 
        "Chỉ Game Logic (Nhanh)", 
        "Hủy bỏ", 
        "Chọn chế độ xuất dumpv2.cs:\n\n"
        "1. [Toàn bộ (All)]: Decompile toàn bộ 100% tất cả các hàm trong dump.cs\n"
        "2. [Chỉ Game Logic]: Chỉ decompile các Assembly gameplay (Assembly-CSharp, Project, Aov...), bỏ qua mscorlib/System/Unity engine core (Tốc độ cao hơn gấp 5 lần)\n"
    )

    if choice == -1 or choice == 0: # Cancel
        print("[-] Người dùng hủy bỏ.")
        return

    only_gameplay = (choice == 1)

    # 3. Đọc script.json để xây dựng bảng ánh xạ chuỗi & tên hàm
    string_map = {}
    method_name_map = {}
    if script_path and os.path.exists(script_path):
        print(f"[*] Đang nạp metadata từ {script_path}...")
        try:
            with open(script_path, 'rb') as f:
                sdata = json.loads(f.read().decode('utf-8'))
                
                # Nạp chuỗi String Literals
                if "ScriptString" in sdata:
                    for sidx, item in enumerate(sdata["ScriptString"], 1):
                        val = item.get("Value", "")
                        if len(val) > 80:
                            val = val[:77] + "..."
                        string_map[f"StringLiteral_{sidx}"] = val

                # Nạp tên & signature
                if "ScriptMethod" in sdata:
                    for m in sdata["ScriptMethod"]:
                        m_addr = m.get("Address", 0)
                        m_name = m.get("Name", "")
                        m_sig = m.get("Signature", "")
                        if m_addr:
                            method_name_map[m_addr] = (m_name, m_sig)
            print(f"[+] Đã nạp {len(string_map)} chuỗi và {len(method_name_map)} chữ ký hàm từ script.json!")
        except Exception as ex:
            print(f"[!] Lỗi khi đọc script.json: {ex}")

    # Danh sách các Assembly engine core cần bỏ qua nếu ở chế độ Gameplay Only
    IGNORED_CORE_ASSEMBLIES = {
        'mscorlib.dll', 'System.dll', 'System.Core.dll', 'System.Xml.dll', 
        'UnityEngine.CoreModule.dll', 'UnityEngine.dll', 'UnityEngine.UI.dll',
        'UnityEngine.UIElementsModule.dll', 'UnityEngine.IMGUIModule.dll',
        'UnityEngine.AnimationModule.dll', 'UnityEngine.PhysicsModule.dll',
        'UnityEngine.Physics2DModule.dll', 'UnityEngine.ParticleSystemModule.dll',
        'UnityEngine.AudioModule.dll', 'Unity.Collections.dll', 'Unity.Burst.dll',
        'Unity.Mathematics.dll', 'Mono.Security.dll', 'Google.Protobuf.dll'
    }

    print(f"[*] Bắt đầu xử lý {dump_path} -> {output_v2_path}...")
    ida_kernwin.show_wait_box("Đang decompile và xuất dumpv2.cs... Nhấn Cancel để dừng sớm.")

    start_time = time.time()
    total_methods = 0
    decompiled_count = 0
    failed_count = 0
    skipped_count = 0

    current_image = ""
    is_gameplay_image = True

    rva_pattern = re.compile(r'// RVA:\s*(0x[0-9A-Fa-f]+|-1)\s+Offset:')
    image_pattern = re.compile(r'// Image \d+:\s*([A-Za-z0-9_\-\.]+)\s*-')

    try:
        with open(dump_path, 'r', encoding='utf-8', errors='ignore') as infile, \
             open(output_v2_path, 'w', encoding='utf-8', errors='ignore') as outfile:

            line_idx = 0
            while True:
                line = infile.readline()
                if not line:
                    break
                line_idx += 1

                # Kiểm tra chuyển Image/Assembly
                img_match = image_pattern.search(line)
                if img_match:
                    current_image = img_match.group(1).strip()
                    if only_gameplay:
                        is_gameplay_image = (current_image not in IGNORED_CORE_ASSEMBLIES)
                    outfile.write(line)
                    continue

                # Kiểm tra dòng RVA
                rva_match = rva_pattern.search(line)
                if rva_match:
                    rva_str = rva_match.group(1)
                    sig_line = infile.readline() # Đọc dòng chữ ký hàm ngay sau đó
                    line_idx += 1

                    outfile.write(line) # Ghi dòng comment RVA

                    # Nếu không có RVA (abstract hoặc stripped -1)
                    if rva_str == '-1' or not is_gameplay_image:
                        if rva_str != '-1':
                            skipped_count += 1
                        outfile.write(sig_line)
                        continue

                    # Có RVA hợp lệ
                    total_methods += 1
                    rva = int(rva_str, 16)
                    ea = get_addr(rva)

                    # 1. Chỉnh đốn và chuẩn hóa tên hàm trong IDA
                    if rva in method_name_map:
                        raw_name, sig_decl = method_name_map[rva]
                        clean_sym = sanitize_name(raw_name)
                        # Đổi tên trong IDA database
                        idc.set_name(ea, clean_sym, idc.SN_NOWARN | idc.SN_NOCHECK)
                        # Ép kiểu prototype nếu có
                        if sig_decl:
                            try:
                                clean_sig = sig_decl.replace('&', '*')
                                pt = idc.parse_decl(clean_sig, idc.PT_SILENT)
                                if pt:
                                    idc.apply_type(ea, pt, idc.TINFO_DEFINITE)
                            except Exception:
                                pass

                    # 2. Decompile bằng Hex-Rays
                    base_indent = '\t'
                    if sig_line.startswith('\t\t'):
                        base_indent = '\t\t'
                    elif sig_line.startswith('\t'):
                        base_indent = '\t'

                    decompiled_body = None
                    try:
                        # Đảm bảo hàm tồn tại trong IDA
                        if not ida_funcs.get_func(ea):
                            ida_funcs.add_func(ea)

                        cfunc = ida_hexrays.decompile(ea)
                        if cfunc:
                            sv = cfunc.get_pseudocode()
                            raw_lines = [ida_lines.tag_remove(l.line) for l in sv]
                            c_pseudocode = "\n".join(raw_lines)
                            decompiled_body = clean_hexrays_body(c_pseudocode, base_indent=base_indent, string_map=string_map)
                            decompiled_count += 1
                        else:
                            failed_count += 1
                    except Exception as e:
                        failed_count += 1
                        decompiled_body = f"\n{base_indent}{{\n{base_indent}\t// [Hex-Rays Decompile Error: {e}]\n{base_indent}}}"

                    # 3. Ghép thân hàm vào dumpv2.cs
                    if decompiled_body and '{ }' in sig_line:
                        # Thay thế `{ }` bằng thân hàm đã decompile
                        sig_before_brace = sig_line.rsplit('{ }', 1)[0].rstrip()
                        new_sig_line = sig_before_brace + decompiled_body + '\n'
                        outfile.write(new_sig_line)
                    else:
                        outfile.write(sig_line)

                    # Quản lý bộ nhớ và cập nhật tiến trình
                    if total_methods % 200 == 0:
                        # Dọn dẹp cache Hex-Rays để tránh cạn RAM IDA
                        try:
                            ida_hexrays.clear_cached_cfuncs()
                        except Exception:
                            pass
                        gc.collect()

                        elapsed = time.time() - start_time
                        msg = f"Đã decompile {decompiled_count} / {total_methods} hàm ({failed_count} lỗi, {skipped_count} bỏ qua) - {elapsed:.1f}s"
                        print(f"[*] {msg}")

                        if ida_kernwin.user_cancelled():
                            print("[!] Người dùng bấm Cancel. Đang lưu lại các hàm đã xử lý...")
                            break
                    continue

                # Các dòng thông thường khác (Class, Field, Namespace, Enum...)
                outfile.write(line)

    finally:
        ida_kernwin.hide_wait_box()
        try:
            ida_hexrays.clear_cached_cfuncs()
        except Exception:
            pass
        gc.collect()

    elapsed_total = time.time() - start_time
    print("=" * 70)
    print(f"[+] HOÀN THÀNH XUẤT DUMPV2.CS!")
    print(f" - Tổng số hàm quét: {total_methods}")
    print(f" - Decompile thành công: {decompiled_count}")
    print(f" - Lỗi decompile: {failed_count}")
    print(f" - Bỏ qua: {skipped_count}")
    print(f" - Thời gian thực thi: {elapsed_total:.1f} giây")
    print(f" - File thành phẩm: {output_v2_path}")
    print("=" * 70)
    ida_kernwin.info(
        f"Hoàn thành xuất dumpv2.cs!\n\n"
        f"Thành công: {decompiled_count} hàm\n"
        f"Lỗi: {failed_count}\n"
        f"File lưu tại:\n{output_v2_path}"
    )

if __name__ == '__main__':
    main()
