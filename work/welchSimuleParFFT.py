import numpy as np
import matplotlib.pyplot as plt
from scipy.signal import welch, get_window
from scipy.fft import fft

# Paramètres du signal
fs = 1000                # Fréquence d'échantillonnage en Hz
T = 1.0                  # Durée en secondes
N = int(T * fs)          # Nombre d'échantillons
t = np.linspace(0, T, N, endpoint=False)

# Signal : sinus de 100 Hz + un peu de bruit
signal = np.sin(2 * np.pi * 100 * t) + 0.1 * np.random.randn(N)

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
signal_win = signal * window

# Calcul du facteur de normalisation U (moyenne de l'énergie de la fenêtre)
U = (1 / N) * np.sum(window**2)

# FFT du signal fenêtré
X = fft(signal_win)

# Calcul de la densité spectrale de puissance (DSP)
Pxx_fft = (1 / (fs * N * U)) * np.abs(X)**2

# Garder la moitié positive
Pxx_fft = Pxx_fft[:N // 2 + 1]
Pxx_fft[1:-1] *= 2  # Corriger pour la symétrie (hors DC et Nyquist)

# Fréquences associées
# f_fft = np.fft.fftfreq(N, 1 / fs)[:N // 2 + 1]
f_fft = np.fft.rfftfreq(N, 1 / fs)
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
