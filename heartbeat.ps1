# heartbeat.ps1 — writes last system input time to heartbeat.json every 10s
# Uses Win32 GetLastInputInfo to detect ANY mouse/keyboard activity system-wide

$heartbeatFile = "$env:USERPROFILE\.vscode-time-tracker\heartbeat.json"

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32Input {
    [DllImport("user32.dll")]
    public static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);
    [StructLayout(LayoutKind.Sequential)]
    public struct LASTINPUTINFO {
        public uint cbSize;
        public uint dwTime;
    }
    public static uint GetIdleMs() {
        LASTINPUTINFO info = new LASTINPUTINFO();
        info.cbSize = (uint)Marshal.SizeOf(info);
        GetLastInputInfo(ref info);
        return (uint)Environment.TickCount - info.dwTime;
    }
}
"@

while ($true) {
    $idleMs = [Win32Input]::GetIdleMs()
    $ts = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    $json = "{`"lastInputMs`":$ts,`"idleMs`":$idleMs}"
    [System.IO.File]::WriteAllText($heartbeatFile, $json)
    Start-Sleep -Seconds 10
}
