# IL2CppDumper Studio • Unified Workstation Repository

Hệ thống hợp nhất toàn diện bao gồm **C# Core Decompilation Engine** và **React Electron Desktop Workstation** trong một mã nguồn duy nhất.

---

## Cấu trúc thư mục thống nhất (Unified Structure)

```text
Il2CppDumper-Studio/
├── engine/                   # Toàn bộ mã nguồn C# .NET 8 Core Engine
│   ├── Il2CppDumper.sln      # Solution .NET 8 / Visual Studio
│   └── Il2CppDumper/         # Mã nguồn chính (Il2CppDecompiler, Il2Cpp, etc.)
│       ├── Il2Cpp/           # Thuật toán phân tích metadata & Tencent XOR Decryption
│       ├── Outputs/          # Bộ xuất dump.cs, dummy DLLs, script Ghidra/IDA
│       └── bin/Release/      # File thực thi Il2CppDumper.exe đã biên dịch
│
├── workspace/                # Thư mục Workspace mặc định (NẰM CÙNG CẤP VỚI FILE .EXE)
│   ├── libil2cpp.so          # File binary ELF mặc định
│   ├── global-metadata.dat   # File metadata mặc định
│   └── output/               # Nơi lưu kết quả decompilation (dump.cs, DummyDll)
│
├── src/                      # Frontend React 19 + TypeScript + Tailwind CSS
│   ├── components/           # UI Components (Dropzone, Terminal, Config, Artifacts)
│   ├── config.ts             # API Client Configuration
│   └── App.tsx               # Root Workstation Shell
│
├── electron/                 # Desktop Application Bridge (Electron v45)
│   ├── main.cjs              # Electron Main Process & Native Dialog Handlers
│   └── preload.cjs           # Context Bridge Security Layer
│
├── server/                   # Express HTTP & Real-time SSE Bridge Server
│   └── bridge.cjs            # Server điều phối Engine & Streaming log
│
├── release/                  # Thành phẩm ứng dụng Windows
│   ├── win-unpacked/         # Bản chạy trực tiếp (Il2CppDumper-Studio.exe)
│   └── Il2CppDumper-Studio Setup 6.8.0.exe # Bộ cài đặt Windows Setup
│
├── build.bat                 # Script 1-click tự động build cả Engine + GUI + EXE
├── launch.bat                # Script 1-click mở nhanh ứng dụng Desktop
└── package.json              # Quản lý script biên dịch toàn dự án
```

---

## Hướng dẫn thao tác

### 1. Khởi chạy nhanh ứng dụng
- Nhấp đúp vào file `launch.bat` trong thư mục này (hoặc file `Launch_Il2CppDumper_Studio.bat` tại thư mục gốc workspace).

### 2. Biên dịch lại toàn bộ (C# Engine + GUI + Đóng gói EXE)
- Nhấp đúp vào file `build.bat` hoặc chạy lệnh:
```bash
npm run build
npm run package:dir
```

### 3. Chạy môi trường Development
```bash
npm run dev
```
Môi trường phát triển sẽ tự động kích hoạt cả Server bridge và Vite dev server.
