$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [Console]::OutputEncoding
$warnings = @()
$adapters = @()
try {
    $adapters = @(Get-NetIPConfiguration -All | ForEach-Object {
        [pscustomobject]@{
            name = [string]$_.InterfaceAlias
            description = [string]$_.InterfaceDescription
            status = [string]$_.NetAdapter.Status
            link_speed = [string]$_.NetAdapter.LinkSpeed
            wireless = ($_.NetAdapter.NdisPhysicalMedium -in 1,9)
            ipv4 = @($_.IPv4Address.IPAddress)
            gateways = @($_.IPv4DefaultGateway.NextHop)
            dns = @($_.DNSServer.ServerAddresses)
        }
    })
} catch { $warnings += 'adapter_read_unavailable' }
$wifi = @()
try {
    $lines = @(& "$env:SystemRoot\System32\netsh.exe" wlan show interfaces 2>$null)
    $current = @{}
    foreach ($line in $lines) {
        if ($line -match '^\s*SSID\s*:\s*(.*)$') {
            if ($current.ContainsKey('ssid')) { $wifi += [pscustomobject]$current; $current = @{} }
            $current.ssid = $matches[1].Trim()
        }
        if ($line -match '^\s*(?:Signal|Сигнал)\s*:\s*(\d+)\s*%') { $current.signal_percent = [int]$matches[1] }
        if ($line -match '^\s*(?:Receive rate.*|Скорость приема.*|Скорость приёма.*)\s*:\s*([\d.,]+)\s*$') { $current.receive_mbps = [double]::Parse($matches[1].Replace(',','.'),[Globalization.CultureInfo]::InvariantCulture) }
        if ($line -match '^\s*(?:Transmit rate.*|Скорость передачи.*)\s*:\s*([\d.,]+)\s*$') { $current.transmit_mbps = [double]::Parse($matches[1].Replace(',','.'),[Globalization.CultureInfo]::InvariantCulture) }
    }
    if ($current.Count) { $wifi += [pscustomobject]$current }
    if ($LASTEXITCODE -ne 0) { $warnings += 'wifi_details_unavailable' }
} catch { $warnings += 'wifi_details_unavailable' }
$events = @()
try {
    $events = @(Get-WinEvent -FilterHashtable @{LogName='Microsoft-Windows-WLAN-AutoConfig/Operational'; Id=8001,8002,8003; StartTime=(Get-Date).AddDays(-1)} -MaxEvents 200 -ErrorAction Stop | ForEach-Object {
        $xml = [xml]$_.ToXml()
        $reason = @($xml.Event.EventData.Data | Where-Object { $_.Name -in 'ReasonCode','FailureReason','Reason' } | ForEach-Object { $_.'#text' }) -join '; '
        [pscustomobject]@{id=$_.Id;record_id=$_.RecordId;at=$_.TimeCreated.ToUniversalTime().ToString('o');reason=$reason}
    })
} catch { if ($_.FullyQualifiedErrorId -notlike 'NoMatchingEventsFound*') { $warnings += 'wlan_history_unavailable' } }
$gateway = @($adapters | Where-Object {$_.status -eq 'Up' -and $_.gateways.Count} | ForEach-Object {$_.gateways} | Select-Object -First 1)
$ping = [pscustomobject]@{status='unavailable';sent=0;received=0;average_ms=$null}
if ($gateway.Count) {
    $latencies = @()
    $pinger = [Net.NetworkInformation.Ping]::new()
    try {
        for ($attempt=0; $attempt -lt 3; $attempt++) {
            $result = $pinger.Send([string]$gateway[0],800)
            if ($result.Status -eq [Net.NetworkInformation.IPStatus]::Success) { $latencies += $result.RoundtripTime }
        }
        $ping = [pscustomobject]@{status=if($latencies.Count){'reply'}else{'no_reply'};sent=3;received=$latencies.Count;average_ms=if($latencies.Count){[math]::Round(($latencies | Measure-Object -Average).Average,1)}else{$null}}
    } catch { $ping.status='unavailable' } finally { $pinger.Dispose() }
}
[pscustomobject]@{adapters=$adapters;wifi=$wifi;events=$events;gateway_ping=$ping;warnings=$warnings} | ConvertTo-Json -Depth 6 -Compress
