import numpy as np
from scipy.fft import fft
"""
pour comparer python et js : cmpPyJs.js
On calcule la fft simple de python, et on fera de meme dans cmpPyJs.js
On donne le signal comme une formule 
Sort sur stdout i s[i] Re(fft(i)) Im(fft(i] abs(fft[i])
"""
# Paramètres du signal
fs = 1024                # Fréquence d'échantillonnage en Hz
T = 1.0                  # Durée en secondes
N = int(T * fs)          # Nombre d'échantillons
t = np.linspace(0, T, N, endpoint=False)

# Signal : sinus de 100 Hz + un peu de bruit
signal = np.sin(2 * np.pi * 100 * t) 

# FFT du signal
X = fft(signal)

# Calcul de la densité spectrale de puissance (DSP)
for i in range(N):
    print(f"{i} {signal[i]} {X[i].real} {X[i].imag} {np.sqrt(abs(X[i]))}")
