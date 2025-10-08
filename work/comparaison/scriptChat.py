# welch_python.py
import numpy as np
from scipy.signal import welch

# Paramètres
fs = 1000          # fréquence d'échantillonnage
nperseg = 256
noverlap = 128

# Lecture du signal
signal = np.loadtxt("signal.txt")

# Calcul PSD avec Welch
freqs, Pxx = welch(signal, fs=fs, nperseg=nperseg, noverlap=noverlap)

# Affichage
for f, p in zip(freqs, Pxx):
    print(f"{f:.6f}, {p:.6e}")
