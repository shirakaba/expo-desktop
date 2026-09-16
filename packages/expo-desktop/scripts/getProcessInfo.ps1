[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [int] $ProcessId
)

$ErrorActionPreference = "Stop"

try {
  if ($ProcessId -le 0) {
    throw "Expected a positive process ID."
  }

  Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;

public static class ExpoDesktopProcessInfo
{
    private const uint ProcessQueryInformation = 0x0400;
    private const uint ProcessVmRead = 0x0010;
    private const int ProcessBasicInformation = 0;
    private const int ProcessWow64Information = 26;

    [StructLayout(LayoutKind.Sequential)]
    private struct ProcessBasicInformationNative
    {
        public IntPtr Reserved1;
        public IntPtr PebBaseAddress;
        public IntPtr Reserved2;
        public IntPtr Reserved3;
        public IntPtr UniqueProcessId;
        public IntPtr Reserved4;
    }

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr OpenProcess(uint desiredAccess, bool inheritHandle, uint processId);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool CloseHandle(IntPtr handle);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool ReadProcessMemory(
        IntPtr process,
        IntPtr address,
        byte[] buffer,
        IntPtr size,
        out IntPtr bytesRead);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool IsWow64Process2(
        IntPtr process,
        out ushort processMachine,
        out ushort nativeMachine);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool IsWow64Process(IntPtr process, out bool isWow64);

    [DllImport("ntdll.dll")]
    private static extern int NtQueryInformationProcess(
        IntPtr process,
        int informationClass,
        out ProcessBasicInformationNative information,
        uint informationLength,
        out uint returnLength);

    [DllImport("ntdll.dll", EntryPoint = "NtQueryInformationProcess")]
    private static extern int NtQueryInformationProcessWow64(
        IntPtr process,
        int informationClass,
        out IntPtr information,
        uint informationLength,
        out uint returnLength);

    public static string GetCurrentDirectory(int processId)
    {
        IntPtr process = OpenProcess(ProcessQueryInformation | ProcessVmRead, false, (uint)processId);
        if (process == IntPtr.Zero)
        {
            throw new Win32Exception(Marshal.GetLastWin32Error(), "Could not open the process.");
        }

        try
        {
            bool is32Bit = Is32BitProcess(process);
            IntPtr peb = GetPebAddress(process, is32Bit);
            IntPtr processParameters = ReadPointer(
                process,
                IntPtr.Add(peb, is32Bit ? 0x10 : 0x20),
                is32Bit);

            // RTL_USER_PROCESS_PARAMETERS.CurrentDirectory.DosPath.
            IntPtr currentDirectory = IntPtr.Add(processParameters, is32Bit ? 0x24 : 0x38);
            ushort length = ReadUInt16(process, currentDirectory);
            IntPtr buffer = ReadPointer(
                process,
                IntPtr.Add(currentDirectory, is32Bit ? 0x04 : 0x08),
                is32Bit);

            if (length == 0 || buffer == IntPtr.Zero)
            {
                return "";
            }

            return Encoding.Unicode.GetString(ReadBytes(process, buffer, length));
        }
        finally
        {
            CloseHandle(process);
        }
    }

    private static bool Is32BitProcess(IntPtr process)
    {
        try
        {
            ushort processMachine;
            ushort nativeMachine;
            if (IsWow64Process2(process, out processMachine, out nativeMachine))
            {
                return processMachine != 0;
            }
        }
        catch (EntryPointNotFoundException)
        {
            // Fall back for Windows versions without IsWow64Process2.
        }

        bool isWow64;
        if (IsWow64Process(process, out isWow64))
        {
            return isWow64;
        }

        return IntPtr.Size == 4;
    }

    private static IntPtr GetPebAddress(IntPtr process, bool is32Bit)
    {
        uint returnLength;
        if (is32Bit)
        {
            IntPtr peb;
            int status = NtQueryInformationProcessWow64(
                process,
                ProcessWow64Information,
                out peb,
                (uint)IntPtr.Size,
                out returnLength);
            if (status != 0 || peb == IntPtr.Zero)
            {
                throw new InvalidOperationException("Could not locate the 32-bit process environment block.");
            }
            return peb;
        }

        ProcessBasicInformationNative information;
        int nativeStatus = NtQueryInformationProcess(
            process,
            ProcessBasicInformation,
            out information,
            (uint)Marshal.SizeOf(typeof(ProcessBasicInformationNative)),
            out returnLength);
        if (nativeStatus != 0 || information.PebBaseAddress == IntPtr.Zero)
        {
            throw new InvalidOperationException("Could not locate the process environment block.");
        }
        return information.PebBaseAddress;
    }

    private static ushort ReadUInt16(IntPtr process, IntPtr address)
    {
        byte[] bytes = ReadBytes(process, address, 2);
        return BitConverter.ToUInt16(bytes, 0);
    }

    private static IntPtr ReadPointer(IntPtr process, IntPtr address, bool is32Bit)
    {
        byte[] bytes = ReadBytes(process, address, is32Bit ? 4 : 8);
        if (is32Bit)
        {
            return new IntPtr((int)BitConverter.ToUInt32(bytes, 0));
        }

        return new IntPtr(BitConverter.ToInt64(bytes, 0));
    }

    private static byte[] ReadBytes(IntPtr process, IntPtr address, int length)
    {
        byte[] bytes = new byte[length];
        IntPtr bytesRead;
        if (!ReadProcessMemory(process, address, bytes, new IntPtr(length), out bytesRead) ||
            bytesRead.ToInt64() != length)
        {
            throw new Win32Exception(Marshal.GetLastWin32Error(), "Could not read process memory.");
        }
        return bytes;
    }
}
'@

  $process = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId"
  if ($null -eq $process) {
    throw "Could not find process $ProcessId."
  }

  [PSCustomObject]@{
    directory = [ExpoDesktopProcessInfo]::GetCurrentDirectory($ProcessId)
    command = $process.CommandLine
  } | ConvertTo-Json -Compress
}
catch {
  Write-Error $_.Exception.Message
  exit 1
}
