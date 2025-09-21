#!/usr/bin/env python3
"""
Pour comprendre comment ça marche.
Partant du fichier avec l'entete ci dessous, je le réecris à ma manière.
J'ouvre le comport  = "/dev/ttyUSB0" car je sais que dans cas ici c'est ca et id (aka target) = 4
ça me rend un handle que j'utilise pour des read et write en utilisant dacdoc.pdf

"""

"""
Author: Trenz Electronic GmbH / Kilian Jahn 27.09.2019 - edited 25.02.2020
Edited within the Python version:   3.7.3

This module is part of the example on using the ADC of the Trenz modules TEI0015,
TEI0016 and TEI023.
Further explonations are available in the Trenz Electronic wiki.
"""

import serial  # Serial/Comport connection
import numpy as np # FFT window function generating data
import serial.tools.list_ports
import sys

#*********************************************************************************
#                               EN AVANT SIMONE
#*********************************************************************************
comport = "/dev/ttyUSB0"
n = int(input("il y aura n * 2**14 points, n<=2**6. Entrez n=1 ou 2 ... ou 64 "))
cmd = input("t= normal, x=12345...12345, y= nombre croissant de 0 1M-1. Enntrez t/x/y  ")
SIGNED = int(input("Entrez 0 si NON SIGNE, !0 sinon "))
f = open(f"tmp_{n}_{cmd}_{SIGNED}","w")
f.writelines(f"# using {n=} {cmd=} { SIGNED=}\n")
try:
    handleComport = serial.Serial(comport, 115200)
    handleComport.reset_output_buffer()
    handleComport.write(bytearray(str(cmd),'utf8'))
    # handleComport.close()
except:
    print("Error send command")
    exit(0)
    nMax = (1024*1024)//(16*1024) # nb max de lecture de 16k 
    adcByteListAll = 0
    handleComport.reset_output_buffer()
    f.writelines("# value string (from cli)\n");
for i in range(n): 
    adcSamples = 16384 # 2**14 au plis on lira 2**6 * 2**14 = 2**20 = 1M
    handleComport.reset_input_buffer()
    handleComport.write(bytearray("*",'utf8')) # Read 16384 adc values 
    adcByteList = handleComport.read(5*adcSamples)
    for i in range(0,5*adcSamples,5):
        ss=adcByteList[i:i+5]
        v= int(ss,16)
        if SIGNED:
            if v > 131071:
                v -=  262142
        f.writelines(f"{v} {ss} \n")
print(f.name+" closed")
f.close()
