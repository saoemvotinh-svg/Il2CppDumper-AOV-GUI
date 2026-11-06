with open(r"c:\Users\hung\Desktop\REATEST\Il2CppDumper-AOV-GUI\src\components\CodeViewer.tsx", "r", encoding="utf-8") as f:
    text = f.read()

text = text.replace('title="Mã C# giả lập sạch (Đã chuyển đổi con trỏ và unwrap string)"', 'title="Clean reconstructed C# pseudocode (unwrapped structs, dereferenced pointers, string literals)"')
text = text.replace('title="Mã Hex-Rays C Pseudocode nguyên bản (Pointer, thanh ghi, offset)"', 'title="Raw Hex-Rays C pseudocode (raw registers, pointer offsets, call sites)"')

with open(r"c:\Users\hung\Desktop\REATEST\Il2CppDumper-AOV-GUI\src\components\CodeViewer.tsx", "w", encoding="utf-8") as f:
    f.write(text)

print("Updated CodeViewer.tsx successfully")
