with open(r"c:\Users\hung\Desktop\REATEST\Il2CppDumper-AOV-GUI\electron\main.cjs", "r", encoding="utf-8") as f:
    text = f.read()

target = """    backgroundColor: '#151719',
    show: false,
    autoHideMenuBar: true,"""

replacement = """    backgroundColor: '#121416',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#141618',
      symbolColor: '#9FA6A2',
      height: 36
    },
    show: false,
    autoHideMenuBar: true,"""

if target in text:
    text = text.replace(target, replacement)
    with open(r"c:\Users\hung\Desktop\REATEST\Il2CppDumper-AOV-GUI\electron\main.cjs", "w", encoding="utf-8") as f:
        f.write(text)
    print("Patched main.cjs with titleBarOverlay")
else:
    print("ERROR: target not found in main.cjs")
