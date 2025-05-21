import numpy as np
import sys
from scipy import fft
"""
pour comparer python et js : cmpPyJs.js
On calcule la fft simple de python, et on fera de meme dans cmpPyJs.js
On donne le signal comme une formule 
Sort sur stdout i s[i] Re(fft(i)) Im(fft(i] abs(fft[i])
"""
# Paramètres du signal

if len(sys.argv) != 2:
    print("syntax: node cmpPyJs.js f/w     (pour welch ou fft)")
    exit(0)
if sys.argv[1]!='f' and sys.argv[1]!='w':
    print("syntax: node cmpPyJs.js f/w     (pour welch ou fft)")
    exit(0)

lines = open("tmp").readlines()
signal = np.array(list(map(float,lines)))
N = len(signal)
if sys.argv[1]=='f':
    # FFT du signal
    X = fft(signal)
    # Calcul de la densité spectrale de puissance (DSP)
    for i in range(N):
        print(f"{i} {signal[i]} {X[i].real} {X[i].imag}")# {np.sqrt(abs(X[i]))}")
else:
    print("in progress")
    exit(0)

        
