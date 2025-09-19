#!/usr/bin/env python
import os,sys,subprocess
from sys import exit,argv
from os import popen,system
def w(x):sys.stdout.writelines(x)
"""
lit le fichier cree par le server (server) qui log les data brutes dans la versions specifiques
de app.js
"""

lines = open(sys.argv[1]).readlines()
out = ""
k=1
for l in lines:
    if l[0]!="@":
        continue
    out += l.split()[1].replace("\n","")
    out += "\n" if k%5==0 else " "
    # print(l.split()[1],end= "\n" if k%5==0 else " ")
    k+=1
out = out.split("\n")
out = out[:-1]
print("# valeur chaine_lue (from server)")
for k,v in enumerate(out):
    codes=v.split()
    hex_str = ''.join(chr(int(c)) for c in codes)
    nombre = int(hex_str, 16)
    print("%d %s"%(nombre,hex_str))
print("# valeur chaine_lue (from server)")
