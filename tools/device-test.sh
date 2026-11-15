#!/usr/bin/env bash
# Runs on an Android emulator (GitHub Actions): installs the released APK, opens the game and walks through a
# few screens with real touches. Saves screenshots, what the system reports, and the log into device-test/.
set -u
OUT=device-test; mkdir -p "$OUT"
APK=${1:-long-ascent.apk}; PKG=io.github.jpvanacor.longascent
say() { echo "$@" | tee -a "$OUT/result.txt"; }
shot() { adb exec-out screencap -p > "$OUT/$1.png" || true; }
# what is on screen, as the system describes it; an empty file means the system could not describe it this time
dump() {
  local i
  for i in 1 2 3; do
    adb shell rm -f /sdcard/ui.xml >/dev/null 2>&1
    adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1
    adb exec-out cat /sdcard/ui.xml > "$OUT/ui.xml" 2>/dev/null
    grep -q "<node" "$OUT/ui.xml" 2>/dev/null && return 0
    sleep 1
  done
  return 1
}
# centre of the first thing on screen whose text or description contains $1
find_node() { python3 - "$1" "$OUT/ui.xml" <<'PY'
import re, sys
want, path = sys.argv[1], sys.argv[2]
try:
    xml = open(path, encoding='utf-8', errors='ignore').read()
except OSError:
    sys.exit(1)
for m in re.finditer(r'<node [^>]*>', xml):
    n = m.group(0)
    t = re.search(r' text="([^"]*)"', n); d = re.search(r' content-desc="([^"]*)"', n)
    b = re.search(r' bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', n)
    if b and ((t and want in t.group(1)) or (d and want in d.group(1))):
        x1, y1, x2, y2 = map(int, b.groups())
        print((x1 + x2) // 2, (y1 + y2) // 2)
        sys.exit(0)
sys.exit(1)
PY
}
# the first few words readable on screen
texts() { python3 - "$OUT/ui.xml" <<'PY'
import re, sys
try:
    xml = open(sys.argv[1], encoding='utf-8', errors='ignore').read()
except OSError:
    xml = ''
seen = []
for m in re.finditer(r'<node [^>]*>', xml):
    n = m.group(0)
    t = re.search(r' text="([^"]*)"', n); d = re.search(r' content-desc="([^"]*)"', n)
    label = (t.group(1) if t and t.group(1) else '') or (d.group(1) if d and d.group(1) else '')
    if label and label not in seen:
        seen.append(label)
print(' | '.join(s[:36] for s in seen[:14]) or '(nothing readable)')
PY
}
tap_text() { dump; local p; if p=$(find_node "$1"); then adb shell input tap $p; say "tapped '$1' at $p"; return 0; fi; say "NOT FOUND on screen: '$1'. On screen: $(texts)"; return 1; }
# A slow emulator sometimes shows "... isn't responding". If it names the game, that is a finding: note it and wait.
# If it names something else (the emulator's own home screen, usually), close that so the test can go on.
calm() {
  local p box
  find_node "responding" >/dev/null || return 1
  box=$(texts); say "system box: $box"
  case "$box" in
    *"Long Ascent"*) say "THE GAME WAS REPORTED AS NOT RESPONDING"; p=$(find_node "Wait") && adb shell input tap $p ;;
    *) p=$(find_node "Close app") && adb shell input tap $p ;;
  esac
  sleep 3; return 0
}
front() { adb shell dumpsys activity activities | grep -E "ResumedActivity" | head -1 | tr -s ' ' | tr -d '\r'; }
players() { adb shell dumpsys audio | grep -E "AudioPlaybackConfiguration" | grep -c "state:started"; }

say "== device"
say "Android $(adb shell getprop ro.build.version.release | tr -d '\r') (API $(adb shell getprop ro.build.version.sdk | tr -d '\r')), $(adb shell wm size | tr -d '\r'), $(adb shell wm density | tr -d '\r')"
say "apk: $(stat -c %s "$APK") bytes, sha256 $(sha256sum "$APK" | cut -c1-16)"
say "web view: $(adb shell dumpsys webviewupdate | grep -E 'Current WebView package' | tr -s ' ' | tr -d '\r')"
adb logcat -G 16M >/dev/null 2>&1
say "== install"
adb install -r "$APK" 2>&1 | tee -a "$OUT/result.txt"
if ! adb shell pm list packages | grep -q "$PKG"; then
  say "RESULT: the APK did not install"
  adb logcat -d > "$OUT/logcat.txt"
  grep -E "PackageManager|PackageInstaller|INSTALL_|installd" "$OUT/logcat.txt" | tail -40 | tee -a "$OUT/result.txt"
  exit 1
