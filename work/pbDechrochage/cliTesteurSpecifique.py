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

def dataConvertTEI0023(adcByteList, adcSamples, adcSignalVolt, adcSignalFloatNormalized, adcSignedInteger):
    for adcSingleValue in range(0, adcSamples):
        adcSingleValue = ((adcSingleValue)*5) # 5 nibble = 20 > 18 bit
        # ADC resolution is 18bit, positive values reach from 0 to 131071, 
        # negatives values from 131072 to 262142        
        adcIntRaw = int(adcByteList[adcSingleValue:adcSingleValue+5], 16)
        if False: # NOT SIGNED, for SIGNED use True
            if adcIntRaw > 131071:
                adcIntRaw = int(adcIntRaw - 262142)
        adcSignalVolt.append(float(adcIntRaw)*(2*5.0*1/0.45)/262142) # (2*Vref*ADCgain) / 2*maxInt 149
        adcSignalFloatNormalized.append(adcIntRaw/131071)
        adcSignedInteger.append(adcIntRaw)
        
 
#*********************************************************************************
#                               EN AVANT SIMONE
#*********************************************************************************
comport = "/dev/ttyUSB0"
n=1
# print(f"{n=}")
cmd="t"
# print(f"{cmd=}")

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
adcSignalVoltAll  = []
adcSignedIntegerAll = []
handleComport.reset_output_buffer()
print("# value string (from cli)");
for i in range(n): #64): # 2**6
    adcSamples = 16384 # 2**14
    # donc on lira 2**6 * 2**14 = 2**20 = 1M
    adcSignalVolt = []    
    adcSignalFloatNormalized = []
    adcSignedInteger = []
    handleComport.reset_input_buffer()
    handleComport.write(bytearray("*",'utf8')) # Read 16384 adc values 
    adcByteList = handleComport.read(5*adcSamples)
    for i in range(0,5*adcSamples,5):
        ss=adcByteList[i:i+5]
        v= int(ss,16)
        print(v,ss)
    print("# value string (from cli)")
