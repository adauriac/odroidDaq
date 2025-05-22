import numpy as np
import matplotlib.pyplot as plt
from scipy.signal import welch, get_window
from scipy import fft
import sys

# Paramètres du signal
fs = 1000                # Fréquence d'échantillonnage en Hz
fs=32 #bidon
T = 1.0                  # Durée en secondes
N = int(T * fs)          # Nombre d'échantillons
t = np.linspace(0, T, N, endpoint=False)

# Signal : sinus de 100 Hz + un peu de bruit
signal = np.sin(2 * np.pi * 100 * t) + 0.1 * np.random.randn(N)

if len(sys.argv)==3:
    lines = open(sys.argv[1]).readlines()
    fs = float(sys.argv[2])
    signal = np.array(list(map(float,lines)))
    N = len(signal)
    print("# data from "+sys.argv[1]+ " with fs=%lf"%fs)
else:
    print("# data generated (NOT from a file)")


if False:
    ff=open("signaltmp","w")
    for x in signal:
        ff.writelines("%15.13lf\n"%x)
    ff.close()
    print(ff.name+ " closed")
    sys.exit(0)
# ================================
# 1. Méthode Welch (référence)
# ================================
f_welch, Pxx_welch = welch(
    signal, fs=fs, nperseg=N, window='hann', scaling='density'
)

# ================================
# 2. Méthode manuelle via FFT
# ================================

# Appliquer la même fenêtre de Hann
window = get_window('hann', N)
myWindow = np.array(list(map(lambda x:0.5-0.5*np.cos(2*np.pi*x/N),range(N))))
signal_win = signal * myWindow

# Calcul du facteur de normalisation U (moyenne de l'énergie de la fenêtre)
U = np.sum(window**2)

# FFT du signal fenêtré
X = fft(signal_win)

# Calcul de la densité spectrale de puissance (DSP)
# Pxx_fft = (1 / (fs * U)) * np.abs(X)**2
Pxx_fft = []
c = (1 / (fs * U))
for i in range(len(X)):
    z = X[i]
    Pxx_fft.append(c*(z.real**2 + z.imag**2))
Pxx_fft = np.array(Pxx_fft)

# Garder la moitié positive
Pxx_fft = Pxx_fft[:N // 2 + 1]
Pxx_fft[1:-1] *= 2  # Corriger pour la symétrie (hors DC et Nyquist)
# [a(0),a(1),...,a(2*n-1)] -> [2*a(0),2*a(1),...,2*a(n-1),a(n) ]

# Fréquences associées
# f_fft = np.fft.fftfreq(N, 1 / fs)[:N // 2 + 1]
f_fft = np.array(list(map(lambda x:x*(fs/N),range(N//2+1))))

# ================================
# 3. Affichage
# ================================
plt.figure(figsize=(10, 5))
plt.semilogy(f_welch, Pxx_welch, label='Welch (scipy.signal.welch)', linewidth=2)
plt.semilogy(f_fft, Pxx_fft, '--', label='FFT manuelle (hann)', linewidth=2)

plt.xlabel("Fréquence (Hz)")
plt.ylabel("DSP (V²/Hz)")
plt.title("Comparaison Welch vs FFT (fenêtre Hann)")
plt.grid(True, which='both')
plt.legend()
plt.tight_layout()
plt.show()
