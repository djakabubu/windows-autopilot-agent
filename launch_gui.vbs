Option Explicit

Dim shell, scriptPath, available
Set shell = CreateObject("WScript.Shell")
scriptPath = WScript.Arguments(0)
shell.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(scriptPath)

available = (shell.Run("cmd.exe /d /c where pyw.exe >nul 2>nul", 0, True) = 0)
If available Then
    shell.Run "pyw.exe -3 """ & scriptPath & """", 0, False
Else
    available = (shell.Run("cmd.exe /d /c where pythonw.exe >nul 2>nul", 0, True) = 0)
    If available Then
        shell.Run "pythonw.exe """ & scriptPath & """", 0, False
    Else
        MsgBox "Python 3.9 o superiore non è installato o non è disponibile nel PATH.", _
            vbExclamation, "Assistente Windows"
    End If
End If
