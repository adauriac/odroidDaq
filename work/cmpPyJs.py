#!/usr/bin/env python3
import numpy as np
import sys
from scipy import fft
from scipy import signal
"""
pour comparer python et js : cmpPyJs.js
On calcule la fft simple de python, et on fera de meme dans cmpPyJs.js
On donne le signal comme une formule 
Sort sur stdout i s[i] Re(fft(i)) Im(fft(i] abs(fft[i])
"""
# Paramètres du signal

if len(sys.argv) < 2:
    print("syntax: node cmpPyJs.js f/w     (pour welch ou fft)")
    exit(0)
if sys.argv[1]!='f' and sys.argv[1]!='w':
    print("syntax: node cmpPyJs.js f/w     (pour welch ou fft)")
    exit(0)

lines = open("tmp").readlines()
data = np.array(list(map(float,lines)))
N = len(data)
if sys.argv[1]=='f':
    # FFT du signal
    X = fft(data)
    # Calcul de la densité spectrale de puissance (DSP)
    for i in range(N):
        print(f"{i} {data[i]} {X[i].real} {X[i].imag}")# {np.sqrt(abs(X[i]))}")
else:
    nbperseg = len(data)
    freqSampling = 10
    f, P = signal.welch(data,
                        freqSampling,
                        'hann',
                        nperseg=nbperseg,
                        scaling='density')
    assert len(f)==len(P)
    print(f"# welch en python {freqSampling=}")
    for i in range(len(P)):
        print(i,f[i],P[i])
    exit(0)

        
