using System;
using System.IO;

namespace Il2CppDumper
{
    public static class DummyAssemblyExporter
    {
        public static void Export(Il2CppExecutor il2CppExecutor, string outputDir, bool addToken)
        {
            var dummyDir = Path.Combine(outputDir, "DummyDll");
            if (!Directory.Exists(dummyDir))
            {
                Directory.CreateDirectory(dummyDir);
            }
            var dummy = new DummyAssemblyGenerator(il2CppExecutor, addToken);
            int exported = 0;
            foreach (var assembly in dummy.Assemblies)
            {
                try
                {
                    var outPath = Path.Combine(dummyDir, assembly.MainModule.Name);
                    using var stream = new MemoryStream();
                    assembly.Write(stream);
                    File.WriteAllBytes(outPath, stream.ToArray());
                    exported++;
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"WARNING: Failed to export {assembly.MainModule.Name}: {ex.Message}");
                }
            }
            Console.WriteLine($"Exported {exported}/{dummy.Assemblies.Count} assemblies to {dummyDir}");
        }
    }
}
