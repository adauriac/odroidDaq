import numpy as np

# Paramètres
fs = 1000       # fréquence d'échantillonnage (Hz)
T = 1.0         # durée du signal en secondes
T=1000
N = int(fs * T) # nombre d'échantillons

t = np.linspace(0, T, N, endpoint=False)

# --- Signal avec deux maxima ---
# Option 1 : somme de deux sinusoïdes
f1 = 50  # Hz
f2 = 120 # Hz
signal = np.sin(2 * np.pi * f1 * t) + 0.8 * np.sin(2 * np.pi * f2 * t)

# Option 2 : si vous préférez deux pics gaussiens dans le temps
# peak1 = np.exp(-((t-0.3)**2)/(2*0.01**2))
# peak2 = np.exp(-((t-0.7)**2)/(2*0.01**2))
# signal = peak1 + peak2

# --- Normalisation optionnelle ---
signal /= np.max(np.abs(signal))

# --- Sauvegarde dans signal.txt ---
np.savetxt("signal.txt", signal, fmt="%.6f")
print("signal.txt créé avec", N, "échantillons")
