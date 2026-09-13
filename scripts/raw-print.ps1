param([string]$FilePath, [string]$PrinterName)

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class NoktaRawPrinter {
    [DllImport("winspool.drv", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern bool OpenPrinter(string pPrinterName, out IntPtr hPrinter, IntPtr pDefault);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int level, ref DOCINFO pDocInfo);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int cbBytes, out int pcBytesWritten);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
    public struct DOCINFO {
        public string pDocName;
        public string pOutputFile;
        public string pDatatype;
    }

    public static bool SendFileToPrinter(string printerName, string filePath) {
        byte[] bytes = System.IO.File.ReadAllBytes(filePath);
        IntPtr hPrinter = IntPtr.Zero;

        if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero))
            throw new Exception("Cannot open printer: " + printerName);

        try {
            DOCINFO di = new DOCINFO();
            di.pDocName = "NOKTA POS Receipt";
            di.pOutputFile = null;
            di.pDatatype = "RAW";

            StartDocPrinter(hPrinter, 1, ref di);
            StartPagePrinter(hPrinter);

            IntPtr pBytes = Marshal.AllocHGlobal(bytes.Length);
            try {
                Marshal.Copy(bytes, 0, pBytes, bytes.Length);
                int written;
                WritePrinter(hPrinter, pBytes, bytes.Length, out written);
            } finally {
                Marshal.FreeHGlobal(pBytes);
            }

            EndPagePrinter(hPrinter);
            EndDocPrinter(hPrinter);
        } finally {
            ClosePrinter(hPrinter);
        }
        return true;
    }
}
"@

[NoktaRawPrinter]::SendFileToPrinter($PrinterName, $FilePath)
