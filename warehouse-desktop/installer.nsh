!macro customInstall
  ; Publish the standard location used by the common app's warehouse updater.
  ; The legacy app GUID and the app's own registry location stay intact.
  WriteRegStr SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}" "InstallLocation" "$INSTDIR"
!macroend
