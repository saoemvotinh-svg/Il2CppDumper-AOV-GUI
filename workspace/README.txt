THU MUC WORKSPACE MAC DINH • IL2CPPDUMPER STUDIO
=================================================
Thư mục này nằm cùng cấp với file thực thi Il2CppDumper-Studio.exe (hoặc bên trong thư mục cài đặt) để ứng dụng có thể hoạt động độc lập trên mọi máy tính:

1. File nhị phân ELF:
   - Đặt file `libil2cpp.so` vào đây.
2. File Metadata:
   - Đặt file `global-metadata.dat` vào đây.
3. Thư mục xuất dữ liệu:
   - Kết quả decompile (dump.cs, thư mục DummyDll, file il2cpp.h, script Ghidra/IDA) sẽ tự động được lưu vào thư mục `output/`.

Khi mở ứng dụng hoặc bấm "Use Workspace Defaults", hệ thống sẽ tự động quét và nạp các file này ngay lập tức.
