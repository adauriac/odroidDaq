
import numpy as np
import time
from scipy import signal
import getopt,sys
import json

#json encoder for numpy types
class NumpyArrayEncoder(json.JSONEncoder):
    def default(self, obj):        
        if isinstance(obj, np.integer):
            return int(obj)
        elif isinstance(obj, np.floating):
            return float(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        return json.JSONEncoder.default(self, obj)
        
# FFT en nV/Hz
# fft3.py
# on fait 2 ffts successives :
# - une avec la segmentation demandée
#- l'autre sans segmentation 
# puis on asemble les resultats

# Read data (signal temporel) from the Writable Stream
def read_in():
    lines = sys.stdin.readlines()
    return json.loads(lines[0])


def main():
    # Remove 1st argument from the
    # list of command line arguments
    # on doit passer fs(freq echantillons) et seg(segmentation) en arguments
    argumentList = sys.argv[1:]
    
    # Options
    options = "f:s:m:d:"
    try:
        # Parsing argument
        arguments, values = getopt.getopt(argumentList, options)   
        sys.stderr.write('\nPY:args = ' + str(arguments) + str(values))
        # checking each argument
        for currentArgument, currentValue in arguments:
            if currentArgument in ['-f']:
                # frequence echantillonage
                fs = int(currentValue  )
            elif currentArgument in ['-s']:
                # nbre d'echantillons
                samples = int(currentValue)
            elif currentArgument in ['-m']:
                # segmentation
                seg = int(currentValue)
            elif currentArgument in ['-d']:
                # 2 ffts
                dbl = int(currentValue)
                
    except getopt.error as err:
        # output error, and return with an error code
        exit (0) 

      # Store the data as an array in 'data_input'
    data_input = read_in()

    #conversion en tableau de float
    data=[]
    for d in data_input.values():
        data.append(float(d))
    sys.stderr.write('\nPY:fft3  fs =' + str(fs) + ' seg=' +str(seg) +' N='+ str(len(data))+'\n')
    
    # FFT
    # avec seg =1
    nbperseg = samples * 1024 
    # segmentation p  seg=N//p
    #boxcar, triang, blackman, hamming, hann, bartlett, flattop, parzen, bohman, blackmanharris, nuttall, barthann
    f1, P1xx_den = signal.welch(data, fs, 'hann',nperseg=nbperseg, scaling='density')
    sys.stderr.write("PY: commande lancee : signal.welch(data, fs, 'hann',nperseg=nbperseg, scaling='density') ")
    sys.stderr.write("avec fs=%d nbperseg=%d len(data)=%d\n"%(fs,nbperseg,len(data)))
# f, Pxx sont des ndarray
    sys.stderr.write('\nPY:computed..' + str(f1.size))
    fmin = 0

    if ((seg != 1) ): #and (dbl==1) ) : 
        fmin = f1[1] #plus petite valeur de f non nulle
        sys.stderr.write('\nPY:fmin = ' + str(fmin) + str(f1[0]))
        # on refait une FFT avec seg = N   
        sys.stderr.write('\nPY:fft3  fs =' + str(fs) + ' seg=1 N='+ str(len(data))+'\n')
    
        nbperseg = samples * 1024/seg
        f2, P2xx_den = signal.welch(data, fs, 'hann',nperseg=nbperseg, scaling='density')
        sys.stderr.write("PY: commande Relancee (seg>1) : signal.welch(data, fs, 'hann',nperseg=nbperseg, scaling='density') ")
        sys.stderr.write("avec fs=%d nbperseg=%d len(data)=%d\n"%(fs,nbperseg,len(data)))
        ## on ne garde les valeurs que jusqu'à f =fmin
      
        sys.stderr.write('\nPY: f2 size = ' + str(f2.size))
        # i=0
        # while ( (i!= f2.size) and (f2[i]<fmin) ) :
        #     i = i+1
        # indexfmin= i
        # sys.stderr.write('\nPY:index fmin = ' + str(indexfmin)+ ' f2 size=' + str(f2.size)) 
        # #concatene f2[0: fmin] avec f[fmin:]
        # fout = np.concatenate( (f2[0:indexfmin],f[1:]))
        # Pout = np.concatenate( (np.sqrt(P2xx_den[0:indexfmin]),np.sqrt(Pxx_den[1:])) )
        # return de junction frequency  between 2 ffts
       # sys.stdout.write(json.dumps( {'f0': fmin} ) )    
    else :
        f2 =0; P2xx_den=0
        
    fout =f1
    Pout = np.sqrt(P1xx_den)
    # f et Pxx de type <ndarray>
    sys.stderr.write('\nPY:computed..' + str(f1.size))

     # Return the fft
    numpyData = {'fft_x1': fout , "fft_y1": Pout, 'f0': fmin ,'fft_x2': f2 , "fft_y2": np.sqrt(P2xx_den) }
    sys.stdout.write(json.dumps(numpyData,  cls=NumpyArrayEncoder) )

    sys.stderr.write('\nPY:done')
    return fmin

# Start the process
if __name__ == '__main__':
   exit ( main())