fi
say "RESULT: installed. $(adb shell dumpsys package $PKG | grep -E 'versionCode|versionName' | head -2 | tr -s ' ' | tr -d '\r' | tr '\n' ' ')"
# let the freshly started system settle before the game opens
sleep 8; for i in 1 2 3; do dump; calm || break; done
adb logcat -c
say "== start"
adb shell am start -W -n "$PKG/.MainActivity" 2>&1 | grep -E "Status|TotalTime|Error" | tr -d '\r' | tee -a "$OUT/result.txt"
t0=$(date +%s); found=no
for i in $(seq 1 40); do
  dump
  if find_node "Tap to begin" >/dev/null; then found=yes; break; fi
  calm
  sleep 2
done
shot 01-title
say "title screen found: $found, after $(( $(date +%s) - t0 )) s"
[ "$found" = no ] && say "on screen instead: $(texts)"
tap_text "Tap to begin"; sleep 4; shot 02-first-screen
say "sound sources playing after the first touch: $(players)"
for i in $(seq 1 12); do tap_text "Work the land" >/dev/null || break; sleep 0.3; done
sleep 1; shot 03-after-work
tap_text "Buy 1"; sleep 1.5; shot 04-after-buy
tap_text "Menu"; sleep 0.8; shot 05a-menu-1s; sleep 2; shot 05b-menu-3s
dump; say "menu open: $(find_node 'Start over' >/dev/null && echo yes || echo no)"
say "where the menu's parts are on screen (text, bounds):"
python3 - "$OUT/ui.xml" <<'PY' | tee -a "$OUT/result.txt"
import re, sys
xml = open(sys.argv[1], encoding='utf-8', errors='ignore').read()
for m in re.finditer(r'<node [^>]*>', xml):
    n = m.group(0)
    t = re.search(r' text="([^"]*)"', n); d = re.search(r' content-desc="([^"]*)"', n); b = re.search(r' bounds="([^"]*)"', n); c = re.search(r' class="([^"]*)"', n)
    label = (t.group(1) if t and t.group(1) else '') or (d.group(1) if d else '')
    if label and any(k in label for k in ('Sound', 'Save', 'Credits', 'Start over', 'Close', 'Menu', 'Copy', 'Work the land', 'Buildings')):
        print('   ', label[:40].ljust(40), b.group(1) if b else '', c.group(1).split('.')[-1] if c else '')
PY
shot 05c-menu-later
adb shell input keyevent KEYCODE_BACK; sleep 2; shot 06-after-back
dump; say "menu still open after Back: $(find_node 'Start over' >/dev/null && echo yes || echo no)"
say "in front after Back: $(front)"
# a second opening, to tell a slow first drawing from a slow sheet
if tap_text "Menu" >/dev/null; then sleep 0.4; shot 05d-menu-again-early; sleep 1; shot 05e-menu-again-later; adb shell input keyevent KEYCODE_BACK; sleep 2; fi
sleep 1; say "sound sources playing in front: $(players)"
adb shell input keyevent KEYCODE_HOME; sleep 5
say "sound sources playing after Home: $(players)"
say "in front after Home: $(front)"
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1; sleep 5; shot 07-back-in-front
say "sound sources playing after coming back: $(players)"
adb shell input keyevent KEYCODE_BACK; sleep 3
say "in front after Back with nothing open: $(front)"
adb logcat -d > "$OUT/logcat.txt"
say "== trouble in the system log (apps not responding, crashes, page errors)"
grep -E "ANR in |Reason: |FATAL EXCEPTION|AndroidRuntime: (Process|java\.|Caused by)|Force finishing activity|Process $PKG .*has died|Renderer process .*(crash|kill)|chromium.*Uncaught|Capacitor/Console.*[Ee]rror" "$OUT/logcat.txt" | head -24 | cut -c1-260 | tee -a "$OUT/result.txt"
say "== done"
