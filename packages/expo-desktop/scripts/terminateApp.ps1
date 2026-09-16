[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string] $ProcessName
)

$ErrorActionPreference = "Stop"
$waiters = @()

try {
  if ([string]::IsNullOrWhiteSpace($ProcessName)) {
    throw "Expected a process name."
  }

  Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;

public static class ExpoDesktopNativeWindows
{
    private const uint WmClose = 0x0010;

    private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

    [DllImport("user32.dll")]
    private static extern bool PostMessage(IntPtr hWnd, uint message, IntPtr wParam, IntPtr lParam);

    public static IntPtr[] GetTopLevelWindowsForProcess(int processId)
    {
        var windows = new List<IntPtr>();
        EnumWindows((hWnd, lParam) =>
        {
            uint ownerProcessId;
            GetWindowThreadProcessId(hWnd, out ownerProcessId);
            if (ownerProcessId == processId)
            {
                windows.Add(hWnd);
            }
            return true;
        }, IntPtr.Zero);
        return windows.ToArray();
    }

    public static bool RequestClose(IntPtr hWnd)
    {
        return PostMessage(hWnd, WmClose, IntPtr.Zero, IntPtr.Zero);
    }
}
'@

  $ProcessName = [IO.Path]::GetFileNameWithoutExtension($ProcessName)
  $processes = @(
    Get-Process -Name $ProcessName -ErrorAction SilentlyContinue |
      Where-Object { -not $_.HasExited }
  )

  if ($processes.Count -eq 0) {
    exit 0
  }

  # Process.Exited is raised by the operating system. Register all observers
  # before requesting a close so that a fast exit cannot be missed.
  foreach ($process in $processes) {
    $process.EnableRaisingEvents = $true
    # EnumWindows includes hidden top-level windows. Message-only windows are
    # not enumerable with EnumWindows and have no generic close contract, so a
    # process with no top-level windows uses the force-kill fallback below.
    $windows = @([ExpoDesktopNativeWindows]::GetTopLevelWindowsForProcess($process.Id))

    $sourceIdentifier = "ExpoDesktop.ProcessExited.$($process.Id)"
    Register-ObjectEvent `
      -InputObject $process `
      -EventName Exited `
      -SourceIdentifier $sourceIdentifier | Out-Null
    $waiters += [PSCustomObject]@{
      Process = $process
      Windows = $windows
      ForceKill = $windows.Count -eq 0
      SourceIdentifier = $sourceIdentifier
    }
  }

  foreach ($waiter in $waiters) {
    if ($waiter.Process.HasExited) {
      continue
    }

    if ($waiter.ForceKill) {
      # A process without a top-level window has no generic Windows close
      # request that we can send. This is the expected case for tray apps that
      # keep running after their visible windows have closed.
      try {
        $waiter.Process.Kill()
      } catch [System.InvalidOperationException] {
        if (-not $waiter.Process.HasExited) {
          throw
        }
      }
      continue
    }

    $closeRequestsPosted = 0
    foreach ($window in $waiter.Windows) {
      if ([ExpoDesktopNativeWindows]::RequestClose($window)) {
        $closeRequestsPosted++
      }
    }
    if ($closeRequestsPosted -eq 0 -and -not $waiter.Process.HasExited) {
      throw "Could not request process $($waiter.Process.Id) to close because its top-level windows were no longer available."
    }
  }

  foreach ($waiter in $waiters) {
    if ($waiter.Process.HasExited) {
      continue
    }

    # Do not use a timeout here. A normal close can legitimately be blocked by
    # an application's save/confirmation dialog; the user must be able to
    # resolve that dialog before deployment continues.
    Wait-Event -SourceIdentifier $waiter.SourceIdentifier | Out-Null
  }

  exit 0
}
catch {
  Write-Error $_.Exception.Message
  exit 1
}
finally {
  foreach ($waiter in $waiters) {
    Unregister-Event -SourceIdentifier $waiter.SourceIdentifier -ErrorAction SilentlyContinue
    Get-Job -Name $waiter.SourceIdentifier -ErrorAction SilentlyContinue |
      Remove-Job -Force -ErrorAction SilentlyContinue
    $waiter.Process.Dispose()
  }
}
