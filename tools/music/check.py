"""Draws what was rendered: energy per semitone over time (from the mp3 itself), with the written notes outlined on top,
and the loudness over time underneath. A way to check the music by eye where it cannot be heard.
Usage: python3 tools/music/check.py audio/music/age1.mp3 notes.json out.png"""
import sys, json, subprocess
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle

mp3, notes, out = sys.argv[1], sys.argv[2], sys.argv[3]
SR = 22050
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', mp3, '-f', 'f32le', '-ac', '2', '-ar', str(SR), 'pipe:1'], capture_output=True).stdout
st = np.frombuffer(raw, dtype=np.float32).reshape(-1, 2)
x = st.mean(axis=1)
N, HOP = 4096, 512
win = np.hanning(N)
frames = 1 + (len(x) - N) // HOP
spec = np.abs(np.fft.rfft(np.stack([x[i * HOP:i * HOP + N] * win for i in range(frames)]), axis=1))
freqs = np.fft.rfftfreq(N, 1 / SR)
LO, HI = 33, 100
roll = np.zeros((HI - LO + 1, frames))
for m in range(LO, HI + 1):
    f = 440 * 2 ** ((m - 69) / 12)
    lo, hi = f * 2 ** (-0.4 / 12), f * 2 ** (0.4 / 12)
    idx = np.where((freqs >= lo) & (freqs <= hi))[0]
    if len(idx) == 0: idx = [np.argmin(np.abs(freqs - f))]
    roll[m - LO] = spec[:, idx].max(axis=1)
db = 20 * np.log10(roll + 1e-6); db -= db.max()
t = np.arange(frames) * HOP / SR
fig, ax = plt.subplots(2, 1, figsize=(15, 7.2), gridspec_kw={'height_ratios': [5, 1]}, sharex=True)
ax[0].imshow(db, origin='lower', aspect='auto', extent=[0, t[-1], LO - 0.5, HI + 0.5], cmap='magma', vmin=-55, vmax=0)
cols = ['#5fd4ff', '#8dff7a', '#ffffff', '#ffb0f0', '#ffe066', '#ff9060']
for i, stem in enumerate(json.load(open(notes))):
    for e in stem['events']:
        ax[0].add_patch(Rectangle((e['t'], e['m'] - 0.5), e['d'], 1, fill=False, edgecolor=cols[i % len(cols)], linewidth=0.5, alpha=0.9))
    ax[0].plot([], [], color=cols[i % len(cols)], label=stem['name'])
ax[0].legend(loc='upper right', fontsize=7, ncol=6, framealpha=0.5)
ax[0].set_yticks(range(36, HI + 1, 12)); ax[0].set_yticklabels(['C%d' % (m // 12 - 1) for m in range(36, HI + 1, 12)]); ax[0].set_ylabel('pitch')
w = int(0.4 * SR); k = len(x) // w
for ch, c in ((0, '#3a7bd5'), (1, '#d5573a')):
    r = np.sqrt((st[:k * w, ch].reshape(k, w) ** 2).mean(axis=1))
    ax[1].plot(np.arange(k) * 0.4, 20 * np.log10(r + 1e-6), color=c, linewidth=1)
ax[1].set_ylim(-60, 0); ax[1].set_ylabel('dB (L, R)'); ax[1].set_xlabel('seconds'); ax[1].grid(alpha=0.3)
peak = np.abs(st).max()
fig.suptitle('%s   %.1f s   peak %.2f   clipped samples %d' % (mp3.split('/')[-1], len(x) / SR, peak, int((np.abs(st) >= 0.999).sum())), fontsize=10)
fig.tight_layout(); fig.savefig(out, dpi=95)
print(out, 'peak %.2f' % peak)
