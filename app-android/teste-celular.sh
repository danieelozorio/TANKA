#!/bin/sh
# Teste no celular virtual (GitHub, branch de teste): abre o app, aperta "Atualizar agora" e guarda prints e registros.
set -x
adb install -r Eldrin-app.apk
adb shell pm grant br.com.eldrinonline.app android.permission.POST_NOTIFICATIONS || true
adb logcat -c
adb shell am start -n br.com.eldrinonline.app/.MainActivity
sleep 20
adb exec-out screencap -p > tela-1.png
PID=$(adb shell pidof br.com.eldrinonline.app | tr -d '\r')
adb forward tcp:9222 localabstract:webview_devtools_remote_$PID
python3 app-android/teste-celular.py > teste.txt 2>&1 || true
adb exec-out screencap -p > tela-2.png
sleep 20
adb exec-out screencap -p > tela-3.png
adb logcat -d > logcat-tudo.txt
grep -iE "capacitor|capgo|updater|eldrin|chromium|AndroidRuntime" logcat-tudo.txt | tail -400 > logcat.txt || true
cat teste.txt
true
