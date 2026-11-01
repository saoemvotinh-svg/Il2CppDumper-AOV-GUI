# Il2CppDumper-AOV-GUI • Unity & Liên Quân Mobile (AOV) Reverse Engineering Workstation

[![Release](https://img.shields.io/github/v/release/saoemvotinh-svg/Il2CppDumper-AOV-GUI?color=blue&label=Windows%20Release%20v6.8.0)](https://github.com/saoemvotinh-svg/Il2CppDumper-AOV-GUI/releases/tag/v6.8.0)
[![Platform](https://img.shields.io/badge/Platform-Windows%20x64-informational)](https://github.com/saoemvotinh-svg/Il2CppDumper-AOV-GUI)
[![Target](https://img.shields.io/badge/Target-ARM64%20%7C%20ARMv7%20%7C%20x86%20%7C%20x64-success)](https://github.com/saoemvotinh-svg/Il2CppDumper-AOV-GUI)
[![Unity IL2CPP](https://img.shields.io/badge/IL2CPP-v16%20--%20v31%20(v29%20AOV)-orange)](https://github.com/saoemvotinh-svg/Il2CppDumper-AOV-GUI)
[![Tencent XOR](https://img.shields.io/badge/Tencent%20XOR-0x69696969%20Auto--Decode-purple)](https://github.com/saoemvotinh-svg/Il2CppDumper-AOV-GUI)
[![IDA Decompiler](https://img.shields.io/badge/IDA%20Pro-Ultimate%20Engine%20Included-red)](https://github.com/saoemvotinh-svg/Il2CppDumper-AOV-GUI)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

Kho mã nguồn hợp nhất toàn diện bao gồm **C# .NET 8 Core Engine** và **React 19 Electron Desktop Workstation** chuyên dụng cho việc phân tích tĩnh (Static Analysis), trích xuất mã nguồn, phục hồi cấu trúc Type và khôi phục biểu tượng từ binary `libil2cpp.so` và `global-metadata.dat` của game Unity IL2CPP — đặc biệt tối ưu cho các game được bảo vệ bởi Tencent / Garena như **Liên Quân Mobile (Arena of Valor - AOV)**.

---

## 📑 Mục lục
1. [Tính năng nổi bật (Key Features)](#-tính-năng-nổi-bật-key-features)
2. [Tải về bản cài đặt (Quick Download v6.8.0)](#-tải-về-bản-cài-đặt-quick-download-v680)
3. [Cấu trúc thư mục dự án](#-cấu-trúc-thư-mục-dự-án-unified-structure)
4. [Hướng dẫn sử dụng chi tiết](#-hướng-dẫn-sử-dụng-chi-tiết)
   - [Quy trình 1: Phân tích & Decompile thông thường](#quy-trình-1-phân-tích--decompile-thông-thường)
   - [Quy trình 2: Khôi phục Header Metadata bằng Tab "Fix Metadata"](#quy-trình-2-khôi-phục-header-metadata-bằng-tab-fix-metadata)
   - [Quy trình 3: Map Tên Hàm & Struct vào IDA Pro (Khuyên dùng Tối thượng ⭐⭐⭐)](#quy-trình-3-map-tên-hàm--struct-vào-ida-pro-khuyên-dùng-tối-thượng-)
5. [So sánh chất lượng Decompile trong IDA Pro](#-so-sánh-chất-lượng-decompile-trong-ida-pro)
6. [Hướng dẫn biên dịch từ Source (Build from Source)](#-hướng-dẫn-biên-dịch-từ-source-build-from-source)
7. [Tuyên bố miễn trừ trách nhiệm (Disclaimer)](#-tuyên-bố-miễn-trừ-trách-nhiệm-disclaimer)

---

## 🌟 Tính năng nổi bật (Key Features)

### 1. 🛡️ Tự động giải mã Tencent XOR 0x69696969 (AOV De-obfuscation)
- Tự động nhận diện và giải mã các chuỗi và trường dữ liệu bị mã hóa XOR bởi cơ chế bảo vệ của Tencent / Garena trong các phiên bản Unity v29/v24.
- Tự động phân loại phương thức bị stripped RVA `-1` và tái tạo chữ ký hàm chuẩn.

### 2. 🛠️ Tab chuyên dụng "Fix Metadata" (Header Recovery & EA → FA Auto-Patch)
- **Tự động quét Memory Dump:** Quét siêu tốc trong các file dump bộ nhớ (`*.bin`, `*.dat`, Frida memory dump) để tìm cấu trúc `Il2CppGlobalMetadataHeader` nguyên vẹn (nhận diện cả bản thông thường và Version 29).
- **Vá Magic Tencent EA → FA:** Tự động phát hiện magic Tencent `0xEAB11BAF` (`af 1b b1 ea`) và vá thành magic Unity chuẩn `0xFAB11BAF` (`af 1b b1 fa`) cho Version 29 (mặc định tích sẵn).
- **Đường dẫn chuẩn hóa thông minh:** 
  - File gốc mặc định trỏ vào `workspace\Managed\global-metadata.dat`.
  - File đã sửa tự động xuất ra `workspace\global-metadata-fixed.dat`.
  - Nút **"Chọn Thư Mục..."** thông minh: Chỉ cần chọn một thư mục bất kỳ, công cụ sẽ tự động thêm `\global-metadata-fixed.dat` vào phía sau.
  - Tự động gán file sau khi fix làm Active Metadata cho Workspace để bấm sang tab Pipeline là decompile được ngay.

### 3. 🔍 Deep Symbol Query & Assembly Inspector (dump.cs AST)
- **Tra cứu 1.7M dòng trong vài mili-giây:** Tìm kiếm Methods, Fields, Classes với đầy đủ thông tin:
  - Tên hàm, số lượng tham số, kiểu tham số, kiểu trả về.
  - Địa chỉ RVA, File Offset trong `libil2cpp.so`, Memory Offset (`0x18`, `0x20`), Access Modifiers.
- **Phân tích quan hệ kế thừa:**
  - Class cha (Base class), các Class con dẫn xuất (Subclasses / Derived classes), Interfaces cài đặt, Namespace và DLL sở tại.
- **Trình duyệt DLL Assemblies (88+ DLLs):**
  - Mở trực tiếp từng DLL xuất xứ để duyệt danh sách Classes, xem Methods, Fields và mã C# giả lập mà không cần mở phần mềm ngoài.
- **Universal Text Selection:** Cho phép bôi đen chọn văn bản và bấm copy nhanh mọi loại địa chỉ, tên hàm, chữ ký ở mọi vị trí trên giao diện.

### 4. 💻 Bộ Script Map Tối Thượng cho IDA Pro & Ghidra
- **`ida_ultimate_il2cpp.py` (Khuyên dùng tối thượng ⭐⭐⭐ cho IDA Pro 7.x, 8.x, 9.x):**
  - **Fault-Tolerant Header Chunker:** Phân tích `il2cpp.h` theo từng block độc lập với cơ chế tự phục hồi lỗi cú pháp. Không bao giờ làm văng IDA khi nạp header khổng lồ 100MB+.
  - **Deep Call-Site String Inlining:** Quét toàn bộ Xrefs trỏ tới String literal và chèn comment trực tiếp vào từng dòng lệnh gọi trong code ASM và cửa sổ F5 Decompile.
  - **Auto-Cast `this` & Field Resolver:** Tự động nhận diện và gán kiểu Struct cho con trỏ `this` (param 0), biến các lệnh offset thô `*(a1 + 0x18)` thành mã giả C# sạch sẽ `this->fields.m_isVisible`.
  - **Metadata TypeInfo Resolver & Clean CTree:** Tự động giải mã TypeInfo cho các đối tượng mới tạo và lọc dọn tham số rác `const MethodInfo* method`.
- **`ida_with_struct_py3.py` (Tiêu chuẩn ⭐):**
  - Đọc trực tiếp `script.json` và nạp toàn bộ cấu trúc C struct từ `il2cpp.h` vào IDA Type Engine.
  - Tự động nhận diện file `script.json` và `il2cpp.h` ở cùng thư mục, không hiện popup hỏi file.
- **`ida_py3.py`:** Script IDA cơ bản giúp đổi tên hàm và chuỗi nhanh chóng khi không cần nạp struct C.
- **`ghidra_with_struct.py` & `ghidra.py`:** Bộ script nạp struct và symbol vào Ghidra 10.x / 11.x.
- **Tự động sao chép:** Toàn bộ các script trên được tự động sao chép vào thư mục output ngay khi decompile xong.

### 5. 🖥️ Giao diện Modern Industrial Workstation & Workspace Portable
- Giao diện tối kỹ thuật cao cấp, phân chia thành 3 Tab chức năng rõ ràng:
  1. `>_ Execution Pipeline`: Điều khiển decompile, cấu hình nâng cao và xem log thời gian thực (SSE).
  2. `Artifact Explorer`: Tra cứu symbol sâu, xem DLL assemblies, lấy script IDA Pro / Ghidra.
  3. `Fix Metadata`: Khôi phục header metadata từ file dump memory.
- **Workspace Portable:** Thư mục `workspace/` nằm cùng cấp với file thực thi `.exe`, dễ dàng sao chép cả thư mục mang sang thiết bị khác sử dụng mà không cần cấu hình lại.

---

## 🚀 Tải về bản cài đặt (Quick Download v6.8.0)

Người dùng không cần cài đặt môi trường lập trình có thể tải trực tiếp bản đóng gói sẵn chính thức:

| Phiên bản | Định dạng | Tải về trực tiếp | Ghi chú |
| :--- | :--- | :--- | :--- |
| **Windows Setup** | `.exe` (Installer) | 👉 **[Il2CppDumper-Studio.Setup.6.8.0.exe](https://github.com/saoemvotinh-svg/Il2CppDumper-AOV-GUI/releases/download/v6.8.0/Il2CppDumper-Studio.Setup.6.8.0.exe)** | Bản cài đặt Windows chuẩn (Khuyên dùng ⭐) |
| **Windows Portable** | `.exe` (Standalone) | 👉 **[Il2CppDumper-Studio.6.8.0.exe](https://github.com/saoemvotinh-svg/Il2CppDumper-AOV-GUI/releases/download/v6.8.0/Il2CppDumper-Studio.6.8.0.exe)** | Chạy ngay không cần cài đặt |

> Xem toàn bộ changelog và file đính kèm tại: [Trang GitHub Releases v6.8.0](https://github.com/saoemvotinh-svg/Il2CppDumper-AOV-GUI/releases/tag/v6.8.0)

---

## 📂 Cấu trúc thư mục dự án (Unified Structure)

```text
Il2CppDumper-AOV-GUI/
├── engine/                   # Toàn bộ mã nguồn C# .NET 8 Core Engine
│   ├── Il2CppDumper.sln      # Solution .NET 8 / Visual Studio
│   └── Il2CppDumper/         # Mã nguồn chính của dumper
│       ├── Il2Cpp/           # Thuật toán phân tích metadata & Tencent XOR Decryption
│       ├── Outputs/          # Bộ xuất dump.cs, dummy DLLs, script Ghidra/IDA
│       ├── ida_ultimate_il2cpp.py # Script map IDA Pro tối thượng (Fault-Tolerant, String Inlining, Auto-Cast this)
│       ├── ida_with_struct_py3.py # Script map IDA Pro tiêu chuẩn
│       ├── ida_py3.py        # Script IDA Pro cơ bản
│       ├── ghidra_with_struct.py  # Script Ghidra nạp struct
│       └── bin/Release/net8.0/    # File thực thi Il2CppDumper.exe đã biên dịch
│
├── workspace/                # Thư mục làm việc mặc định (nằm cùng file .exe)
│   ├── libil2cpp.so          # File binary ELF cần phân tích
│   ├── global-metadata.dat   # File metadata đang kích hoạt
│   ├── Managed/              # Thư mục chứa metadata gốc cần sửa
│   │   └── global-metadata.dat
│   └── output/               # Kết quả xuất ra (dump.cs, DummyDll/, script IDA)
│
├── src/                      # Frontend React 19 + TypeScript + Tailwind CSS
│   ├── components/
│   │   ├── Header.tsx        # Navigation Bar & Chuyển đổi 3 Tab
│   │   ├── BinaryDropzone.tsx # Khu vực nạp file ELF, Metadata & Output
│   │   ├── EngineConfig.tsx  # Cấu hình tính năng decompile
│   │   ├── TerminalView.tsx  # Khung console log thời gian thực (SSE)
│   │   ├── ArtifactsExplorer.tsx # Trình tra cứu symbol sâu & duyệt DLL
│   │   └── MetadataFixer.tsx # Tab sửa Header Metadata (EA -> FA)
│   ├── types/                # TypeScript interface định nghĩa dữ liệu
│   └── App.tsx               # Root component điều phối ứng dụng
│
├── electron/                 # Desktop Application Wrapper (Electron v45)
│   ├── main.cjs              # Electron Main Process & File Dialogs
│   └── preload.cjs           # Context Bridge an toàn
│
├── server/                   # Express HTTP & Real-time SSE Bridge Server
│   └── bridge.cjs            # Điều phối engine C#, streaming log, tìm kiếm AST
│
├── release/                  # Thư mục thành phẩm đóng gói Windows
│   ├── win-unpacked/         # Bản chạy trực tiếp portable (Il2CppDumper-Studio.exe)
│   ├── Il2CppDumper-Studio Setup 6.8.0.exe # Bộ cài đặt Windows Installer
│   └── Il2CppDumper-Studio 6.8.0.exe       # Bản chạy trực tiếp Portable
│
├── build.bat                 # Script 1-click build toàn bộ (Engine + GUI + EXE)
├── launch.bat                # Script 1-click mở nhanh ứng dụng Desktop
└── package.json              # Quản lý script và dependency dự án
```

---

## 📖 Hướng dẫn sử dụng chi tiết

### Quy trình 1: Phân tích & Decompile thông thường

1. **Chuẩn bị file:**
   - Copy file `libil2cpp.so` (từ APK/AAB: thư mục `lib/arm64-v8a/` hoặc `lib/armeabi-v7a/`).
   - Copy file `global-metadata.dat` (từ thư mục `assets/bin/Data/Managed/Metadata/`).
   - Đặt cả 2 file vào thư mục `workspace/` (hoặc chọn file trực tiếp trên giao diện bằng nút **"Select File"**).
2. **Khởi chạy ứng dụng:**
   - Mở ứng dụng **Il2CppDumper-Studio**.
   - Kiểm tra các tùy chọn tái tạo (Dump Method, Dump Field, Generate Dummy DLL, Generate Structs).
   - Bấm nút **"🚀 START DECOMPILE PIPELINE"**.
3. **Theo dõi tiến trình:**
   - Cửa sổ terminal hiển thị trực tiếp tiến trình giải mã Tencent XOR, khôi phục string literals và nạp metadata.
4. **Xem kết quả:**
   - Khi hoàn tất, bấm nút **"Open Destination Folder"** để xem thư mục `output/` chứa `dump.cs`, thư mục `DummyDll/` và các script ánh xạ IDA Pro / Ghidra.

---

### Quy trình 2: Khôi phục Header Metadata bằng Tab "Fix Metadata"

Áp dụng khi file `global-metadata.dat` trên đĩa bị mã hóa hoặc xóa header (game Tencent / Garena v29):

1. **Chuẩn bị file:**
   - File memory dump bộ nhớ (`com.garena.game.kgvn-...bin` hoặc `*.dat` lấy từ Frida / Game Guardian / memory dumper).
   - File `global-metadata.dat` gốc trên đĩa (đặt vào `workspace\Managed\global-metadata.dat`).
2. **Thao tác trên giao diện:**
   - Chuyển sang tab **"Fix Metadata"** trên thanh menu trên cùng.
   - Chọn file memory dump ở **Mục 1**. Công cụ sẽ **tự động quét** và phát hiện vị trí header hợp lệ (ví dụ offset `0x1e3800`, Version 29).
   - Kiểm tra ô tích **"Tự động sửa magic Tencent EA → FA cho Version 29"** (đã được tích sẵn mặc định).
   - Mục 3 đã mặc định lưu tại `workspace\global-metadata-fixed.dat` (hoặc bấm **"Chọn Thư Mục..."** để chọn thư mục khác).
   - Bấm nút **"⚡ FIX & REPLACE METADATA HEADER"**.
3. **Hoàn tất:**
   - Công cụ sẽ thay thế 256 bytes đầu bằng header chuẩn và so sánh trực quan mã Hex.
   - Bấm nút **"Chuyển sang Tab Pipeline để Decompile ngay 🚀"** để tiến hành decompile với file metadata đã fix!

---

### Quy trình 3: Map Tên Hàm & Struct vào IDA Pro (Khuyên dùng Tối thượng ⭐⭐⭐)

Sau khi decompile xong, để `libil2cpp.so` trong IDA Pro hiển thị đầy đủ tên hàm, kiểu tham số, con trỏ và struct C#:

1. **Mở file `libil2cpp.so` trong IDA Pro** (chọn đúng bản IDA 64-bit hoặc 32-bit tương ứng với file binary).
2. **Chờ IDA hoàn tất phân tích ban đầu** (nhìn góc dưới cùng bên trái màn hình IDA hiển thị trạng thái `AU: idle`).
3. **Nhấn tổ hợp phím `Alt + F7`** (hoặc vào menu `File` -> `Script file...`).
4. **Chọn file `ida_ultimate_il2cpp.py` (Tối thượng ⭐⭐⭐)** trong thư mục output (bạn có thể bấm nút **"Copy Script Path"** trong tab Artifact Explorer của Studio để dán đường dẫn).
5. **Xem kết quả:**
   - Script tự động tìm `script.json` và `il2cpp.h` cùng thư mục mà không cần popup chọn file.
   - Console IDA sẽ in log tiến trình:
     ```text
     [Il2CppDumper] Loading symbol data from: ...\script.json
     [Il2CppDumper] Parsing structs from: ...\il2cpp.h
     [Il2CppDumper] Ingesting struct definitions chunk by chunk...
     [Il2CppDumper] Processing and Xref-inlining 38920 strings...
     [Il2CppDumper] Renaming, typing and auto-binding `this` for 45210 methods...
     [Il2CppDumper] Done mapping 45210 methods!
     ```
   - Toàn bộ hàm, chuỗi ký tự và kiểu dữ liệu trong IDA sẽ được đổi tên và gán struct chính xác 100%!

---

## ⚡ So sánh chất lượng Decompile trong IDA Pro

| Tiêu chí | `ida_with_struct_py3.py` (Tiêu chuẩn) | `ida_ultimate_il2cpp.py` (Tối thượng ⭐⭐⭐) |
| :--- | :---: | :---: |
| **Đổi tên hàm (Method Renaming)** | ✅ Có | ✅ Có |
| **Khai báo hàm (Signatures)** | ✅ Có | ✅ Có |
| **Chống văng khi `il2cpp.h` lớn (>100MB)** | ❌ Dễ lỗi syntax làm dừng cả file | ✅ **Fault-Tolerant Chunker (Không bao giờ văng)** |
| **Hiển thị String Literals trong F5** | ❌ Chỉ hiện `qword_XXX` vô nghĩa | ✅ **Tự động inline String Xrefs vào câu lệnh F5** |
| **Hiển thị Fields của Class** | ❌ Hiện offset thô `*(a1 + 0x18)` | ✅ **Tự Cast `this` $\to$ `this->fields.m_isVisible`** |
| **Dọn dẹp tham số rác `MethodInfo*`** | ❌ Hiện đầy đủ gây rối code | ✅ **Tự động làm sạch CTree decompiler** |

```c
// TRƯỚC (Dùng script mặc định):
__int64 __fastcall HeroAvatarView__SetVisible(__int64 a1, char a2, __int64 a3)
{
  *(_BYTE *)(a1 + 0x18) = a2;               // Offset thô khó hiểu
  *(_DWORD *)(a1 + 0x24) = 1;
  v3 = sub_7A1234(qword_7B9820);            // Chuỗi bị ẩn dưới dạng qword
  sub_7B4560(v3, a2);
  return 0LL;
}

// SAU (Dùng ida_ultimate_il2cpp.py):
void __fastcall HeroAvatarView__SetVisible(HeroAvatarView_o *this, bool isVisible)
{
  this->fields.m_isVisible = isVisible;     // Tự động nhận diện Field C#
  this->fields.m_state = 1;
  // StringLiteral_1245: "UI_Lobby_HeroAvatar_Show"
  v3 = HeroAvatarView__FormatLog(StringLiteral_1245 /* "UI_Lobby_HeroAvatar_Show" */);
  HeroAvatarView__DispatchEvent(v3, isVisible);
  // Tham số rác `const MethodInfo* method` đã được dọn sạch!
}
```

---

## 🛠️ Hướng dẫn biên dịch từ Source (Build from Source)

Dành cho nhà phát triển muốn tự biên dịch hoặc tùy biến mã nguồn:

### Yêu cầu môi trường
* **Hệ điều hành:** Windows 10 / 11 (64-bit)
* **.NET SDK:** .NET 8.0 SDK trở lên ([Tải tại Microsoft](https://dotnet.microsoft.com/download/dotnet/8.0))
* **Node.js:** Node.js v18 trở lên & npm ([Tải tại nodejs.org](https://nodejs.org/))
* **Git**

### Các bước biên dịch

1. **Clone mã nguồn về máy:**
   ```bash
   git clone https://github.com/saoemvotinh-svg/Il2CppDumper-AOV-GUI.git
   cd Il2CppDumper-AOV-GUI
   ```

2. **Cài đặt dependencies:**
   ```bash
   npm install
   ```

3. **Chạy ở môi trường Development (Debug):**
   ```bash
   npm run dev
   ```

4. **Biên dịch 1-Click (Tự động build cả C# Engine + React GUI + Đóng gói EXE):**
   - Chạy file: `build.bat`
   - Hoặc chạy qua dòng lệnh:
     ```bash
     npm run package
     ```
   - Thành phẩm installer `.exe` và portable `.exe` sẽ được lưu tại thư mục:
     - `release\Il2CppDumper-Studio Setup 6.8.0.exe`
     - `release\Il2CppDumper-Studio 6.8.0.exe`

---

## 📜 Tuyên bố miễn trừ trách nhiệm (Disclaimer)

Dự án này được phát triển dựa trên dự án mã nguồn mở [Il2CppDumper](https://github.com/Perfare/Il2CppDumper) của tác giả Perfare, được mở rộng và tích hợp giao diện Workstation nhằm phục vụ cho mục đích:
* Nghiên cứu học thuật, tìm hiểu cấu trúc compiler IL2CPP của Unity Engine.
* Hỗ trợ nhà phát triển phân tích an toàn thông tin, kiểm thử bảo mật (security auditing) và phân tích mã độc trên các ứng dụng di động.

Mọi hành vi sử dụng công cụ này vào mục đích xâm phạm bản quyền, can thiệp trái phép vào hệ thống phần mềm thương mại hoặc vi phạm pháp luật hiện hành đều không thuộc trách nhiệm của các tác giả phát triển dự án.

---

<p align="center">
  Phát triển với ❤️ bởi cộng đồng Đảo ngược Mã nguồn &amp; Nghiên cứu Unity IL2CPP
</p>
