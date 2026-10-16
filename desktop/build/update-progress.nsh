; Keep the standard installer, but show only its real progress page during updates.
; Also works when an older FastGo launches this installer with /S --updated.
!macro customInit
  ${if} ${isUpdated}
    SetSilent normal
    SetAutoClose true
  ${endif}
!macroend

!macro customInstallMode
  ${if} ${isUpdated}
    ${if} $hasPerMachineInstallation == "1"
      StrCpy $isForceMachineInstall "1"
    ${else}
      StrCpy $isForceCurrentInstall "1"
    ${endif}
  ${endif}
!macroend

!macro customPageAfterChangeDir
  Function FastGoUpdateProgressShow
    ${if} ${isUpdated}
      !insertmacro MUI_HEADER_TEXT "Установка обновления FastGo" "Приложение откроется снова автоматически."
      SendMessage $HWNDPARENT ${WM_SETTEXT} 0 "STR:Обновление FastGo"
    ${endif}
  FunctionEnd
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW FastGoUpdateProgressShow
!macroend

!macro customFinishPage
  Function FastGoFinishPre
    ${if} ${isUpdated}
      HideWindow
      ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "--updated"
      SetErrorLevel 0
      Quit
    ${endif}
  FunctionEnd
  Function FastGoStartApp
    ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" ""
  FunctionEnd
  !define MUI_PAGE_CUSTOMFUNCTION_PRE FastGoFinishPre
  !define MUI_FINISHPAGE_RUN
  !define MUI_FINISHPAGE_RUN_FUNCTION FastGoStartApp
  !insertmacro MUI_PAGE_FINISH
!macroend
