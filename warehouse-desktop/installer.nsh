!macro customInstall
  ; Publish the standard location used by the common app's warehouse updater.
  ; The legacy app GUID and the app's own registry location stay intact.
  WriteRegStr SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}" "InstallLocation" "$INSTDIR"
  ; Refresh renamed links rather than keeping a legacy target/short path.
  ; An intentionally removed shortcut is still not recreated.
  ${if} $oldDesktopLink != $newDesktopLink
  ${andIf} ${FileExists} "$newDesktopLink"
    CreateShortCut "$newDesktopLink" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
    WinShell::SetLnkAUMI "$newDesktopLink" "${APP_ID}"
  ${endif}
  ${if} $oldStartMenuLink != $newStartMenuLink
  ${andIf} ${FileExists} "$newStartMenuLink"
    CreateShortCut "$newStartMenuLink" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
    WinShell::SetLnkAUMI "$newStartMenuLink" "${APP_ID}"
  ${endif}
!macroend
