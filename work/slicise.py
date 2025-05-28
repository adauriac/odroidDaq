#!/usr/bin/env python3
import os,sys,subprocess
from sys import exit,argv
from os import popen,system
sys.path.append("/home/dauriac/lib")
def w(x):sys.stdout.writelines(x)

#import jc2 as jc
import numpy as np
import matplotlib.pyplot as plt
from math import log

def grouper_par_proximite(T, epsilon):
    T = np.asarray(T)
    groupes = []
    groupe_courant = [T[0]]
    for t in T[1:]:
        if t - groupe_courant[0] <= epsilon:
            groupe_courant.append(t)
        else:
            groupes.append(np.array(groupe_courant))
            groupe_courant = [t]
    groupes.append(np.array(groupe_courant))  # dernier groupe
    return groupes

def slices_groupes_par_proximite(T, epsilon):
    T = np.asarray(T)
    slices = []
    start = 0
    for i in range(1, len(T)):
        if T[i] - T[start] > epsilon:
            slices.append(slice(start, i))
            start = i
    slices.append(slice(start, len(T)))  # dernier groupe
    return slices

filename = "tst512"
lines = open(filename).readlines()
lines = lines[1:]
X = np.array(list(map(lambda x:float(x.split()[0]),lines)))
Y = np.array(list(map(lambda x:float(x.split()[1]),lines)))
lX = np.log(X)
lY = np.log(Y)
lxi = lX[0]
lxa = lX[-1]

N = 1024*2
d = (lxa-lxi)/N
slices = slices_groupes_par_proximite(lX, d)
XX = []
YY = []
for slice in slices:
    x = lX[slice]
    y = lY[slice]
    if len(x)==1:
        XX.append(x[0])
        YY.append(y[0])
    else:
        XX.append(x.mean())
        YY.append(y.min())
        XX.append(x.mean())
        YY.append(y.max())

f = open(filename+"slice","w")
for i in range(len(XX)):
    f.writelines("%lf %lf\n"%(XX[i],YY[i]))
print(f.name+" fermee")
f.close()

